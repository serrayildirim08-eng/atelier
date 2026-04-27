/**
 * Per-PDF payroll extractor schema (rich second-pass).
 *
 * Five-variant discriminated union (by `payroll_subtype`) covering the
 * payroll evidence the firm sees on E-2 marginality analysis:
 *   - payroll_register   — period-by-period register listing each
 *                          employee's gross pay; the canonical document
 *                          for "more than marginal" headcount evidence
 *                          (manual §9 marginality / 9 FAM 402.9-6(D)).
 *   - w2_summary         — annual W-2 aggregate (Forms W-3 / employer
 *                          summary) showing total wages reported and
 *                          employee count for a tax year.
 *   - form_941           — Quarterly Federal Tax Return; each quarter
 *                          carries total wages and total employees and
 *                          is the cleanest IRS-side cross-check on
 *                          payroll continuity.
 *   - employee_list      — bare roster (HR census) without dollar
 *                          figures; lower probative value but useful
 *                          when a register is unavailable.
 *   - other_payroll      — escape hatch for stubs / state-filed forms /
 *                          partial documents.
 *
 * The payroll_register variant is the highest-leverage shape: when
 * detected with employee_count_excluding_beneficiary ≥ 1, the aggregator
 * sets `marginality_evidence_present.us_workers_employed = true` so the
 * drafter can deploy the §9 marginality narrative confidently.
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}. Currency is captured in source currency + ISO-4217 code
 * (US payrolls are USD; foreign-equivalent payrolls may appear when a
 * multinational corporate parent files alongside).
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
/* Shared sub-schemas                                                     */
/* ---------------------------------------------------------------------- */

/**
 * One row of a payroll register. Mirrors what a typical ADP / Gusto /
 * QuickBooks Payroll line item shows. employment_status drives the
 * marginality analysis — only W2 (and arguably owner_draw treated as
 * salary) counts as a "U.S. worker employed" for 9 FAM 402.9-6(D).
 */
const EmployeeRowSchema = z.object({
  employee_name: Field(z.string()),
  position_title: Field(z.string()),
  gross_pay_amount: Field(z.number()),
  hours_worked: Field(z.number()),
  employment_status: Field(z.enum(['W2', '1099', 'owner_draw'])),
});

export type EmployeeRow = z.infer<typeof EmployeeRowSchema>;

/* ---------------------------------------------------------------------- */
/* Payroll register (manual §9 marginality canonical evidence)            */
/* ---------------------------------------------------------------------- */

const PayrollRegisterSchema = z.object({
  payroll_subtype: z.literal('payroll_register'),
  pay_period_start: Field(z.string()),
  pay_period_end: Field(z.string()),
  total_gross_wages_amount: Field(z.number()),
  total_gross_wages_currency: Field(z.string()),
  employee_rows: z.array(EmployeeRowSchema),
  /**
   * Count of distinct employees on the register MINUS the Beneficiary if
   * the Beneficiary appears as an employee. Drives the §9 marginality
   * gate — only non-Beneficiary U.S. workers count under 9 FAM 402.9-6(D).
   */
  employee_count_excluding_beneficiary: Field(z.number()),
  /** True if the Beneficiary's name appears in employee_rows. */
  beneficiary_included: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* W-2 / W-3 summary                                                      */
/* ---------------------------------------------------------------------- */

const W2SummarySchema = z.object({
  payroll_subtype: z.literal('w2_summary'),
  tax_year: Field(z.string()),
  total_wages_reported: Field(z.number()),
  employee_count: Field(z.number()),
  employer_ein: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Form 941 (Quarterly Federal Tax Return)                                */
/* ---------------------------------------------------------------------- */

const Form941Schema = z.object({
  payroll_subtype: z.literal('form_941'),
  /** "Q1" | "Q2" | "Q3" | "Q4" */
  quarter: Field(z.string()),
  year: Field(z.string()),
  total_wages: Field(z.number()),
  total_employees: Field(z.number()),
  employer_ein: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Employee list (roster only)                                            */
/* ---------------------------------------------------------------------- */

const EmployeeListSchema = z.object({
  payroll_subtype: z.literal('employee_list'),
  list_date: Field(z.string()),
  employee_rows: z.array(EmployeeRowSchema),
  employee_count_excluding_beneficiary: Field(z.number()),
  beneficiary_included: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Other payroll                                                          */
/* ---------------------------------------------------------------------- */

const OtherPayrollSchema = z.object({
  payroll_subtype: z.literal('other_payroll'),
  one_line_summary: Field(z.string()),
  document_date: Field(z.string()),
  reference_number: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const PayrollFactsSchema = z.discriminatedUnion('payroll_subtype', [
  PayrollRegisterSchema,
  W2SummarySchema,
  Form941Schema,
  EmployeeListSchema,
  OtherPayrollSchema,
]);

export type PayrollFacts = z.infer<typeof PayrollFactsSchema>;
export type PayrollSubtype = PayrollFacts['payroll_subtype'];

export const PAYROLL_SUBTYPE_LABELS: Record<PayrollSubtype, string> = {
  payroll_register: 'Payroll Register (period-by-period)',
  w2_summary: 'W-2 / W-3 Annual Summary',
  form_941: 'Form 941 (Quarterly Federal Tax Return)',
  employee_list: 'Employee List / Roster',
  other_payroll: 'Other Payroll Document',
};
