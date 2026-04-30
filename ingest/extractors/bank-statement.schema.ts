/**
 * Bank-statement rich-extraction schema (second pass).
 *
 * The thin first-pass classifier (typed-memory.ts BankStatementFactsSchema)
 * captures month/period + holder + last4 at low fidelity. This rich schema
 * adds the fields needed to (a) compose a deterministic display name —
 * "Chase · Deborah Walther · ****7192 · 2025-03" — and (b) feed the
 * SOF / proof-slot reconciliations: bank short-name normalization, account
 * subtype (personal vs business checking/savings/MMA), period bounds, and
 * balance sanity numbers.
 *
 * PII rule (non-negotiable): account_number_last4 MUST be exactly 4 digits.
 * The schema enforces this with a regex; full account numbers / IBANs /
 * routing numbers are stripped at extract time and never enter the typed
 * memory.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

/**
 * Currency-tolerant number — accepts a number or a numeric string with
 * currency symbols / thousands separators. Bank-statement balances often
 * come back from the LLM as "$1,234.56" or "1.234,56" (EU comma). Without
 * this preprocess, the schema rejects → retry → 12-minute ingests.
 */
const CurrencyNumber = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const cleaned = v
    .replace(/[$€£₺¥₪]/g, '')
    .replace(/\s/g, '')
    // EU style "1.234,56" → "1234.56"; US/UK style "1,234.56" → "1234.56".
    // Heuristic: if the last separator is a comma AND there are exactly 2
    // digits after it, treat comma as decimal. Otherwise commas are
    // thousands separators.
    .replace(/(\d),(\d{2})$/, '$1.$2')
    .replace(/,/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '—') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : v;
}, z.number());

/* ---------------------------------------------------------------------- */
/* Subtype enum                                                           */
/* ---------------------------------------------------------------------- */

export const BankStatementSubtypeEnum = z.enum([
  'personal_checking',
  'personal_savings',
  'business_checking',
  'business_savings',
  'money_market',
  'other',
]);

export type BankStatementSubtype = z.infer<typeof BankStatementSubtypeEnum>;

export const BANK_STATEMENT_SUBTYPE_LABELS: Record<BankStatementSubtype, string> = {
  personal_checking: 'Personal Checking',
  personal_savings: 'Personal Savings',
  business_checking: 'Business Checking',
  business_savings: 'Business Savings',
  money_market: 'Money Market',
  other: 'Other Bank Account',
};

/* ---------------------------------------------------------------------- */
/* Rich facts                                                             */
/* ---------------------------------------------------------------------- */

/**
 * Last-4 digits of an account number. PII rule enforces exactly 4 digits;
 * the extractor's system prompt strips full account numbers before this
 * value lands in the typed memory.
 */
const AccountLast4Schema = z.string().regex(/^\d{4}$/, {
  message: 'account_number_last4 must be exactly 4 digits',
});

export const BankStatementRichFactsSchema = z.object({
  bank_statement_subtype: Field(BankStatementSubtypeEnum),

  // Bank identity
  /** Bank's full legal name as printed on the statement (e.g., "JPMorgan Chase Bank, N.A."). */
  bank_name: Field(z.string()),
  /**
   * Short display form used by deriveBankStatementDisplayName. Normalized
   * by the extractor against a canonical table:
   *   Bank of America → BofA · JPMorgan Chase → Chase · Wells Fargo → WF
   *   Capital One → CapOne · Citibank / Citi → Citi
   * Unknown banks: extractor falls back to the most-recognizable short
   * form (e.g., "PNC" for "PNC Bank, N.A.").
   */
  bank_short_name: Field(z.string()),

  // Account
  account_holder_name: Field(z.string()),
  account_number_last4: Field(AccountLast4Schema),
  /** Statement-of-record mailing address as printed on the statement header. */
  account_address: Field(z.string()).optional(),

  // Period
  statement_period_start: Field(z.string()),
  statement_period_end: Field(z.string()),
  /** "YYYY-MM" derived from statement_period_end (or _start when end missing). */
  statement_year_month: Field(z.string()),

  // Balances (optional — many statements are SOF-evidence-only).
  // Currency-tolerant: accepts number OR "$1,234.56" / "1.234,56" strings.
  beginning_balance_usd: Field(CurrencyNumber).optional(),
  ending_balance_usd: Field(CurrencyNumber).optional(),
  total_deposits_usd: Field(CurrencyNumber).optional(),
  total_withdrawals_usd: Field(CurrencyNumber).optional(),
});

export type BankStatementRichFacts = z.infer<typeof BankStatementRichFactsSchema>;
