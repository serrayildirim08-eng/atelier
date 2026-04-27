/**
 * Per-PDF customer-contract extractor schema (rich second-pass).
 *
 * Captures Tab H-class commercial commitments from customers — offtake
 * agreements, supply contracts, MSAs, distribution agreements (manual
 * MANUAL-SUBTYPE-4 §3.8.2). A signed long-term offtake is the strongest
 * non-financial proof of the enterprise's viability and anchors the
 * substantiality + marginality argument.
 *
 * Flat schema (no union). Provenance: every leaf carries {value,
 * source_page, source_quote, confidence}, mirroring contract.schema.ts.
 * Currency captured in source currency + ISO-4217 code; the aggregator
 * reconciles FX downstream.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const CustomerContractFactsSchema = z.object({
  customer_legal_name: Field(z.string()),
  agreement_type: Field(
    z.enum(['offtake', 'supply', 'MSA', 'distribution', 'other']),
  ),
  total_value_amount: Field(z.number()),
  total_value_currency: Field(z.string()),
  term_years: Field(z.number()),
  quantity_committed: Field(z.string()),
  pricing_basis: Field(
    z.enum(['fixed', 'active_market', 'cost_plus', 'other']),
  ),
  execution_date: Field(z.string()),
  key_terms_verbatim: Field(z.string()),
});

export type CustomerContractFacts = z.infer<typeof CustomerContractFactsSchema>;
