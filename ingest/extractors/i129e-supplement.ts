/**
 * I-129 E Supplement rich-extraction second pass — runs on PDFs detected
 * as the substantive E-2 supplement (Section 1: Treaty Trader / Treaty
 * Investor). Pulls the petitioner's industry classification + NAICS +
 * restated investment amount + treaty country + beneficiary ownership
 * percent. Phase-7 closes the Phase-6 NAICS drift gate to a 3-source
 * comparison (cover_letter ↔ business_plan ↔ I-129E).
 *
 * Single Haiku 4.5 call fills I129ESupplementFactsSchema.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  I129ESupplementFactsSchema,
  type I129ESupplementFacts,
} from './i129e-supplement.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a Form I-129 E Supplement (the substantive E-2 attachment to Form I-129). Your output drives the Phase-6 NAICS drift gate (3-source: cover_letter ↔ business_plan ↔ I-129E) and validates the Phase-1 unaccounted_sof_share gate's claimed amount.

Extract the following fields per I129ESupplementFactsSchema. EVERY leaf field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- industry_classification: short phrase (≤ 200 chars) describing the petitioner's type of business. Look for labelled fields like "Type of business", "Nature of business", "Industry", "Principal product, merchandise, or service" on the supplement. Capture the most descriptive single phrase (e.g., "Full-service restaurant — Mediterranean cuisine", "B2B e-commerce — medium-voltage electrical equipment", "Automotive repair services"). Confidence 0.9 verbatim, 0.6 inferred, 0.4 heuristic. If no industry / type-of-business field is filled, leave value=null.

- naics_code: 6-digit NAICS code if cited on the supplement. Some I-129E supplements include NAICS in a "Type of business" field, others omit it. Confidence 0.9 verbatim. Leave value=null when not cited.

- investment_amount_usd: the "Amount of investment in USD" / "Total cost of the enterprise" / "Amount invested" dollar figure on the supplement. Number only (no comma, no currency symbol). When the supplement distinguishes "amount invested" from "total cost of enterprise", capture the AMOUNT INVESTED. Confidence 0.9 verbatim, never below 0.7.

- treaty_country: the treaty-trader / treaty-investor country (the treaty national's nationality). Look for "Treaty country" / "Country of nationality of treaty-qualifying owners". Capture the country name as written (e.g., "Türkiye", "Turkey", "France"). Confidence 0.9 verbatim.

- beneficiary_ownership_percent: the percent of the petitioner entity owned by the Beneficiary (the treaty-investor named on the I-129). Look for "Percentage owned by treaty-qualifying owners" / "Beneficiary's ownership" / "Ownership percentage". Number 0-100. Confidence 0.9 verbatim.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source.
- confidence is in [0, 1]; do not emit values below 0.3.

Output: ONE JSON object matching I129ESupplementFactsSchema. No prose, no commentary, no markdown fences.`;

export interface I129ESupplementExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface I129ESupplementExtractResult {
  filename: string;
  pageCount: number;
  facts?: I129ESupplementFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractI129ESupplement(
  input: I129ESupplementExtractInput,
): Promise<I129ESupplementExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the I129ESupplementFacts schema. No prose, no markdown fences.`;

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
        code: 'i129e_supplement_extract_failed',
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

  const validated = I129ESupplementFactsSchema.safeParse(raw);
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
    facts: validated.data as I129ESupplementFacts,
  };
}
