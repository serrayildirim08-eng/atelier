/**
 * Per-PDF passport extractor schema (rich second-pass).
 *
 * Extends the thin first-pass `PassportFactsSchema` in typed-memory.ts
 * with provenance-anchored fields the cover-letter drafter requires:
 *   - full_name_native (original spelling, with diacritics) AND
 *   - full_name_ascii (transliterated for filing-bound text)
 *     per manual §15 "All names in filing-bound text are ASCII
 *     transliterations" — Turkish ş/ı/İ/ğ/ü/ö/ç, Arabic, Cyrillic, etc.
 *   - sex (M/F/X) — required on most USCIS forms; consistency across
 *     passport ↔ I-94 ↔ I-129 is checked by the aggregator.
 *
 * Together with the passport_number / date_of_expiration fields below,
 * this drives the manual §3.1 defensive flag (passport must be valid
 * for ≥ 6 months from filing date — visa rule). The aggregator runs a
 * deterministic gate that appends `passport_expires_soon` (severity 3)
 * to conflict_register when the gate fails.
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

export const PassportFactsRichSchema = z.object({
  full_name_native: Field(z.string()),
  full_name_ascii: Field(z.string()),
  sex: Field(z.enum(['M', 'F', 'X'])),
  date_of_birth: Field(z.string()),
  place_of_birth: Field(z.string()),
  nationality: Field(z.string()),
  country_of_issue: Field(z.string()),
  passport_number: Field(z.string()),
  date_of_issue: Field(z.string()),
  date_of_expiration: Field(z.string()),
  /** MRZ line 1 + line 2 verbatim if visible (helps detect tampering). */
  mrz_present: Field(z.boolean()),
});

export type PassportFactsRich = z.infer<typeof PassportFactsRichSchema>;
