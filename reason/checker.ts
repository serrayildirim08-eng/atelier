import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { E2Facts } from '@/ingest/schema';
import { ReviewReportSchema, type ReviewReport } from './schema';

const SYSTEM_PROMPT = `You are a senior US immigration attorney conducting a pre-submission review of a draft E-2 Treaty Investor visa cover letter. Your job is to catch errors and weaknesses BEFORE the petition is filed with USCIS, while there is still time to fix them.

You receive two inputs:
1. Facts — Structured JSON extracted from the client's source documents. Each value carries source_page, source_quote, and confidence.
2. Draft cover letter — A draft built from those facts, addressing the five E-2 statutory elements.

Conduct four checks and produce a structured review report.

## Check 1: Grounding (no hallucination)

For every SPECIFIC FACTUAL CLAIM ABOUT THE CASE (applicant name/dob/passport/country, business name/EIN/address, dollar amounts, ownership percentages, employee counts, dates, source-of-funds details, business activities), cross-reference the facts JSON.
- A claim that contradicts the facts: severity=critical, category=contradicts_facts.
- A claim that introduces specific case information NOT derivable from the facts JSON: severity=major, category=hallucination.
- Generic legal boilerplate, statutory citations, procedural language, and rhetorical framing are NOT subject to this check.
- [MISSING: <field>] markers in the draft are correctly flagged gaps. Do NOT flag them as inconsistencies.

## Check 2: Internal consistency

For every dollar amount, date, name, and address mentioned more than once in the draft:
- Verify the value appears identically each time. "$150,000" and "$150,000.00" together in the same letter is an internal inconsistency.
- Names spelled differently across sections, dates in different formats, addresses with discrepancies — flag each (category=internal_inconsistency).
- Severity: minor for purely cosmetic; major if the variance could create legal ambiguity.

## Check 3: Element coverage

For each of the five E-2 statutory elements:
1. treaty_country — applicant's nationality of a treaty country
2. substantial_investment — substantial capital invested or actively being invested, irrevocably committed and at risk
3. real_and_operating — real, active commercial enterprise (not paper)
4. more_than_marginal — generates more than minimal living, or significant economic contribution
5. develop_and_direct — applicant develops and directs (typically >=50% ownership or operational control)

Determine whether the draft ARGUES each element by linking specific facts from the case to the legal standard, versus merely RECITING the legal standard. A section that quotes the rule but never names the relevant case facts is a missing argument. Add one missing_arguments entry per element with insufficient argument.

## Check 4: USCIS RFE risk

Identify weak spots a USCIS officer would likely issue an RFE (Request for Evidence) on. Common patterns:
- Investment amount not clearly traced into the enterprise
- Source of funds / lawful source not addressed
- Marginality not addressed quantitatively (no income projections, no employee plan, no break-even)
- Develop-and-direct ambiguity (ownership % unclear, who actually controls operations)
- Real-and-operating thin (no operations, no premises, no contracts, no customers)
- Substantial investment ratio (capital relative to total enterprise cost) not addressed
- Treaty country status not pinned to a specific treaty / current eligibility list

Each weak_spots entry: severity, the element it relates to (or "general"), description, the specific rfe_risk, and a concrete suggestion to strengthen.

## Severity rubric

- critical: would cause denial or constitute a fundamental misrepresentation. Use sparingly.
- major: would likely draw an RFE; substantive issue requiring revision before filing.
- minor: cosmetic, formatting, low risk of RFE.

## Output rules

- Be specific. For each finding, quote a SHORT excerpt (<= 30 words) from the letter so the reviewer can locate it. letter_excerpt may be null for findings that are about an absence rather than a specific passage.
- Do NOT pad. If there are no findings in a category, return an empty array. Do not invent findings to fill space.
- summary: 1-3 sentences capturing the overall verdict.
- overall_assessment:
  - ready: no critical or major findings; minor cleanup only.
  - minor_revisions: a small number of major findings, fixable in under an hour.
  - major_revisions: several major findings, or one critical finding.
  - not_ready: critical errors that require restarting sections of the letter.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface ReviewResult {
  report: ReviewReport;
  usage: { input_tokens: number; output_tokens: number };
}

export async function checkE2Draft(
  facts: E2Facts,
  draft: string,
): Promise<ReviewResult> {
  const response = await client().messages.parse({
    model: 'claude-opus-4-7',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: zodOutputFormat(ReviewReportSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Review this E-2 cover letter draft against the source facts.\n\n## Facts (each value carries source_page, source_quote, confidence)\n\n\`\`\`json\n${JSON.stringify(facts, null, 2)}\n\`\`\`\n\n## Draft cover letter\n\n${draft}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error('Reviewer response did not match the review report schema');
  }

  return {
    report: response.parsed_output,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
