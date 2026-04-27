import allowlistJson from '@/lib/authorities/allowlist.json';
import type { CaseType } from '@/ingest/schema';
import type { CitationVerifyStatus, ExtractedCitation } from '@/lib/verify/types';

interface CaseLawEntry {
  name: string;
  reporters: string[];
  court: string;
  year: number;
  note?: string;
}

interface CaseTypeAllowlist {
  statutes: string[];
  regulations: string[];
  agency: string[];
  case_law: CaseLawEntry[];
}

const ALLOWLIST = allowlistJson as unknown as Record<string, CaseTypeAllowlist> & {
  _meta: unknown;
};

/**
 * Stem-match: an allowlist entry like "8 CFR § 214.2(e)" matches deeper
 * subsections like "8 CFR § 214.2(e)(12)". Both forms share the entry's
 * leading characters.
 */
function stemMatchAny(normalized: string, entries: string[]): boolean {
  return entries.some((stem) => normalized.startsWith(stem));
}

/**
 * Detect AAO/BIA non-precedent citations that the verifier cannot mechanically
 * confirm. CourtListener does not index AAO/BIA non-precedent decisions, so
 * we route them to the human-review queue rather than silently approving.
 *
 * Heuristic for "needs human review":
 *   - The citation matches a case_law entry whose `court` is "AAO" or "BIA"
 *     AND the matched form is by NAME (not by reporter), AND the entry has
 *     no reporters listed.
 *   - This is the doctrine's "attorney supremacy" rule operationalized.
 */
function isAaoNamedCite(
  citation: ExtractedCitation,
  caseType: CaseType,
): boolean {
  if (citation.kind !== 'case_name') return false;
  const list = ALLOWLIST[caseType];
  if (!list) return false;
  return list.case_law.some(
    (entry) =>
      entry.name === citation.normalized &&
      (entry.court === 'AAO' || entry.court === 'BIA') &&
      entry.reporters.length === 0,
  );
}

export interface CheckResult {
  status: CitationVerifyStatus;
  message: string;
}

export function checkCitation(
  citation: ExtractedCitation,
  caseType: CaseType,
): CheckResult {
  if (isAaoNamedCite(citation, caseType)) {
    return {
      status: 'aao_route_to_human',
      message: `AAO citation ${citation.normalized} cannot be mechanically verified — routed to human review queue per ccc-doctrine attorney-supremacy rule.`,
    };
  }

  const list = ALLOWLIST[caseType];
  if (!list) {
    return {
      status: 'off_allowlist',
      message: `No allowlist defined for case type ${caseType}.`,
    };
  }

  switch (citation.kind) {
    case 'ina':
    case 'cfr':
      if (
        stemMatchAny(citation.normalized, list.statutes) ||
        stemMatchAny(citation.normalized, list.regulations)
      ) {
        return { status: 'on_allowlist', message: 'OK — on allowlist.' };
      }
      break;
    case 'fam':
    case 'uscis_pm':
      if (stemMatchAny(citation.normalized, list.agency)) {
        return { status: 'on_allowlist', message: 'OK — on allowlist.' };
      }
      break;
    case 'case_name':
      if (list.case_law.some((e) => e.name === citation.normalized)) {
        return { status: 'on_allowlist', message: 'OK — on allowlist.' };
      }
      break;
    case 'reporter_in_dec':
    case 'reporter_federal':
      if (
        list.case_law.some((e) => e.reporters.includes(citation.normalized))
      ) {
        return { status: 'on_allowlist', message: 'OK — on allowlist.' };
      }
      break;
    case 'unknown':
      return {
        status: 'unparseable',
        message: `Could not classify citation: ${citation.raw}`,
      };
  }

  return {
    status: 'off_allowlist',
    message: `Citation "${citation.raw}" is not on the ${caseType} allowlist. Either add it to lib/authorities/allowlist.json (with primary-source justification) or replace with [CITE NEEDED: <subject>].`,
  };
}
