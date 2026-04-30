/**
 * Bank-statement rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as bank_statement. Single Haiku 4.5 call fills
 * BankStatementRichFactsSchema with bank identity (full + short name),
 * account holder, last-4 of the account number, statement period bounds
 * + derived YYYY-MM, and optional balance sanity figures.
 *
 * Output drives client-side display-name derivation
 * (lib/e2/bank-statement-rename.ts) and downstream SOF / proof-slot
 * reconciliations.
 *
 * PII: account numbers are captured only as the last 4 digits. The system
 * prompt instructs Haiku to strip full numbers / IBANs / routing numbers
 * BEFORE emitting; the schema's regex `/^\d{4}$/` enforces it.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  BankStatementRichFactsSchema,
  type BankStatementRichFacts,
} from './bank-statement.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document bank-statement extraction on a single PDF from an E-2 / EB-1 case folder. Your output feeds (a) a deterministic per-statement display name the dashboard renders ("Chase · Deborah Walther · ****7192 · 2025-03"), and (b) the case-level aggregator's SOF / proof-slot reconciliations.

Extract the following fields per the BankStatementRichFacts schema. EVERY leaf field carries the {value, source_page, source_quote, confidence} provenance wrapper.

1. bank_statement_subtype — closed enum, one of:
   - personal_checking — individually-held checking account; account holder is a natural person; no business / LLC / Inc / EIN signals.
   - personal_savings — individually-held savings account.
   - business_checking — account held by an LLC / Inc / Corp / partnership; account holder name carries an entity suffix OR an EIN appears OR header text says "business".
   - business_savings — business-held savings account.
   - money_market — labeled "money market", "MMA", "money market account".
   - other — bank account that does not fit the above (CD, IRA, brokerage cash sweep, escrow, trust account). Use sparingly.

   Disambiguation: if the holder name contains LLC / L.L.C. / Inc / Incorporated / Corp / Corporation / LP / LLP / GmbH / A.Ş. / Ltd / Ltda → business_checking unless explicitly a savings / money-market product. If the holder is a natural person AND no business signals → personal_checking unless the product label says savings. When in doubt between checking vs savings, prefer checking and reflect uncertainty in confidence.

2. bank_name — the bank's full legal name as printed on the statement header / footer (e.g., "JPMorgan Chase Bank, N.A.", "Bank of America, N.A.", "Wells Fargo Bank, N.A.", "Akbank T.A.Ş.").

3. bank_short_name — display short form. Apply this normalization table EXACTLY (case-insensitive matching against bank_name):
   - "Bank of America"               → "BofA"
   - "JPMorgan Chase" / "Chase"      → "Chase"
   - "Wells Fargo"                   → "WF"
   - "Capital One"                   → "CapOne"
   - "Citibank" / "Citi"             → "Citi"
   - "U.S. Bank" / "US Bank"         → "USB"
   - "PNC" / "PNC Bank"              → "PNC"
   - "TD Bank"                       → "TD"
   - "HSBC"                          → "HSBC"
   - "Akbank"                        → "Akbank"
   - "Garanti BBVA" / "Garanti"      → "Garanti"
   - "İş Bankası" / "Isbank"         → "İş Bankası"
   - "Yapı Kredi"                    → "YapıKredi"
   For banks not in the table, emit the most recognizable short form (e.g., "PNC" for "PNC Bank, National Association", "Ally" for "Ally Bank"). Keep ASCII unless the bank's brand uses native diacritics (Turkish banks may keep İ / ş).

4. account_holder_name — the legal name as printed on the statement (e.g., "Deborah Walther", "Wise Guys Deli LLC"). PRESERVE diacritics. Do NOT include the address.

5. account_number_last4 — EXACTLY 4 digits. CRITICAL PII RULE:
   - If the statement prints the full account number (e.g., "1234567192"), capture ONLY the last 4 digits ("7192").
   - If the statement prints a masked form like "****7192" or "...7192" or "x-7192", strip the masking and emit "7192".
   - If only 3 digits are visible due to redaction, LEFT-PAD with zeros to 4 ("0742") — never emit a 3-digit value (the schema regex /^\\d{4}$/ will fail).
   - NEVER emit the full account number, IBAN, or routing number anywhere in your output. The pipeline strips these on extract.

6. account_address — the statement-of-record mailing address (one line; commas OK). Optional — null if not visible.

7. statement_period_start / statement_period_end — ISO YYYY-MM-DD bounds of the statement period. Common headers:
   - "Statement Period: March 1, 2025 to March 31, 2025" → start=2025-03-01, end=2025-03-31
   - "From 03/01/2025 Through 03/31/2025" → same
   - Single statement date "Statement Date: March 31, 2025" → leave start=null, end=2025-03-31
   - Mid-month bounds (e.g., 2025-03-15 → 2025-04-14) are OK — emit verbatim.

8. statement_year_month — derived "YYYY-MM" string. Rules:
   - If statement_period_end is set, take its year-month.
   - If only statement_period_start is set, take its year-month.
   - If both are null, emit null.
   This is a Field<string>: source_page = the page where the period was found, source_quote = the period header text.

9. Optional balances (USD only — leave null for non-USD statements; foreign-currency statements pass through with null balances and the aggregator handles FX separately):
   - beginning_balance_usd — opening balance for the period.
   - ending_balance_usd — closing balance.
   - total_deposits_usd — period deposits/credits sum.
   - total_withdrawals_usd — period withdrawals/debits sum.
   Numbers only; strip currency symbols and commas. If signs are ambiguous, emit absolute value.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.

Edge cases:
- Multi-account statements (one PDF, two account summaries): classify by the FIRST / PRIMARY account on the statement and emit a single record. The aggregator does not yet support multi-account statements as a single rich record.
- Quarterly / semi-annual statements: emit period bounds as printed; statement_year_month takes the END month.
- Mid-month statements: emit start and end verbatim; statement_year_month follows the END date.
- If only the year is visible (no month), leave statement_year_month=null.

Output: ONE JSON object matching BankStatementRichFactsSchema. No prose, no commentary, no markdown fences.`;

export interface BankStatementExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface BankStatementExtractResult {
  filename: string;
  pageCount: number;
  facts?: BankStatementRichFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractBankStatement(
  input: BankStatementExtractInput,
): Promise<BankStatementExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the BankStatementRichFacts schema. No prose, no markdown fences.`;

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
        code: 'bank_statement_extract_failed',
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

  const validated = BankStatementRichFactsSchema.safeParse(raw);
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
    facts: validated.data as BankStatementRichFacts,
  };
}
