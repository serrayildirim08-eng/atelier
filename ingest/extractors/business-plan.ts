/**
 * Business-plan rich-extraction second pass (Phase-9). Runs after
 * typed-extract.ts classifies a PDF as doc_type='business_plan'. Pulls
 * year-1 / year-3 / year-5 revenue projections + year-5 employee count
 * — the four numbers consumed by the
 * `five_year_horizon_vs_business_plan_drift` gate.
 *
 * Single Haiku 4.5 call fills BusinessPlanRichFactsSchema. The
 * aggregator (Phase-9 enrichment) writes these onto
 * facts.business_plan_phase9.five_year_horizon.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  BusinessPlanRichFactsSchema,
  type BusinessPlanRichFacts,
} from './business-plan.schema';

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on an E-2 business plan. The document was already classified as doc_type='business_plan'; this second pass pulls the four numeric projections that drive the five_year_horizon_vs_business_plan_drift gate.

Extract the following four fields per BusinessPlanRichFactsSchema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- year_1_revenue_usd: numeric — projected revenue (USD) for Year 1 of the plan (no comma, no $ sign). Look for projection tables, executive-summary numeric callouts, "Year 1 Revenue" rows. Confidence 0.9 verbatim, 0.6 inferred (e.g., monthly × 12), 0.4 heuristic (e.g., chart only).
- year_3_revenue_usd: numeric — projected revenue (USD) for Year 3.
- year_5_revenue_usd: numeric — projected revenue (USD) for Year 5.
- year_5_employee_count: integer — projected total US workforce (excluding the Beneficiary if specified separately, otherwise total) at the end of Year 5. Look for hire-plan tables, "Year 5 Headcount", "FTE", "Total Employees by Year 5". Confidence 0.9 verbatim, 0.6 inferred (e.g., sum of department-level rows), 0.4 heuristic.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source containing or directly evidencing the value.
- confidence is in [0, 1]; do not emit values below 0.3.

Output: ONE JSON object matching BusinessPlanRichFactsSchema. No prose, no commentary, no markdown fences.`;

export interface BusinessPlanExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface BusinessPlanExtractResult {
  filename: string;
  pageCount: number;
  facts?: BusinessPlanRichFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractBusinessPlan(
  input: BusinessPlanExtractInput,
): Promise<BusinessPlanExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the BusinessPlanRichFacts schema. No prose, no markdown fences.`;

  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'business_plan_extract_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'json_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const validated = BusinessPlanRichFactsSchema.safeParse(raw);
  if (!validated.success) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'schema_mismatch',
        message: validated.error.message.slice(0, 500),
      },
    };
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-haiku-4-5',
    case_type: 'E2',
    usage: response.usage,
  });

  return {
    filename: input.filename,
    pageCount: input.pageCount,
    facts: validated.data as BusinessPlanRichFacts,
  };
}
