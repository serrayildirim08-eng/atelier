/**
 * Per-PDF credential extractor schema (rich second-pass).
 *
 * Five-variant discriminated union (by `credential_subtype`) covering the
 * education / professional-credential documents the firm sees on
 * Subtype-3/4 employee filings (manual §3.3.4–§3.3.5):
 *   - diploma                  (university degree certificate)
 *   - professional_certification (industry / vendor certification)
 *   - license                  (regulator-issued professional license)
 *   - transcript               (academic transcript with grades)
 *   - other_credential
 *
 * The diploma variant drives the credential_unverifiable gate: a foreign
 * diploma without an apostille / legalization stamp is severity 3
 * (manual §3.5).
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
/* Diploma (manual §3.3.4)                                                 */
/* ---------------------------------------------------------------------- */

const DiplomaSchema = z.object({
  credential_subtype: z.literal('diploma'),
  institution_name: Field(z.string()),
  institution_country: Field(z.string()),
  degree_level: Field(
    z.enum(['associate', 'bachelor', 'master', 'phd', 'professional', 'other']),
  ),
  field_of_study: Field(z.string()),
  conferral_date: Field(z.string()),
  graduate_name_ascii: Field(z.string()),
  registrar_signature_present: Field(z.boolean()),
  apostille_or_legalization_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Professional certification (manual §3.3.5)                              */
/* ---------------------------------------------------------------------- */

const ProfessionalCertificationSchema = z.object({
  credential_subtype: z.literal('professional_certification'),
  issuer_name: Field(z.string()),
  certification_name: Field(z.string()),
  holder_name_ascii: Field(z.string()),
  issue_date: Field(z.string()),
  expiry_date: Field(z.string()),
  certification_id: Field(z.string()),
  scope_or_domain: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* License                                                                 */
/* ---------------------------------------------------------------------- */

const LicenseSchema = z.object({
  credential_subtype: z.literal('license'),
  issuing_authority: Field(z.string()),
  license_type: Field(z.string()),
  holder_name_ascii: Field(z.string()),
  issue_date: Field(z.string()),
  expiry_date: Field(z.string()),
  license_number: Field(z.string()),
  scope: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Transcript                                                              */
/* ---------------------------------------------------------------------- */

const TranscriptCourseSchema = z.object({
  course_name: Field(z.string()),
  grade: Field(z.string()),
  credits: Field(z.number()),
});

const TranscriptSchema = z.object({
  credential_subtype: z.literal('transcript'),
  institution_name: Field(z.string()),
  student_name_ascii: Field(z.string()),
  gpa_or_equivalent: Field(z.string()),
  courses: z.array(TranscriptCourseSchema),
  completion_date: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Other                                                                   */
/* ---------------------------------------------------------------------- */

const OtherCredentialSchema = z.object({
  credential_subtype: z.literal('other_credential'),
  one_line_summary: Field(z.string()),
  issuer_name: Field(z.string()),
  holder_name_ascii: Field(z.string()),
  issue_date: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const CredentialFactsSchema = z.discriminatedUnion('credential_subtype', [
  DiplomaSchema,
  ProfessionalCertificationSchema,
  LicenseSchema,
  TranscriptSchema,
  OtherCredentialSchema,
]);

export type CredentialFacts = z.infer<typeof CredentialFactsSchema>;
export type CredentialSubtype = CredentialFacts['credential_subtype'];

export const CREDENTIAL_SUBTYPE_LABELS: Record<CredentialSubtype, string> = {
  diploma: 'Diploma / Degree Certificate',
  professional_certification: 'Professional Certification',
  license: 'Professional License',
  transcript: 'Academic Transcript',
  other_credential: 'Other Credential',
};
