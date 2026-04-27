/**
 * Per-PDF bank receipt extractor schema.
 *
 * Two-variant discriminated union (by `receipt_subtype`):
 *   - single_event       — one wire / transfer / FX confirmation (manual §5.2.1)
 *   - multi_installment  — property-sale proceeds split across N receipts
 *                          on N dates (manual §5.1.3, real Akalan pattern:
 *                          deposits on Oct 15, Oct 18 plus 3 same-day wires
 *                          on the sale date Nov 24)
 *
 * The multi_installment variant is the high-leverage shape: each row
 * becomes a row in the manual §5.4 SOF chain, and the buyer counterparty
 * must agree across rows. Keeping each receipt a fully-provenanced
 * sub-object (rather than a flat list of amounts) lets the aggregator
 * cite exact pages and quotes per installment.
 *
 * Currency is captured in source currency + ISO-4217 code; the aggregator
 * reconciles to USD via the wire-confirmation extractor's FX-validation
 * gate (manual §5.2.1).
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

/**
 * One installment / receipt row. Mirrors the manual §5.1.3 schema verbatim
 * so the aggregator's prompt can cite the field names directly.
 */
const ReceiptRowSchema = z.object({
  date: Field(z.string()),
  amount: Field(z.number()),
  currency: Field(z.string()),
  from_name: Field(z.string()),
  from_account_last4: Field(z.string()),
  to_name: Field(z.string()),
  to_account_last4: Field(z.string()),
  bank: Field(z.string()),
  memo_or_remittance: Field(z.string()),
});

export type ReceiptRow = z.infer<typeof ReceiptRowSchema>;

/* ---------------------------------------------------------------------- */
/* Single-event receipt (manual §5.2.1 currency conversion / single wire) */
/* ---------------------------------------------------------------------- */

const SingleEventReceiptSchema = z.object({
  receipt_subtype: z.literal('single_event'),
  receipt: ReceiptRowSchema,
  /**
   * "deposit" | "withdrawal" | "fx_conversion" | "other". Helps the
   * aggregator route a lone FX-conversion receipt into the §5.2.1 step
   * even when the wire-confirmation extractor did not run.
   */
  event_kind: Field(
    z.enum(['deposit', 'withdrawal', 'fx_conversion', 'other']),
  ),
});

/* ---------------------------------------------------------------------- */
/* Multi-installment receipts (manual §5.1.3 property-sale pattern)        */
/* ---------------------------------------------------------------------- */

const MultiInstallmentReceiptSchema = z.object({
  receipt_subtype: z.literal('multi_installment'),
  receipts: z.array(ReceiptRowSchema),
  /**
   * Sum of every row's `amount` as captured in the source. Stored in the
   * source currency to avoid silent FX conversion. The aggregator gates
   * this against the title-deed sale price.
   */
  total_received_amount: Field(z.number()),
  total_received_currency: Field(z.string()),
  /**
   * Counterparty (buyer) name — must agree across every row when the
   * receipts evidence a single property sale. Surfaced separately so the
   * aggregator can flag a row-level mismatch without re-walking the array.
   */
  consistent_counterparty_name: Field(z.string()),
  /**
   * E.g. "real_property_sale_proceeds" | "rental_income" | "other".
   * Drives the §5 SOF chain row labeling.
   */
  proceeds_kind: Field(
    z.enum(['real_property_sale_proceeds', 'rental_income', 'other']),
  ),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const BankReceiptFactsSchema = z.discriminatedUnion('receipt_subtype', [
  SingleEventReceiptSchema,
  MultiInstallmentReceiptSchema,
]);

export type BankReceiptFacts = z.infer<typeof BankReceiptFactsSchema>;
export type BankReceiptSubtype = BankReceiptFacts['receipt_subtype'];

export const BANK_RECEIPT_SUBTYPE_LABELS: Record<BankReceiptSubtype, string> = {
  single_event: 'Single-Event Bank Receipt',
  multi_installment: 'Multi-Installment Bank Receipts (e.g., property sale)',
};
