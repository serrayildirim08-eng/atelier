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
import {
  classifyFieldOfEndeavor,
  type FieldOfEndeavorInput,
} from './extractors/field-of-endeavor';

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

function buildBeneficiary(memory: TypedMemory): EB1AFacts['beneficiary'] {
  const passport = firstPassport(memory);
  const cv = firstCv(memory);

  return {
    full_name:
      passsportName(passport) ?? cvName(cv) ?? nullField<string>(),
    dob: passthrough(passport?.p.date_of_birth) ?? nullField<string>(),
    country_of_birth: passthrough(passport?.p.place_of_birth),
    country_of_nationality: passthrough(passport?.p.nationality),
    passport_number: passthrough(passport?.p.passport_number),
    passport_expiry: passthrough(passport?.p.date_of_expiration),
    current_us_status: nullField<string>(),
    highest_degree: nullField<string>(),
    field_of_endeavor: nullField<string>(),
    current_position: passthrough(cv?.cv.current_position_title),
    current_employer: passthrough(cv?.cv.current_employer),
  };
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
}

export async function aggregateTypedMemoryToEb1a(
  memory: TypedMemory,
  options: EB1AAggregateOptions = {},
): Promise<EB1AFacts> {
  const { classifyField = true } = options;

  const beneficiary = buildBeneficiary(memory);
  const education_history = buildEducationHistory(memory);
  const tenure_table = buildTenureTable(memory);

  let field_classification = fieldClassificationStub();
  if (classifyField) {
    const input = buildFieldClassifierInput(memory);
    const hasAnyInput =
      input.cv !== undefined ||
      (input.diplomas?.length ?? 0) > 0 ||
      (input.recommendation_letter_excerpts?.length ?? 0) > 0;
    if (hasAnyInput) {
      const classified = await classifyFieldOfEndeavor(input);
      field_classification = {
        label: lift(classified.label, '[classifier]', 0.9),
        peer_set_description: lift(classified.peer_set_description, '[classifier]', 0.9),
        specificity: lift(classified.specificity, '[classifier]', 0.9),
        confidence: lift(classified.confidence, '[classifier]', 1),
        reasoning: lift(classified.reasoning, '[classifier]', 0.9),
        manual_override_used: {
          value: false,
          source_page: null,
          source_quote: null,
          confidence: 1,
        },
      };
    }
  }

  const facts: EB1AFacts = {
    beneficiary,
    filing_metadata: defaultFilingMetadata(),
    education_history,
    tenure_table,
    field_classification,
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
