import type { CaseType } from '@/ingest/schema';
import { verifyCitations } from '@/lib/cite-verify';
import { lintDraft } from '@/lib/lint';
import type { VerifyReport } from './types';

export type { VerifyReport, LintFinding, CitationVerifyResult, CitationVerifyFinding, ExtractedCitation } from './types';

/**
 * Phase B verification — runs after the drafter, before the reviewer.
 * Returns a structured report the reviewer can use to focus its rewrite
 * on flagged spans rather than re-deriving every check.
 *
 * Pure function (no I/O). All checks are deterministic regex / allowlist
 * passes. CourtListener real-time verification + USCIS PM snapshot lookup
 * are deferred to PR-3b (require external API tokens / scrape data).
 */
export function postDraft(letter: string, caseType: CaseType): VerifyReport {
  const citations = verifyCitations(letter, caseType);
  const lint = lintDraft(letter, caseType);

  const flaggedCount =
    citations.off_allowlist + citations.aao_routed + citations.unparseable + lint.length;

  return {
    case_type: caseType,
    citations,
    lint,
    flagged_count: flaggedCount,
    ok: flaggedCount === 0,
  };
}

/**
 * Render a VerifyReport as a Markdown block the reviewer can read in its
 * user prompt. Truncates if there are many findings.
 */
export function reportToReviewerPrompt(report: VerifyReport): string {
  if (report.ok) {
    return `## Verify report (Phase B)\n\nNo automated findings — proceed with substantive review only.`;
  }

  const parts: string[] = [`## Verify report (Phase B) — ${report.flagged_count} flagged`];

  const offAllowlist = report.citations.findings.filter((f) => f.status === 'off_allowlist');
  if (offAllowlist.length > 0) {
    parts.push(
      '\n### Citations off the per-case-type allowlist (FIX REQUIRED)\n' +
        offAllowlist
          .map(
            (f) =>
              `- \`${f.citation.raw}\` (${f.citation.kind}) — ${f.message}`,
          )
          .join('\n'),
    );
  }

  const aao = report.citations.findings.filter((f) => f.status === 'aao_route_to_human');
  if (aao.length > 0) {
    parts.push(
      '\n### AAO citations routed for human review (DO NOT silently approve)\n' +
        aao.map((f) => `- \`${f.citation.raw}\` — ${f.message}`).join('\n'),
    );
  }

  if (report.lint.length > 0) {
    parts.push(
      '\n### Lint findings (defined-term drift + citation format)\n' +
        report.lint
          .map((f) => `- [${f.category}] ${f.message}\n  Excerpt: ${f.excerpt}`)
          .join('\n'),
    );
  }

  parts.push(
    '\nFocus the rewrite on these specific spans. Other parts of the letter passed verification.',
  );

  return parts.join('\n');
}
