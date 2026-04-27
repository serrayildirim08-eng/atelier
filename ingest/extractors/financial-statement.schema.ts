/**
 * Per-PDF financial-statement extractor schema (rich second-pass).
 *
 * Five-variant discriminated union (by `statement_subtype`) covering the
 * unaudited / compiled / reviewed financial statements that typically
 * accompany the business plan or appear as standalone exhibits:
 *   - profit_and_loss      — P&L / income statement
 *   - balance_sheet        — statement of financial position
 *   - cash_flow            — statement of cash flows
 *   - combined_statements  — multi-statement bundle (P&L + BS + CF in
 *                            one document, common from QuickBooks / Wave)
 *   - other_financial      — escape hatch (forecast, ratio analysis,
 *                            partial schedule)
 *
 * The aggregator runs a deterministic gate cross-checking the P&L
 * net_income against the matching tax-return net_income for the same
 * tax_year — drift > $1,000 = severity-3 'pl_tax_net_income_drift'
 * conflict.
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}. Currency is captured separately — most U.S. statements
 * are USD, but corporate-funding subtypes may show foreign currency.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

/* ---------------------------------------------------------------------- */
/* Profit & Loss / Income Statement                                       */
/* ---------------------------------------------------------------------- */

const ProfitAndLossSchema = z.object({
  statement_subtype: z.literal('profit_and_loss'),
  period_start: Field(z.string()),
  period_end: Field(z.string()),
  total_revenue_amount: Field(z.number()),
  total_expenses_amount: Field(z.number()),
  net_income_amount: Field(z.number()),
  currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Balance Sheet                                                          */
/* ---------------------------------------------------------------------- */

const BalanceSheetSchema = z.object({
  statement_subtype: z.literal('balance_sheet'),
  as_of_date: Field(z.string()),
  total_assets_amount: Field(z.number()),
  total_liabilities_amount: Field(z.number()),
  total_equity_amount: Field(z.number()),
  currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Cash Flow Statement                                                    */
/* ---------------------------------------------------------------------- */

const CashFlowSchema = z.object({
  statement_subtype: z.literal('cash_flow'),
  period_start: Field(z.string()),
  period_end: Field(z.string()),
  operating_cash_flow: Field(z.number()),
  investing_cash_flow: Field(z.number()),
  financing_cash_flow: Field(z.number()),
  currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Combined Statements (P&L + BS + CF)                                    */
/* ---------------------------------------------------------------------- */

const CombinedStatementsSchema = z.object({
  statement_subtype: z.literal('combined_statements'),
  period_start: Field(z.string()),
  period_end: Field(z.string()),
  // P&L block
  total_revenue_amount: Field(z.number()),
  total_expenses_amount: Field(z.number()),
  net_income_amount: Field(z.number()),
  // BS block (as-of period_end)
  total_assets_amount: Field(z.number()),
  total_liabilities_amount: Field(z.number()),
  total_equity_amount: Field(z.number()),
  // CF block
  operating_cash_flow: Field(z.number()),
  investing_cash_flow: Field(z.number()),
  financing_cash_flow: Field(z.number()),
  currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Other Financial                                                        */
/* ---------------------------------------------------------------------- */

const OtherFinancialSchema = z.object({
  statement_subtype: z.literal('other_financial'),
  one_line_summary: Field(z.string()),
  document_date: Field(z.string()),
  currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const FinancialStatementFactsSchema = z.discriminatedUnion(
  'statement_subtype',
  [
    ProfitAndLossSchema,
    BalanceSheetSchema,
    CashFlowSchema,
    CombinedStatementsSchema,
    OtherFinancialSchema,
  ],
);

export type FinancialStatementFacts = z.infer<typeof FinancialStatementFactsSchema>;
export type FinancialStatementSubtype = FinancialStatementFacts['statement_subtype'];

export const FINANCIAL_STATEMENT_SUBTYPE_LABELS: Record<
  FinancialStatementSubtype,
  string
> = {
  profit_and_loss: 'Profit & Loss / Income Statement',
  balance_sheet: 'Balance Sheet',
  cash_flow: 'Statement of Cash Flows',
  combined_statements: 'Combined Statements (P&L + BS + CF)',
  other_financial: 'Other Financial Document',
};

/* ---------------------------------------------------------------------- */
/* Deterministic P&L vs tax-return net-income gate                         */
/* ---------------------------------------------------------------------- */

/** Tolerance for the |P&L net_income − tax-return net_income| gate (USD). */
export const PL_TAX_GATE_TOLERANCE_USD = 1000;

/**
 * Variants that carry a P&L net_income figure. Balance sheet and
 * cash-flow only do not — the gate does not apply to them.
 */
export type FinancialStatementWithNetIncome = Extract<
  FinancialStatementFacts,
  { statement_subtype: 'profit_and_loss' | 'combined_statements' }
>;

export function hasPlNetIncome(
  facts: FinancialStatementFacts,
): facts is FinancialStatementWithNetIncome {
  return (
    facts.statement_subtype === 'profit_and_loss' ||
    facts.statement_subtype === 'combined_statements'
  );
}
