/**
 * Wire-confirmation extractor — second pass after the typed-extract.ts
 * classifier. Runs a single Haiku 4.5 call dedicated to wire / SWIFT
 * extraction: classifies into one of three wire subtypes and fills the
 * matching variant of WireConfirmationFactsSchema. Called from
 * classifyAndExtractOnePdf when the first-pass classifier returns
 * money_movement.
 *
 * Mirrors the contract extractor's contract: pre-extracted PDF text in,
 * WireConfirmationExtractResult out. Manual JSON parse + Zod validate
 * (the discriminated union exceeds Anthropic's structured-output cap).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  WireConfirmationFactsSchema,
  type WireConfirmationFacts,
} from './wire-confirmation.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document wire-confirmation extraction on a single PDF from an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will reconcile against the SOF chain (manual §5.4) and the FX-validation gate (manual §5.2.1).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE wire_subtype:

   - international_wire_with_fx — a cross-border wire that bundles a currency conversion. The receipt shows BOTH a source amount in one currency AND a target amount in another (typically TRY → USD or EUR → USD), plus an exchange rate. This includes (a) standalone FX conversion receipts (manual §5.2.1) and (b) SWIFT confirmations where the source is debited in one currency and credited in another. Real Akalan example (Kacar-Salih): TRY 4,086,900.00 converted to USD 95,600.00 at 42.75000 TRY/USD on Nov 25, 2025.

   - usd_only_wire — a wire in a SINGLE currency, typically USD, with no conversion. The receipt shows one amount, one currency, and no exchange rate. This includes (a) the §5.2.3 close-of-chain wire from Beneficiary's US account to Co-Owner / Petitioner account, and (b) any USD-to-USD international SWIFT.

   - corporate_funding — a Subtype-4 (Camural / corporate-owned investor) pattern: a corporate parent entity funds its US subsidiary, both holding USD accounts. The sender is a corporate entity (not a natural person), the receiver is the Petitioner or another subsidiary, and no FX is involved. Distinguished from usd_only_wire by the corporate-to-corporate party structure and the funding intent (capital contribution or intercompany loan), which the aggregator routes into a different SOF leg.

2. EXTRACT the subtype-specific fields per the schema for the chosen wire_subtype. Only the schema variant matching your chosen wire_subtype is valid in your JSON output.

Subtype-specific guidance:

international_wire_with_fx:
- swift_mt103_reference: the unique reference number from a SWIFT MT103 message (alphanumeric, often 16 chars; sometimes labeled "Reference", "REF", "TRN", or "UETR"). Leave value=null if not visible.
- sender / receiver: each carries {holder_name, account_last4, bank, bank_country}. CAPTURE ONLY THE LAST 4 DIGITS of any account / IBAN — never the full number.
- source_amount + source_currency: the amount that left the sender, in the original currency (e.g., 4086900 TRY).
- target_amount + target_currency: the amount that landed at the receiver, in the converted currency (e.g., 95600 USD).
- exchange_rate: as printed on the receipt. If the receipt shows "1 USD = 42.75 TRY", emit 42.75. If "1 TRY = 0.0234 USD", emit 0.0234 — the FX gate downstream tries both directions, so do not invert.

usd_only_wire:
- swift_mt103_reference: same handling as above.
- amount + currency: the single amount and ISO-4217 currency.
- remittance_information: any memo / reference text the wire carries.

corporate_funding:
- parent_entity / subsidiary_entity: each carries {holder_name, account_last4, bank, bank_country}. The holder_name MUST be a corporate entity (LLC, Corp, Inc., Pte Ltd, Ltd, GmbH, etc.) — if either party is a natural person, you have likely picked the wrong wire_subtype.
- funding_purpose: 'capital_contribution' if the memo / context indicates equity injection or member capital; 'intercompany_loan' if the document characterizes it as a loan, advance, or note; 'other' if uncertain. A loan may trigger 9 FAM 402.9-6(C)(2) at-risk concerns later, so do not silently classify a loan as a capital contribution.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 currency code captured separately. NEVER convert to USD.
- Dates: prefer ISO YYYY-MM-DD (value_date is the bank's settlement date, not the instruction date if both are present); if format ambiguous (MM/DD vs DD/MM), leave value=null.
- Account numbers: capture only the LAST 4 digits. Do NOT emit a full IBAN, routing number, or account number anywhere — strip on extract.

Edge cases:
- A receipt that mentions a currency conversion in passing but settles in a single currency (e.g., a USD wire whose memo references "converted from TRY at branch") is usd_only_wire, not international_wire_with_fx — pick the variant by what the wire ITSELF moved, not by upstream history.
- If a single PDF contains multiple distinct wires, classify by the PRIMARY wire and note any secondary wires briefly in remittance_information / source_quote.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the wire_subtype-discriminated WireConfirmationFacts schema. No prose, no commentary, no markdown fences.`;

export interface WireConfirmationExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface WireConfirmationExtractResult {
  filename: string;
  pageCount: number;
  facts?: WireConfirmationFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractWireConfirmation(
  input: WireConfirmationExtractInput,
): Promise<WireConfirmationExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the wire_subtype-discriminated WireConfirmationFacts schema. No prose, no markdown fences.`;

  // The 3-variant union with PartyEndpointSchema sub-objects has ~50
  // nullable Field<> params — over Anthropic's structured-output
  // union-param cap (16). Use manual JSON parse + Zod validate.
  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
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
        code: 'wire_confirmation_extract_failed',
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

  const validated = WireConfirmationFactsSchema.safeParse(raw);
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
    facts: validated.data as WireConfirmationFacts,
  };
}
