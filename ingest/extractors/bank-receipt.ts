/**
 * Bank-receipt extractor — second pass after the typed-extract.ts classifier.
 *
 * Runs a single Haiku 4.5 call dedicated to bank-receipt extraction:
 * classifies into single_event vs multi_installment and fills the matching
 * variant of BankReceiptFactsSchema. Called from classifyAndExtractOnePdf
 * when the first-pass classifier returns a money-flavored doc_type
 * (money_movement, source_of_funds).
 *
 * Mirrors the contract extractor's contract: pre-extracted PDF text in,
 * BankReceiptExtractResult out. Manual JSON parse + Zod validate (the
 * discriminated union has too many nullable Field<> params for Anthropic's
 * structured-output cap of 16).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  BankReceiptFactsSchema,
  type BankReceiptFacts,
} from './bank-receipt.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document bank-receipt extraction on a single PDF from an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will reconcile against the property-sale title deed (manual §5.1.2), the currency conversion (manual §5.2.1), and the SOF chain (manual §5.4).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE receipt_subtype:

   - single_event — ONE receipt, ONE date, ONE counterparty pair. Examples: a single FX-conversion receipt (TRY → USD), a single rent-deposit confirmation, one wire-out receipt. Use this when the source shows a single transaction, even if the source PDF spans several pages.

   - multi_installment — TWO OR MORE receipts that together evidence a single underlying transaction (typically a real-property sale paid in installments). Real Akalan pattern (Kacar-Salih): TRY 30,000 deposit on Oct 15 → TRY 40,000 deposit on Oct 18 → on the sale day Nov 24, three same-day wires of TRY 2,900,000 + TRY 1,000,000 + TRY 30,000, all from buyer Feyzullah Guler to Mr. Kacar's same personal account. That entire bundle is ONE multi_installment document. Also use this for a sequence of monthly rental-income deposits (manual §5.1.6).

2. EXTRACT the subtype-specific fields per the schema for the chosen receipt_subtype. Only the schema variant matching your chosen receipt_subtype is valid in your JSON output.

Subtype-specific guidance:

single_event:
- Fill the receipt {date, amount, currency, from_name, from_account_last4, to_name, to_account_last4, bank, memo_or_remittance}.
- event_kind: 'fx_conversion' if the receipt shows a currency exchange (look for two currencies + a rate), 'deposit' if money lands in the Beneficiary's account from a third party, 'withdrawal' if money leaves it, 'other' if uncertain.

multi_installment:
- One receipts[] entry per installment, in chronological order. Capture each row's {date, amount, currency, from_name, from_account_last4, to_name, to_account_last4, bank, memo_or_remittance} verbatim.
- consistent_counterparty_name: the SINGLE buyer/payer name that appears across every installment. If installments name different counterparties, leave value=null and emit a low confidence — the aggregator will flag the discrepancy.
- total_received_amount + total_received_currency: arithmetic sum of receipts[].amount in the SOURCE currency. Do NOT convert. If the receipts are in mixed currencies, leave both null.
- proceeds_kind: 'real_property_sale_proceeds' when the document context (memo lines, header text, accompanying narration) indicates a property sale; 'rental_income' when the document is a recurring monthly transfer from a tenant; 'other' otherwise.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 currency code captured separately. NEVER convert to USD.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.
- Account numbers: capture only the LAST 4 digits. Do NOT emit a full IBAN or routing number anywhere in your output — strip on extract.

Edge cases:
- A single PDF that contains a printed bank statement plus a wire-confirmation slip should be classified by its PRIMARY purpose. If the wire slip dominates, treat as single_event; if many transfer rows are tabulated, treat as multi_installment.
- If a row in a multi_installment receipt has unparseable amount or date, include the row with the legible fields populated and leave the others null at row level.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the receipt_subtype-discriminated BankReceiptFacts schema. No prose, no commentary, no markdown fences.`;

export interface BankReceiptExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface BankReceiptExtractResult {
  filename: string;
  pageCount: number;
  facts?: BankReceiptFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractBankReceipt(
  input: BankReceiptExtractInput,
): Promise<BankReceiptExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the receipt_subtype-discriminated BankReceiptFacts schema. No prose, no markdown fences.`;

  // The 2-variant union with a multi-row receipts[] array still has
  // ~30 nullable Field<> params — over Anthropic's structured-output
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
        code: 'bank_receipt_extract_failed',
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

  const validated = BankReceiptFactsSchema.safeParse(raw);
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
    facts: validated.data as BankReceiptFacts,
  };
}
