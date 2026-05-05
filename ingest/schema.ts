import { z } from 'zod';

/**
 * Provenance wrapper. Every leaf fact extracted from a client document
 * carries the value, the source page, a verbatim quote, and a confidence
 * score. Null at any field means the source did not support a value.
 */
const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.preprocess(
    (v: unknown) => {
      if (v === null || v === undefined) {
        return { value: null, source_page: null, source_quote: null, confidence: null };
      }
      // The aggregator sometimes emits bare scalars / arrays where a Field is
      // required. Wrap them with null provenance so the rest of the schema
      // doesn't fail validation. The aggregator prompt forbids this, but
      // resilience here lets the pipeline keep moving.
      if (typeof v !== 'object' || Array.isArray(v)) {
        return { value: v, source_page: null, source_quote: null, confidence: null };
      }
      return v;
    },
    z.object({
      value: value.nullable(),
      source_page: z.number().int().nullable(),
      source_quote: z.string().nullable(),
      confidence: z.number().min(0).max(1).nullable(),
    }),
  );

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

/**
 * Severity 1=cosmetic, 2=clerical, 3=factual_minor, 4=factual_material,
 * 5=dispositive (HALT). Calibration examples live in the extract prompts.
 */
const ConflictEntrySchema = z.object({
  description: Field(z.string()),
  conflict_type: Field(z.string()),
  severity: Field(z.number().int().min(1).max(5)),
  fact_a_doc: Field(z.string()),
  fact_a_page: Field(z.number().int()),
  fact_b_doc: Field(z.string()),
  fact_b_page: Field(z.number().int()),
});

/**
 * Evidence APS (Adjudicator Persuasiveness Score). Three sub-components,
 * each scored 1-3, summed into a 3-9 raw score. The rfe_risk derived map:
 *   APS 8-9 → LOW
 *   APS 6-7 → MED
 *   APS 3-5 → HIGH
 * Used for the strongest evidence items per criterion (typically top 5).
 */
const EvidenceAPSSchema = z.object({
  evidence_item: Field(z.string()),
  criterion_label: Field(z.string()),
  probative_value: Field(z.enum(['HIGH', 'MED', 'LOW'])),
  independence: Field(z.enum(['STRONG', 'MOD', 'WEAK'])),
  corroboration: Field(z.enum(['CORR', 'PARTIAL', 'NONE'])),
  aps_score: Field(z.number().int().min(3).max(9)),
  rfe_risk: Field(z.enum(['LOW', 'MED', 'HIGH'])),
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
  // Phase-2 (Flatturbo OCR) gate inputs. All optional/null-defaulted.
  // current_status: granular B-2 / B-1 / ESTA detector input for
  // b2_status_violation_signal. prior_status_expiration_date +
  // work_authorization_date drive status_gap_pre_filing and the
  // pre-authorization-operations branch of b2_status_violation_signal.
  current_status: Field(z.string()).optional(),
  prior_status_expiration_date: Field(z.string()).optional(),
  work_authorization_date: Field(z.string()).optional(),
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
  // Phase-2 (Flatturbo OCR) gate inputs. All optional/null-defaulted.
  // fully_operational_since_date: when the case theory claims day-to-day
  // ops began; compared against work_authorization_date and
  // filed_date_i129 by b2_status_violation_signal. claimed vs observed
  // business_model populates external_evidence_contradiction_risk.
  fully_operational_since_date: Field(z.string()).optional(),
  claimed_business_model: Field(z.string()).optional(),
  observed_business_model: Field(z.string()).optional(),
  // Phase-6 manual-input stub for external_evidence_contradiction_risk.
  // Attorney-typed one-liner from a manual Yelp/Google/BBB/website check.
  // No automated puller — the gate prefers this when populated; falls
  // back to observed_business_model otherwise.
  observed_business_model_manual_input: Field(z.string()).optional(),
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
  // Gate input (Phase-0.7+). Optional — claimed (cover-letter / I-129E) USD
  // amount, used by unaccounted_sof_share against documented_amount_usd
  // sums on source_of_funds.
  claimed_amount_usd: Field(z.number()).optional(),
});

const SourceOfFundsChainSchema = z.object({
  origin_category: Field(z.string()),
  origin_amount_usd: Field(z.number()),
  origin_evidence: Field(z.string()),
  final_destination: Field(z.string()),
  notes: Field(z.string()),
  // Gate inputs (Phase-0.7+). Optional — null when extractor doesn't populate.
  // documented_amount_usd is the amount the firm has primary evidence for
  // (used by unaccounted_sof_share). source_person.full_name is the human
  // whose funds these are (used by co_petitioner_fund_circularity to match
  // against matter.co_petitioners).
  documented_amount_usd: Field(z.number()).optional(),
  source_person: z
    .object({
      full_name: Field(z.string()),
    })
    .optional(),
});

const OwnershipHistoryEntrySchema = z.object({
  effective_date: Field(z.string()),
  // The set of owner names *as of this transition*. Distinct sets across
  // entries = a transition. Used by ownership_volatility gate.
  owner_names: z.array(Field(z.string())),
  source_doc: Field(z.string()),
});

const CoPetitionerRelationshipEnum = z.enum([
  'spouse',
  'child',
  'co_investor',
  'sibling',
  'parent',
  'business_partner',
  'unknown',
]);

const CoPetitionerSubAppEnum = z.enum([
  'sub1',
  'sub2',
  'sub3',
  'sub4',
  'sub5',
  'sub6',
  'derivative_only',
  'none',
]);

const CoPetitionerSchema = z.object({
  full_name: Field(z.string()),
  role: Field(z.string()),
  // Phase-6 enrichment fields. All optional / null-defaulted so legacy
  // matters validate. Used by the dossier UI to render co-petitioner
  // role detail; co_petitioner_fund_circularity gate consults
  // sub_application_status when distinguishing a Sub2 lender from a
  // pure derivative dependent.
  relationship_to_principal: Field(CoPetitionerRelationshipEnum).optional(),
  sub_application_status: Field(CoPetitionerSubAppEnum).optional(),
  role_in_petitioner_entity: Field(z.string()).optional(),
});

/**
 * Phase-10 — derivative-dependent slot. Populated by
 * `lib/e2/dependent-inference.ts` after the principal applicant is
 * identified (applicant-inference.ts) and the family documents
 * (marriage_certificate, birth_certificate, nufus_kayit_ornegi) have been
 * extracted. One row per dependent passport that the deterministic ladder
 * (or the env-gated Haiku 4.5 fallback) was able to bind to a specific
 * relationship. Unmatched passports are surfaced via
 * conflict_register entries (conflict_type='unmatched_passport',
 * severity 2) rather than a row here, so the dossier UI can show the
 * attorney "we saw this passport but couldn't tie it to a family doc".
 *
 * `dependent_doc_basis` records WHICH family doc carried the binding fact
 * (e.g., "marriage_certificate.pdf" or "nufus_kayit_ornegi.pdf"); the
 * drafter prints this verbatim in the cover-letter dependent paragraph.
 */
const E2DependentRelationshipEnum = z.enum([
  'spouse',
  'child',
  'other_dependent',
]);

const E2DependentSchema = z.object({
  full_name: Field(z.string()),
  relationship: Field(E2DependentRelationshipEnum),
  dob: Field(z.string()),
  nationality: Field(z.string()),
  passport_filename: Field(z.string()),
  dependent_doc_basis: Field(z.string()),
});

export type E2Dependent = z.infer<typeof E2DependentSchema>;
export type E2DependentRelationship = z.infer<typeof E2DependentRelationshipEnum>;

const MatterMetaSchema = z.object({
  co_petitioners: z.array(CoPetitionerSchema).optional(),
  // Phase-7 Task B — attorney-supplied per-matter sub-application alias
  // overrides. Keys are firm-internal folder / filename variants
  // ("Subordinate-One", "S1_PetitionerB"); values are canonical sub
  // slots ("sub1".."sub6"). Takes precedence over the static
  // SUB_APPLICATION_ALIAS_MAP in lib/case-folder-aliases.ts.
  sub_application_aliases: z.record(z.string(), z.string()).optional(),
});

// Phase-8 — cover-letter narrative-claim slot. Mirrors the per-cover-letter
// CoverLetterRichFactsSchema shapes captured in
// ingest/extractors/cover-letter.schema.ts but lives on E2FactsSchema so
// the drafter + reviewer can read these without round-tripping through
// the typed-memory pipeline. All three sub-shapes are nullable + optional;
// the Phase-8 enricher (deriveCoverLetterPhase7Fields → enrichPhase8Fields)
// populates whichever fields the cover-letter rich extractor surfaced.
const CoverLetterPhase7PassportFootnoteSchema = z.object({
  paragraph_text: z.string(),
  prior_passport_number: z.string(),
  current_passport_number: z.string(),
});

const CoverLetterPhase7HorizonSchema = z.object({
  year_1_revenue_usd: z.number().nullable(),
  year_3_revenue_usd: z.number().nullable(),
  year_5_revenue_usd: z.number().nullable(),
  year_5_employee_count: z.number().nullable(),
});

const DevelopAndDirectAuthorityScopeEnum = z.enum([
  'contract_signing',
  'banking_authority',
  'hire_fire',
  'day_to_day_operations',
  'strategic_planning',
]);

export type DevelopAndDirectAuthorityScope = z.infer<
  typeof DevelopAndDirectAuthorityScopeEnum
>;

const CoverLetterPhase7RoleGrantSchema = z.object({
  role_title: z.string(),
  granting_document_ref: z.string(),
  authority_scope: z.array(DevelopAndDirectAuthorityScopeEnum),
});

const CoverLetterPhase7Schema = z.object({
  passport_renewal_footnote: CoverLetterPhase7PassportFootnoteSchema
    .nullable()
    .optional(),
  five_year_horizon: CoverLetterPhase7HorizonSchema.nullable().optional(),
  develop_and_direct_role_grant: CoverLetterPhase7RoleGrantSchema
    .nullable()
    .optional(),
});

export type CoverLetterPhase7 = z.infer<typeof CoverLetterPhase7Schema>;

const BusinessPlanPhase9HorizonSchema = z.object({
  year_1_revenue_usd: z.number().nullable(),
  year_3_revenue_usd: z.number().nullable(),
  year_5_revenue_usd: z.number().nullable(),
  year_5_employee_count: z.number().nullable(),
});

const BusinessPlanPhase9Schema = z.object({
  five_year_horizon: BusinessPlanPhase9HorizonSchema.nullable().optional(),
});

export type BusinessPlanPhase9 = z.infer<typeof BusinessPlanPhase9Schema>;

const RfeEntrySchema = z.object({
  rfe_date: Field(z.string()),
  subject_category: Field(
    z.enum([
      'bona_fide_enterprise',
      'marginality',
      'substantial_investment',
      'source_of_funds',
      'classification',
      'maintenance_of_status',
      'other',
      // Phase-4 additions (rfe-notice rich extractor closed enum). Older
      // names are preserved for back-compat; new fixtures emit the
      // Phase-4 names.
      'nationality_or_ownership',
      'develop_and_direct',
      'procedural_status',
      'classification_ambiguity',
      'multiple',
    ]),
  ),
  notes: Field(z.string()),
  // Phase-2 (Flatturbo OCR) gate inputs for material_change_in_response_to_uscis.
  // Verbatim assertion from the initial filing vs the assertion in the
  // RFE/NOID response on the same factual point (date / ownership /
  // business activity / operational status). Mismatch trips Matter of Izummi.
  initial_filing_assertion: Field(z.string()).optional(),
  response_assertion: Field(z.string()).optional(),
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
  conflict_register: z.array(ConflictEntrySchema),
  // Phase-0.7+ gate inputs. All optional/null-defaulted — pre-existing
  // matters extracted before these fields landed continue to validate.
  matter: MatterMetaSchema.optional(),
  ownership_history: z.array(OwnershipHistoryEntrySchema).optional(),
  filed_date_i129: Field(z.string()).optional(),
  rfes: z.array(RfeEntrySchema).optional(),
  // Phase-8 — cover-letter narrative claims surfaced from the cover-letter
  // rich extractor. Drafter consumes these to drive the passport-renewal
  // footnote, the five-year horizon section, and the develop-and-direct
  // authority surfacing. Reviewer's two new gates
  // (`develop_and_direct_role_authority_thin`, `five_year_horizon_marginal_failure`)
  // also read this slot.
  cover_letter_phase7: CoverLetterPhase7Schema.optional(),
  // Phase-9 — business-plan five-year horizon mirror. Populated by the
  // Phase-9 business-plan rich extractor; consumed by the
  // `five_year_horizon_vs_business_plan_drift` gate which compares it
  // against `cover_letter_phase7.five_year_horizon` for credibility under
  // Matter of Ho.
  business_plan_phase9: BusinessPlanPhase9Schema.optional(),
  // Phase-10 — derivative-dependent identification. One row per passport
  // the deterministic dependent-inference ladder (or the env-gated Haiku
  // 4.5 fallback) was able to bind to a family document. Unmatched
  // passports are surfaced as `unmatched_passport` (severity 2)
  // conflict_register entries instead, so the attorney can see which
  // people the firm has passport-level evidence for that didn't match a
  // marriage / birth / Nüfus record. Optional — pre-Phase-10 matters
  // continue to validate.
  dependents: z.array(E2DependentSchema).optional(),
});

export type E2Facts = z.infer<typeof E2FactsSchema>;

/* ---------------------------------------------------------------------- */
/* EB-1A schema                                                           */
/* Authority: INA § 203(b)(1)(A); 8 CFR § 204.5(h);                      */
/* Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010).                     */
/* Need 3+ of 10 criteria, then survive Kazarian step 2 (final merits).  */
/* ---------------------------------------------------------------------- */

const PeerBenchmarkingSchema = z.object({
  field_definition: Field(z.string()),
  beneficiary_metric: Field(z.string()),
  field_median: Field(z.string()),
  field_top_10_percent: Field(z.string()),
  benchmark_source: Field(z.string()),
  percentile_conclusion: Field(z.string()),
});

const KazarianStepTwoSchema = z.object({
  framework_invoked: Field(z.string()),
  sustained_acclaim_evidence: Field(z.string()),
  risen_to_very_top_evidence: Field(z.string()),
  comparison_cohort: Field(z.string()),
  recent_evidence_within_3_years: Field(z.string()),
  top_of_field_evidence: z.array(Field(z.string())),
  peer_benchmarking: z.array(PeerBenchmarkingSchema),
  narrative_stress_test: Field(z.string()),
});

const CitationCountsSchema = z.object({
  claimed_total: Field(z.number()),
  google_scholar_total: Field(z.number()),
  ex_self_citations: Field(z.number()),
  h_index_claimed: Field(z.number()),
});

/**
 * Tier-1 filing metadata. filing_route + consulate_post are MANUAL inputs
 * (the bot never auto-detects these — see earlier design discussion).
 * Address fields are auto-filled from passport / visa / I-797 mailing
 * blocks where available, but always editable.
 */
const EB1AFilingMetadataSchema = z.object({
  filing_route: Field(z.enum(['consular', 'change_of_status', 'unknown'])),
  consulate_post: Field(z.string()),
  i140_receipt_number: Field(z.string()),
  i140_filed_date: Field(z.string()),
  residential_address: Field(z.string()),
  mailing_address: Field(z.string()),
  mailing_address_same_as_residential: Field(z.boolean()),
  manual_overrides_applied: z.array(Field(z.string())),
});

/**
 * Tier-2 — academic record. One row per qualifying credential, oldest
 * first. is_terminal=true marks the highest degree the beneficiary holds
 * in the field (used by tenure-table classifier to split phd / postdoc
 * vs employment).
 */
const EB1AEducationEntrySchema = z.object({
  degree: Field(z.string()),
  field_of_study: Field(z.string()),
  institution: Field(z.string()),
  country: Field(z.string()),
  start_date: Field(z.string()),
  end_date: Field(z.string()),
  is_terminal: Field(z.boolean()),
  evidence_doc: Field(z.string()),
});

/**
 * Tier-2 — master tenure table. Backbone for the future leading/critical-
 * role criterion gate (8 CFR 204.5(h)(3)(viii)). One row per role.
 * Sources: CV roles[], service-record extractor, employer letters,
 * recommendation letters with prior-employer relationship. Academic
 * positions (PhD program, postdoc, visiting appointments) are first-
 * class rows — tenure_type discriminates.
 */
const EB1ATenureEntrySchema = z.object({
  employer: Field(z.string()),
  title: Field(z.string()),
  tenure_type: Field(
    z.enum([
      'employment',
      'phd_program',
      'postdoc',
      'fellowship',
      'visiting_appointment',
      'consulting',
      'board_or_advisory',
      'other',
    ]),
  ),
  start_date: Field(z.string()),
  end_date: Field(z.string()),
  is_current: Field(z.boolean()),
  country: Field(z.string()),
  scope_of_role: Field(z.string()),
  headcount_under: Field(z.number()),
  evidence_docs: z.array(Field(z.string())),
});

/**
 * Tier-3 — field of endeavor classification (Haiku 4.5 pass with manual
 * override). Goldilocks rule applies:
 *   too_broad → peer comparison meaningless ("computer science")
 *   goldilocks → specific enough to compare, broad enough to have peers
 *   too_narrow → no defined peer set ("React 19 server-component memory profiling")
 * Always manually editable. peer_set_description is a 1-sentence
 * description of "others in the field" that the criteria gates use to
 * frame benchmarking.
 */
const EB1AFieldClassificationSchema = z.object({
  label: Field(z.string()),
  peer_set_description: Field(z.string()),
  specificity: Field(z.enum(['too_broad', 'goldilocks', 'too_narrow'])),
  confidence: Field(z.enum(['HIGH', 'MED', 'LOW'])),
  reasoning: Field(z.string()),
  manual_override_used: Field(z.boolean()),
});

/**
 * Case-theory synthesis (Phase-0.8). Produced by the case-theory
 * synthesizer in ingest/extractors/case-theory.ts. Anchors every
 * downstream LLM gate (criteria (h)(3)(i)–(x), Kazarian step 2,
 * expert-letter scaffolding, cover-letter draft).
 */
const EB1ACaseTheorySchema = z.object({
  one_line: Field(z.string()),
  specialized_knowledge_arc: Field(z.string()),
  evidence_anchors: z.array(
    z.object({
      source_id: Field(z.string()),
      why_it_matters: Field(z.string()),
    }),
  ),
  confidence: Field(z.enum(['HIGH', 'MED', 'LOW'])),
  gaps: Field(z.string()),
  manual_override_used: Field(z.boolean()),
});

/**
 * Derivative dependents — spouse + unmarried under-21 children.
 * EB-1A derivatives follow INA §203(d); the binding shape is identical
 * to the E-2 dependent slot (E2DependentSchema), so the inference
 * helper in `lib/e2/dependent-inference.ts` is reused.
 */
const EB1ADerivativeSchema = E2DependentSchema;
export type EB1ADerivative = z.infer<typeof EB1ADerivativeSchema>;

/**
 * Beneficiary visa history timeline. One row per discrete event:
 *   - passport_issued  (passport.date_of_issue)
 *   - visa_issued      (visa-stamp validity_start_date)
 *   - admission        (i94 admission_date OR visa-stamp prior_admissions)
 *   - status_grant     (I-797 approval — visa-stamp i797_receipt_number)
 *   - status_expiration (visa-stamp validity_end_date OR i94 admit_until)
 *
 * Sorted ascending by date. Powers the cover-letter "prior immigration
 * history" paragraph and the extraordinary-ability "sustained presence
 * in the field" framing.
 */
const VisaHistoryEventTypeEnum = z.enum([
  'passport_issued',
  'visa_issued',
  'admission',
  'status_grant',
  'status_expiration',
]);

const VisaHistoryEntrySchema = z.object({
  date: Field(z.string()),
  event_type: Field(VisaHistoryEventTypeEnum),
  classification: Field(z.string()),
  port_or_consulate: Field(z.string()),
  source_doc: Field(z.string()),
});

export type VisaHistoryEntry = z.infer<typeof VisaHistoryEntrySchema>;
export type VisaHistoryEventType = z.infer<typeof VisaHistoryEventTypeEnum>;

export const EB1AFactsSchema = z.object({
  beneficiary: BeneficiarySchema,
  filing_metadata: EB1AFilingMetadataSchema,
  education_history: z.array(EB1AEducationEntrySchema),
  tenure_table: z.array(EB1ATenureEntrySchema),
  field_classification: EB1AFieldClassificationSchema,
  case_theory: EB1ACaseTheorySchema,
  derivatives: z.array(EB1ADerivativeSchema),
  visa_history: z.array(VisaHistoryEntrySchema),
  claimed_criteria: z.array(ClaimedCriterionSchema),
  expert_letters: z.array(ExpertLetterSchema),
  kazarian_step_two: KazarianStepTwoSchema,
  citation_counts: CitationCountsSchema,
  evidence_aps: z.array(EvidenceAPSSchema),
  conflict_register: z.array(ConflictEntrySchema),
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

const InternationalRecognitionSchema = z.object({
  international_collaborators: Field(z.string()),
  invited_talks_abroad: Field(z.string()),
  foreign_grants_or_fellowships: Field(z.string()),
  visiting_appointments_abroad: Field(z.string()),
  international_editorial_or_advisory: Field(z.string()),
  foreign_media_coverage: Field(z.string()),
  top_of_field_evidence: z.array(Field(z.string())),
  peer_benchmarking: z.array(PeerBenchmarkingSchema),
  narrative_stress_test: Field(z.string()),
});

export const EB1BFactsSchema = z.object({
  beneficiary: BeneficiarySchema,
  petitioner: EB1BPetitionerSchema,
  three_years_experience: ThreeYearsExperienceSchema,
  permanent_position_type: Field(z.string()),
  claimed_criteria: z.array(ClaimedCriterionSchema),
  expert_letters: z.array(ExpertLetterSchema),
  international_recognition: InternationalRecognitionSchema,
  evidence_aps: z.array(EvidenceAPSSchema),
  conflict_register: z.array(ConflictEntrySchema),
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

/**
 * Subordinate tier classification per direct report. Drives the
 * "first-line supervisor" analysis under INA 101(a)(44)(A)(ii) — if every
 * direct report is non-professional, the beneficiary is presumptively a
 * first-line supervisor and not a manager. Used for both foreign and U.S.
 * roles in EB-1C (and parallel structures in L-1A if added later).
 */
const SubordinateEntrySchema = z.object({
  name: Field(z.string()),
  title: Field(z.string()),
  tier: Field(
    z.enum([
      'managerial',
      'supervisory',
      'professional',
      'non-professional',
      'UNCLEAR',
    ]),
  ),
  evidence: Field(z.string()),
  source_doc: Field(z.string()),
  side: Field(z.enum(['foreign', 'us'])),
});

export const EB1CFactsSchema = z.object({
  beneficiary: BeneficiarySchema,
  qualifying_relationship: QualifyingRelationshipSchema,
  us_entity_doing_business_evidence: Field(z.string()),
  one_year_abroad: OneYearAbroadSchema,
  foreign_role: RoleAnalysisSchema,
  us_role: RoleAnalysisSchema,
  functional_or_personnel_manager: Field(z.string()),
  subordinate_tier_table: z.array(SubordinateEntrySchema),
  conflict_register: z.array(ConflictEntrySchema),
});

export type EB1CFacts = z.infer<typeof EB1CFactsSchema>;

/* ---------------------------------------------------------------------- */
/* Drafter mode (Phase-0.7 will detect; default 'initial' until then)      */
/* ---------------------------------------------------------------------- */

export const DraftModeEnum = z.enum([
  'initial',
  'premium_upgrade',
  'rfe_response',
  'service_request',
]);
export type DraftMode = z.infer<typeof DraftModeEnum>;

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

import type { E2PrincipalSubtype } from './extractors/subtype-detect.schema';

export type CaseFacts =
  | {
      case_type: 'E2';
      facts: E2Facts;
      subtype?: E2PrincipalSubtype | null;
      draft_mode?: DraftMode | null;
    }
  | { case_type: 'EB1A'; facts: EB1AFacts; draft_mode?: DraftMode | null }
  | { case_type: 'EB1B'; facts: EB1BFacts; draft_mode?: DraftMode | null }
  | { case_type: 'EB1C'; facts: EB1CFacts; draft_mode?: DraftMode | null };

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

// Re-export the E-2 sub-type structure so callers can import the full
// post-detection shape from a single module. The chained sub-type
// classifier (Phase-0.6, runs only when case_type='E2') is implemented in
// ingest/extractors/subtype-detect.ts.
export type {
  E2CaseSubtype,
  E2PrincipalSubtype,
  E2ProceduralPosture,
  E2DetectionConfidence,
} from './extractors/subtype-detect.schema';

import type { E2CaseSubtype as _E2CaseSubtype } from './extractors/subtype-detect.schema';

/**
 * Detection bundle returned by the Phase-0 + Phase-0.6 chain. When
 * case_type is 'E2', e2_subtype is populated by the chained sub-type
 * classifier; for the other case types it stays null.
 */
export interface DetectionWithSubtype extends Detection {
  e2_subtype: _E2CaseSubtype | null;
}
