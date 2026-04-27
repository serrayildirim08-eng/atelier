/**
 * Per-PDF tax-return extractor schema (rich second-pass).
 *
 * Six-variant discriminated union (by `tax_return_subtype`) covering the
 * U.S. federal tax-return forms the firm sees on E-2 financial review:
 *   - form_1120              — C-corporation income tax return
 *   - form_1120s             — S-corporation income tax return
 *   - form_1065              — Partnership return (incl. multi-member LLC)
 *   - form_1040_schedule_c   — Sole-proprietorship Schedule C of Form 1040
 *   - form_1040_k1           — Schedule K-1 issued to a partner / S-corp
 *                              shareholder; useful for individual-level
 *                              ownership and pass-through income
 *   - other_tax_return       — escape hatch
 *
 * The 1120 / 1120s / 1065 variants additionally carry Schedule L total
 * assets (beginning + end of year). The aggregator runs a deterministic
 * gate: |schedule_l_total_assets_end − I-129E investment_amount_usd| /
 * I-129E investment_amount_usd ≤ 25%; otherwise severity-3
 * 'tax_balance_sheet_drift' conflict.
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}. Currency is USD on all U.S. federal tax forms; we keep
 * the currency field for symmetry with bank-receipt / wire-confirmation
 * but the Sonnet aggregator may treat it as fixed.
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
/* Form 1120 (C-Corp)                                                     */
/* ---------------------------------------------------------------------- */

const Form1120Schema = z.object({
  tax_return_subtype: z.literal('form_1120'),
  tax_year: Field(z.string()),
  ein_or_ssn_last4: Field(z.string()),
  entity_legal_name: Field(z.string()),
  gross_receipts_amount: Field(z.number()),
  total_deductions_amount: Field(z.number()),
  net_income_or_loss_amount: Field(z.number()),
  currency: Field(z.string()),
  schedule_l_total_assets_beginning: Field(z.number()),
  schedule_l_total_assets_end: Field(z.number()),
});

/* ---------------------------------------------------------------------- */
/* Form 1120-S (S-Corp)                                                   */
/* ---------------------------------------------------------------------- */

const Form1120sSchema = z.object({
  tax_return_subtype: z.literal('form_1120s'),
  tax_year: Field(z.string()),
  ein_or_ssn_last4: Field(z.string()),
  entity_legal_name: Field(z.string()),
  gross_receipts_amount: Field(z.number()),
  total_deductions_amount: Field(z.number()),
  net_income_or_loss_amount: Field(z.number()),
  currency: Field(z.string()),
  schedule_l_total_assets_beginning: Field(z.number()),
  schedule_l_total_assets_end: Field(z.number()),
});

/* ---------------------------------------------------------------------- */
/* Form 1065 (Partnership / multi-member LLC)                              */
/* ---------------------------------------------------------------------- */

const Form1065Schema = z.object({
  tax_return_subtype: z.literal('form_1065'),
  tax_year: Field(z.string()),
  ein_or_ssn_last4: Field(z.string()),
  entity_legal_name: Field(z.string()),
  gross_receipts_amount: Field(z.number()),
  total_deductions_amount: Field(z.number()),
  net_income_or_loss_amount: Field(z.number()),
  currency: Field(z.string()),
  schedule_l_total_assets_beginning: Field(z.number()),
  schedule_l_total_assets_end: Field(z.number()),
});

/* ---------------------------------------------------------------------- */
/* Form 1040 Schedule C (Sole proprietorship)                              */
/* ---------------------------------------------------------------------- */

const Form1040ScheduleCSchema = z.object({
  tax_return_subtype: z.literal('form_1040_schedule_c'),
  tax_year: Field(z.string()),
  ein_or_ssn_last4: Field(z.string()),
  entity_legal_name: Field(z.string()),
  gross_receipts_amount: Field(z.number()),
  total_deductions_amount: Field(z.number()),
  net_income_or_loss_amount: Field(z.number()),
  currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Form 1040 Schedule K-1 (Partner / S-corp shareholder)                   */
/* ---------------------------------------------------------------------- */

const Form1040K1Schema = z.object({
  tax_return_subtype: z.literal('form_1040_k1'),
  tax_year: Field(z.string()),
  ein_or_ssn_last4: Field(z.string()),
  entity_legal_name: Field(z.string()),
  gross_receipts_amount: Field(z.number()),
  total_deductions_amount: Field(z.number()),
  net_income_or_loss_amount: Field(z.number()),
  currency: Field(z.string()),
  partner_or_shareholder_name: Field(z.string()),
  ownership_percent: Field(z.number()),
  ordinary_business_income_amount: Field(z.number()),
});

/* ---------------------------------------------------------------------- */
/* Other tax return                                                       */
/* ---------------------------------------------------------------------- */

const OtherTaxReturnSchema = z.object({
  tax_return_subtype: z.literal('other_tax_return'),
  tax_year: Field(z.string()),
  ein_or_ssn_last4: Field(z.string()),
  entity_legal_name: Field(z.string()),
  gross_receipts_amount: Field(z.number()),
  total_deductions_amount: Field(z.number()),
  net_income_or_loss_amount: Field(z.number()),
  currency: Field(z.string()),
  one_line_summary: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const TaxReturnFactsSchema = z.discriminatedUnion(
  'tax_return_subtype',
  [
    Form1120Schema,
    Form1120sSchema,
    Form1065Schema,
    Form1040ScheduleCSchema,
    Form1040K1Schema,
    OtherTaxReturnSchema,
  ],
);

export type TaxReturnFacts = z.infer<typeof TaxReturnFactsSchema>;
export type TaxReturnSubtype = TaxReturnFacts['tax_return_subtype'];

export const TAX_RETURN_SUBTYPE_LABELS: Record<TaxReturnSubtype, string> = {
  form_1120: 'Form 1120 (C-Corporation Income Tax Return)',
  form_1120s: 'Form 1120-S (S-Corporation Income Tax Return)',
  form_1065: 'Form 1065 (Partnership / Multi-Member LLC Return)',
  form_1040_schedule_c: 'Form 1040 Schedule C (Sole Proprietorship)',
  form_1040_k1: 'Schedule K-1 (Partner / Shareholder)',
  other_tax_return: 'Other Tax Return',
};

/* ---------------------------------------------------------------------- */
/* Deterministic Schedule L vs I-129E gate                                */
/* ---------------------------------------------------------------------- */

/** Tolerance for the |Schedule L EOY assets − I-129E investment| / I-129E gate. */
export const TAX_BALANCE_SHEET_GATE_TOLERANCE = 0.25;

/**
 * Variants that carry a Schedule L total_assets_end value. Form 1040
 * Schedule C, K-1, and other_tax_return have no Schedule L equivalent at
 * the entity level, so the gate does not apply to them.
 */
export type TaxReturnWithScheduleL = Extract<
  TaxReturnFacts,
  { tax_return_subtype: 'form_1120' | 'form_1120s' | 'form_1065' }
>;

export function hasScheduleL(
  facts: TaxReturnFacts,
): facts is TaxReturnWithScheduleL {
  return (
    facts.tax_return_subtype === 'form_1120' ||
    facts.tax_return_subtype === 'form_1120s' ||
    facts.tax_return_subtype === 'form_1065'
  );
}
