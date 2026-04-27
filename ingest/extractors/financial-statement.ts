/**
 * Financial-statement extractor — second pass after the typed-extract.ts
 * classifier. Runs a single Haiku 4.5 call dedicated to financial-statement
 * extraction: classifies into one of five statement subtypes and fills
 * the matching variant of FinancialStatementFactsSchema. Called from
 * classifyAndExtractOnePdf when the first-pass classifier returns
 * business_plan (financial statements typically accompany or appear
 * alongside the formal plan).
 *
 * Mirrors the contract / bank-receipt extractor pattern. Manual JSON
 * parse + Zod validate.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  FinancialStatementFactsSchema,
  type FinancialStatementFacts,
} from './financial-statement.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document financial-statement extraction on a single PDF from an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will reconcile against the tax-return extractor (manual §9 marginality, P&L-vs-tax net-income gate).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE statement_subtype:

   - profit_and_loss — income statement: revenue, expenses, net income, for a stated period (month / quarter / year).

   - balance_sheet — statement of financial position as of a single date: assets, liabilities, equity.

   - cash_flow — statement of cash flows: operating / investing / financing activity for a period.

   - combined_statements — multi-statement bundle (P&L + balance sheet + cash flow in one document). Common from QuickBooks, Wave, Xero "All Reports" exports.

   - other_financial — anything else (forecast spreadsheet, ratio analysis, partial schedule, footnotes-only document).

2. EXTRACT the subtype-specific fields per the schema for the chosen statement_subtype. Only the schema variant matching your chosen statement_subtype is valid in your JSON output.

Subtype-specific guidance:

profit_and_loss:
- period_start / period_end: ISO YYYY-MM-DD bounds the statement covers. Year-to-date statements show period_start = January 1 of the year.
- total_revenue_amount: top-line revenue (also called total income / net sales).
- total_expenses_amount: total operating expenses (or total expenses including COGS depending on format — capture verbatim per the document's structure).
- net_income_amount: bottom-line (also "Net Profit", "Net Income (Loss)"). NEGATIVE if a loss.
- currency: ISO-4217 (USD on most U.S. statements). Capture from the heading or column legend.

balance_sheet:
- as_of_date: the single date the balance sheet is drawn up at.
- total_assets_amount: total assets line.
- total_liabilities_amount: total liabilities line.
- total_equity_amount: total equity (or "Members' Equity" / "Stockholders' Equity").

cash_flow:
- period_start / period_end: same handling as P&L.
- operating_cash_flow / investing_cash_flow / financing_cash_flow: the three section subtotals. NEGATIVE values are valid (financing or investing outflows).

combined_statements:
- Fill BOTH the P&L block (total_revenue_amount, total_expenses_amount, net_income_amount) AND the BS block (as-of period_end) AND the CF block.
- If any block is missing in the document, leave its fields null.

other_financial:
- one_line_summary: what the document is and why it might matter.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas/parentheses-stripped (parentheses indicate negative, e.g., "(5,000)" → -5000). Do NOT convert.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous, leave value=null.

Edge cases:
- A P&L printed as "Income Statement" or "Statement of Operations" is profit_and_loss.
- A balance sheet that lists only ONE side (assets only, no liabilities) is other_financial — the schema requires both sides for the gate.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.
- If a single PDF contains multi-period comparative statements (current year + prior year side-by-side), classify by the PRIMARY period (the most recent column) and capture that period's totals; mention the comparative in source_quote on net_income_amount.

Output: ONE JSON object matching the statement_subtype-discriminated FinancialStatementFacts schema. No prose, no commentary, no markdown fences.`;

export interface FinancialStatementExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface FinancialStatementExtractResult {
  filename: string;
  pageCount: number;
  facts?: FinancialStatementFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractFinancialStatement(
  input: FinancialStatementExtractInput,
): Promise<FinancialStatementExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the statement_subtype-discriminated FinancialStatementFacts schema. No prose, no markdown fences.`;

  // The 5-variant union has ~30 nullable Field<> params across variants
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
        code: 'financial_statement_extract_failed',
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

  const validated = FinancialStatementFactsSchema.safeParse(raw);
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
    facts: validated.data as FinancialStatementFacts,
  };
}
