/**
 * Deterministic + LLM-fallback derivative-dependent identification for
 * E-2 cases.
 *
 * Problem this solves: when a case folder ingests several passports, only
 * one of them is the principal applicant (already bound by
 * applicant-inference.ts via the ownership chain). The remaining passports
 * are *probably* dependents — spouse and children eligible for E-2
 * derivative status under INA § 101(a)(15)(E)(ii) and 9 FAM 402.9-9(C) —
 * but the firm needs to print a specific relationship in the cover-letter
 * dependent paragraph and on Form DS-160 / I-539. Guessing is not safe;
 * the binding has to come from a primary family document:
 *
 *   - marriage_certificate              → spouse dependent
 *   - birth_certificate                  → child dependent
 *   - nufus_kayit_ornegi (Turkish        → spouse + child(ren) at once
 *     family registry; vital_record)
 *
 * Logic ladder (deterministic only, no LLM):
 *
 *   1. Collect every PerPdfResult that carries a thin `passport`
 *      doc_type, attaching the rich `passport` payload (name, DOB,
 *      nationality) when present.
 *   2. Identify the principal-applicant passport by exact ASCII-name match
 *      against `principalName`. That passport is removed from the
 *      candidate pool — it is NOT a dependent.
 *   3. Walk every family document and produce {basis_filename, candidate
 *      relationship, candidate name(s)} bindings:
 *        - vitalRecords.marriage_certificate AND
 *          governmentDoc.vital_record_marriage → bind the non-principal
 *          spouse name.
 *        - vitalRecords.birth_certificate AND
 *          governmentDoc.vital_record_birth → bind the child name when
 *          one of the listed parents matches `principalName`.
 *        - thin VitalRecordFactsSchema with record_kind='other' whose
 *          filename matches the nufus_kayit_ornegi pattern → bind every
 *          remaining passport whose nationality matches the principal's
 *          (the registry establishes membership of the same household but
 *          rarely surfaces structured fields).
 *   4. For each remaining passport, look for a binding match. If found,
 *      emit a dependent row. If not, emit an `unmatched_passport`
 *      (severity 2) conflict so the attorney knows the firm has
 *      passport-level evidence of an unidentified person.
 *   5. Optional Haiku 4.5 fallback (env-gated, default OFF) for the
 *      ambiguous middle: when there are unmatched passports AND there is
 *      at least one family doc the deterministic ladder couldn't resolve
 *      (e.g., Nüfus with no structured names), one Haiku call may propose
 *      bindings. Fail-closed: a null return preserves deterministic
 *      output.
 *
 * Idempotency contract (mirrors applicant-inference.ts):
 *   - Never duplicate a dependent row keyed on (passport_filename,
 *     full_name, relationship). The aggregator's
 *     `enrichDependentsFromFamilyDocs` integration calls this function
 *     more than once per matter (Phase-3 deterministic + post-Phase-9
 *     async) and must converge.
 *   - Never duplicate a conflict_register entry keyed on (conflict_type,
 *     fact_a_doc).
 */

import { z } from 'zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { isTreatyNational } from '@/lib/e2/treaty-countries';
import type { ConflictEntryT, FieldT } from '@/lib/e2/applicant-inference';
import type { E2DependentRelationship } from '@/ingest/schema';

/* ---------------------------------------------------------------------- */
/* Public types                                                           */
/* ---------------------------------------------------------------------- */

/** Minimum surface from a passport extraction the inference needs. */
export interface PassportCandidate {
  filename: string;
  /** ASCII-form preferred (passport rich); fallback to thin full_name. */
  full_name: string | null;
  dob: string | null;
  nationality: string | null;
}

/** Marriage-certificate binding (rich vital_records OR government_doc). */
export interface MarriageBinding {
  filename: string;
  spouse_a_name: string | null;
  spouse_b_name: string | null;
}

/** Birth-certificate binding (rich vital_records OR government_doc). */
export interface BirthBinding {
  filename: string;
  child_name: string | null;
  child_dob: string | null;
  parent1_name: string | null;
  parent2_name: string | null;
}

/** Nüfus kayıt örneği binding — usually unstructured. */
export interface NufusBinding {
  filename: string;
  /** Names the extractor surfaced (rare). */
  household_member_names: string[];
}

export interface DependentInferenceInput {
  passports: readonly PassportCandidate[];
  principal_name: string | null;
  principal_nationality: string | null;
  principal_passport_filename: string | null;
  marriages: readonly MarriageBinding[];
  births: readonly BirthBinding[];
  nufus: readonly NufusBinding[];
}

export interface DependentRow {
  full_name: FieldT<string>;
  relationship: FieldT<E2DependentRelationship>;
  dob: FieldT<string>;
  nationality: FieldT<string>;
  passport_filename: FieldT<string>;
  dependent_doc_basis: FieldT<string>;
}

export interface DependentInferenceResult {
  dependents: DependentRow[];
  conflicts: ConflictEntryT[];
  reasoning: string;
}

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

const NULL_FIELD: FieldT<never> = {
  value: null,
  source_page: null,
  source_quote: null,
  confidence: null,
};

const CONFLICT_SOURCE_QUOTE = '[deterministic dependent-from-family-docs inference]';
const HAIKU_CONFLICT_SOURCE_QUOTE = '[Haiku dependent-inference fallback]';

function asNonEmpty(s: string | null | undefined): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

/**
 * Loose name match: ASCII-fold-ish (lowercase + collapse whitespace +
 * strip diacritics) and check substring containment in either direction.
 * Real cases: "Salih Kaçar" ↔ "Salih KACAR" ↔ "KACAR Salih". Conservative
 * because false positives could anoint the wrong family member; Jaccard
 * on tokens prevents single-token first-name collisions ("Ali") from
 * matching unrelated "Ali" rows.
 */
function namesLikelyMatch(a: string | null, b: string | null): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Token-set Jaccard. Both must share ≥ 2 tokens OR Jaccard ≥ 0.6 with
  // ≥ 1 multi-char token shared.
  const ta = new Set(na.split(' ').filter((t) => t.length >= 2));
  const tb = new Set(nb.split(' ').filter((t) => t.length >= 2));
  if (ta.size === 0 || tb.size === 0) return false;
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = union > 0 ? intersect / union : 0;
  if (intersect >= 2) return true;
  return jaccard >= 0.6 && intersect >= 1;
}

function normalizeName(s: string | null | undefined): string | null {
  const t = asNonEmpty(s);
  if (!t) return null;
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildConflict(params: {
  description: string;
  conflict_type: string;
  severity: number;
  fact_a_doc: string;
  source_quote?: string;
}): ConflictEntryT {
  const sq = params.source_quote ?? CONFLICT_SOURCE_QUOTE;
  return {
    description: { value: params.description, source_page: null, source_quote: sq, confidence: 1 },
    conflict_type: { value: params.conflict_type, source_page: null, source_quote: sq, confidence: 1 },
    severity: { value: params.severity, source_page: null, source_quote: sq, confidence: 1 },
    fact_a_doc: { value: params.fact_a_doc, source_page: null, source_quote: sq, confidence: 1 },
    fact_a_page: NULL_FIELD,
    fact_b_doc: NULL_FIELD,
    fact_b_page: NULL_FIELD,
  };
}

function fieldOf<T>(value: T, sourceQuote: string, confidence: number): FieldT<T> {
  return { value, source_page: null, source_quote: sourceQuote, confidence };
}

function makeDependent(params: {
  full_name: string;
  relationship: E2DependentRelationship;
  dob: string | null;
  nationality: string | null;
  passport_filename: string;
  dependent_doc_basis: string;
  source_quote: string;
  confidence: number;
}): DependentRow {
  return {
    full_name: fieldOf(params.full_name, params.source_quote, params.confidence),
    relationship: fieldOf(params.relationship, params.source_quote, params.confidence),
    dob: params.dob
      ? fieldOf(params.dob, params.source_quote, params.confidence)
      : (NULL_FIELD as FieldT<string>),
    nationality: params.nationality
      ? fieldOf(params.nationality, params.source_quote, params.confidence)
      : (NULL_FIELD as FieldT<string>),
    passport_filename: fieldOf(params.passport_filename, params.source_quote, params.confidence),
    dependent_doc_basis: fieldOf(params.dependent_doc_basis, params.source_quote, params.confidence),
  };
}

/* ---------------------------------------------------------------------- */
/* Deterministic ladder                                                   */
/* ---------------------------------------------------------------------- */

export function inferDependentsFromFamilyDocs(
  input: DependentInferenceInput,
): DependentInferenceResult {
  const principalName = asNonEmpty(input.principal_name);
  const principalNationality = asNonEmpty(input.principal_nationality);
  const principalFilename = asNonEmpty(input.principal_passport_filename);

  // Pool of passports excluding the principal's. Match by filename first
  // (canonical), fall back to name match (some folders attach the
  // principal's passport under multiple filenames).
  const candidates = input.passports.filter((p) => {
    if (principalFilename && p.filename === principalFilename) return false;
    if (principalName && namesLikelyMatch(p.full_name, principalName)) return false;
    return true;
  });

  if (!principalName) {
    return {
      dependents: [],
      conflicts: [],
      reasoning:
        'No principal applicant identified; refusing to infer dependents (cannot tell which passport is the principal vs a dependent).',
    };
  }

  const dependents: DependentRow[] = [];
  const conflicts: ConflictEntryT[] = [];
  const usedPassports = new Set<string>();
  const reasoningTrace: string[] = [];

  // ----- Step A — marriage certificates → spouse dependent ----------------
  for (const m of input.marriages) {
    const a = asNonEmpty(m.spouse_a_name);
    const b = asNonEmpty(m.spouse_b_name);
    // Determine which spouse is the principal. The OTHER spouse is the
    // dependent candidate.
    let spouseName: string | null = null;
    if (a && namesLikelyMatch(a, principalName) && b) spouseName = b;
    else if (b && namesLikelyMatch(b, principalName) && a) spouseName = a;
    if (!spouseName) {
      conflicts.push(
        buildConflict({
          description:
            `Marriage certificate (${m.filename}) does not list the principal applicant ("${principalName}") as either spouse — ` +
            `cannot bind a spouse dependent from this document. Spouses on file: "${a ?? '(blank)'}" + "${b ?? '(blank)'}".`,
          conflict_type: 'dependent_relationship_unclear',
          severity: 2,
          fact_a_doc: m.filename,
        }),
      );
      continue;
    }
    // Find the passport for spouseName.
    const passport = candidates.find(
      (p) => !usedPassports.has(p.filename) && namesLikelyMatch(p.full_name, spouseName),
    );
    if (!passport) {
      conflicts.push(
        buildConflict({
          description:
            `Marriage certificate (${m.filename}) names spouse "${spouseName}" as the principal's partner, but no passport in the case folder matches that name. ` +
            `The firm cannot file a derivative E-2 application without a passport for the dependent — request the spouse's passport.`,
          conflict_type: 'dependent_relationship_unclear',
          severity: 2,
          fact_a_doc: m.filename,
        }),
      );
      continue;
    }
    usedPassports.add(passport.filename);
    dependents.push(
      makeDependent({
        full_name: passport.full_name ?? spouseName,
        relationship: 'spouse',
        dob: passport.dob,
        nationality: passport.nationality,
        passport_filename: passport.filename,
        dependent_doc_basis: m.filename,
        source_quote: `[dependent inferred from marriage_certificate: ${m.filename} ↔ passport ${passport.filename}]`,
        confidence: 0.9,
      }),
    );
    reasoningTrace.push(`spouse=${spouseName} via ${m.filename} ↔ ${passport.filename}`);
  }

  // ----- Step B — birth certificates → child dependent --------------------
  for (const b of input.births) {
    const childName = asNonEmpty(b.child_name);
    const p1 = asNonEmpty(b.parent1_name);
    const p2 = asNonEmpty(b.parent2_name);
    const principalIsParent =
      (p1 && namesLikelyMatch(p1, principalName)) ||
      (p2 && namesLikelyMatch(p2, principalName));
    if (!childName || !principalIsParent) {
      conflicts.push(
        buildConflict({
          description:
            `Birth certificate (${b.filename}) does not list the principal applicant ("${principalName}") as a parent — ` +
            `cannot bind a child dependent. Parents on file: "${p1 ?? '(blank)'}" + "${p2 ?? '(blank)'}", child: "${childName ?? '(blank)'}".`,
          conflict_type: 'dependent_relationship_unclear',
          severity: 2,
          fact_a_doc: b.filename,
        }),
      );
      continue;
    }
    const passport = candidates.find(
      (p) => !usedPassports.has(p.filename) && namesLikelyMatch(p.full_name, childName),
    );
    if (!passport) {
      conflicts.push(
        buildConflict({
          description:
            `Birth certificate (${b.filename}) names child "${childName}" of principal "${principalName}", but no passport in the case folder matches that name. ` +
            `Request the child's passport before filing the derivative E-2 application.`,
          conflict_type: 'dependent_relationship_unclear',
          severity: 2,
          fact_a_doc: b.filename,
        }),
      );
      continue;
    }
    usedPassports.add(passport.filename);
    dependents.push(
      makeDependent({
        full_name: passport.full_name ?? childName,
        relationship: 'child',
        dob: passport.dob ?? b.child_dob,
        nationality: passport.nationality,
        passport_filename: passport.filename,
        dependent_doc_basis: b.filename,
        source_quote: `[dependent inferred from birth_certificate: ${b.filename} ↔ passport ${passport.filename}]`,
        confidence: 0.9,
      }),
    );
    reasoningTrace.push(`child=${childName} via ${b.filename} ↔ ${passport.filename}`);
  }

  // ----- Step C — Nüfus kayıt örneği → bind remaining same-nationality
  // passports as household members. Relationship is recorded as
  // 'other_dependent' unless we have a structured household_member_names
  // entry that lets us discriminate spouse vs child. ---------------------
  if (input.nufus.length > 0) {
    const remaining = candidates.filter((p) => !usedPassports.has(p.filename));
    for (const n of input.nufus) {
      // Best-case: the extractor surfaced names. Try direct binding first.
      for (const member of n.household_member_names) {
        const memberName = asNonEmpty(member);
        if (!memberName) continue;
        if (namesLikelyMatch(memberName, principalName)) continue;
        const passport = remaining.find(
          (p) => !usedPassports.has(p.filename) && namesLikelyMatch(p.full_name, memberName),
        );
        if (!passport) continue;
        usedPassports.add(passport.filename);
        dependents.push(
          makeDependent({
            full_name: passport.full_name ?? memberName,
            relationship: 'other_dependent',
            dob: passport.dob,
            nationality: passport.nationality,
            passport_filename: passport.filename,
            dependent_doc_basis: n.filename,
            source_quote: `[dependent inferred from nufus_kayit_ornegi: ${n.filename} ↔ passport ${passport.filename}]`,
            confidence: 0.7,
          }),
        );
        reasoningTrace.push(`household=${memberName} via ${n.filename} ↔ ${passport.filename}`);
      }
      // Fallback: when the registry has no structured names but there
      // ARE remaining same-nationality passports, log a soft conflict so
      // the attorney can confirm relationships manually. We do NOT
      // auto-bind: the registry is strong evidence of household
      // membership, but the relationship (spouse vs child) is not
      // recoverable without structured data.
      const stillRemaining = remaining.filter((p) => !usedPassports.has(p.filename));
      if (n.household_member_names.length === 0 && stillRemaining.length > 0) {
        // Optional sanity check: if the principal's nationality is known,
        // prefer to flag passports whose nationality matches.
        const sameNationality = principalNationality
          ? stillRemaining.filter(
              (p) =>
                normalizeName(p.nationality)?.split(' ')[0] ===
                normalizeName(principalNationality)?.split(' ')[0],
            )
          : stillRemaining;
        if (sameNationality.length > 0) {
          // Only emit the count-inconsistency when we have a household
          // size mismatch indicator from the registry. Without parsed
          // names, we just leave it as unmatched_passport conflicts (Step
          // D below); the registry alone isn't enough to bind.
        }
      }
    }
  }

  // ----- Step D — unmatched passports → severity-2 conflict --------------
  const unmatched = candidates.filter((p) => !usedPassports.has(p.filename));
  for (const p of unmatched) {
    conflicts.push(
      buildConflict({
        description:
          `Passport (${p.filename}) for "${p.full_name ?? '(unknown name)'}" (nationality ${p.nationality ?? 'unknown'}) is not the principal applicant ("${principalName}") and could not be bound to any family document ` +
          `(marriage certificate, birth certificate, or Nüfus Kayıt Örneği). Likely a dependent, but the relationship is undetermined — request the missing primary evidence (marriage cert / birth cert) before drafting derivative paragraphs.`,
        conflict_type: 'unmatched_passport',
        severity: 2,
        fact_a_doc: p.filename,
      }),
    );
  }

  // ----- Step E — count-consistency check across Nüfus + dependents ------
  // When a Nüfus is present AND we resolved at least one dependent, log a
  // sanity conflict if the dependent count looks materially off (e.g., 4
  // remaining passports but only 1 binding). Severity 3 because this
  // typically signals a missing translation or a misclassified family doc.
  if (input.nufus.length > 0 && dependents.length > 0 && unmatched.length >= 2) {
    conflicts.push(
      buildConflict({
        description:
          `Nüfus Kayıt Örneği on file (${input.nufus.map((n) => n.filename).join(', ')}) typically lists the entire household, but the deterministic dependent binder produced ${dependents.length} dependent(s) ` +
          `and left ${unmatched.length} passport(s) unbound. Verify each unmatched passport against the registry's household section and supply the corresponding marriage / birth certificates.`,
        conflict_type: 'dependent_count_inconsistent',
        severity: 3,
        fact_a_doc: input.nufus[0].filename,
      }),
    );
  }

  return {
    dependents,
    conflicts,
    reasoning:
      reasoningTrace.length > 0
        ? `Resolved ${dependents.length} dependent(s): ${reasoningTrace.join('; ')}. Unmatched passports: ${unmatched.length}.`
        : `No dependents resolved deterministically. Unmatched passports: ${unmatched.length}.`,
  };
}

/* ---------------------------------------------------------------------- */
/* Haiku 4.5 fallback (env-gated, default OFF)                            */
/* ---------------------------------------------------------------------- */

const HAIKU_SYSTEM_PROMPT = `You identify E-2 derivative dependents (spouse, child) from a JSON bundle of passports plus family documents.

Authority: INA § 101(a)(15)(E)(ii); 9 FAM 402.9-9(C). A derivative dependent must be the principal applicant's lawful spouse or unmarried child under 21. The relationship must be established by a primary government document (marriage certificate, birth certificate, or equivalent civil registry record like a Turkish Nüfus Kayıt Örneği).

You will receive:
  - principal: { name, nationality, passport_filename }
  - candidate_passports: an array of {filename, full_name, dob, nationality}
  - family_documents: an array of {filename, kind, structured_data}
    where kind ∈ {'marriage_certificate', 'birth_certificate', 'nufus_kayit_ornegi'} and structured_data may be partial.

Return a single JSON object:
{
  "bindings": [
    {
      "passport_filename": string,           // MUST exist in candidate_passports
      "relationship": "spouse" | "child" | "other_dependent",
      "dependent_doc_basis": string,         // MUST exist in family_documents.filename
      "reasoning": string                    // one sentence, cite the matching name
    }
  ],
  "unbindable_passports": [
    { "passport_filename": string, "reasoning": string }
  ]
}

Rules:
- NEVER invent a passport_filename or family-document filename.
- NEVER bind the principal's passport as a dependent.
- Spouse binding requires a marriage_certificate OR Nüfus that names BOTH the principal and the candidate as a couple.
- Child binding requires a birth_certificate OR Nüfus where one parent's name matches the principal AND the child's name matches the candidate passport.
- Use 'other_dependent' only for Nüfus-only bindings where the registry establishes household membership but neither spouse nor child role can be confirmed.
- No prose outside the JSON.`;

const HaikuBindingSchema = z.object({
  passport_filename: z.string(),
  relationship: z.enum(['spouse', 'child', 'other_dependent']),
  dependent_doc_basis: z.string(),
  reasoning: z.string(),
});

const HaikuVerdictSchema = z.object({
  bindings: z.array(HaikuBindingSchema),
  unbindable_passports: z.array(
    z.object({
      passport_filename: z.string(),
      reasoning: z.string(),
    }),
  ),
});

export type HaikuDependentVerdict = z.infer<typeof HaikuVerdictSchema>;

function isHaikuFallbackEnabled(): boolean {
  const v = process.env.DEPENDENT_HAIKU_FALLBACK_ENABLED;
  if (!v) return false;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

async function callHaikuDependentFallback(
  input: DependentInferenceInput,
): Promise<HaikuDependentVerdict | null> {
  const compact = {
    principal: {
      name: input.principal_name,
      nationality: input.principal_nationality,
      passport_filename: input.principal_passport_filename,
    },
    candidate_passports: input.passports.map((p) => ({
      filename: p.filename,
      full_name: p.full_name,
      dob: p.dob,
      nationality: p.nationality,
    })),
    family_documents: [
      ...input.marriages.map((m) => ({
        filename: m.filename,
        kind: 'marriage_certificate',
        structured_data: { spouse_a: m.spouse_a_name, spouse_b: m.spouse_b_name },
      })),
      ...input.births.map((b) => ({
        filename: b.filename,
        kind: 'birth_certificate',
        structured_data: {
          child: b.child_name,
          child_dob: b.child_dob,
          parent1: b.parent1_name,
          parent2: b.parent2_name,
        },
      })),
      ...input.nufus.map((n) => ({
        filename: n.filename,
        kind: 'nufus_kayit_ornegi',
        structured_data: { household_member_names: n.household_member_names },
      })),
    ],
  };

  let raw: unknown;
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      system: [
        {
          type: 'text',
          text: HAIKU_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Bundle:\n\`\`\`json\n${JSON.stringify(compact, null, 2)}\n\`\`\`\n\nReturn JSON only.`,
        },
      ],
    });

    logAnthropicUsage({
      stage: 'extract',
      model: 'claude-haiku-4-5',
      case_type: 'E2',
      usage: response.usage,
    });

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  const parsed = HaikuVerdictSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

/**
 * Public async entry point. Runs the deterministic ladder; if any
 * passports remain unbound AND the env flag is set, fires one Haiku call
 * and applies its verdict on top — but ONLY for passports/family-docs
 * whose filenames already exist in the input. Names are never invented.
 *
 * Tests should call `inferDependentsFromFamilyDocs` directly to keep the
 * suite hermetic.
 */
export async function inferDependentsWithLlmFallback(
  input: DependentInferenceInput,
): Promise<DependentInferenceResult> {
  const deterministic = inferDependentsFromFamilyDocs(input);

  // Short-circuit: nothing left for the LLM to do.
  const unmatchedConflicts = deterministic.conflicts.filter(
    (c) => c.conflict_type.value === 'unmatched_passport',
  );
  if (unmatchedConflicts.length === 0) return deterministic;
  if (!isHaikuFallbackEnabled()) return deterministic;

  const verdict = await callHaikuDependentFallback(input);
  if (!verdict || verdict.bindings.length === 0) return deterministic;

  // Whitelist: only accept bindings whose passport_filename + dependent_doc_basis
  // exist in the input. Filter out any that contradict already-resolved
  // dependents.
  const resolvedFilenames = new Set(
    deterministic.dependents.map((d) => d.passport_filename.value).filter(Boolean) as string[],
  );
  const passportFilenames = new Set(input.passports.map((p) => p.filename));
  const familyFilenames = new Set([
    ...input.marriages.map((m) => m.filename),
    ...input.births.map((b) => b.filename),
    ...input.nufus.map((n) => n.filename),
  ]);

  const merged: DependentRow[] = [...deterministic.dependents];
  const newConflicts: ConflictEntryT[] = [];
  const haikuConsumedFilenames = new Set<string>();

  for (const binding of verdict.bindings) {
    if (!passportFilenames.has(binding.passport_filename)) continue;
    if (!familyFilenames.has(binding.dependent_doc_basis)) continue;
    if (resolvedFilenames.has(binding.passport_filename)) continue;
    const passport = input.passports.find((p) => p.filename === binding.passport_filename);
    if (!passport) continue;

    // For 'spouse' / 'child' bindings, sanity-check via isTreatyNational
    // when the principal is a treaty national: the dependent typically
    // shares nationality. We don't reject mismatches (mixed-nationality
    // households exist), just lower confidence.
    const sameAsTreaty = isTreatyNational(passport.nationality);
    const confidence = sameAsTreaty ? 0.7 : 0.6;

    merged.push(
      makeDependent({
        full_name: passport.full_name ?? '(unknown — Haiku binding)',
        relationship: binding.relationship,
        dob: passport.dob,
        nationality: passport.nationality,
        passport_filename: passport.filename,
        dependent_doc_basis: binding.dependent_doc_basis,
        source_quote: `[dependent inferred via Haiku 4.5 fallback: ${binding.reasoning}]`,
        confidence,
      }),
    );
    resolvedFilenames.add(passport.filename);
    haikuConsumedFilenames.add(passport.filename);
  }

  // Drop the deterministic 'unmatched_passport' conflicts whose filenames
  // the Haiku fallback successfully resolved; keep the rest plus any new
  // Haiku-surfaced conflicts.
  const filteredConflicts = deterministic.conflicts.filter((c) => {
    if (c.conflict_type.value !== 'unmatched_passport') return true;
    const fa = c.fact_a_doc.value;
    return !(fa != null && haikuConsumedFilenames.has(fa));
  });
  for (const u of verdict.unbindable_passports) {
    if (!passportFilenames.has(u.passport_filename)) continue;
    if (resolvedFilenames.has(u.passport_filename)) continue;
    // If the deterministic ladder already logged unmatched_passport for
    // this filename, leave it (dedupe at the aggregator integration layer).
    const alreadyLogged = filteredConflicts.some(
      (c) =>
        c.conflict_type.value === 'unmatched_passport' &&
        c.fact_a_doc.value === u.passport_filename,
    );
    if (alreadyLogged) continue;
    newConflicts.push(
      buildConflict({
        description: `Haiku fallback could not bind passport ${u.passport_filename}: ${u.reasoning}`,
        conflict_type: 'unmatched_passport',
        severity: 2,
        fact_a_doc: u.passport_filename,
        source_quote: HAIKU_CONFLICT_SOURCE_QUOTE,
      }),
    );
  }

  return {
    dependents: merged,
    conflicts: [...filteredConflicts, ...newConflicts],
    reasoning:
      `${deterministic.reasoning} Haiku fallback added ${haikuConsumedFilenames.size} binding(s).`,
  };
}
