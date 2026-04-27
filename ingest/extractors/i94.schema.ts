/**
 * Per-PDF I-94 extractor schema (rich second-pass).
 *
 * Extends the thin first-pass `StatusDocFactsSchema` in typed-memory.ts
 * with port_of_entry and provenance-anchored fields the cover-letter
 * drafter requires. Drives the manual §3.4 quality gate: admit_until_date
 * MUST be ≥ filing_date; otherwise the Beneficiary is out of status at
 * filing → severity 5 'status_violation_at_filing' conflict.
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}, mirroring contract.schema.ts.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const I94FactsSchema = z.object({
  full_name_ascii: Field(z.string()),
  admission_number: Field(z.string()),
  class_of_admission: Field(z.string()),
  admission_date: Field(z.string()),
  admit_until_date: Field(z.string()),
  port_of_entry: Field(z.string()),
  /** "D/S" — duration of status — for some classes (e.g., F-1, J-1). */
  duration_of_status_marker: Field(z.boolean()),
  /** CBP record number (sometimes printed alongside the admission #). */
  cbp_record_number: Field(z.string()),
});

export type I94Facts = z.infer<typeof I94FactsSchema>;
