/**
 * Per-PDF incentive-document extractor schema (rich second-pass).
 *
 * Captures government incentives that anchor the §FINANCIAL SITUATION
 * AND FUTURE PLANS narrative — Production Tax Credits (PTC), Inflation
 * Reduction Act (IRA) credits, state credits, federal grants, tax
 * exemptions (manual MANUAL-SUBTYPE-4 §3 / cover-letter narrative). The
 * aggregator runs a deterministic gate: recipient_legal_name !==
 * Petitioner.legal_name → severity-3 'incentive_recipient_mismatch'
 * (an incentive awarded to the Beneficiary personally cannot be claimed
 * as enterprise capacity).
 *
 * Flat schema (no union). Provenance: every leaf carries {value,
 * source_page, source_quote, confidence}, mirroring contract.schema.ts.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const IncentiveDocumentFactsSchema = z.object({
  incentive_type: Field(
    z.enum([
      'PTC',
      'IRA',
      'state_credit',
      'federal_grant',
      'tax_exemption',
      'other',
    ]),
  ),
  issuing_authority: Field(z.string()),
  recipient_legal_name: Field(z.string()),
  value_amount: Field(z.number()),
  value_currency: Field(z.string()),
  term_years: Field(z.number()),
  conditions_verbatim: Field(z.string()),
});

export type IncentiveDocumentFacts = z.infer<
  typeof IncentiveDocumentFactsSchema
>;
