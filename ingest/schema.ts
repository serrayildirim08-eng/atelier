import { z } from 'zod';

/**
 * Provenance wrapper. Every leaf fact extracted from a client document
 * carries the value, the source page, a verbatim quote, and a confidence
 * score. Null at any field means the source did not support a value.
 */
const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

/* ---------------------------------------------------------------------- */
/* Case-type discriminator                                                */
/* ---------------------------------------------------------------------- */

export const CaseTypeEnum = z.enum(['E2', 'EB1A', 'EB1B', 'EB1C']);
export type CaseType = z.infer<typeof CaseTypeEnum>;

/* ---------------------------------------------------------------------- */
/* Shared sub-schemas                                                     */
/* ---------------------------------------------------------------------- */

const BeneficiarySchema = z.object({
  full_name: Field(z.string()),
  dob: Field(z.string()),
  country_of_birth: Field(z.string()),
  country_of_nationality: Field(z.string()),
  passport_number: Field(z.string()),
  passport_expiry: Field(z.string()),
  current_us_status: Field(z.string()),
  highest_degree: Field(z.string()),
  field_of_endeavor: Field(z.string()),
  current_position: Field(z.string()),
  current_employer: Field(z.string()),
});

const ClaimedCriterionSchema = z.object({
  criterion_label: Field(z.string()),
  is_claimed: Field(z.string()),
  evidence_summary: Field(z.string()),
  exhibits_referenced: z.array(Field(z.string())),
});

const ExpertLetterSchema = z.object({
  writer_name: Field(z.string()),
  writer_title: Field(z.string()),
  writer_institution: Field(z.string()),
  writer_country: Field(z.string()),
  relationship_to_beneficiary: Field(z.string()),
  specificity_score: Field(z.string()),
  strongest_sentence: Field(z.string()),
});

const RoleAnalysisSchema = z.object({
  title: Field(z.string()),
  span_of_control: Field(z.string()),
  percent_time_managerial: Field(z.number()),
  percent_time_executive: Field(z.number()),
  percent_time_other: Field(z.number()),
  description: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* E-2 schema                                                             */
/* Authority: INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e); 9 FAM 402.9.    */
/* Five elements: treaty country, substantial investment, real &         */
/* operating, more than marginal, develop & direct.                       */
/* ---------------------------------------------------------------------- */

const E2InvestorSchema = z.object({
  full_name: Field(z.string()),
  dob: Field(z.string()),
  place_of_birth: Field(z.string()),
  nationality: Field(z.string()),
  passport_number: Field(z.string()),
  passport_expiry: Field(z.string()),
  current_us_status: Field(z.string()),
});

const E2EnterpriseSchema = z.object({
  legal_name: Field(z.string()),
  ein: Field(z.string()),
  formation_date: Field(z.string()),
  state_of_formation: Field(z.string()),
  entity_type: Field(z.string()),
  industry: Field(z.string()),
  naics_code: Field(z.string()),
  physical_address: Field(z.string()),
});

const OwnershipEntrySchema = z.object({
  owner_name: Field(z.string()),
  ownership_percent: Field(z.number()),
  nationality: Field(z.string()),
  direct_or_indirect: Field(z.string()),
});

const InvestmentItemSchema = z.object({
  category: Field(z.string()),
  amount_usd: Field(z.number()),
  date: Field(z.string()),
  evidence_doc: Field(z.string()),
});

const E2InvestmentSchema = z.object({
  total_committed_usd: Field(z.number()),
  total_spent_usd: Field(z.number()),
  total_cost_of_enterprise_usd: Field(z.number()),
  proportionality_percent: Field(z.number()),
  items: z.array(InvestmentItemSchema),
});

const SourceOfFundsChainSchema = z.object({
  origin_category: Field(z.string()),
  origin_amount_usd: Field(z.number()),
  origin_evidence: Field(z.string()),
  final_destination: Field(z.string()),
  notes: Field(z.string()),
});

const E2ElementsEvidenceSchema = z.object({
  treaty_country_basis: Field(z.string()),
  substantial_investment_basis: Field(z.string()),
  real_and_operating_basis: Field(z.string()),
  more_than_marginal_basis: Field(z.string()),
  develop_and_direct_basis: Field(z.string()),
});

export const E2FactsSchema = z.object({
  investor: E2InvestorSchema,
  enterprise: E2EnterpriseSchema,
  ownership_chain: z.array(OwnershipEntrySchema),
  investment: E2InvestmentSchema,
  source_of_funds: z.array(SourceOfFundsChainSchema),
  elements_evidence: E2ElementsEvidenceSchema,
  red_flags: z.array(Field(z.string())),
});

export type E2Facts = z.infer<typeof E2FactsSchema>;

/* ---------------------------------------------------------------------- */
/* EB-1A schema                                                           */
/* Authority: INA § 203(b)(1)(A); 8 CFR § 204.5(h);                      */
/* Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010).                     */
/* Need 3+ of 10 criteria, then survive Kazarian step 2 (final merits).  */
/* ---------------------------------------------------------------------- */

const KazarianStepTwoSchema = z.object({
  framework_invoked: Field(z.string()),
  sustained_acclaim_evidence: Field(z.string()),
  risen_to_very_top_evidence: Field(z.string()),
  comparison_cohort: Field(z.string()),
  recent_evidence_within_3_years: Field(z.string()),
});

const CitationCountsSchema = z.object({
  claimed_total: Field(z.number()),
  google_scholar_total: Field(z.number()),
  ex_self_citations: Field(z.number()),
  h_index_claimed: Field(z.number()),
});

export const EB1AFactsSchema = z.object({
  beneficiary: BeneficiarySchema,
  claimed_criteria: z.array(ClaimedCriterionSchema),
  expert_letters: z.array(ExpertLetterSchema),
  kazarian_step_two: KazarianStepTwoSchema,
  citation_counts: CitationCountsSchema,
  red_flags: z.array(Field(z.string())),
});

export type EB1AFacts = z.infer<typeof EB1AFactsSchema>;

/* ---------------------------------------------------------------------- */
/* EB-1B schema                                                           */
/* Authority: INA § 203(b)(1)(B); 8 CFR § 204.5(i).                      */
/* Need 2+ of 6 criteria + petitioner permanent position + 3 years.      */
/* ---------------------------------------------------------------------- */

const EB1BPetitionerSchema = z.object({
  legal_name: Field(z.string()),
  ein: Field(z.string()),
  institution_type: Field(z.string()),
  permanent_position_evidence: Field(z.string()),
});

const ThreeYearsExperienceSchema = z.object({
  evidence_summary: Field(z.string()),
  positions: z.array(Field(z.string())),
});

export const EB1BFactsSchema = z.object({
  beneficiary: BeneficiarySchema,
  petitioner: EB1BPetitionerSchema,
  three_years_experience: ThreeYearsExperienceSchema,
  permanent_position_type: Field(z.string()),
  claimed_criteria: z.array(ClaimedCriterionSchema),
  expert_letters: z.array(ExpertLetterSchema),
  red_flags: z.array(Field(z.string())),
});

export type EB1BFacts = z.infer<typeof EB1BFactsSchema>;

/* ---------------------------------------------------------------------- */
/* EB-1C schema                                                           */
/* Authority: INA § 203(b)(1)(C); 8 CFR § 204.5(j).                      */
/* Multinational manager / executive — qualifying relationship +         */
/* 1 of 3 years abroad in qualifying capacity + managerial/executive     */
/* role at both ends.                                                     */
/* ---------------------------------------------------------------------- */

const QualifyingRelationshipSchema = z.object({
  relationship_type: Field(z.string()),
  us_entity_legal_name: Field(z.string()),
  us_entity_ein: Field(z.string()),
  foreign_entity_legal_name: Field(z.string()),
  foreign_entity_country: Field(z.string()),
  ownership_chain_evidence: Field(z.string()),
});

const OneYearAbroadSchema = z.object({
  start_date: Field(z.string()),
  end_date: Field(z.string()),
  employer: Field(z.string()),
  role_summary: Field(z.string()),
});

export const EB1CFactsSchema = z.object({
  beneficiary: BeneficiarySchema,
  qualifying_relationship: QualifyingRelationshipSchema,
  us_entity_doing_business_evidence: Field(z.string()),
  one_year_abroad: OneYearAbroadSchema,
  foreign_role: RoleAnalysisSchema,
  us_role: RoleAnalysisSchema,
  functional_or_personnel_manager: Field(z.string()),
  red_flags: z.array(Field(z.string())),
});

export type EB1CFacts = z.infer<typeof EB1CFactsSchema>;

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export type CaseFacts =
  | { case_type: 'E2'; facts: E2Facts }
  | { case_type: 'EB1A'; facts: EB1AFacts }
  | { case_type: 'EB1B'; facts: EB1BFacts }
  | { case_type: 'EB1C'; facts: EB1CFacts };

/* ---------------------------------------------------------------------- */
/* Detection schema                                                       */
/* ---------------------------------------------------------------------- */

export const DetectionSchema = z.object({
  case_type: CaseTypeEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evidence_quotes: z.array(z.string()),
});

export type Detection = z.infer<typeof DetectionSchema>;
