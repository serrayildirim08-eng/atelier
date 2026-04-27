import type { CaseType } from '@/ingest/schema';
import type { LintFinding } from '@/lib/verify/types';
import { lintDefinedTerms } from './defined-terms';
import { lintCitationFormat } from './citation-format';

export { lintDefinedTerms } from './defined-terms';
export { lintCitationFormat } from './citation-format';

export function lintDraft(letter: string, caseType: CaseType): LintFinding[] {
  return [...lintDefinedTerms(letter, caseType), ...lintCitationFormat(letter)];
}
