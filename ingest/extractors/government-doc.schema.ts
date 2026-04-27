/**
 * Per-PDF government-document extractor schema.
 *
 * Five-variant discriminated union (by `government_doc_subtype`) covering
 * the foreign government-issued documents the firm sees on E-2 cases:
 *   - title_deed              (manual §5.1.1 / §5.1.2 — Tapu Mudurlugu)
 *   - vital_record_birth      (manual §12.4 dependent eligibility)
 *   - vital_record_marriage   (manual §12.3 dependent eligibility)
 *   - court_order             (e.g., name change, custody, divorce)
 *   - other_government_doc
 *
 * The title_deed variant is the highest-leverage shape: when detected,
 * the aggregator sets `defensive_paragraphs_required.tapu_explanation =
 * true` so the drafter inserts the manual §5.1.2 / §3 Tapu defensive
 * paragraph BEFORE citing the exhibit (real Akalan phrasing).
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}. Names are captured in BOTH the native script
 * (..._native) AND ASCII transliteration (..._ascii) per manual §15
 * "All names in filing-bound text are ASCII transliterations".
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
/* Title deed (manual §5.1.1 prior + §5.1.2 current)                       */
/* ---------------------------------------------------------------------- */

const TitleDeedSchema = z.object({
  government_doc_subtype: z.literal('title_deed'),
  parcel_id: Field(z.string()),
  registry_office: Field(z.string()),
  property_type: Field(z.string()),
  registration_date: Field(z.string()),
  owner_name_native: Field(z.string()),
  owner_name_ascii: Field(z.string()),
  owner_country: Field(z.string()),
  location: Field(z.string()),
  /**
   * If this title deed records a transfer (i.e., it is the §5.1.2 current
   * deed showing the property has been sold), populate the next three
   * fields. For a §5.1.1 prior deed showing only original ownership,
   * leave them null.
   */
  transfer_date_if_any: Field(z.string()),
  new_owner_if_any: Field(z.string()),
  transfer_registry_number: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Vital record — birth (manual §12.4)                                     */
/* ---------------------------------------------------------------------- */

const VitalRecordBirthSchema = z.object({
  government_doc_subtype: z.literal('vital_record_birth'),
  child_name_native: Field(z.string()),
  child_name_ascii: Field(z.string()),
  date_of_birth: Field(z.string()),
  place_of_birth: Field(z.string()),
  father_name_native: Field(z.string()),
  father_name_ascii: Field(z.string()),
  mother_name_native: Field(z.string()),
  mother_name_ascii: Field(z.string()),
  registry_office: Field(z.string()),
  registry_number: Field(z.string()),
  registry_date: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
  translator_certification_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Vital record — marriage (manual §12.3)                                  */
/* ---------------------------------------------------------------------- */

const VitalRecordMarriageSchema = z.object({
  government_doc_subtype: z.literal('vital_record_marriage'),
  spouse_a_name_native: Field(z.string()),
  spouse_a_name_ascii: Field(z.string()),
  spouse_b_name_native: Field(z.string()),
  spouse_b_name_ascii: Field(z.string()),
  date_of_marriage: Field(z.string()),
  place_of_marriage: Field(z.string()),
  registry_office: Field(z.string()),
  registry_number: Field(z.string()),
  registry_date: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
  translator_certification_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Court order                                                             */
/* ---------------------------------------------------------------------- */

const CourtOrderSchema = z.object({
  government_doc_subtype: z.literal('court_order'),
  order_kind: Field(z.string()),
  court_name: Field(z.string()),
  jurisdiction: Field(z.string()),
  case_number: Field(z.string()),
  order_date: Field(z.string()),
  parties: z.array(Field(z.string())),
  one_line_summary: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Other government doc                                                    */
/* ---------------------------------------------------------------------- */

const OtherGovernmentDocSchema = z.object({
  government_doc_subtype: z.literal('other_government_doc'),
  one_line_summary: Field(z.string()),
  issuing_authority: Field(z.string()),
  jurisdiction: Field(z.string()),
  document_date: Field(z.string()),
  reference_number: Field(z.string()),
  certified_translation_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const GovernmentDocFactsSchema = z.discriminatedUnion(
  'government_doc_subtype',
  [
    TitleDeedSchema,
    VitalRecordBirthSchema,
    VitalRecordMarriageSchema,
    CourtOrderSchema,
    OtherGovernmentDocSchema,
  ],
);

export type GovernmentDocFacts = z.infer<typeof GovernmentDocFactsSchema>;
export type GovernmentDocSubtype = GovernmentDocFacts['government_doc_subtype'];

export const GOVERNMENT_DOC_SUBTYPE_LABELS: Record<
  GovernmentDocSubtype,
  string
> = {
  title_deed: 'Title Deed (Tapu / Land Registry)',
  vital_record_birth: 'Vital Record — Birth Certificate',
  vital_record_marriage: 'Vital Record — Marriage Certificate',
  court_order: 'Court Order',
  other_government_doc: 'Other Government Document',
};
