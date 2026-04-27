/**
 * Incentive-document rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='business_contract' AND the content
 * references incentives / tax credits / grants / IRA / PTC. Single Haiku
 * 4.5 call fills IncentiveDocumentFactsSchema. The aggregator runs a
 * deterministic gate: recipient_legal_name !== Petitioner.legal_name →
 * severity-3 'incentive_recipient_mismatch'.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  IncentiveDocumentFactsSchema,
  type IncentiveDocumentFacts,
} from './incentive-document.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a government-incentive document for an E-2 Treaty Investor case. The document evidences a Production Tax Credit (PTC), Inflation Reduction Act (IRA) credit, state economic development credit, federal grant, tax exemption, or similar award to the Petitioner enterprise. The aggregator uses your output to anchor the FINANCIAL SITUATION AND FUTURE PLANS section of the cover letter AND to gate that the recipient is the Petitioner (an incentive awarded to the Beneficiary personally cannot be claimed as enterprise capacity).

Extract the following fields per the IncentiveDocumentFacts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- incentive_type:
  - 'PTC' — federal Production Tax Credit (e.g., IRC §45 / §45Y for clean electricity production; IRC §45X for advanced-manufacturing components).
  - 'IRA' — Inflation Reduction Act of 2022 program label that doesn't fit a more specific PTC bucket (energy community bonus, domestic content bonus, §48E investment tax credit, §45V hydrogen, §45Q sequestration). Use 'PTC' for clean-electricity production explicitly; 'IRA' for the broader IRA-program awards.
  - 'state_credit' — any US state-level credit, exemption, or rebate (e.g., South Carolina Job Tax Credit, Georgia Quality Jobs Credit, California CalCompetes).
  - 'federal_grant' — direct federal grant award (DOE, EDA, USDA, NSF, NIH, DOD).
  - 'tax_exemption' — sales-tax / property-tax / FILOT (Fee in Lieu of Taxes) exemption agreements; abatement letters.
  - 'other' — does not fit above; capture program label in conditions_verbatim.
- issuing_authority: the FULL legal name of the agency / department / state office issuing the award (e.g., "U.S. Department of Energy", "South Carolina Coordinating Council for Economic Development", "Internal Revenue Service"). Capture verbatim.
- recipient_legal_name: the FULL legal name of the recipient entity AS IT APPEARS ON THE AWARD. Critical for the recipient-mismatch gate — must match the US Petitioner. If the award is in the name of a parent entity, a sister entity, or the Beneficiary individually, capture verbatim; the gate will surface the conflict.
- value_amount + value_currency: the maximum award value as stated. For PTCs / per-unit credits, capture the AGGREGATE value when the document states one (e.g., "estimated $35M over 10 years"); if only a per-unit rate is stated, leave value=null and capture the per-unit formula in conditions_verbatim. ISO-4217 currency code captured separately. Most US incentives are USD; do not assume.
- term_years: duration in years over which the incentive applies. PTCs are typically 10 years; state job-tax credits often 5 years. If the term is "perpetual" or "until law sunset", value=null and note in conditions_verbatim.
- conditions_verbatim: 1-3 short verbatim quotes (combined ≤ 800 chars) covering the most material conditions — clawback triggers, employment thresholds, capital-investment thresholds, prevailing-wage / apprenticeship requirements, sunset dates. Quote DIRECTLY; do not paraphrase. The drafter cites these to anchor the FINANCIAL SITUATION narrative AND to flag dependencies the attorney must verify before relying on the incentive.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words).
- confidence is in [0, 1]; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 captured separately.
- Dates / durations: term_years as a number; if the document states a date range, compute the difference rounded to one decimal year.

Edge cases:
- If a single PDF contains multiple distinct incentives stacked (common for IRA + state credits in the same award letter), classify by the document's PRIMARY award (largest value or first listed) and capture secondary incentives in conditions_verbatim.
- If the document is the enterprise's APPLICATION FOR an incentive (not the award letter), still extract — capture intended values and mark conditions_verbatim with "[application — not yet awarded]" prefix.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.
- If the document is a normal customer/vendor commercial contract with no government-incentive content, do NOT extract; return all fields null. The aggregator's content-pattern router will mark this as a misroute.

Output: ONE JSON object matching IncentiveDocumentFactsSchema. No prose, no commentary, no markdown fences.`;

export interface IncentiveDocumentExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface IncentiveDocumentExtractResult {
  filename: string;
  pageCount: number;
  facts?: IncentiveDocumentFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractIncentiveDocument(
  input: IncentiveDocumentExtractInput,
): Promise<IncentiveDocumentExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the IncentiveDocumentFacts schema. No prose, no markdown fences.`;

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
        code: 'incentive_document_extract_failed',
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

  const validated = IncentiveDocumentFactsSchema.safeParse(raw);
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
    facts: validated.data as IncentiveDocumentFacts,
  };
}
