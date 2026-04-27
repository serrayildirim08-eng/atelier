import type { LintFinding } from '@/lib/verify/types';

// Citation-format lint: catch surface-form drift in citations that PASS the
// allowlist but use the wrong house style. Examples flagged:
//   - INA section symbol missing: "INA 101" should be "INA § 101"
//   - CFR section symbol missing: "8 CFR 214.2" should be "8 CFR § 214.2"
//   - "Vol 6" missing the period: "Vol. 6"
//
// Authority-allowlist enforcement is in lib/cite-verify/. This is purely
// stylistic.

interface FormatRule {
  pattern: RegExp;
  message: string;
}

const RULES: FormatRule[] = [
  {
    pattern: /\bINA\s+(?!§|Sec\.?|Section)\d/g,
    message: 'INA citation missing section symbol — use "INA § 101" not "INA 101".',
  },
  {
    pattern: /\b\d+\s+CFR\s+(?!§|Sec\.?|Section)\d/g,
    message: 'CFR citation missing section symbol — use "8 CFR § 214.2" not "8 CFR 214.2".',
  },
  {
    pattern: /\bUSCIS\s+(?:Policy\s+Manual\s+|PM\s+)Vol\s+\d/gi,
    message: 'USCIS PM volume should be "Vol." not "Vol" (period required).',
  },
];

function excerptAround(text: string, start: number, end: number, words = 8): string {
  const before = text.slice(0, start).split(/\s+/).slice(-words).join(' ');
  const middle = text.slice(start, end);
  const after = text.slice(end).split(/\s+/).slice(0, words).join(' ');
  return `${before} «${middle}» ${after}`.trim();
}

export function lintCitationFormat(letter: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(letter)) !== null) {
      findings.push({
        category: 'citation_format',
        message: rule.message,
        excerpt: excerptAround(letter, match.index, match.index + match[0].length),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return findings;
}
