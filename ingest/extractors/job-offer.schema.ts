/**
 * Per-PDF job-offer-letter extractor schema (rich second-pass).
 *
 * Captures the petitioner's offer letter to a Subtype-3/4 employee
 * Beneficiary (manual MANUAL-SUBTYPE-4 §3.3 / §3.7). The job-offer
 * letter anchors:
 *   - the position title and salary (compared against CV title — drives
 *     cv_title_vs_offer_drift gate)
 *   - the petitioner's name + EIN-last-4 (cross-checked against
 *     formation_doc + I-129)
 *   - the salary level (compared against industry benchmark — drives
 *     salary_below_benchmark gate)
 *   - signatory + letterhead (drives evidentiary weight)
 *
 * Flat schema (no union). Provenance: every leaf carries {value,
 * source_page, source_quote, confidence}, mirroring contract.schema.ts.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const JobOfferFactsSchema = z.object({
  petitioner_legal_name: Field(z.string()),
  petitioner_ein_last4: Field(z.string()),
  position_title: Field(z.string()),
  classification_basis: Field(
    z.enum(['specialized_knowledge', 'executive_supervisory', 'other']),
  ),
  proposed_start_date: Field(z.string()),
  proposed_end_date: Field(z.string()),
  annual_salary_amount: Field(z.number()),
  annual_salary_currency: Field(z.string()),
  work_location: Field(z.string()),
  supervisor_name: Field(z.string()),
  duties_summary_verbatim: Field(z.string()),
  full_time_or_part_time: Field(z.enum(['full_time', 'part_time', 'unclear'])),
  letterhead_present: Field(z.boolean()),
  signatory_name: Field(z.string()),
  signatory_title: Field(z.string()),
  signed_date: Field(z.string()),
});

export type JobOfferFacts = z.infer<typeof JobOfferFactsSchema>;
