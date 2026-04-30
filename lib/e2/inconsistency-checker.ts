/**
 * Cross-document inconsistency checker — human + company identity dimension.
 *
 * The aggregator already ships a battery of amount / financial drift gates
 * (investment_amount_drift, fx_rate_drift, tax_balance_sheet_drift,
 * pl_tax_net_income_drift, board_resolution_amount_drift,
 * real_estate_buyer_mismatch, incentive_recipient_mismatch,
 * naics_industry_drift, entity_name_drift, cv_title_vs_offer_drift). This
 * module adds the ORTHOGONAL set: identity coherence across documents.
 *
 *   beneficiary_name_drift   — passport / I-94 / visa / status_doc /
 *                              cover_letter / I-129+DS-160 names disagree
 *   beneficiary_dob_drift    — DOB on passport / I-94 / visa stamp differ
 *   passport_number_drift    — passport_number across same-period docs
 *                              disagree (multiple active passports = ok,
 *                              single doc claiming two = not ok)
 *   ein_drift                — EIN across formation / tax / forms differ
 *                              (severity 5 — EIN is unique per entity)
 *   enterprise_address_drift — physical address differs across formation /
 *                              lease / I-129 / business plan
 *   formation_date_drift     — formation date drifts > 30 days across
 *                              articles / good-standing / EIN cert / SS-4
 *   i94_number_drift         — I-94 admission # differs across i94 + status
 *
 * NOTE on entity vs beneficiary: existing `entity_name_drift` covers the
 * COMPANY name. `beneficiary_name_drift` here covers the PERSON name. The
 * two never collide — different doc surfaces (passport.full_name vs
 * formation_doc.entity_legal_name) and different conflict_type literals.
 *
 * Pure / deterministic. No Anthropic calls. Idempotent: callers dedupe by
 * (conflict_type, fact_a_doc, fact_b_doc).
 */

import type { TypedMemory } from '@/ingest/typed-memory';
import type { E2Facts } from '@/ingest/schema';
import type { ConflictEntryT } from '@/lib/e2/applicant-inference';

/* ---------------------------------------------------------------------- */
/* Public API                                                             */
/* ---------------------------------------------------------------------- */

export interface InconsistencyResult {
  conflicts: ConflictEntryT[];
}

export function checkCrossDocumentInconsistencies(
  memory: TypedMemory,
  _caseFacts: E2Facts,
): InconsistencyResult {
  // _caseFacts is reserved for future expansion (e.g., comparing
  // aggregator-decided values against memory). Today every check reads
  // from the typed memory directly so the result is reproducible without
  // running the aggregator first.
  void _caseFacts;
  const conflicts: ConflictEntryT[] = [
    ...checkBeneficiaryNameConsistency(memory),
    ...checkBeneficiaryDobConsistency(memory),
    ...checkPassportNumberConsistency(memory),
    ...checkEinConsistency(memory),
    ...checkEnterpriseAddressConsistency(memory),
    ...checkFormationDateConsistency(memory),
    ...checkI94NumberConsistency(memory),
  ];
  return { conflicts: dedupeConflicts(conflicts) };
}

/* ---------------------------------------------------------------------- */
/* Shared helpers                                                          */
/* ---------------------------------------------------------------------- */

const SOURCE_QUOTE = '[deterministic cross-document inconsistency check]';

interface Observation {
  filename: string;
  source_field: string;
  raw_value: string;
  source_page: number | null;
  source_quote: string | null;
}

interface Group<T extends Observation> {
  /** Normalized representative key. */
  key: string;
  members: T[];
}

function nullField<T>(): {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
} {
  return { value: null, source_page: null, source_quote: null, confidence: null };
}

function unwrap<T>(
  field: { value: T | null; source_page: number | null; source_quote: string | null } | null | undefined,
): { value: T | null; source_page: number | null; source_quote: string | null } {
  if (!field) return { value: null, source_page: null, source_quote: null };
  return {
    value: field.value ?? null,
    source_page: field.source_page ?? null,
    source_quote: field.source_quote ?? null,
  };
}

function nonEmpty(s: string | null | undefined): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

/**
 * Group observations by their normalized key. Returns the groups sorted
 * by member count desc — group[0] is the majority cluster.
 */
function groupByKey<T extends Observation>(
  obs: T[],
  normalize: (raw: string) => string | null,
): Group<T>[] {
  const buckets = new Map<string, T[]>();
  for (const o of obs) {
    const key = normalize(o.raw_value);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(o);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries())
    .map(([key, members]) => ({ key, members }))
    .sort((a, b) => b.members.length - a.members.length);
}

/**
 * Pairwise outlier-vs-majority conflict generation. For groups [G0, G1,
 * G2…] (sorted by size desc), emit one conflict per outlier group with
 * fact_a = first member of outlier, fact_b = first member of majority.
 * When 2 groups tie at 1 each ("1-1 split") we still emit one conflict
 * with the iteration order that buckets produced (deterministic for the
 * same input).
 */
function emitOutlierConflicts(
  groups: Group<Observation>[],
  conflictType: string,
  severity: number,
  describe: (majority: Group<Observation>, outlier: Group<Observation>) => string,
): ConflictEntryT[] {
  if (groups.length < 2) return [];
  const out: ConflictEntryT[] = [];
  const majority = groups[0];
  const majorityRep = majority.members[0];
  for (let i = 1; i < groups.length; i++) {
    const outlier = groups[i];
    const outlierRep = outlier.members[0];
    out.push({
      description: {
        value: describe(majority, outlier),
        source_page: null,
        source_quote: SOURCE_QUOTE,
        confidence: 1,
      },
      conflict_type: {
        value: conflictType,
        source_page: null,
        source_quote: SOURCE_QUOTE,
        confidence: 1,
      },
      severity: {
        value: severity,
        source_page: null,
        source_quote: SOURCE_QUOTE,
        confidence: 1,
      },
      fact_a_doc: {
        value: outlierRep.filename,
        source_page: outlierRep.source_page,
        source_quote: outlierRep.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: outlierRep.source_page,
        source_page: outlierRep.source_page,
        source_quote: outlierRep.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: majorityRep.filename,
        source_page: majorityRep.source_page,
        source_quote: majorityRep.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: majorityRep.source_page,
        source_page: majorityRep.source_page,
        source_quote: majorityRep.source_quote,
        confidence: 1,
      },
    });
  }
  return out;
}

function dedupeConflicts(conflicts: ConflictEntryT[]): ConflictEntryT[] {
  const seen = new Set<string>();
  const out: ConflictEntryT[] = [];
  for (const c of conflicts) {
    const key = `${c.conflict_type.value ?? ''}|${c.fact_a_doc.value ?? ''}|${c.fact_b_doc.value ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function* iterMemoryEntries(memory: TypedMemory) {
  for (const list of Object.values(memory)) {
    if (!list) continue;
    for (const entry of list) yield entry;
  }
}

/* ---------------------------------------------------------------------- */
/* 1. Beneficiary name consistency                                         */
/* ---------------------------------------------------------------------- */

/**
 * Person-name normalizer: NFD-fold (strip combining marks), uppercase,
 * collapse whitespace, drop honorifics + comma reorderings ("Smith, John
 * A." → "JOHN A SMITH"). Different from `foldEntityName`, which strips
 * corporate suffixes.
 */
function normalizePersonName(raw: string): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  const folded = t
    .normalize('NFD')
    // Strip combining diacritics.
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
  // Handle "LASTNAME, FIRSTNAME MIDDLE" reorder.
  const reordered = folded.includes(',')
    ? (() => {
        const parts = folded.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
        return folded.replace(/,/g, ' ');
      })()
    : folded;
  // Strip Turkish-specific overlays the NFD pass missed (ş → S, ı → I).
  const tr = reordered
    .replace(/Ş/g, 'S')
    .replace(/Ç/g, 'C')
    .replace(/Ğ/g, 'G')
    .replace(/İ/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U')
    .replace(/I/g, 'I'); // dotless I noop after the above
  // Strip honorifics anywhere.
  const noHonorifics = tr.replace(
    /\b(MR|MRS|MS|MISS|DR|PROF|HON|SIR|MADAM|MME|MLLE)\.?\b/g,
    '',
  );
  // Strip punctuation that's not alphanumeric or space.
  const cleaned = noHonorifics.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length === 0 ? null : cleaned;
}

export function checkBeneficiaryNameConsistency(memory: TypedMemory): ConflictEntryT[] {
  const obs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;

    // 1a — passport rich (preferred for ASCII).
    if (entry.passport) {
      const ascii = unwrap(entry.passport.full_name_ascii);
      const native = unwrap(entry.passport.full_name_native);
      const pick = ascii.value ?? native.value;
      if (pick) {
        obs.push({
          filename: entry.filename,
          source_field: 'passport.full_name',
          raw_value: pick,
          source_page: ascii.value ? ascii.source_page : native.source_page,
          source_quote: ascii.value ? ascii.source_quote : native.source_quote,
        });
        continue;
      }
    }

    // 1b — i94 rich.
    if (entry.i94) {
      const f = unwrap(entry.i94.full_name_ascii);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'i94.full_name_ascii',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
        continue;
      }
    }

    // 1c — visa stamp rich.
    if (entry.visaStamp) {
      const f = unwrap(entry.visaStamp.holder_name_ascii);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'visaStamp.holder_name_ascii',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
        continue;
      }
    }

    if (!facts) continue;

    // 1d — thin passport / status_doc / i94 fall-throughs (no rich
    // extraction landed). This is the typical path for legacy fixtures.
    if (facts.doc_type === 'passport') {
      const f = unwrap(facts.full_name);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'passport.full_name',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }

    if (facts.doc_type === 'status_doc') {
      const f = unwrap(facts.full_name);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'status_doc.full_name',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }

    if (facts.doc_type === 'i94') {
      const f = unwrap(facts.full_name);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'i94.full_name',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }

    // 1e — uscis_or_dos_form (I-129, DS-160, etc.) beneficiary_name.
    if (facts.doc_type === 'uscis_or_dos_form') {
      const f = unwrap(facts.beneficiary_name);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: `uscis_or_dos_form.beneficiary_name(${
            unwrap(facts.form_id).value ?? '?'
          })`,
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }

    // 1f — cover_letter rich principal_treaty_investor_identity
    // (Subtype-3/4 identity declarative).
    if (facts.doc_type === 'cover_letter' && entry.coverLetter) {
      const f = unwrap(entry.coverLetter.principal_treaty_investor_identity);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'cover_letter.principal_treaty_investor_identity',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }
  }

  if (obs.length < 2) return [];
  const groups = groupByKey(obs, normalizePersonName);
  if (groups.length < 2) return [];
  return emitOutlierConflicts(
    groups,
    'beneficiary_name_drift',
    4,
    (maj, out) =>
      `Beneficiary name drift: "${out.members[0].raw_value}" (${out.members[0].filename}:${out.members[0].source_field}) disagrees with majority "${maj.members[0].raw_value}" (${maj.members[0].filename}). All identity documents must agree on the same legal name (8 CFR §214.2(e); 9 FAM 402.9-7).`,
  );
}

/* ---------------------------------------------------------------------- */
/* 2. Beneficiary DOB consistency                                          */
/* ---------------------------------------------------------------------- */

/** Normalize a DOB to ISO YYYY-MM-DD when possible. Returns null on garbage. */
function normalizeIsoDate(raw: string): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  // Already ISO-ish?
  const isoMatch = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const mo = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  // DD/MM/YYYY or MM/DD/YYYY — ambiguous; trust DD MMM YYYY first, then
  // fall back to a Date.parse round-trip. Both passport and I-94 print
  // DD MMM YYYY ("12 JAN 1985") so we hit that first.
  const monthMap: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };
  const ddMmmMatch = t.toUpperCase().match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/);
  if (ddMmmMatch) {
    const d = ddMmmMatch[1].padStart(2, '0');
    const mo = monthMap[ddMmmMatch[2]];
    const y = ddMmmMatch[3];
    if (mo) return `${y}-${mo}-${d}`;
  }
  const slashMatch = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (slashMatch) {
    // Assume DD/MM/YYYY (Turkish + most non-US passports). USCIS forms
    // sometimes print MM/DD/YYYY — when the first group is > 12 we know
    // it's DD/MM, otherwise it's ambiguous. Conservative fallback:
    // produce both and let the comparator match either.
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    const y = slashMatch[3];
    if (a > 12) {
      return `${y}-${b.toString().padStart(2, '0')}-${a.toString().padStart(2, '0')}`;
    }
    if (b > 12) {
      return `${y}-${a.toString().padStart(2, '0')}-${b.toString().padStart(2, '0')}`;
    }
    // Truly ambiguous — emit DD/MM canonical (most likely on E-2 fixtures).
    return `${y}-${b.toString().padStart(2, '0')}-${a.toString().padStart(2, '0')}`;
  }
  // Date.parse last resort.
  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = parsed.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function checkBeneficiaryDobConsistency(memory: TypedMemory): ConflictEntryT[] {
  const obs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;

    if (entry.passport) {
      const f = unwrap(entry.passport.date_of_birth);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'passport.date_of_birth',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
        continue;
      }
    }
    if (facts?.doc_type === 'passport') {
      const f = unwrap(facts.dob);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'passport.dob',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }

    // visa stamp doesn't carry DOB; skip.
    // I-94 also doesn't carry DOB on the rich schema. Skip.

    if (facts?.doc_type === 'government_id') {
      // Government IDs (national ID, driver's license) carry DOB and
      // belong to the same person. Useful triangulation point.
      // The thin GovernmentIdFactsSchema doesn't have a dob field — issue_date is
      // close but wrong. Skip; we'll add government ID DOB if a rich
      // extractor surfaces it later.
    }
  }

  if (obs.length < 2) return [];
  const groups = groupByKey(obs, normalizeIsoDate);
  if (groups.length < 2) return [];
  return emitOutlierConflicts(
    groups,
    'beneficiary_dob_drift',
    4,
    (maj, out) =>
      `Beneficiary DOB drift: ${out.members[0].raw_value} (${out.members[0].filename}:${out.members[0].source_field}) disagrees with majority ${maj.members[0].raw_value} (${maj.members[0].filename}).`,
  );
}

/* ---------------------------------------------------------------------- */
/* 3. Passport number consistency                                          */
/* ---------------------------------------------------------------------- */

function normalizePassportNumber(raw: string): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  return t.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
}

export function checkPassportNumberConsistency(memory: TypedMemory): ConflictEntryT[] {
  // For each PDF, what passport number(s) does it cite? We consider:
  //   - passport doc itself (passport.passport_number / facts.passport_number)
  //   - i94 rich (no passport_number in i94.schema.ts — skip)
  //   - visa stamp rich (no passport_number on the visa stamp schema — skip)
  //
  // The rich schemas don't currently carry passport_number on i94 or
  // visa-stamp. We focus on detecting the realistic same-period failure:
  // multiple passport documents in the same case folder claiming
  // DIFFERENT numbers when they should be the SAME (one current passport
  // scanned twice, or a renewal where the prior+current passport are
  // both active). The expired-then-renewed pattern is legitimate; we
  // surface ALL distinct numbers and let the cover-letter footnote
  // (prior_passport_renewal_footnote) explain it. If the cover letter
  // lacks the footnote AND we see ≥ 2 passport numbers, flag it.
  const passportObs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;
    if (entry.passport) {
      const f = unwrap(entry.passport.passport_number);
      if (f.value) {
        passportObs.push({
          filename: entry.filename,
          source_field: 'passport.passport_number',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
        continue;
      }
    }
    if (facts?.doc_type === 'passport') {
      const f = unwrap(facts.passport_number);
      if (f.value) {
        passportObs.push({
          filename: entry.filename,
          source_field: 'passport.passport_number',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }
  }

  if (passportObs.length < 2) return [];
  const groups = groupByKey(passportObs, normalizePassportNumber);
  if (groups.length < 2) return [];

  // If the cover letter carries a prior_passport_renewal_footnote AND it
  // lists exactly the two passport numbers we see, the multi-passport
  // pattern is explained — no conflict. Otherwise flag it.
  const footnoteNumbers = collectRenewalFootnoteNumbers(memory);
  if (footnoteNumbers && groups.length === 2) {
    const seenSet = new Set(groups.map((g) => g.key));
    const footSet = new Set(
      footnoteNumbers.map((n) => normalizePassportNumber(n)).filter((s): s is string => !!s),
    );
    let allCovered = true;
    for (const k of seenSet) {
      if (!footSet.has(k)) {
        allCovered = false;
        break;
      }
    }
    if (allCovered) return [];
  }

  return emitOutlierConflicts(
    groups,
    'passport_number_drift',
    4,
    (maj, out) =>
      `Passport number drift: "${out.members[0].raw_value}" (${out.members[0].filename}) disagrees with majority "${maj.members[0].raw_value}" (${maj.members[0].filename}). If this is a renewal, the cover letter must carry a prior-passport explanatory footnote citing both numbers.`,
  );
}

function collectRenewalFootnoteNumbers(memory: TypedMemory): string[] | null {
  for (const entry of iterMemoryEntries(memory)) {
    const cl = entry.coverLetter;
    if (!cl) continue;
    const fn = cl.prior_passport_renewal_footnote;
    if (fn && fn.prior_passport_number && fn.current_passport_number) {
      return [fn.prior_passport_number, fn.current_passport_number];
    }
  }
  return null;
}

/* ---------------------------------------------------------------------- */
/* 4. EIN consistency                                                      */
/* ---------------------------------------------------------------------- */

/**
 * Normalize EIN to "XX-XXXXXXX" (canonical IRS format) when possible. The
 * tax-return rich extractor only stores ein_or_ssn_last4 — these go
 * through a side channel that compares the last-4 substring only.
 */
function normalizeFullEin(raw: string): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function einLast4(raw: string): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits.slice(-4);
}

export function checkEinConsistency(memory: TypedMemory): ConflictEntryT[] {
  // Group full-EIN observations first; if a tax-return last-4 contradicts
  // the majority full-EIN's last-4, log it as a separate conflict.
  const fullObs: Observation[] = [];
  const last4Obs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;

    // formation_doc thin facts.ein → full EIN.
    if (facts?.doc_type === 'formation_doc') {
      const f = unwrap(facts.ein);
      const norm = f.value ? normalizeFullEin(f.value) : null;
      if (norm) {
        fullObs.push({
          filename: entry.filename,
          source_field: 'formation_doc.ein',
          raw_value: f.value as string,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }

    // corporateFormation rich (EIN assignment letter only).
    const cf = entry.corporateFormation;
    if (cf && cf.formation_doc_subtype === 'ein_assignment_letter') {
      const f = unwrap(cf.ein_full);
      const norm = f.value ? normalizeFullEin(f.value) : null;
      if (norm) {
        fullObs.push({
          filename: entry.filename,
          source_field: 'corporateFormation.ein_full',
          raw_value: f.value as string,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }

    // tax-return rich → last-4 only.
    const tr = entry.taxReturn;
    if (tr && 'ein_or_ssn_last4' in tr) {
      const f = unwrap(
        (tr as { ein_or_ssn_last4?: { value: string | null; source_page: number | null; source_quote: string | null } })
          .ein_or_ssn_last4,
      );
      if (f.value) {
        last4Obs.push({
          filename: entry.filename,
          source_field: `taxReturn.${
            (tr as { tax_return_subtype?: string }).tax_return_subtype ?? 'unknown'
          }.ein_or_ssn_last4`,
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }
  }

  const conflicts: ConflictEntryT[] = [];

  // Full-EIN drift across formation/EIN-letter/forms.
  if (fullObs.length >= 2) {
    const groups = groupByKey(fullObs, normalizeFullEin);
    if (groups.length >= 2) {
      conflicts.push(
        ...emitOutlierConflicts(
          groups,
          'ein_drift',
          5,
          (maj, out) =>
            `EIN drift: "${out.members[0].raw_value}" (${out.members[0].filename}:${out.members[0].source_field}) disagrees with majority "${maj.members[0].raw_value}" (${maj.members[0].filename}). EIN is unique per legal entity (IRS); a mismatch indicates either a different entity or a transcription error that breaks the petitioner identity chain.`,
        ),
      );
    }
  }

  // Last-4 drift between tax-return last-4 and formation full-EIN last-4.
  if (fullObs.length >= 1 && last4Obs.length >= 1) {
    const fullLast4Groups = groupByKey(fullObs, (s) => einLast4(s));
    if (fullLast4Groups.length >= 1) {
      const majorityLast4 = fullLast4Groups[0].key;
      for (const tr of last4Obs) {
        const tl4 = einLast4(tr.raw_value);
        if (!tl4 || tl4 === majorityLast4) continue;
        const majRep = fullLast4Groups[0].members[0];
        conflicts.push({
          description: {
            value: `EIN drift (last-4): tax return cites "...${tl4}" (${tr.filename}:${tr.source_field}) but formation/EIN-letter majority shows last-4 "${majorityLast4}" (${majRep.filename}). Tax filings must use the same EIN as the IRS CP-575 / Articles.`,
            source_page: null,
            source_quote: SOURCE_QUOTE,
            confidence: 1,
          },
          conflict_type: {
            value: 'ein_drift',
            source_page: null,
            source_quote: SOURCE_QUOTE,
            confidence: 1,
          },
          severity: { value: 5, source_page: null, source_quote: SOURCE_QUOTE, confidence: 1 },
          fact_a_doc: {
            value: tr.filename,
            source_page: tr.source_page,
            source_quote: tr.source_quote,
            confidence: 1,
          },
          fact_a_page: {
            value: tr.source_page,
            source_page: tr.source_page,
            source_quote: tr.source_quote,
            confidence: 1,
          },
          fact_b_doc: {
            value: majRep.filename,
            source_page: majRep.source_page,
            source_quote: majRep.source_quote,
            confidence: 1,
          },
          fact_b_page: {
            value: majRep.source_page,
            source_page: majRep.source_page,
            source_quote: majRep.source_quote,
            confidence: 1,
          },
        });
      }
    }
  }

  return conflicts;
}

/* ---------------------------------------------------------------------- */
/* 5. Enterprise address consistency                                       */
/* ---------------------------------------------------------------------- */

interface AddressKey {
  zip: string | null;
  streetNumber: string | null;
}

/**
 * Loose address normalization. Conservative: only flag when EITHER
 *   - zip5 differs, OR
 *   - the leading street number differs.
 * Suite/unit/floor variations ("Suite 100" vs "Ste 100" vs "#100") are
 * IGNORED — too many legitimate variants to flag.
 */
function extractAddressKey(raw: string): AddressKey | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  // Zip — last 5-digit number sequence, optionally followed by -dddd.
  const zipMatch = t.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : null;
  // Leading street number — first integer at the start of a line / phrase.
  const streetMatch = t.match(/(?:^|[,\s])(\d{1,6})\s+[A-Za-z]/);
  const streetNumber = streetMatch ? streetMatch[1] : null;
  if (!zip && !streetNumber) return null;
  return { zip, streetNumber };
}

function addressKeyAsString(k: AddressKey): string {
  return `${k.zip ?? ''}|${k.streetNumber ?? ''}`;
}

export function checkEnterpriseAddressConsistency(memory: TypedMemory): ConflictEntryT[] {
  const obs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;

    // formation_doc thin → no address field; skip.
    // lease commercial via contract rich.
    const contract = entry.contract;
    if (contract && contract.contract_subtype === 'commercial_lease') {
      const f = unwrap(contract.premises_address);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'contract.commercial_lease.premises_address',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }
    // lease thin facts.address.
    if (facts?.doc_type === 'lease_or_property') {
      const f = unwrap(facts.address);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'lease_or_property.address',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }
    // I-129 thin schema doesn't have physical_address; the supplement
    // schema also lacks it. We rely on lease + a future I-129 enricher.
    // Skip silently — when we add the I-129 address field this gate
    // upgrades automatically.
  }

  if (obs.length < 2) return [];
  const groups = groupByKey(obs, (raw) => {
    const k = extractAddressKey(raw);
    return k ? addressKeyAsString(k) : null;
  });
  if (groups.length < 2) return [];
  return emitOutlierConflicts(
    groups,
    'enterprise_address_drift',
    3,
    (maj, out) =>
      `Enterprise address drift: "${out.members[0].raw_value}" (${out.members[0].filename}:${out.members[0].source_field}) disagrees on zip / street number with majority "${maj.members[0].raw_value}" (${maj.members[0].filename}). Suite / unit variations are ignored — only the zip and street number are compared.`,
  );
}

/* ---------------------------------------------------------------------- */
/* 6. Formation date consistency                                           */
/* ---------------------------------------------------------------------- */

const FORMATION_DATE_TOLERANCE_DAYS = 30;

function dateDiffDays(a: string, b: string): number | null {
  const ai = normalizeIsoDate(a);
  const bi = normalizeIsoDate(b);
  if (!ai || !bi) return null;
  const ad = new Date(`${ai}T00:00:00Z`).getTime();
  const bd = new Date(`${bi}T00:00:00Z`).getTime();
  if (!Number.isFinite(ad) || !Number.isFinite(bd)) return null;
  return Math.abs(ad - bd) / (1000 * 60 * 60 * 24);
}

export function checkFormationDateConsistency(memory: TypedMemory): ConflictEntryT[] {
  const obs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;

    // formation_doc thin: facts.formation_date.
    if (facts?.doc_type === 'formation_doc') {
      const f = unwrap(facts.formation_date);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'formation_doc.formation_date',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }

    // corporateFormation rich: filing_date_or_effective_date (articles)
    // or assigned_date (EIN letter) — the FIRST is the canonical formation
    // anchor. EIN issue_date is informative but typically lags formation
    // by hours-to-days; we include it because the firm tolerates ±30d.
    const cf = entry.corporateFormation;
    if (cf) {
      const filing = unwrap(cf.filing_date_or_effective_date);
      if (filing.value) {
        obs.push({
          filename: entry.filename,
          source_field: `corporateFormation.${cf.formation_doc_subtype}.filing_date_or_effective_date`,
          raw_value: filing.value,
          source_page: filing.source_page,
          source_quote: filing.source_quote,
        });
      }
      if (cf.formation_doc_subtype === 'ein_assignment_letter') {
        const assigned = unwrap(cf.assigned_date);
        if (assigned.value) {
          obs.push({
            filename: entry.filename,
            source_field: 'corporateFormation.ein_assignment_letter.assigned_date',
            raw_value: assigned.value,
            source_page: assigned.source_page,
            source_quote: assigned.source_quote,
          });
        }
      }
      if (cf.formation_doc_subtype === 'certificate_of_good_standing') {
        // Good standing certs print the "incorporated date" sometimes —
        // the schema currently surfaces issued_date, which is the cert
        // issuance date, not formation. Skip.
      }
    }

    // cover_letter rich operational_since_date: the firm's narrative
    // claim about when ops began. NOT the same as legal formation.
    // We deliberately exclude it from this gate to avoid false positives
    // (operational often lags formation by months).
  }

  if (obs.length < 2) return [];

  // Pairwise tolerance check via clustering: build groups where all
  // members are within 30 days of one anchor (first observation).
  // For simplicity we compute the canonical key as the ISO date and let
  // groupByKey bucket; then we collapse buckets within ±30d into one.
  const isoGroups = groupByKey(obs, normalizeIsoDate);
  if (isoGroups.length < 2) return [];

  // Merge ISO buckets that are within tolerance of the largest bucket.
  const majority = isoGroups[0];
  const majorityIso = majority.key;
  const drifters: Group<Observation>[] = [];
  for (let i = 1; i < isoGroups.length; i++) {
    const grp = isoGroups[i];
    const days = dateDiffDays(majorityIso, grp.key);
    if (days === null || days > FORMATION_DATE_TOLERANCE_DAYS) {
      drifters.push(grp);
    }
  }
  if (drifters.length === 0) return [];
  return emitOutlierConflicts(
    [majority, ...drifters],
    'formation_date_drift',
    3,
    (maj, out) =>
      `Formation date drift: ${out.members[0].raw_value} (${out.members[0].filename}:${out.members[0].source_field}) is more than ${FORMATION_DATE_TOLERANCE_DAYS} days off majority ${maj.members[0].raw_value} (${maj.members[0].filename}).`,
  );
}

/* ---------------------------------------------------------------------- */
/* 7. I-94 number consistency                                              */
/* ---------------------------------------------------------------------- */

function normalizeI94Number(raw: string): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  return t.replace(/\s+/g, '').toUpperCase() || null;
}

export function checkI94NumberConsistency(memory: TypedMemory): ConflictEntryT[] {
  const obs: Observation[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;
    if (entry.i94) {
      const f = unwrap(entry.i94.admission_number);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'i94.admission_number',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
        continue;
      }
    }
    if (facts?.doc_type === 'i94') {
      const f = unwrap(facts.admission_number);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'i94.admission_number',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
      continue;
    }
    if (facts?.doc_type === 'status_doc') {
      const f = unwrap(facts.i94_admission_number);
      if (f.value) {
        obs.push({
          filename: entry.filename,
          source_field: 'status_doc.i94_admission_number',
          raw_value: f.value,
          source_page: f.source_page,
          source_quote: f.source_quote,
        });
      }
    }
  }

  if (obs.length < 2) return [];
  const groups = groupByKey(obs, normalizeI94Number);
  if (groups.length < 2) return [];
  return emitOutlierConflicts(
    groups,
    'i94_number_drift',
    4,
    (maj, out) =>
      `I-94 admission number drift: "${out.members[0].raw_value}" (${out.members[0].filename}:${out.members[0].source_field}) disagrees with majority "${maj.members[0].raw_value}" (${maj.members[0].filename}).`,
  );
}

/* ---------------------------------------------------------------------- */
/* nullField — exported for callers that need a typed null Field<T>        */
/* ---------------------------------------------------------------------- */

export const NULL_FIELD = nullField;
