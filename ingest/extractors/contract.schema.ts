/**
 * Per-PDF contract extractor schema.
 *
 * Six-variant discriminated union (by `contract_subtype`) covering the
 * contract types this firm sees on E-2 cases:
 *   - membership_interest_transfer_agreement   (manual §4.5 — heaviest)
 *   - operating_agreement                      (manual §4.2)
 *   - bill_of_sale                             (manual §4.4)
 *   - commercial_lease                         (manual §7.3)
 *   - residential_lease                        (manual §5.1.5)
 *   - other_contract
 *
 * Every leaf field carries the same {value, source_page, source_quote,
 * confidence} provenance wrapper as ingest/schema.ts, so traceability
 * survives aggregation. Currency values are extracted in their source
 * currency with a separate ISO-4217 currency field — the aggregator
 * (Sonnet) reconciles FX afterward.
 *
 * The membership_interest_transfer_agreement variant is gated downstream
 * (manual §4.5 quality gate): its total_consideration_amount must equal
 * the I-129 E Supplement investment_amount; mismatch = severity 5.
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

const PartySchema = z.object({
  name: Field(z.string()),
  ownership_before: Field(z.number()),
  ownership_after: Field(z.number()),
});

const PaymentTermsSchema = z.object({
  upfront_amount: Field(z.number()),
  upfront_currency: Field(z.string()),
  deferred_amount: Field(z.number()),
  deferred_currency: Field(z.string()),
  schedule: Field(z.string()),
  promissory_note_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Membership Interest Transfer Agreement (manual §4.5 — heaviest)        */
/* ---------------------------------------------------------------------- */

const MembershipInterestTransferSchema = z.object({
  contract_subtype: z.literal('membership_interest_transfer_agreement'),
  effective_date: Field(z.string()),
  petitioner_legal_name: Field(z.string()),
  transferor: PartySchema,
  transferee: PartySchema,
  interest_transferred_percent: Field(z.number()),
  total_consideration_amount: Field(z.number()),
  total_consideration_currency: Field(z.string()),
  payment_terms: PaymentTermsSchema,
  executive_role_granted: Field(z.string()),
  effective_date_role: Field(z.string()),
  notarization_present: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Operating Agreement (manual §4.2)                                      */
/* ---------------------------------------------------------------------- */

const InitialMemberSchema = z.object({
  member_name: Field(z.string()),
  ownership_percent: Field(z.number()),
  capital_contribution_amount: Field(z.number()),
  capital_contribution_currency: Field(z.string()),
});

const OperatingAgreementSchema = z.object({
  contract_subtype: z.literal('operating_agreement'),
  entity_legal_name: Field(z.string()),
  formation_date_referenced: Field(z.string()),
  members: z.array(InitialMemberSchema),
  management_structure: Field(z.enum(['member_managed', 'manager_managed', 'unclear'])),
  amendment_or_original: Field(z.enum(['original', 'amendment'])),
});

/* ---------------------------------------------------------------------- */
/* Bill of Sale (manual §4.4)                                             */
/* ---------------------------------------------------------------------- */

const BillOfSaleSchema = z.object({
  contract_subtype: z.literal('bill_of_sale'),
  executed_date: Field(z.string()),
  transferor: PartySchema,
  transferee: PartySchema,
  interest_transferred_percent: Field(z.number()),
  consideration_amount: Field(z.number()),
  consideration_currency: Field(z.string()),
  promissory_note_present: Field(z.boolean()),
  notarized_or_apostilled: Field(z.boolean()),
});

/* ---------------------------------------------------------------------- */
/* Commercial Lease (manual §7.3)                                         */
/* ---------------------------------------------------------------------- */

const CommercialLeaseSchema = z.object({
  contract_subtype: z.literal('commercial_lease'),
  landlord: Field(z.string()),
  tenant_legal_name: Field(z.string()),
  premises_address: Field(z.string()),
  term_start: Field(z.string()),
  term_end: Field(z.string()),
  monthly_rent_amount: Field(z.number()),
  monthly_rent_currency: Field(z.string()),
  security_deposit_amount: Field(z.number()),
  renewal_options: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Residential Lease (manual §5.1.5 — defensive cases)                    */
/* ---------------------------------------------------------------------- */

const ResidentialLeaseSchema = z.object({
  contract_subtype: z.literal('residential_lease'),
  landlord_name: Field(z.string()),
  landlord_relationship_to_beneficiary: Field(
    z.enum(['beneficiary', 'spouse', 'parent', 'child', 'other', 'unclear']),
  ),
  tenant_name: Field(z.string()),
  tenant_account_last4: Field(z.string()),
  monthly_rent_initial_amount: Field(z.number()),
  monthly_rent_initial_currency: Field(z.string()),
  monthly_rent_current_amount: Field(z.number()),
  monthly_rent_current_currency: Field(z.string()),
  term_start: Field(z.string()),
  term_end: Field(z.string()),
  escalation_clause_verbatim: Field(z.string()),
  escalation_index_named: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Other                                                                  */
/* ---------------------------------------------------------------------- */

const OtherContractSchema = z.object({
  contract_subtype: z.literal('other_contract'),
  one_line_summary: Field(z.string()),
  parties: z.array(Field(z.string())),
  signed_date: Field(z.string()),
  total_value_amount: Field(z.number()),
  total_value_currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const ContractFactsSchema = z.discriminatedUnion('contract_subtype', [
  MembershipInterestTransferSchema,
  OperatingAgreementSchema,
  BillOfSaleSchema,
  CommercialLeaseSchema,
  ResidentialLeaseSchema,
  OtherContractSchema,
]);

export type ContractFacts = z.infer<typeof ContractFactsSchema>;
export type ContractSubtype = ContractFacts['contract_subtype'];

export const CONTRACT_SUBTYPE_LABELS: Record<ContractSubtype, string> = {
  membership_interest_transfer_agreement: 'Membership Interest Transfer Agreement',
  operating_agreement: 'Operating Agreement',
  bill_of_sale: 'Bill of Sale',
  commercial_lease: 'Commercial Lease',
  residential_lease: 'Residential Lease',
  other_contract: 'Other Contract',
};
