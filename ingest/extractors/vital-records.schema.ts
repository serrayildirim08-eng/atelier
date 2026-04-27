/**
 * Per-PDF vital-records extractor schema (rich second-pass).
 *
 * Specialized counterpart to government-doc.schema.ts with deeper
 * translation-certification fields. Covers three variants:
 *   - birth_certificate    (manual §12.4, dependent eligibility for kids)
 *   - marriage_certificate (manual §12.3, dependent eligibility for spouse)
 *   - divorce_decree       (used when prior marriage must be terminated
 *                           to establish dependent eligibility for a
 *                           subsequent spouse)
 *
 * Each variant carries:
 *   - native + ASCII names per manual §15
 *   - registry office + registration date
 *   - certified_translation_present (boolean), translator_name,
 *     translator_certification_date — these drive the manual §12.3 gate
 *     ("translator's certification must be present"). The aggregator
 *     appends a severity-3 'translation_certification_missing' conflict
 *     when certified_translation_present is false.
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

/* ---------------------------------------------------------------------- */
/* Birth certificate                                                       */
/* ---------------------------------------------------------------------- */

const BirthCertificateSchema = z.object({
  vital_record_subtype: z.literal('birth_certificate'),
  child_name_native: Field(z.string()),
  child_name_ascii: Field(z.string()),
  dob: Field(z.string()),
  place_of_birth: Field(z.string()),
  parent1_name: Field(z.string()),
  parent2_name: Field(z.string()),
  registry_office: Field(z.string()),
  registration_date: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
  translator_name: Field(z.string()),
  translator_certification_date: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Marriage certificate                                                    */
/* ---------------------------------------------------------------------- */

const MarriageCertificateSchema = z.object({
  vital_record_subtype: z.literal('marriage_certificate'),
  spouse1_name: Field(z.string()),
  spouse2_name: Field(z.string()),
  marriage_date: Field(z.string()),
  marriage_place: Field(z.string()),
  registry: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
  translator_name: Field(z.string()),
  translator_certification_date: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Divorce decree                                                          */
/* ---------------------------------------------------------------------- */

const DivorceDecreeSchema = z.object({
  vital_record_subtype: z.literal('divorce_decree'),
  party1_name: Field(z.string()),
  party2_name: Field(z.string()),
  divorce_date: Field(z.string()),
  court_name: Field(z.string()),
  jurisdiction: Field(z.string()),
  case_number: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
  translator_name: Field(z.string()),
  translator_certification_date: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const VitalRecordsFactsSchema = z.discriminatedUnion(
  'vital_record_subtype',
  [BirthCertificateSchema, MarriageCertificateSchema, DivorceDecreeSchema],
);

export type VitalRecordsFacts = z.infer<typeof VitalRecordsFactsSchema>;
export type VitalRecordsSubtype = VitalRecordsFacts['vital_record_subtype'];

export const VITAL_RECORDS_SUBTYPE_LABELS: Record<VitalRecordsSubtype, string> = {
  birth_certificate: 'Birth Certificate',
  marriage_certificate: 'Marriage Certificate',
  divorce_decree: 'Divorce Decree',
};
