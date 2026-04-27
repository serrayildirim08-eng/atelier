/**
 * Per-PDF service-record extractor schema (rich second-pass).
 *
 * Captures a foreign-government / former-employer service / employment
 * record that establishes the Beneficiary's prior tenure and salary
 * (manual MANUAL-SUBTYPE-4 §3.3.3). Real Akalan example: Turkish SGK
 * service record showing TRY 140K/mo when Turkish national average for
 * the role was TRY 45K — 3× peer benchmark for specialized-knowledge
 * essentiality (9 FAM 402.9-7(2)(b)).
 *
 * Flat schema. Provenance: every leaf carries {value, source_page,
 * source_quote, confidence}, mirroring contract.schema.ts.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const ServiceRecordFactsSchema = z.object({
  employer_legal_name: Field(z.string()),
  employer_country: Field(z.string()),
  beneficiary_name_ascii: Field(z.string()),
  position_title: Field(z.string()),
  employment_start_date: Field(z.string()),
  employment_end_date: Field(z.string()),
  total_tenure_months: Field(z.number()),
  salary_at_termination_amount: Field(z.number()),
  salary_at_termination_currency: Field(z.string()),
  supervisor_name: Field(z.string()),
  signatory_name: Field(z.string()),
  signatory_title: Field(z.string()),
  signed_date: Field(z.string()),
  /** Optional peer-salary benchmark when the source carries it. */
  foreign_peer_salary_benchmark_amount: Field(z.number()),
  foreign_peer_salary_benchmark_currency: Field(z.string()),
  foreign_peer_salary_source_quote: Field(z.string()),
});

export type ServiceRecordFacts = z.infer<typeof ServiceRecordFactsSchema>;
