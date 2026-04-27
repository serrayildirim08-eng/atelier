/**
 * Real-estate purchase-agreement rich-extraction second pass — runs after
 * typed-extract.ts classifies a PDF as doc_type='lease_or_property' AND
 * the content references purchase / sale / conveyance / closing language
 * (manual MANUAL-SUBTYPE-4 §3.8.5). Single Haiku 4.5 call fills
 * RealEstatePurchaseFactsSchema. The aggregator runs a deterministic
 * gate: buyer_legal_name !== Petitioner.legal_name → severity-4
 * 'real_estate_buyer_mismatch'.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  RealEstatePurchaseFactsSchema,
  type RealEstatePurchaseFacts,
} from './real-estate-purchase.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a real-estate purchase agreement, deed, or closing document for an E-2 Treaty Investor case (manual MANUAL-SUBTYPE-4 §3.8.5). The Petitioner has acquired (or is acquiring) real property for plant build-out, facility expansion, or operating premises. The aggregator uses your output to evidence at-risk capital deployment AND to gate that the BUYER on the contract is the Petitioner itself (a deed in the Beneficiary's personal name fails the at-risk-of-the-enterprise test).

Extract the following fields per the RealEstatePurchaseFacts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- buyer_legal_name: the FULL legal name of the BUYER as it appears in the parties block / preamble / signature block. Critical for the buyer-mismatch gate — the buyer MUST match the US Petitioner's legal name (e.g., "Camural USA, LLC"). If the buyer is a natural person (the Beneficiary individually), capture verbatim; the gate will surface the conflict.
- seller_legal_name: full legal name of the SELLER. Capture verbatim — do not abbreviate.
- property_address: full street address as written, including unit / parcel descriptors. If the contract refers to a tract by a parcel ID without a street address, capture the parcel ID + county + state.
- property_size_acres: total area in acres. If the contract states square feet, convert (sf / 43,560). If hectares, convert (ha × 2.4710538). Round to two decimals.
- purchase_price_amount + purchase_price_currency: total purchase consideration. Capture the number with symbols/commas stripped and the ISO-4217 currency code separately. If the price is broken into earnest money + balance, capture the AGGREGATE here and note the breakdown only if it appears verbatim in source_quote. Do not convert FX — the aggregator handles it.
- execution_date: ISO YYYY-MM-DD when the agreement was signed by both parties. Format ambiguous → leave value=null.
- closing_date: ISO YYYY-MM-DD scheduled or actual closing. Many agreements state a "Closing Date" in a defined-terms section; prefer that. If the agreement is contingent and no closing has occurred, capture the contemplated closing date and note "scheduled" in source_quote.
- deed_type:
  - 'warranty' — General Warranty Deed (seller warrants title against all defects).
  - 'quitclaim' — Quitclaim Deed (no warranties; weakest evidentiary value).
  - 'special_warranty' — Special / Limited Warranty Deed (seller warrants title only against defects arising during seller's ownership).
  - 'grant' — Grant Deed (typical California; implied minimal warranties).
  - 'other' — does not fit above; capture verbatim language in source_quote.
- title_insurance_present: true if the agreement requires title insurance OR a title insurance policy / title commitment is referenced. False if explicitly waived. Null if not addressed.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 captured separately.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous, leave value=null.
- Booleans: only emit true/false when the source supports it; otherwise null.

Edge cases:
- If a single PDF contains multiple distinct property purchases (rare — multi-tract closings), classify by the document's PRIMARY property and note secondary parcels in source_quote on property_address.
- If the document is a recorded deed (post-closing) rather than a purchase agreement, extract the same fields — buyer = grantee, seller = grantor.
- If the document is a LEASE rather than a purchase, do NOT extract; return all fields null. The aggregator's content-pattern router will mark this as a misroute (the commercial-lease variant of contract-extractor handles leases).
- If the buyer is a natural person and the case folder identifies them as the Beneficiary, still extract — the gate will surface the conflict downstream rather than the extractor silently dropping the document.

Output: ONE JSON object matching RealEstatePurchaseFactsSchema. No prose, no commentary, no markdown fences.`;

export interface RealEstatePurchaseExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface RealEstatePurchaseExtractResult {
  filename: string;
  pageCount: number;
  facts?: RealEstatePurchaseFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractRealEstatePurchase(
  input: RealEstatePurchaseExtractInput,
): Promise<RealEstatePurchaseExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the RealEstatePurchaseFacts schema. No prose, no markdown fences.`;

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
        code: 'real_estate_purchase_extract_failed',
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

  const validated = RealEstatePurchaseFactsSchema.safeParse(raw);
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
    facts: validated.data as RealEstatePurchaseFacts,
  };
}
