/**
 * EB-1A cross-document aggregator (Tier-1 / Tier-2 / Tier-3 only).
 *
 * Reads typed memory (PerPdfResult[] grouped by doc_type) and produces
 * an EB1AFactsSchema-shaped object. This pass is DETERMINISTIC — no
 * LLM aggregator call. The cross-document reasoning needed for the
 * (h)(3)(i)–(x) criteria gates will live in a per-criterion LLM pass
 * once we walk the criteria one by one (per spec discussion 2026-04-30).
 *
 * Tier coverage today:
 *   Tier 1 — beneficiary identity from passport + CV; filing_metadata
 *            populated with null defaults (manual fields).
 *   Tier 2 — education_history from CV.education[] (corroborated by
 *            credential extractor diploma variants); tenure_table from
 *            CV.roles[] (corroborated by service-record + recommendation
 *            letter date hints).
 *   Tier 3 — field_classification via the Haiku 4.5 classifier in
 *            ingest/extractors/field-of-endeavor.ts. The aggregator
 *            calls it iff classifyField=true.
 *
 * Tier-4+ (criteria, kazarian step 2, evidence_aps, conflict_register)
 * are returned as empty / stub arrays — the criteria-phase work fills
 * them in.
 */

import { defaultFilingMetadata } from '@/lib/eb1a';
import {
  EB1AFactsSchema,
  type EB1AFacts,
} from './schema';
import type { PerPdfResult, TypedMemory } from './typed-memory';
import type { CvFacts } from './extractors/cv.schema';
import type { PassportFactsRich } from './extractors/passport.schema';
import type { ServiceRecordFacts } from './extractors/service-record.schema';
import type { RecommendationLetterFacts } from './extractors/recommendation-letter.schema';
import type { CredentialFacts } from './extractors/credential.schema';
import type { I94Facts } from './extractors/i94.schema';
import type { VisaStampFacts } from './extractors/visa-stamp.schema';
import {
  classifyFieldOfEndeavor,
  type FieldOfEndeavorInput,
} from './extractors/field-of-endeavor';
import {
  synthesizeCaseTheory,
  type CaseTheoryInput,
} from './extractors/case-theory';
import type { CaseTheory } from './extractors/case-theory.schema';
import { synthesizeEb1aReasoning } from './extractors/eb1a-reasoning';
import {
  collectPassportCandidates,
  collectMarriageBindings,
  collectBirthBindings,
  collectNufusBindings,
} from './typed-aggregate';
import { inferDependentsFromFamilyDocs } from '@/lib/e2/dependent-inference';

/* ---------------------------------------------------------------------- */
/* Field<T> helpers                                                        */
/* ---------------------------------------------------------------------- */

type FieldShape<T> = {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
};

const nullField = <T,>(): FieldShape<T> => ({
  value: null,
  source_page: null,
  source_quote: null,
  confidence: null,
});

const lift = <T,>(
  value: T | null | undefined,
  filename: string,
  confidence = 0.9,
): FieldShape<T> => {
  if (value === null || value === undefined) return nullField<T>();
  return {
    value,
    source_page: null,
    source_quote: `[derived from ${filename}]`,
    confidence,
  };
};

/**
 * Pull a Field-wrapped value out of an extractor result. Extractor
 * fields already carry provenance — we keep that provenance verbatim.
 */
const passthrough = <T,>(
  field:
    | {
        value: T | null;
        source_page: number | null;
        source_quote: string | null;
        confidence: number | null;
      }
    | null
    | undefined,
): FieldShape<T> => {
  if (!field) return nullField<T>();
  return { ...field };
};

/* ---------------------------------------------------------------------- */
/* Memory iteration                                                        */
/* ---------------------------------------------------------------------- */

function* iterMemory(memory: TypedMemory): Generator<PerPdfResult> {
  for (const docType of Object.keys(memory) as Array<keyof TypedMemory>) {
    const entries = memory[docType];
    if (!entries) continue;
    yield* entries;
  }
}

function firstPassport(memory: TypedMemory): { p: PassportFactsRich; filename: string } | null {
  for (const entry of iterMemory(memory)) {
    if (entry.passport) return { p: entry.passport, filename: entry.filename };
  }
  return null;
}

function firstCv(memory: TypedMemory): { cv: CvFacts; filename: string } | null {
  for (const entry of iterMemory(memory)) {
    if (entry.cv) return { cv: entry.cv, filename: entry.filename };
  }
  return null;
}

function firstI94(memory: TypedMemory): { i: I94Facts; filename: string } | null {
  for (const entry of iterMemory(memory)) {
    if (entry.i94) return { i: entry.i94, filename: entry.filename };
  }
  return null;
}

function firstVisaStamp(
  memory: TypedMemory,
): { v: VisaStampFacts; filename: string } | null {
  for (const entry of iterMemory(memory)) {
    if (entry.visaStamp) return { v: entry.visaStamp, filename: entry.filename };
  }
  return null;
}

function allDiplomas(
  memory: TypedMemory,
): Array<{ d: Extract<CredentialFacts, { credential_subtype: 'diploma' }>; filename: string }> {
  const out: Array<{
    d: Extract<CredentialFacts, { credential_subtype: 'diploma' }>;
    filename: string;
  }> = [];
  for (const entry of iterMemory(memory)) {
    const c = entry.credential;
    if (c && c.credential_subtype === 'diploma') {
      out.push({ d: c, filename: entry.filename });
    }
  }
  return out;
}

function allServiceRecords(
  memory: TypedMemory,
): Array<{ s: ServiceRecordFacts; filename: string }> {
  const out: Array<{ s: ServiceRecordFacts; filename: string }> = [];
  for (const entry of iterMemory(memory)) {
    if (entry.serviceRecord) out.push({ s: entry.serviceRecord, filename: entry.filename });
  }
  return out;
}

function allRecommendationLetters(
  memory: TypedMemory,
): Array<{ r: RecommendationLetterFacts; filename: string }> {
  const out: Array<{ r: RecommendationLetterFacts; filename: string }> = [];
  for (const entry of iterMemory(memory)) {
    if (entry.recommendationLetter) {
      out.push({ r: entry.recommendationLetter, filename: entry.filename });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------- */
/* Tenure-type inference                                                   */
/* ---------------------------------------------------------------------- */

type TenureTypeValue =
  | 'employment'
  | 'phd_program'
  | 'postdoc'
  | 'fellowship'
  | 'visiting_appointment'
  | 'consulting'
  | 'board_or_advisory'
  | 'other';

const ACADEMIC_EMPLOYER_HINTS = [
  'university',
  'college',
  'institute of technology',
  'school of medicine',
  'üniversite',
  'universität',
  'università',
];

function inferTenureType(title: string | null, employer: string | null): TenureTypeValue {
  const t = (title ?? '').toLowerCase();
  const e = (employer ?? '').toLowerCase();
  const isAcademicEmployer = ACADEMIC_EMPLOYER_HINTS.some((hint) => e.includes(hint));

  if (/\bpostdoc(toral)?\b|post-doc/.test(t)) return 'postdoc';
  if (/\bphd\b|doctoral candidate|graduate research assistant|research assistant/.test(t)) {
    if (isAcademicEmployer) return 'phd_program';
  }
  if (/\bfellow(ship)?\b/.test(t) && !/director|executive/.test(t)) return 'fellowship';
  if (/\bvisiting\b/.test(t) && isAcademicEmployer) return 'visiting_appointment';
  if (/\bconsultant\b|\bconsulting\b|\badvisor(y)?\b/.test(t)) return 'consulting';
  if (/\bboard member|director\b|\btrustee\b/.test(t) && /board|trust/.test(e)) {
    return 'board_or_advisory';
  }
  return 'employment';
}

/* ---------------------------------------------------------------------- */
/* Builders                                                                */
/* ---------------------------------------------------------------------- */

function buildBeneficiary(
  memory: TypedMemory,
  fieldLabel: FieldShape<string> | null,
): EB1AFacts['beneficiary'] {
  const passport = firstPassport(memory);
  const cv = firstCv(memory);
  const i94 = firstI94(memory);
  const visaStamp = firstVisaStamp(memory);

  return {
    full_name:
      passsportName(passport) ?? cvName(cv) ?? nullField<string>(),
    dob: passthrough(passport?.p.date_of_birth) ?? nullField<string>(),
    country_of_birth: passthrough(passport?.p.place_of_birth),
    country_of_nationality: passthrough(passport?.p.nationality),
    passport_number: passthrough(passport?.p.passport_number),
    passport_expiry: passthrough(passport?.p.date_of_expiration),
    current_us_status: deriveCurrentUsStatus(i94, visaStamp),
    highest_degree: deriveHighestDegree(cv),
    field_of_endeavor: fieldLabel ?? nullField<string>(),
    current_position: passthrough(cv?.cv.current_position_title),
    current_employer: passthrough(cv?.cv.current_employer),
  };
}

/**
 * Current US status priority: I-94 class_of_admission (most authoritative,
 * carries D/S marker) → visa-stamp/I-797 classification (fallback).
 */
function deriveCurrentUsStatus(
  i94: { i: I94Facts; filename: string } | null,
  visaStamp: { v: VisaStampFacts; filename: string } | null,
): FieldShape<string> {
  if (i94?.i.class_of_admission?.value) {
    const dsMarker = i94.i.duration_of_status_marker?.value === true ? ' (D/S)' : '';
    const base = passthrough(i94.i.class_of_admission);
    if (dsMarker) {
      return { ...base, value: `${base.value}${dsMarker}` };
    }
    return base;
  }
  if (visaStamp?.v.classification?.value) {
    return passthrough(visaStamp.v.classification);
  }
  return nullField<string>();
}

/**
 * Highest degree priority: PhD/Doctorate > MD/JD > Master > Bachelor.
 * Falls back to first entry if priority can't be parsed.
 */
function deriveHighestDegree(
  cv: { cv: CvFacts; filename: string } | null,
): FieldShape<string> {
  if (!cv?.cv.education?.length) return nullField<string>();
  const ranks: Array<[RegExp, number]> = [
    [/ph\.?d|doctor(ate)?|d\.?phil/i, 4],
    [/\bm\.?d\b|\bj\.?d\b|\bsj\.?d\b|\bdds\b|\bdvm\b/i, 3],
    [/master|m\.?[sa]\.?|mba|llm|m\.?eng|m\.?phil/i, 2],
    [/bachelor|b\.?[sa]\.?|b\.?eng|llb/i, 1],
  ];
  let best: { degree: FieldShape<string>; rank: number } | null = null;
  for (const e of cv.cv.education) {
    const value = e.degree?.value;
    if (!value) continue;
    let rank = 0;
    for (const [re, r] of ranks) {
      if (re.test(value)) {
        rank = r;
        break;
      }
    }
    if (!best || rank > best.rank) {
      best = { degree: passthrough(e.degree), rank };
    }
  }
  if (best) return best.degree;
  // No regex hit — return first non-null degree as fallback.
  for (const e of cv.cv.education) {
    if (e.degree?.value) return passthrough(e.degree);
  }
  return nullField<string>();
}

function passsportName(
  passport: { p: PassportFactsRich; filename: string } | null,
): FieldShape<string> | null {
  if (!passport) return null;
  // Prefer ASCII transliteration for filing-bound text (manual §15).
  const ascii = passport.p.full_name_ascii;
  if (ascii?.value) return passthrough(ascii);
  return passthrough(passport.p.full_name_native);
}

function cvName(cv: { cv: CvFacts; filename: string } | null): FieldShape<string> | null {
  if (!cv) return null;
  const ascii = cv.cv.full_name_ascii;
  if (ascii?.value) return passthrough(ascii);
  return passthrough(cv.cv.full_name_native);
}

function buildEducationHistory(memory: TypedMemory): EB1AFacts['education_history'] {
  const cv = firstCv(memory);
  const diplomas = allDiplomas(memory);

  type Row = EB1AFacts['education_history'][number];
  const rows: Row[] = [];

  // Primary spine: CV.education[]. Each entry becomes a row.
  if (cv?.cv.education) {
    for (const e of cv.cv.education) {
      rows.push({
        degree: passthrough(e.degree),
        field_of_study: passthrough(e.field),
        institution: passthrough(e.institution),
        country: passthrough(e.country),
        start_date: nullField<string>(),
        end_date: yearToIsoDate(e.completion_year),
        is_terminal: nullField<boolean>(),
        evidence_doc: lift(cv.filename, cv.filename, 1),
      });
    }
  }

  // Corroborate with diploma extractor outputs that don't already have a
  // matching CV row. Match by (institution, field_of_study) — fuzzy.
  for (const { d, filename } of diplomas) {
    const inst = d.institution_name.value ?? '';
    const fos = d.field_of_study.value ?? '';
    const alreadyPresent = rows.some(
      (r) =>
        (r.institution.value ?? '').toLowerCase() === inst.toLowerCase() &&
        (r.field_of_study.value ?? '').toLowerCase() === fos.toLowerCase(),
    );
    if (alreadyPresent) continue;
    rows.push({
      degree: degreeLevelToString(d.degree_level),
      field_of_study: passthrough(d.field_of_study),
      institution: passthrough(d.institution_name),
      country: passthrough(d.institution_country),
      start_date: nullField<string>(),
      end_date: passthrough(d.conferral_date),
      is_terminal: nullField<boolean>(),
      evidence_doc: lift(filename, filename, 1),
    });
  }

  // Mark terminal degree (highest degree level present in the rows).
  if (rows.length) {
    const order: Record<string, number> = {
      associate: 1,
      bachelor: 2,
      master: 3,
      professional: 4,
      phd: 5,
    };
    let bestIdx = -1;
    let bestRank = -1;
    for (let i = 0; i < rows.length; i++) {
      const d = (rows[i].degree.value ?? '').toLowerCase();
      let rank = 0;
      for (const key of Object.keys(order)) {
        if (d.includes(key)) {
          rank = Math.max(rank, order[key]);
        }
      }
      if (rank > bestRank) {
        bestRank = rank;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      rows[bestIdx] = {
        ...rows[bestIdx],
        is_terminal: { value: true, source_page: null, source_quote: '[derived: highest degree]', confidence: 0.8 },
      };
    }
  }

  return rows;
}

function degreeLevelToString(
  level:
    | { value: 'associate' | 'bachelor' | 'master' | 'phd' | 'professional' | 'other' | null; source_page: number | null; source_quote: string | null; confidence: number | null }
    | null
    | undefined,
): FieldShape<string> {
  if (!level || level.value === null) return nullField<string>();
  return {
    value: level.value,
    source_page: level.source_page,
    source_quote: level.source_quote,
    confidence: level.confidence,
  };
}

function yearToIsoDate(
  year: { value: number | null; source_page: number | null; source_quote: string | null; confidence: number | null } | null | undefined,
): FieldShape<string> {
  if (!year || year.value === null) return nullField<string>();
  return {
    value: `${year.value}-12-31`,
    source_page: year.source_page,
    source_quote: year.source_quote,
    confidence: year.confidence,
  };
}

function buildTenureTable(memory: TypedMemory): EB1AFacts['tenure_table'] {
  const cv = firstCv(memory);
  const serviceRecords = allServiceRecords(memory);

  type Row = EB1AFacts['tenure_table'][number];
  const rows: Row[] = [];

  if (cv?.cv.roles) {
    for (const role of cv.cv.roles) {
      const employer = role.employer.value;
      const title = role.position_title.value;
      const tenureType = inferTenureType(title, employer);
      rows.push({
        employer: passthrough(role.employer),
        title: passthrough(role.position_title),
        tenure_type: {
          value: tenureType,
          source_page: null,
          source_quote: '[derived from CV title + employer]',
          confidence: 0.7,
        },
        start_date: passthrough(role.start_date),
        end_date: passthrough(role.end_date),
        is_current: deriveIsCurrent(role.end_date),
        country: passthrough(role.location),
        scope_of_role: passthrough(role.key_responsibilities_summary),
        headcount_under: nullField<number>(),
        evidence_docs: [lift(cv.filename, cv.filename, 1)],
      });
    }
  }

  // Service records corroborate / supplement CV rows. Match by
  // (employer, title) — if missing, append as a new row.
  for (const { s, filename } of serviceRecords) {
    const emp = s.employer_legal_name.value ?? '';
    const title = s.position_title.value ?? '';
    const matched = rows.find(
      (r) =>
        (r.employer.value ?? '').toLowerCase() === emp.toLowerCase() &&
        (r.title.value ?? '').toLowerCase() === title.toLowerCase(),
    );
    if (matched) {
      // Append the service record as a corroborating evidence doc.
      matched.evidence_docs.push(lift(filename, filename, 1));
      continue;
    }
    rows.push({
      employer: passthrough(s.employer_legal_name),
      title: passthrough(s.position_title),
      tenure_type: {
        value: inferTenureType(title, emp),
        source_page: null,
        source_quote: '[derived from service-record employer + title]',
        confidence: 0.7,
      },
      start_date: passthrough(s.employment_start_date),
      end_date: passthrough(s.employment_end_date),
      is_current: deriveIsCurrent(s.employment_end_date),
      country: passthrough(s.employer_country),
      scope_of_role: nullField<string>(),
      headcount_under: nullField<number>(),
      evidence_docs: [lift(filename, filename, 1)],
    });
  }

  // Sort oldest first by start_date.
  rows.sort((a, b) => {
    const da = a.start_date.value ?? '9999';
    const db = b.start_date.value ?? '9999';
    return da.localeCompare(db);
  });

  return rows;
}

function deriveIsCurrent(
  endDate: { value: string | null; source_page: number | null; source_quote: string | null; confidence: number | null } | null | undefined,
): FieldShape<boolean> {
  if (!endDate) return nullField<boolean>();
  const v = endDate.value;
  if (v === null) {
    return {
      value: true,
      source_page: endDate.source_page,
      source_quote: '[derived: end_date null → current]',
      confidence: 0.6,
    };
  }
  const lower = v.toLowerCase();
  if (lower.includes('present') || lower.includes('current') || lower.includes('halen')) {
    return {
      value: true,
      source_page: endDate.source_page,
      source_quote: endDate.source_quote,
      confidence: 0.9,
    };
  }
  return {
    value: false,
    source_page: endDate.source_page,
    source_quote: endDate.source_quote,
    confidence: 0.9,
  };
}

/**
 * EB-1A derivatives — spouse + unmarried under-21 children. Reuses the
 * deterministic E-2 dependent-inference ladder (marriage → spouse,
 * birth → child, passport binding by name match). The principal here is
 * the EB-1A beneficiary; passports not bound to any family doc surface
 * as conflict_register entries (already handled inside the inference
 * helper — left out of this aggregator until conflict_register is wired).
 */
function buildDerivatives(
  memory: TypedMemory,
  beneficiary: EB1AFacts['beneficiary'],
): EB1AFacts['derivatives'] {
  const principalName = beneficiary.full_name?.value ?? null;
  if (!principalName) return [];

  const passports = collectPassportCandidates(memory);
  let principalPassportFilename: string | null = null;
  for (const p of passports) {
    if (p.full_name && p.full_name.trim() === principalName.trim()) {
      principalPassportFilename = p.filename;
      break;
    }
  }

  const result = inferDependentsFromFamilyDocs({
    passports,
    principal_name: principalName,
    principal_nationality: beneficiary.country_of_nationality?.value ?? null,
    principal_passport_filename: principalPassportFilename,
    marriages: collectMarriageBindings(memory),
    births: collectBirthBindings(memory),
    nufus: collectNufusBindings(memory),
  });

  return result.dependents as EB1AFacts['derivatives'];
}

/**
 * EB-1A visa history timeline. Walks every passport, visa-stamp / I-797,
 * and I-94 in TypedMemory and emits one row per discrete event. Sorted
 * ascending by ISO date string; rows missing a date are dropped (cover
 * letter cannot reason about undated events). Powers the "prior
 * immigration history" paragraph and the sustained-presence framing.
 */
function buildVisaHistory(memory: TypedMemory): EB1AFacts['visa_history'] {
  const rows: EB1AFacts['visa_history'] = [];

  for (const entry of iterMemory(memory)) {
    if (entry.passport?.date_of_issue?.value) {
      rows.push({
        date: passthrough(entry.passport.date_of_issue),
        event_type: lift('passport_issued', entry.filename, 1),
        classification: nullField<string>(),
        port_or_consulate: passthrough(entry.passport.country_of_issue),
        source_doc: lift(entry.filename, entry.filename, 1),
      });
    }

    if (entry.visaStamp) {
      const v = entry.visaStamp;
      if (v.validity_start_date?.value) {
        rows.push({
          date: passthrough(v.validity_start_date),
          event_type: lift(
            v.i797_receipt_number?.value ? 'status_grant' : 'visa_issued',
            entry.filename,
            1,
          ),
          classification: passthrough(v.classification),
          port_or_consulate: passthrough(v.issuing_consulate),
          source_doc: lift(entry.filename, entry.filename, 1),
        });
      }
      if (v.validity_end_date?.value) {
        rows.push({
          date: passthrough(v.validity_end_date),
          event_type: lift('status_expiration', entry.filename, 1),
          classification: passthrough(v.classification),
          port_or_consulate: passthrough(v.issuing_consulate),
          source_doc: lift(entry.filename, entry.filename, 1),
        });
      }
      for (const adm of v.prior_admissions ?? []) {
        if (!adm.admission_date?.value) continue;
        rows.push({
          date: passthrough(adm.admission_date),
          event_type: lift('admission', entry.filename, 0.9),
          classification: passthrough(adm.classification),
          port_or_consulate: passthrough(adm.port_of_entry),
          source_doc: lift(entry.filename, entry.filename, 1),
        });
      }
    }

    if (entry.i94) {
      const i = entry.i94;
      if (i.admission_date?.value) {
        rows.push({
          date: passthrough(i.admission_date),
          event_type: lift('admission', entry.filename, 1),
          classification: passthrough(i.class_of_admission),
          port_or_consulate: passthrough(i.port_of_entry),
          source_doc: lift(entry.filename, entry.filename, 1),
        });
      }
      if (i.admit_until_date?.value) {
        rows.push({
          date: passthrough(i.admit_until_date),
          event_type: lift('status_expiration', entry.filename, 1),
          classification: passthrough(i.class_of_admission),
          port_or_consulate: passthrough(i.port_of_entry),
          source_doc: lift(entry.filename, entry.filename, 1),
        });
      }
    }
  }

  return rows
    .filter((r) => typeof r.date.value === 'string' && r.date.value.length > 0)
    .sort((a, b) => (a.date.value! < b.date.value! ? -1 : a.date.value! > b.date.value! ? 1 : 0));
}

function caseTheoryStub(): EB1AFacts['case_theory'] {
  return {
    one_line: nullField<string>(),
    specialized_knowledge_arc: nullField<string>(),
    evidence_anchors: [],
    confidence: {
      value: 'LOW',
      source_page: null,
      source_quote: '[synthesizer not yet run]',
      confidence: 0,
    },
    gaps: nullField<string>(),
    manual_override_used: {
      value: false,
      source_page: null,
      source_quote: null,
      confidence: 1,
    },
  };
}

function buildCaseTheoryInput(
  memory: TypedMemory,
  fieldClassification: EB1AFacts['field_classification'],
): CaseTheoryInput {
  const cv = firstCv(memory);
  const recs = allRecommendationLetters(memory);

  const fullName =
    cv?.cv.full_name_ascii.value ?? cv?.cv.full_name_native.value ?? null;

  return {
    field_of_endeavor: {
      label: fieldClassification.label.value,
      peer_set_description: fieldClassification.peer_set_description.value,
      specificity: fieldClassification.specificity.value,
      confidence: fieldClassification.confidence.value,
    },
    cv: cv
      ? {
          full_name: fullName,
          current_title: cv.cv.current_position_title.value,
          current_employer: cv.cv.current_employer.value,
          prior_titles:
            cv.cv.roles
              ?.map((r) => r.position_title.value)
              .filter((v): v is string => v !== null)
              .slice(0, 3) ?? [],
          role_descriptions:
            cv.cv.roles
              ?.map((r) => r.key_responsibilities_summary.value)
              .filter((v): v is string => v !== null)
              .slice(0, 5) ?? [],
          source_id: cv.filename,
        }
      : undefined,
    recommendation_letter_excerpts: recs.length
      ? recs
          .map(({ r, filename }) => ({
            excerpt: r.specialized_expertise_described_verbatim.value,
            source_id: filename,
          }))
          .filter(
            (e): e is { excerpt: string; source_id: string } => e.excerpt !== null,
          )
      : undefined,
  };
}

function liftCaseTheory(theory: CaseTheory): EB1AFacts['case_theory'] {
  return {
    one_line: lift(theory.one_line, '[synthesizer]', 0.9),
    specialized_knowledge_arc: lift(theory.specialized_knowledge_arc, '[synthesizer]', 0.9),
    evidence_anchors: theory.evidence_anchors.map((a) => ({
      source_id: lift(a.source_id, '[synthesizer]', 0.9),
      why_it_matters: lift(a.why_it_matters, '[synthesizer]', 0.9),
    })),
    confidence: lift(theory.confidence, '[synthesizer]', 1),
    gaps: lift(theory.gaps, '[synthesizer]', 0.9),
    manual_override_used: {
      value: false,
      source_page: null,
      source_quote: null,
      confidence: 1,
    },
  };
}

function fieldClassificationStub(): EB1AFacts['field_classification'] {
  return {
    label: nullField<string>(),
    peer_set_description: nullField<string>(),
    specificity: nullField<'too_broad' | 'goldilocks' | 'too_narrow'>(),
    confidence: {
      value: 'LOW',
      source_page: null,
      source_quote: '[classifier not yet run]',
      confidence: 0,
    },
    reasoning: nullField<string>(),
    manual_override_used: {
      value: false,
      source_page: null,
      source_quote: null,
      confidence: 1,
    },
  };
}

function buildFieldClassifierInput(
  memory: TypedMemory,
): FieldOfEndeavorInput {
  const cv = firstCv(memory);
  const diplomas = allDiplomas(memory);
  const recs = allRecommendationLetters(memory);

  return {
    cv: cv
      ? {
          current_title: cv.cv.current_position_title.value,
          prior_titles:
            cv.cv.roles
              ?.map((r) => r.position_title.value)
              .filter((v): v is string => v !== null)
              .slice(0, 3) ?? [],
          role_descriptions:
            cv.cv.roles
              ?.map((r) => r.key_responsibilities_summary.value)
              .filter((v): v is string => v !== null)
              .slice(0, 5) ?? [],
          source_id: cv.filename,
        }
      : undefined,
    diplomas: diplomas.length
      ? diplomas.map(({ d, filename }) => ({
          field_of_study: d.field_of_study.value,
          degree: d.degree_level.value,
          is_terminal: null,
          source_id: filename,
        }))
      : undefined,
    recommendation_letter_excerpts: recs.length
      ? recs
          .map(({ r, filename }) => ({
            excerpt: r.specialized_expertise_described_verbatim.value,
            source_id: filename,
          }))
          .filter(
            (e): e is { excerpt: string; source_id: string } => e.excerpt !== null,
          )
      : undefined,
  };
}

/* ---------------------------------------------------------------------- */
/* Public entry                                                            */
/* ---------------------------------------------------------------------- */

export interface EB1AAggregateOptions {
  /**
   * When true (default), runs the Haiku 4.5 field-of-endeavor classifier
   * after building the deterministic skeleton. When false, returns the
   * classifier stub — useful in tests or when you only want to verify
   * the deterministic mapping shape.
   */
  classifyField?: boolean;
  /**
   * When true (default), runs the Haiku 4.5 case-theory synthesizer
   * after the field-of-endeavor classifier. Skipped automatically when
   * classifyField=false (synthesizer depends on the classifier output).
   */
  synthesizeCaseTheory?: boolean;
}

export async function aggregateTypedMemoryToEb1a(
  memory: TypedMemory,
  options: EB1AAggregateOptions = {},
): Promise<EB1AFacts> {
  const { classifyField = true, synthesizeCaseTheory: doSynthesize = true } = options;

  const education_history = buildEducationHistory(memory);
  const tenure_table = buildTenureTable(memory);

  let field_classification = fieldClassificationStub();
  let case_theory = caseTheoryStub();

  if (classifyField) {
    const fieldInput = buildFieldClassifierInput(memory);
    const hasAnyInput =
      fieldInput.cv !== undefined ||
      (fieldInput.diplomas?.length ?? 0) > 0 ||
      (fieldInput.recommendation_letter_excerpts?.length ?? 0) > 0;
    if (hasAnyInput) {
      // Bundled EB-1A reasoning call: one Haiku round-trip returns BOTH
      // field-of-endeavor classification AND case-theory synthesis. Saves
      // a round-trip + redundant CV-payload retransmission vs. running
      // classifyFieldOfEndeavor + synthesizeCaseTheory sequentially.
      const ctInput = buildCaseTheoryInput(memory, field_classification);
      const bundled = await synthesizeEb1aReasoning({
        ...fieldInput,
        ...ctInput,
      });

      field_classification = {
        label: lift(bundled.field_of_endeavor.label, '[reasoning-bundle]', 0.9),
        peer_set_description: lift(bundled.field_of_endeavor.peer_set_description, '[reasoning-bundle]', 0.9),
        specificity: lift(bundled.field_of_endeavor.specificity, '[reasoning-bundle]', 0.9),
        confidence: lift(bundled.field_of_endeavor.confidence, '[reasoning-bundle]', 1),
        reasoning: lift(bundled.field_of_endeavor.reasoning, '[reasoning-bundle]', 0.9),
        manual_override_used: {
          value: false,
          source_page: null,
          source_quote: null,
          confidence: 1,
        },
      };

      if (doSynthesize) {
        case_theory = liftCaseTheory(bundled.case_theory);
      }
    }
  }

  const beneficiary = buildBeneficiary(memory, field_classification.label);

  const derivatives = buildDerivatives(memory, beneficiary);
  const visa_history = buildVisaHistory(memory);

  const facts: EB1AFacts = {
    beneficiary,
    filing_metadata: defaultFilingMetadata(),
    education_history,
    tenure_table,
    field_classification,
    case_theory,
    derivatives,
    visa_history,
    claimed_criteria: [],
    expert_letters: [],
    kazarian_step_two: {
      framework_invoked: nullField<string>(),
      sustained_acclaim_evidence: nullField<string>(),
      risen_to_very_top_evidence: nullField<string>(),
      comparison_cohort: nullField<string>(),
      recent_evidence_within_3_years: nullField<string>(),
      top_of_field_evidence: [],
      peer_benchmarking: [],
      narrative_stress_test: nullField<string>(),
    },
    citation_counts: {
      claimed_total: nullField<number>(),
      google_scholar_total: nullField<number>(),
      ex_self_citations: nullField<number>(),
      h_index_claimed: nullField<number>(),
    },
    evidence_aps: [],
    conflict_register: [],
  };

  // Validate the shape against the canonical schema. Throws if the
  // builder ever drifts.
  return EB1AFactsSchema.parse(facts);
}

/* ====================================================================== */
/* Sort-out pipeline (2026-05-05) — IdentitySheet + CriterionMap          */
/*                                                                        */
/* MOVED 2026-05-05 sprint to ./aggregators/identity-sheet.ts and         */
/* ./aggregators/criterion-map.ts. The exports below are re-exports for   */
/* back-compat — DO NOT ADD NEW LOGIC HERE.                               */
/* ====================================================================== */

export {
  aggregateIdentitySheet,
  type IdentitySheet,
  type IdentityNameChangeEvent,
  type IdentityParents,
  type PreChangeEvidenceWarning,
} from './aggregators/identity-sheet';

export {
  buildCriterionMap,
  CRITERION_NAMES,
  type CriterionId,
  type CriterionStatus,
  type CriterionRow,
  type CvSignalSlice,
} from './aggregators/criterion-map';

