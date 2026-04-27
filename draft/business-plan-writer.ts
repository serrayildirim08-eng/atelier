/**
 * Business-plan writer (drafter side).
 *
 * Produces a structured 5-year business plan ready for Tab G-8 / Tab
 * H-1 of the petition exhibits. The plan is held to the Matter of Ho,
 * 19 I&N Dec. 582 (BIA 1988) "comprehensive, credible, and verifiable"
 * standard — the system prompt invokes that authority anchor and
 * enforces a strict refusal contract: every projected figure must
 * carry a `source` field, and where no primary source exists the
 * source MUST be the literal sentinel '[ASSUMED — verify before
 * filing]' so the attorney's last-pass review can find unverified
 * numbers before signing.
 *
 * Sonnet 4.6, adaptive thinking on, effort 'high'. zodOutputFormat
 * with BusinessPlanSchema. cache_control ttl '1h' on the system prompt.
 */

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import type { E2Facts } from '@/ingest/schema';
import {
  ASSUMED_SENTINEL,
  BusinessPlanSchema,
  type BusinessPlan,
  type FinancialProjections,
  type ProjectedYearPL,
} from './business-plan-writer.schema';

const DEFAULT_TARGET_WORD_COUNT = 5000;

const SYSTEM_PROMPT = `You are an immigration attorney drafting a 5-year business plan for an E-2 Treaty Investor petition exhibit (Tab G-8 / Tab H-1) for Akalan Immigration Law. The plan will be filed with USCIS / a US consulate as part of the cover-letter exhibit set. A real attorney will review and sign the cover letter that incorporates this plan.

AUTHORITY ANCHOR — invoke ONCE at the head of the plan in authority_anchor_note:

By analogy to Matter of Ho, 19 I&N Dec. 582 (BIA 1988) — which holds that a business plan submitted in support of an immigration petition must be "comprehensive, credible, and verifiable" — this plan is structured around verifiable inputs from the petitioner's case file and clearly marked assumptions where primary sources do not yet exist.

The Matter of Ho citation is the SOLE authority cite the writer is permitted to use in the plan. Do NOT introduce other case names, regulations, or federal statutes — those belong in the cover letter, not the business plan. The plan is a commercial document that incorporates an immigration framing, not a legal brief.

REFUSAL CONTRACT — strict (the firm's reputation depends on it):

1. NEVER invent industry numbers. Do not pull figures from your training data. If the input does not contain a primary-source number, write the figure as a defensive description (e.g., "the addressable market is described in [source: not yet cited] and ranges in published industry coverage from $X to $Y") and set the figure's source field to the literal sentinel '${ASSUMED_SENTINEL}'.

2. Every ProjectedFigure (revenue, COGS, gross_profit, operating_expenses, net_income for each of year_1..year_5; breakeven_month) MUST have either:
   (a) a real source URL or citation pulled from the input's industryContext field, OR
   (b) the literal sentinel '${ASSUMED_SENTINEL}' as the source.

3. If you set a figure's source to the sentinel, the figure is still permitted — the plan is allowed to model assumptions — but the attorney needs to see them all in one place. Do NOT bury an assumed figure under a fabricated citation.

4. NEVER cite a URL you have not been given. The market_analysis.source_urls array contains ONLY URLs from the input's industryContext field. An empty array is acceptable.

5. Use ONLY facts from the input caseFacts JSON. Do NOT invent investor names, ownership percentages, enterprise legal name, EIN, formation date, or addresses.

6. If a required caseFacts field is null, mark it inline as [MISSING: <plain-language label of the field>] rather than guessing.

7. Reference source pages from caseFacts only when the field's source_page is non-null, e.g. "(see source p. 3)".

8. Hedge low-confidence facts (caseFacts confidence < 0.6): "the petitioner asserts", "the record indicates".

STRUCTURE — write each section in GitHub-flavored markdown using level-3 (###) sub-headings within the section. The renderer adds level-2 (##) section headings on top, so do NOT add a section's own ## heading inside content_markdown.

Sections (in order, each producing one schema field):

executive_summary:
- 2-4 paragraphs. Identify the enterprise (caseFacts.enterprise.legal_name), the investor (caseFacts.investor.full_name + nationality), the industry (caseFacts.enterprise.industry), the total committed investment (caseFacts.investment.total_committed_usd), and the 5-year vision.
- End with a 4-bullet "Plan thesis" list: market opportunity, competitive position, capital plan, expected outcomes.

market_analysis:
- 4-8 paragraphs covering industry size, growth rate, geographic scope, customer segments, regulatory tailwinds/headwinds, competitive landscape.
- Each industry-data figure MUST cite its primary source by URL inline. ONLY use URLs from the input's industryContext field.
- source_urls (the array field) lists every distinct URL cited inline. If you do not have any URLs in industryContext, leave source_urls=[] and write the section defensively (qualitative, with explicit "[MISSING: industry data — source not yet cited]" markers where a number would otherwise go).

products_or_services:
- 3-6 paragraphs describing the offering, pricing model, unit economics narrative, and (if applicable) IP / trade secrets.
- Pull product line names from caseFacts where available; do NOT invent SKUs or product names.

operational_plan:
- 3-6 paragraphs covering location, premises (cite caseFacts.enterprise.physical_address if present), supply chain, capacity ramp, key milestones with dates.
- If caseFacts contains an investment ledger, walk through how the committed capital is allocated (build-out vs. inventory vs. working capital).

marketing_strategy:
- 2-5 paragraphs covering go-to-market motion, channel mix, customer acquisition, brand position. Tie back to the customer segments named in market_analysis.

management_team:
- 2-4 paragraphs profiling the principal investor (caseFacts.investor — full name, nationality, role) and any additional managers in caseFacts.ownership_chain. Cite CV / credential evidence where present in caseFacts. This is the section where the develop-and-direct narrative is tee'd up — explicitly walk the investor's executive role.
- If caseFacts.ownership_chain is empty, write the section around the principal investor only and note "[MISSING: additional management team — none present in caseFacts.ownership_chain]".

financial_projections — STRUCTURED, not free-form. Populate year_1 through year_5 with the five line items each (revenue, cogs, gross_profit, operating_expenses, net_income). EACH ProjectedFigure MUST carry a source. Either:
- a real URL/citation from industryContext (when the figure is anchored to a published benchmark), OR
- the literal sentinel '${ASSUMED_SENTINEL}' (when the figure is a modeled assumption).
hiring_schedule_markdown: a markdown table with columns "Year | Role | FTE adds | Cumulative FTE". Pull the W-2 hiring narrative from caseFacts.elements_evidence.more_than_marginal_basis where present.
breakeven_month: a ProjectedFigure whose value is a string like "Month 14" or "Month 22". The source field follows the same refusal rule.

growth_strategy:
- 3-5 paragraphs covering year 3-5 strategic moves: geographic expansion, new product lines, partnership / M&A possibilities, exit considerations.
- This is where the long-term "more than marginal" argument is reinforced — tie growth to projected employment scale and economic contribution.

LENGTH:
- The plan should target the user-supplied targetWordCount (default 5000 words). Do not pad — if the inputs only support a 3500-word plan honestly, write 3500 words rather than fabricating content to hit the target.

TONE:
- Professional commercial-document register. The plan is read by USCIS adjudicators alongside the cover letter; it must read like a real business plan, not legal prose. Avoid statutory citations beyond the single Matter of Ho anchor.
- First-person plural ("we", "our") OR third-person enterprise voice ("[Enterprise] will…"). Pick ONE and use it consistently.

Output: ONE JSON object matching the BusinessPlanSchema. No prose outside the schema fields.`;

export interface DraftBusinessPlanInputs {
  caseFacts: E2Facts;
  /**
   * Optional industry-context block the writer may cite from. Free-form
   * text — the firm builds it from its research/ folder + recent
   * web-fetch results before invoking the writer. Every URL in this
   * blob is fair to cite in market_analysis.source_urls. URLs NOT in
   * this blob are fabrications and the refusal contract forbids them.
   */
  industryContext?: string;
  /** Defaults to 5000. */
  targetWordCount?: number;
}

export interface BusinessPlanResult {
  plan: BusinessPlan;
  rendered_markdown: string;
  /**
   * Audit trail for the attorney's last-pass review: every ProjectedFigure
   * whose source is the [ASSUMED] sentinel. Empty array = the writer was
   * able to source every projected number.
   */
  assumed_figures: AssumedFigureRow[];
  usage: { input_tokens: number; output_tokens: number };
}

/** One audit row per [ASSUMED] figure surfaced by `assumed_figures`. */
export interface AssumedFigureRow {
  /** Path into the BusinessPlan (e.g., "financial_projections.year_2.revenue"). */
  path: string;
  /** The value the writer modeled (e.g., "$1,800,000"). */
  value: string;
}

const BUSINESS_PLAN_FORMAT = zodOutputFormat(BusinessPlanSchema);

const PL_LINE_ITEM_KEYS = [
  'revenue',
  'cogs',
  'gross_profit',
  'operating_expenses',
  'net_income',
] as const;

/**
 * Walk the structured projections and return one row per ProjectedFigure
 * whose source is the [ASSUMED] sentinel. Pure / deterministic — exposed
 * for tests.
 */
export function collectAssumedFigures(plan: BusinessPlan): AssumedFigureRow[] {
  const rows: AssumedFigureRow[] = [];
  const proj = plan.financial_projections;
  const yearKeys = ['year_1', 'year_2', 'year_3', 'year_4', 'year_5'] as const;
  for (const yearKey of yearKeys) {
    const year: ProjectedYearPL = proj[yearKey];
    for (const lineKey of PL_LINE_ITEM_KEYS) {
      const fig = year[lineKey];
      if (fig.source === ASSUMED_SENTINEL) {
        rows.push({
          path: `financial_projections.${yearKey}.${lineKey}`,
          value: fig.value,
        });
      }
    }
  }
  if (proj.breakeven_month.source === ASSUMED_SENTINEL) {
    rows.push({
      path: 'financial_projections.breakeven_month',
      value: proj.breakeven_month.value,
    });
  }
  return rows;
}

/**
 * Render a BusinessPlan into the canonical Tab G-8 / Tab H-1 markdown
 * shape. Section headings are level-2 (##); the writer's content_markdown
 * uses level-3 (###) sub-headings inside each section. Financial
 * projections are rendered as a single P&L table (years × line items).
 */
export function renderBusinessPlanMarkdown(plan: BusinessPlan): string {
  const parts: string[] = [];
  parts.push(`> ${plan.authority_anchor_note.trim()}`);

  parts.push(`## Executive Summary\n\n${plan.executive_summary.content_markdown.trim()}`);
  parts.push(`## Market Analysis\n\n${plan.market_analysis.content_markdown.trim()}`);
  if (plan.market_analysis.source_urls.length > 0) {
    parts.push(
      `### Sources cited in market analysis\n\n${plan.market_analysis.source_urls
        .map((u) => `- ${u}`)
        .join('\n')}`,
    );
  }
  parts.push(
    `## Products and Services\n\n${plan.products_or_services.content_markdown.trim()}`,
  );
  parts.push(
    `## Operational Plan\n\n${plan.operational_plan.content_markdown.trim()}`,
  );
  parts.push(
    `## Marketing Strategy\n\n${plan.marketing_strategy.content_markdown.trim()}`,
  );
  parts.push(
    `## Management Team\n\n${plan.management_team.content_markdown.trim()}`,
  );

  parts.push(renderFinancialProjections(plan.financial_projections));

  parts.push(
    `## Growth Strategy\n\n${plan.growth_strategy.content_markdown.trim()}`,
  );

  return parts.join('\n\n');
}

function renderFinancialProjections(proj: FinancialProjections): string {
  const lines: string[] = [];
  lines.push('## Financial Projections');
  lines.push('');
  lines.push('### Five-year P&L');
  lines.push('');
  lines.push('| Line item | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const key of PL_LINE_ITEM_KEYS) {
    const label = key
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    const cells = [
      proj.year_1[key].value,
      proj.year_2[key].value,
      proj.year_3[key].value,
      proj.year_4[key].value,
      proj.year_5[key].value,
    ];
    lines.push(`| ${label} | ${cells.join(' | ')} |`);
  }
  lines.push('');
  lines.push('### Hiring schedule');
  lines.push('');
  lines.push(proj.hiring_schedule_markdown.trim());
  lines.push('');
  lines.push('### Breakeven');
  lines.push('');
  lines.push(`Projected breakeven: ${proj.breakeven_month.value}.`);
  lines.push('');
  lines.push('### Sources for projected figures');
  lines.push('');
  lines.push('| Figure | Source |');
  lines.push('| --- | --- |');
  const yearKeys = ['year_1', 'year_2', 'year_3', 'year_4', 'year_5'] as const;
  for (const yearKey of yearKeys) {
    for (const lineKey of PL_LINE_ITEM_KEYS) {
      const fig = proj[yearKey][lineKey];
      lines.push(`| ${yearKey}.${lineKey} (${fig.value}) | ${fig.source} |`);
    }
  }
  lines.push(
    `| breakeven_month (${proj.breakeven_month.value}) | ${proj.breakeven_month.source} |`,
  );
  return lines.join('\n');
}

export async function draftBusinessPlan(
  inputs: DraftBusinessPlanInputs,
): Promise<BusinessPlanResult> {
  const targetWordCount = inputs.targetWordCount ?? DEFAULT_TARGET_WORD_COUNT;
  const factsJson = JSON.stringify(inputs.caseFacts, null, 2);

  const industryBlock = inputs.industryContext
    ? `## Industry context (only sources / URLs in this block may be cited)\n\n${inputs.industryContext}`
    : `## Industry context\n\n(none provided — write the market analysis defensively; do NOT cite any URL or numerical industry datum, and use the [ASSUMED — verify before filing] sentinel for every projected figure)`;

  const factsBlock = `## Case facts (each value carries source_page, source_quote, confidence)\n\n\`\`\`json\n${factsJson}\n\`\`\``;

  const userMessage = `Draft the 5-year business plan using the case facts and (where present) the industry-context block in the system. Target length: ${targetWordCount} words.`;

  const response = await getAnthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: BUSINESS_PLAN_FORMAT,
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
      {
        type: 'text',
        text: industryBlock,
        cache_control: { type: 'ephemeral', ttl: '5m' },
      },
      {
        type: 'text',
        text: factsBlock,
        cache_control: { type: 'ephemeral', ttl: '5m' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  if (!response.parsed_output) {
    throw new Error(
      'Business-plan response did not match the BusinessPlan schema',
    );
  }

  logAnthropicUsage({
    stage: 'draft',
    model: 'claude-sonnet-4-6',
    case_type: 'E2',
    usage: response.usage,
  });

  const plan = response.parsed_output;
  return {
    plan,
    rendered_markdown: renderBusinessPlanMarkdown(plan),
    assumed_figures: collectAssumedFigures(plan),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
