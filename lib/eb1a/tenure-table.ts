/**
 * Master tenure table builder — Tier 2.
 *
 * Inputs:
 *   - CV roles[] (primary spine; one row per role the beneficiary lists)
 *   - service-record extractor outputs (foreign-employer "sicil özeti"
 *     and equivalents — corroborate dates / titles)
 *   - employer-letter extractor outputs (US-side employer verifications)
 *   - recommendation-letter extractor outputs WITH a prior-employer
 *     relationship (these often surface dates or scope detail the CV
 *     left out)
 *
 * Output: EB1ATenureEntry[] sorted oldest first.
 *
 * Tenure types (per spec discussion 2026-04-30):
 *   - employment      — normal post-graduation jobs
 *   - phd_program     — academic only
 *   - postdoc         — academic only
 *   - fellowship      — academic / research
 *   - visiting_appointment — academic
 *   - consulting      — short-term advisory
 *   - board_or_advisory   — non-employee directorships
 *   - other           — fallback
 *
 * Heuristics for the academic split (loose; the field_of_endeavor
 * classifier upstream and the user's manual edit are the final word):
 *   - title contains "PhD" / "doctoral candidate" / "graduate research
 *     assistant" + employer is a university → phd_program
 *   - title contains "postdoc" / "postdoctoral" → postdoc
 *   - title contains "visiting" + university → visiting_appointment
 *   - title contains "fellow" + non-corp employer → fellowship
 *
 * NOTE: "is this employer a distinguished organization" is NOT computed
 * here. That check lives inside the future leading/critical-role
 * criterion gate (8 CFR 204.5(h)(3)(viii)) — see CLAUDE.md note on
 * 2026-04-30 design call.
 */

import type {
  EB1AEducationEntry,
  EB1ATenureEntry,
  TenureType,
} from './types';

export interface TenureBuilderInput {
  cv_roles?: Array<{
    employer?: string | null;
    title?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    country?: string | null;
    description?: string | null;
    headcount_under?: number | null;
    source_doc?: string | null;
  }>;
  service_records?: Array<{
    employer?: string | null;
    title?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    country?: string | null;
    salary_amount_usd?: number | null;
    source_doc?: string | null;
  }>;
  employer_letters?: Array<{
    employer?: string | null;
    title?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
    source_doc?: string | null;
  }>;
  recommendation_letters_from_employers?: Array<{
    employer?: string | null;
    relationship_dates?: string | null;
    description?: string | null;
    source_doc?: string | null;
  }>;
  education?: EB1AEducationEntry[];
}

export function buildTenureTable(input: TenureBuilderInput): EB1ATenureEntry[] {
  // Implementation lives in the EB-1A aggregator pass
  // (ingest/typed-aggregate-eb1a.ts). The aggregator builds the tenure
  // table directly from typed memory — this builder exists as a public
  // entry point for tests and callers that already have structured
  // CV / service-record inputs and want to bypass the typed-memory
  // round-trip. Currently a no-op until a test fixture needs it.
  void input;
  return [];
}

const ACADEMIC_TENURE_TYPES = new Set<TenureType>([
  'phd_program',
  'postdoc',
  'fellowship',
  'visiting_appointment',
]);

export function isAcademicTenure(entry: EB1ATenureEntry): boolean {
  const t = entry.tenure_type.value;
  return t !== null && ACADEMIC_TENURE_TYPES.has(t);
}
