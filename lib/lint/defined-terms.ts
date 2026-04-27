import type { CaseType } from '@/ingest/schema';
import type { LintFinding } from '@/lib/verify/types';

// Defined-term drift: drafter is supposed to use canonical terms (per
// ccc-doctrine SKILL.md "Drafting voice" section). Synonym usage signals
// either prompt drift or a re-write that lost the convention. We flag rather
// than auto-fix — the reviewer pass decides what to do.

interface CanonicalTerm {
  canonical: string;
  // Patterns that, when found in the letter, suggest the drafter used a
  // synonym in place of the canonical term. Boundaries are word-level so we
  // do not flag substrings inside other words.
  synonyms: RegExp[];
  // Case types this rule applies to. Some terms are case-type specific
  // (e.g., "the Enterprise" only matters for E-2).
  caseTypes: CaseType[];
}

const TERMS: CanonicalTerm[] = [
  {
    canonical: 'the Beneficiary',
    synonyms: [
      /\bthe foreign national\b/g,
      /\bthe applicant\b/g, // for I-140 case types — "Applicant" is wrong; use Beneficiary
    ],
    caseTypes: ['EB1A', 'EB1B', 'EB1C'],
  },
  {
    canonical: 'the Petitioner',
    synonyms: [/\bthe sponsor\b/g, /\bthe employer\b/g],
    caseTypes: ['EB1B', 'EB1C'], // EB-1A is self-petition; EB-1B/C are employer-sponsored
  },
  {
    canonical: 'the Enterprise',
    synonyms: [/\bthe company\b/g, /\bthe firm\b/g, /\bthe LLC\b/g, /\bthe Corp\b/g],
    caseTypes: ['E2'],
  },
  {
    canonical: 'the Applicant',
    synonyms: [/\bthe foreign national\b/g, /\bthe investor\b/g],
    caseTypes: ['E2'], // E-2 visa: party seeking the visa is the "Applicant"
  },
];

function excerptAround(text: string, start: number, end: number, words = 12): string {
  // Pull ~`words` words on either side of the match for context.
  const before = text.slice(0, start).split(/\s+/).slice(-words).join(' ');
  const middle = text.slice(start, end);
  const after = text.slice(end).split(/\s+/).slice(0, words).join(' ');
  return `${before} «${middle}» ${after}`.trim();
}

export function lintDefinedTerms(letter: string, caseType: CaseType): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const term of TERMS) {
    if (!term.caseTypes.includes(caseType)) continue;
    for (const syn of term.synonyms) {
      syn.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = syn.exec(letter)) !== null) {
        findings.push({
          category: 'defined_term_drift',
          message: `Defined-term drift: "${match[0]}" used in place of canonical "${term.canonical}".`,
          excerpt: excerptAround(letter, match.index, match.index + match[0].length),
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }
  return findings;
}
