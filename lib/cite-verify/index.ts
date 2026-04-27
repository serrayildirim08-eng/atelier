import type { CaseType } from '@/ingest/schema';
import { extractCitations } from './extract';
import { checkCitation } from './allowlist';
import type { CitationVerifyResult, CitationVerifyFinding } from '@/lib/verify/types';

export { extractCitations } from './extract';
export { checkCitation } from './allowlist';

export function verifyCitations(letter: string, caseType: CaseType): CitationVerifyResult {
  const citations = extractCitations(letter);
  const findings: CitationVerifyFinding[] = citations.map((citation) => {
    const { status, message } = checkCitation(citation, caseType);
    return { citation, status, message };
  });

  return {
    case_type: caseType,
    total_citations: findings.length,
    on_allowlist: findings.filter((f) => f.status === 'on_allowlist').length,
    off_allowlist: findings.filter((f) => f.status === 'off_allowlist').length,
    aao_routed: findings.filter((f) => f.status === 'aao_route_to_human').length,
    unparseable: findings.filter((f) => f.status === 'unparseable').length,
    findings,
  };
}
