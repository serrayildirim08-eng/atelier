/**
 * Tax-return extractor — second pass after the typed-extract.ts classifier.
 *
 * Runs a single Haiku 4.5 call dedicated to U.S. federal tax-return
 * extraction: classifies into one of six tax_return subtypes and fills
 * the matching variant of TaxReturnFactsSchema. Called from
 * classifyAndExtractOnePdf when the first-pass classifier returns
 * tax_doc.
 *
 * Mirrors the contract / bank-receipt extractor pattern. Manual JSON
 * parse + Zod validate (the discriminated union exceeds Anthropic's
 * structured-output cap).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  TaxReturnFactsSchema,
  type TaxReturnFacts,
} from './tax-return.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document tax-return extraction on a single PDF from an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will reconcile against the I-129 E Supplement and the financial statements (manual §9 marginality + investment-vs-balance-sheet gate).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE tax_return_subtype:

   - form_1120 — IRS Form 1120 (U.S. Corporation Income Tax Return). C-corporation. Carries Schedule L (balance sheet).

   - form_1120s — IRS Form 1120-S (U.S. Income Tax Return for an S Corporation). Carries Schedule L.

   - form_1065 — IRS Form 1065 (U.S. Return of Partnership Income). Used by partnerships and multi-member LLCs. Carries Schedule L. THE MOST COMMON FORM ON E-2 CASES, since most Petitioner LLCs have ≥2 members.

   - form_1040_schedule_c — Schedule C of Form 1040 (Profit or Loss from Business — Sole Proprietorship). Filed by an individual; no entity-level Schedule L.

   - form_1040_k1 — Schedule K-1 issued by a 1065 / 1120-S to a partner / shareholder. Captures the individual's pass-through income and ownership percent — useful for reconciling against the operating-agreement / membership-interest-transfer extractors.

   - other_tax_return — anything else (Form 1040-NR, foreign tax returns, Form 990, Form 5471). Use sparingly.

2. EXTRACT the subtype-specific fields per the schema for the chosen tax_return_subtype. Only the schema variant matching your chosen tax_return_subtype is valid in your JSON output.

Subtype-specific guidance:

form_1120 / form_1120s / form_1065:
- tax_year: YYYY format (the calendar or fiscal year covered by the return).
- ein_or_ssn_last4: capture only the LAST 4 digits of the entity EIN. NEVER emit a full 9-digit EIN.
- entity_legal_name: the entity's name as printed at the top of the return.
- gross_receipts_amount: line 1a (gross receipts or sales, before returns and allowances).
- total_deductions_amount: total deductions line (Form 1120 line 27, 1120-S line 20, 1065 line 21).
- net_income_or_loss_amount: taxable income / ordinary business income line (1120 line 30, 1120-S line 21, 1065 line 22).
- currency: 'USD' for U.S. federal returns. If the document is a foreign equivalent (Turkish "Beyanname" etc.), it should have been classified as 'other_tax_return'.
- schedule_l_total_assets_beginning / schedule_l_total_assets_end: Schedule L line 15 columns (b) and (d). The aggregator runs a deterministic gate comparing schedule_l_total_assets_end to the I-129 E Supplement's investment_amount_usd; values must be in USD.

form_1040_schedule_c:
- tax_year: YYYY.
- ein_or_ssn_last4: last 4 of the filer's SSN (or EIN if the proprietor has one). Last 4 ONLY.
- entity_legal_name: business name from line C; if blank, the proprietor's own name.
- gross_receipts_amount: line 1.
- total_deductions_amount: line 28 (total expenses).
- net_income_or_loss_amount: line 31 (net profit or loss).

form_1040_k1:
- tax_year: YYYY.
- ein_or_ssn_last4: last 4 of the partnership / S-corp EIN (the issuing entity's identifier).
- entity_legal_name: the issuing entity's name (Part I).
- partner_or_shareholder_name: the K-1 recipient's name (Part II line F).
- ownership_percent: the partner/shareholder's ownership percentage as printed (Form 1065 K-1 line J for capital, line K-1 box H1 for 1120-S — capture verbatim percent).
- ordinary_business_income_amount: K-1 box 1 (ordinary business income / loss).
- gross_receipts_amount / total_deductions_amount / net_income_or_loss_amount: most K-1s do NOT carry these at the entity level — leave value=null unless visible.

other_tax_return:
- one_line_summary: what the document is and why it might matter.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped. NEVER convert.
- Dates: prefer ISO YYYY-MM-DD; tax_year is YYYY-only. If format ambiguous, leave value=null.
- SSN / EIN: capture only LAST 4 digits. Stripping is non-negotiable.

Edge cases:
- A return with multiple year copies bundled in one PDF should be classified by its PRIMARY year (the most recent if the document is a current filing; the oldest if it is an audit response). Mention secondary years in source_quote on tax_year.
- A 1065 with a missing or blank Schedule L (small-partnership election) → leave schedule_l_total_assets_* null.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the tax_return_subtype-discriminated TaxReturnFacts schema. No prose, no commentary, no markdown fences.`;

export interface TaxReturnExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface TaxReturnExtractResult {
  filename: string;
  pageCount: number;
  facts?: TaxReturnFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractTaxReturn(
  input: TaxReturnExtractInput,
): Promise<TaxReturnExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the tax_return_subtype-discriminated TaxReturnFacts schema. No prose, no markdown fences.`;

  // The 6-variant union has ~50 nullable Field<> params across variants
  // — over Anthropic's structured-output union-param cap (16). Use
  // manual JSON parse + Zod validate.
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
        code: 'tax_return_extract_failed',
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

  const validated = TaxReturnFactsSchema.safeParse(raw);
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
    facts: validated.data as TaxReturnFacts,
  };
}
