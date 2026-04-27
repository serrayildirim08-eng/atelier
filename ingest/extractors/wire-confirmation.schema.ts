/**
 * Per-PDF wire-confirmation extractor schema.
 *
 * Three-variant discriminated union (by `wire_subtype`):
 *   - international_wire_with_fx — cross-border wire that bundles a
 *     currency conversion (TRY → USD), e.g. manual §5.2.1 FX receipt or
 *     §5.2.2 international SWIFT confirmation. Both source and target
 *     amounts plus an exchange_rate are extracted; a deterministic FX
 *     gate downstream verifies |source × rate − target| / target ≤ 1%.
 *   - usd_only_wire — domestic or cross-border SWIFT in a single currency
 *     (typically USD). Manual §5.2.3 close-of-chain wires
 *     (Beneficiary → Co-Owner / Petitioner) live here.
 *   - corporate_funding — Subtype-4 (Camural) pattern: a parent entity
 *     funds its US subsidiary, both holding USD accounts; no FX
 *     reconciliation is required. The taxonomy treats this as a distinct
 *     SOF leg because the SOF chain originates inside the corporate
 *     parent's books rather than the Beneficiary's personal funds.
 *
 * Provenance: every leaf carries {value, source_page, source_quote,
 * confidence}. Currency is captured in source currency + ISO-4217 code;
 * the aggregator handles cross-extractor reconciliation (manual §5.4 SOF
 * chain + manual §4.5 consideration gate).
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

const PartyEndpointSchema = z.object({
  holder_name: Field(z.string()),
  account_last4: Field(z.string()),
  bank: Field(z.string()),
  bank_country: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* International wire with embedded FX (manual §5.2.1 / §5.2.2)            */
/* ---------------------------------------------------------------------- */

const InternationalWireWithFxSchema = z.object({
  wire_subtype: z.literal('international_wire_with_fx'),
  /** SWIFT MT103 reference number, when present on the slip. */
  swift_mt103_reference: Field(z.string()),
  value_date: Field(z.string()),
  sender: PartyEndpointSchema,
  receiver: PartyEndpointSchema,
  /** Source-currency leg (e.g., TRY 4,086,900). */
  source_amount: Field(z.number()),
  source_currency: Field(z.string()),
  /** Target-currency leg (e.g., USD 95,600). */
  target_amount: Field(z.number()),
  target_currency: Field(z.string()),
  /** As stated on the receipt (e.g., 42.75000 TRY/USD). */
  exchange_rate: Field(z.number()),
  fees_amount: Field(z.number()),
  fees_currency: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* USD-only wire (manual §5.2.3 close-of-chain wire)                       */
/* ---------------------------------------------------------------------- */

const UsdOnlyWireSchema = z.object({
  wire_subtype: z.literal('usd_only_wire'),
  swift_mt103_reference: Field(z.string()),
  value_date: Field(z.string()),
  sender: PartyEndpointSchema,
  receiver: PartyEndpointSchema,
  amount: Field(z.number()),
  currency: Field(z.string()),
  fees_amount: Field(z.number()),
  fees_currency: Field(z.string()),
  remittance_information: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Corporate funding (Subtype 4 — Camural pattern: parent → subsidiary)    */
/* ---------------------------------------------------------------------- */

const CorporateFundingSchema = z.object({
  wire_subtype: z.literal('corporate_funding'),
  swift_mt103_reference: Field(z.string()),
  value_date: Field(z.string()),
  /**
   * Parent / funding corporate entity. Distinct from `sender` in the
   * other variants because it is a corporate party, not a natural person.
   */
  parent_entity: PartyEndpointSchema,
  /**
   * Subsidiary recipient. Typically the Petitioner LLC.
   */
  subsidiary_entity: PartyEndpointSchema,
  amount: Field(z.number()),
  currency: Field(z.string()),
  /**
   * "capital_contribution" | "intercompany_loan" | "other". A loan
   * leg may trigger 9 FAM 402.9-6(C)(2) at-risk concerns later — surface
   * it explicitly so the aggregator can flag.
   */
  funding_purpose: Field(
    z.enum(['capital_contribution', 'intercompany_loan', 'other']),
  ),
  remittance_information: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const WireConfirmationFactsSchema = z.discriminatedUnion('wire_subtype', [
  InternationalWireWithFxSchema,
  UsdOnlyWireSchema,
  CorporateFundingSchema,
]);

export type WireConfirmationFacts = z.infer<typeof WireConfirmationFactsSchema>;
export type WireConfirmationSubtype = WireConfirmationFacts['wire_subtype'];

export const WIRE_CONFIRMATION_SUBTYPE_LABELS: Record<
  WireConfirmationSubtype,
  string
> = {
  international_wire_with_fx: 'International Wire with FX Conversion',
  usd_only_wire: 'USD-Only Wire (single currency)',
  corporate_funding: 'Corporate Funding (parent → subsidiary, Subtype 4)',
};

/* ---------------------------------------------------------------------- */
/* Deterministic FX validation gate (manual §5.2.1 quality gate)           */
/* ---------------------------------------------------------------------- */

/** Tolerance for the |source × rate − target| / target check (manual §5.2.1). */
export const FX_GATE_TOLERANCE = 0.01;

export interface FxGateResult {
  ok: boolean;
  /** Relative drift in decimal (e.g., 0.0042 for 0.42%). null if not computable. */
  relative_drift: number | null;
  source_amount: number | null;
  source_currency: string | null;
  target_amount: number | null;
  target_currency: string | null;
  exchange_rate: number | null;
}

/**
 * Run the §5.2.1 FX validation gate against an international_wire_with_fx
 * facts object. Returns ok=true if all three numbers are present and
 * |source × rate − target| / target ≤ FX_GATE_TOLERANCE; ok=false if the
 * drift exceeds tolerance; ok=true with relative_drift=null when one of
 * the three numbers is missing (null inputs are not a gate failure — they
 * are a gap that the SOF reconstruction surfaces separately).
 */
export function checkFxGate(facts: WireConfirmationFacts): FxGateResult {
  if (facts.wire_subtype !== 'international_wire_with_fx') {
    return {
      ok: true,
      relative_drift: null,
      source_amount: null,
      source_currency: null,
      target_amount: null,
      target_currency: null,
      exchange_rate: null,
    };
  }

  const sourceAmount = facts.source_amount.value;
  const targetAmount = facts.target_amount.value;
  const rate = facts.exchange_rate.value;
  const sourceCurrency = facts.source_currency.value;
  const targetCurrency = facts.target_currency.value;

  if (sourceAmount == null || targetAmount == null || rate == null || targetAmount === 0) {
    return {
      ok: true,
      relative_drift: null,
      source_amount: sourceAmount,
      source_currency: sourceCurrency,
      target_amount: targetAmount,
      target_currency: targetCurrency,
      exchange_rate: rate,
    };
  }

  // Receipts may quote the rate as either source/target (e.g., 42.75 TRY/USD)
  // or target/source (e.g., 0.0234 USD/TRY). Try both directions and take
  // the smaller drift, since the convention is not standardized across
  // banks. The sign of "ok" is unchanged by which direction matched.
  const driftMul = Math.abs(sourceAmount * rate - targetAmount) / Math.abs(targetAmount);
  const driftDiv = rate !== 0
    ? Math.abs(sourceAmount / rate - targetAmount) / Math.abs(targetAmount)
    : Infinity;
  const drift = Math.min(driftMul, driftDiv);

  return {
    ok: drift <= FX_GATE_TOLERANCE,
    relative_drift: drift,
    source_amount: sourceAmount,
    source_currency: sourceCurrency,
    target_amount: targetAmount,
    target_currency: targetCurrency,
    exchange_rate: rate,
  };
}
