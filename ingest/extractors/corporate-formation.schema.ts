/**
 * Per-PDF corporate formation extractor schema.
 *
 * Six-variant discriminated union (by `formation_doc_subtype`) covering
 * the corporate formation documents an E-2 case folder typically contains:
 *   - articles_of_organization              (LLC formation)
 *   - articles_of_incorporation             (Corp formation)
 *   - operating_agreement_amendment         (post-formation membership change)
 *   - ein_assignment_letter                 (IRS CP 575)
 *   - certificate_of_good_standing          (Secretary of State)
 *   - state_registration                    (annual report, foreign qualification)
 *   - other_formation                       (last-resort)
 *
 * Common fields (entity_legal_name / state-or-country / type / filing_date /
 * registered_agent_name) appear on every variant. The extractor's output is
 * the formation_doc rich pass — it sits next to the thin doc_type='formation_doc'
 * facts on PerPdfResult.
 *
 * EIN handling: ein_assignment_letter captures the FULL EIN, but downstream
 * renderers MUST mask all but the last 4 digits ("XX-XXXNNNN") per the manual's
 * PII-strip rule. The model is also told this in the prompt.
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

const MemberOrShareholderSchema = z.object({
  name: Field(z.string()),
  ownership_percent: Field(z.number()),
  role: Field(z.string()),
});

const PriorOrNewMemberSchema = z.object({
  name: Field(z.string()),
  ownership_percent: Field(z.number()),
});

/* ---------------------------------------------------------------------- */
/* Variants                                                               */
/* ---------------------------------------------------------------------- */

const ArticlesOfOrganizationSchema = z.object({
  formation_doc_subtype: z.literal('articles_of_organization'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  registrant_name: Field(z.string()),
  members_or_shareholders: z.array(MemberOrShareholderSchema),
  organizer_or_incorporator_name: Field(z.string()),
  signed_date: Field(z.string()),
  /**
   * Principal office / business address as printed on the Articles. Used to
   * populate caseFacts.facts.entity.physical_address. Optional because some
   * jurisdictions only list a registered-agent address; absence forces the
   * generate-gate to surface "physical_address missing".
   */
  principal_office_address: Field(z.string()).optional(),
  registered_agent_address: Field(z.string()).optional(),
});

const ArticlesOfIncorporationSchema = z.object({
  formation_doc_subtype: z.literal('articles_of_incorporation'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  registrant_name: Field(z.string()),
  members_or_shareholders: z.array(MemberOrShareholderSchema),
  organizer_or_incorporator_name: Field(z.string()),
  signed_date: Field(z.string()),
  principal_office_address: Field(z.string()).optional(),
  registered_agent_address: Field(z.string()).optional(),
});

const OperatingAgreementAmendmentSchema = z.object({
  formation_doc_subtype: z.literal('operating_agreement_amendment'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  amendment_number: Field(z.string()),
  effective_date: Field(z.string()),
  prior_member_list: z.array(PriorOrNewMemberSchema),
  new_member_list: z.array(PriorOrNewMemberSchema),
  capital_contribution_changes_summary: Field(z.string()),
});

const EinAssignmentLetterSchema = z.object({
  formation_doc_subtype: z.literal('ein_assignment_letter'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  /**
   * Full EIN as stated on the IRS letter. Renderers MUST mask all but
   * the last 4 digits ("XX-XXXNNNN") per the manual's PII rule.
   */
  ein_full: Field(z.string()),
  assigned_date: Field(z.string()),
  irs_signature_present: Field(z.boolean()),
  /** Mailing address printed on the IRS letter — populates entity.physical_address. */
  mailing_address: Field(z.string()).optional(),
});

const CertificateOfGoodStandingSchema = z.object({
  formation_doc_subtype: z.literal('certificate_of_good_standing'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  jurisdiction: Field(z.string()),
  status_value: Field(z.string()),
  issued_date: Field(z.string()),
  expiry_or_validity_period: Field(z.string()),
});

const StateRegistrationSchema = z.object({
  formation_doc_subtype: z.literal('state_registration'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  registration_kind: Field(
    z.enum([
      'annual_report',
      'foreign_qualification',
      'amendment_of_articles',
      'name_change',
      'other_state_registration',
    ]),
  ),
  status_value: Field(z.string()),
  /** Current business address as filed with the state — populates entity.physical_address. */
  principal_office_address: Field(z.string()).optional(),
});

const OtherFormationSchema = z.object({
  formation_doc_subtype: z.literal('other_formation'),
  entity_legal_name: Field(z.string()),
  entity_state_or_country: Field(z.string()),
  entity_type: Field(z.enum(['LLC', 'Corp', 'LP', 'Other'])),
  filing_date_or_effective_date: Field(z.string()),
  registered_agent_name: Field(z.string()),
  one_line_summary: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const CorporateFormationFactsSchema = z.discriminatedUnion(
  'formation_doc_subtype',
  [
    ArticlesOfOrganizationSchema,
    ArticlesOfIncorporationSchema,
    OperatingAgreementAmendmentSchema,
    EinAssignmentLetterSchema,
    CertificateOfGoodStandingSchema,
    StateRegistrationSchema,
    OtherFormationSchema,
  ],
);

export type CorporateFormationFacts = z.infer<typeof CorporateFormationFactsSchema>;
export type CorporateFormationSubtype =
  CorporateFormationFacts['formation_doc_subtype'];

export const CORPORATE_FORMATION_SUBTYPE_LABELS: Record<
  CorporateFormationSubtype,
  string
> = {
  articles_of_organization: 'Articles of Organization (LLC)',
  articles_of_incorporation: 'Articles of Incorporation (Corp)',
  operating_agreement_amendment: 'Operating Agreement Amendment',
  ein_assignment_letter: 'EIN Assignment Letter (IRS CP 575)',
  certificate_of_good_standing: 'Certificate of Good Standing',
  state_registration: 'State Registration / Annual Report / Qualification',
  other_formation: 'Other Formation Document',
};
