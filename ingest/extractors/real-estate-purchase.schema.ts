/**
 * Per-PDF real-estate purchase-agreement extractor schema (rich
 * second-pass).
 *
 * Captures Tab H-class real-property purchase agreements for the
 * Petitioner's plant or facility build-out (manual MANUAL-SUBTYPE-4
 * §3.8.5). Real-estate purchases are among the strongest substantiality
 * proofs available; the buyer-mismatch gate at the aggregator level fires
 * severity-4 when buyer_legal_name disagrees with the Petitioner's
 * legal_name.
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

export const RealEstatePurchaseFactsSchema = z.object({
  buyer_legal_name: Field(z.string()),
  seller_legal_name: Field(z.string()),
  property_address: Field(z.string()),
  property_size_acres: Field(z.number()),
  purchase_price_amount: Field(z.number()),
  purchase_price_currency: Field(z.string()),
  execution_date: Field(z.string()),
  closing_date: Field(z.string()),
  deed_type: Field(
    z.enum(['warranty', 'quitclaim', 'special_warranty', 'grant', 'other']),
  ),
  title_insurance_present: Field(z.boolean()),
});

export type RealEstatePurchaseFacts = z.infer<
  typeof RealEstatePurchaseFactsSchema
>;
