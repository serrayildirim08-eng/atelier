/**
 * Customer-contract rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='business_contract' AND the filename or
 * content matches the customer-commitment pattern (offtake / supply / MSA
 * / distribution / long-term agreement). Single Haiku 4.5 call fills
 * CustomerContractFactsSchema (manual MANUAL-SUBTYPE-4 §3.8.2). The
 * aggregator surfaces the resulting commitments in the cover-letter
 * DOING BUSINESS section as anchors for the substantiality + marginality
 * argument.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  CustomerContractFactsSchema,
  type CustomerContractFacts,
} from './customer-contract.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a customer-commitment commercial contract for an E-2 Treaty Investor case (manual MANUAL-SUBTYPE-4 §3.8.2). The document is typically an offtake agreement, supply agreement, master services agreement (MSA), distribution agreement, or long-term commercial commitment between the Petitioner (US treaty enterprise) and a customer. The aggregator uses your output to evidence future revenue and market validation in the cover-letter DOING BUSINESS section.

Extract the following fields per the CustomerContractFacts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- customer_legal_name: the FULL legal name of the customer counterparty (e.g., "POWIN, LLC", "Tesla, Inc."). Do NOT abbreviate — pull the name exactly as it appears in the parties block / signature block / preamble.
- agreement_type:
  - 'offtake' — customer commits to purchase a stated quantity over a stated term (most common Tab H exhibit; e.g., "Buyer shall purchase 7.5 GWh of battery cells over 5 years").
  - 'supply' — recurring supply of goods/services without a fixed total quantity guarantee.
  - 'MSA' — master services agreement governing future statements of work.
  - 'distribution' — customer is granted distribution rights for the Petitioner's products in a defined territory.
  - 'other' — does not fit above; capture the agreement's self-description in key_terms_verbatim.
- total_value_amount + total_value_currency: aggregate contract value as stated. Many offtakes state value as "approximately $1B" or "USD 1,000,000,000 over 5 years"; capture the number with symbols/commas stripped and the ISO-4217 currency code separately. If only quantity × indexed price is stated (no aggregate dollar number), leave value=null and capture the formula in key_terms_verbatim.
- term_years: contract term in years. If stated in months, convert (months / 12, rounded to one decimal). If perpetual / evergreen, value=null and note in key_terms_verbatim.
- quantity_committed: the unit quantity the customer commits to (verbatim, e.g., "7.5 GWh", "150,000 units", "up to 50 MW"). Free-text Field<string>; preserve the unit.
- pricing_basis:
  - 'fixed' — the price per unit is stated as a fixed number that does not move with a market index.
  - 'active_market' — price floats against an external market or commodity index (e.g., "spot LME copper + 5%").
  - 'cost_plus' — price = cost + a stated margin.
  - 'other' — does not fit above; capture verbatim in key_terms_verbatim.
- execution_date: ISO YYYY-MM-DD when the agreement was signed by both parties. If only one party's signature is dated, prefer the later date. Format ambiguous → leave value=null.
- key_terms_verbatim: 1-3 short verbatim quotes (combined ≤ 800 chars) covering the most material commercial terms — quantity, pricing, term, exclusivity, take-or-pay, early-termination penalties. Quote DIRECTLY from the source; do not paraphrase. This anchors the drafter's DOING BUSINESS narrative.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: extract amounts as numbers with symbols/commas stripped and capture the ISO-4217 currency code separately. Do not convert to USD here — the aggregator handles FX.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.

Edge cases:
- If a single PDF contains multiple distinct customer agreements, classify by the document's PRIMARY commitment and capture secondary content in key_terms_verbatim.
- If a document is partially OCR-garbled, extract what is legible; leave noisy fields null.
- If the contract counterparty appears to be a vendor/supplier rather than a customer (i.e., the Petitioner is buying), do NOT extract; return all fields null. The aggregator's filename router will mark this as a misroute.

Output: ONE JSON object matching CustomerContractFactsSchema. No prose, no commentary, no markdown fences.`;

export interface CustomerContractExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface CustomerContractExtractResult {
  filename: string;
  pageCount: number;
  facts?: CustomerContractFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractCustomerContract(
  input: CustomerContractExtractInput,
): Promise<CustomerContractExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the CustomerContractFacts schema. No prose, no markdown fences.`;

  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
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
        code: 'customer_contract_extract_failed',
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

  const validated = CustomerContractFactsSchema.safeParse(raw);
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
    facts: validated.data as CustomerContractFacts,
  };
}
