/**
 * Per-PDF CV / résumé extractor schema (rich second-pass).
 *
 * Captures the Beneficiary's professional history (manual
 * MANUAL-SUBTYPE-4 §3.3.2). The aggregator uses current_position_title
 * for the cv_title_vs_offer_drift gate and education + certifications +
 * roles to support the specialized-knowledge / develop-and-direct
 * narrative.
 *
 * Flat top-level schema with nested arrays of small objects. Provenance
 * lives on every leaf via Field<T>; nested array element Fields share
 * the same {value, source_page, source_quote, confidence} shape.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

const RoleSchema = z.object({
  employer: Field(z.string()),
  position_title: Field(z.string()),
  start_date: Field(z.string()),
  end_date: Field(z.string()),
  location: Field(z.string()),
  key_responsibilities_summary: Field(z.string()),
});

const EducationSchema = z.object({
  degree: Field(z.string()),
  field: Field(z.string()),
  institution: Field(z.string()),
  country: Field(z.string()),
  completion_year: Field(z.number()),
});

const CertificationSchema = z.object({
  credential_name: Field(z.string()),
  issuer: Field(z.string()),
  issue_date: Field(z.string()),
  validity_status: Field(
    z.enum(['active', 'expired', 'pending', 'unknown']),
  ),
});

const LanguageSchema = z.object({
  language: Field(z.string()),
  proficiency_level: Field(
    z.enum(['native', 'fluent', 'professional', 'conversational', 'basic']),
  ),
});

export const CvFactsSchema = z.object({
  full_name_ascii: Field(z.string()),
  full_name_native: Field(z.string()),
  current_position_title: Field(z.string()),
  current_employer: Field(z.string()),
  total_experience_years: Field(z.number()),
  roles: z.array(RoleSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema),
  languages: z.array(LanguageSchema),
  specialized_skills_keywords: z.array(Field(z.string())),
});

export type CvFacts = z.infer<typeof CvFactsSchema>;
