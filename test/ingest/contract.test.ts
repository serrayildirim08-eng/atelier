/**
 * Contract extractor tests — pure (no Anthropic calls).
 *
 * Covers:
 *   1. ContractFactsSchema validates the Kacar-Salih shaped payload
 *      and the residential-lease shaped payload (manual §4.5 / §5.1.5).
 *   2. ContractFactsSchema rejects malformed payloads (missing
 *      discriminator; bare value substituted for a Field<T>).
 *   3. findConsiderationGateInputs locates the contract + I-129E pair
 *      from a synthesized typed memory, and returns null when missing,
 *      currency-mismatched, or matched against a non-I-129 form.
 */

import { describe, expect, it } from 'vitest';
import { ContractFactsSchema } from '@/ingest/extractors/contract.schema';
import {
  CONSIDERATION_GATE_TOLERANCE,
  findConsiderationGateInputs,
} from '@/ingest/typed-aggregate';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';

/* ---------------------------------------------------------------------- */
/* Fixture helpers                                                        */
/* ---------------------------------------------------------------------- */

/** Canonical Field<T> object — what the contract schema requires. */
function f<T>(
  value: T | null,
  source_page: number | null = null,
  source_quote: string | null = null,
  confidence: number | null = 1,
) {
  return { value, source_page, source_quote, confidence };
}

/** A complete Membership Interest Transfer Agreement payload (Kacar-Salih shaped). */
function membershipTransferPayload(considerationUsd = 120000) {
  return {
    contract_subtype: 'membership_interest_transfer_agreement' as const,
    effective_date: f('2025-12-05', 1, 'effective as of December 5, 2025'),
    petitioner_legal_name: f('Sample LLC'),
    transferor: {
      name: f('Prior Owner'),
      ownership_before: f(100),
      ownership_after: f(50),
    },
    transferee: {
      name: f('Beneficiary'),
      ownership_before: f(0),
      ownership_after: f(50),
    },
    interest_transferred_percent: f(50),
    total_consideration_amount: f(considerationUsd, 2, 'total consideration of $120,000.00'),
    total_consideration_currency: f('USD'),
    payment_terms: {
      upfront_amount: f(80000),
      upfront_currency: f('USD'),
      deferred_amount: f(40000),
      deferred_currency: f('USD'),
      schedule: f('quarterly installments of $10,000'),
      promissory_note_present: f(true),
    },
    executive_role_granted: f('President'),
    effective_date_role: f('2025-12-05'),
    notarization_present: f(true),
  };
}

/** Construct a PerPdfResult carrying a Membership Interest Transfer contract. */
function contractEntry(filename: string, considerationUsd = 120000): PerPdfResult {
  return {
    filename,
    pageCount: 6,
    contract: membershipTransferPayload(considerationUsd),
  };
}

/** Construct a PerPdfResult carrying an I-129 E Supplement form. */
function i129eEntry(
  filename: string,
  investmentAmountUsd: number | null,
  formId = 'I-129E',
): PerPdfResult {
  return {
    filename,
    pageCount: 4,
    facts: {
      doc_type: 'uscis_or_dos_form',
      suggested_filename: f<string | null>(null),
      display_name: f<string | null>(null),
      form_id: f(formId),
      form_edition: f('11/15/2024'),
      beneficiary_name: f('Beneficiary'),
      petitioner_name: f('Sample LLC'),
      signature_present: f(true),
      signature_date: f('2026-01-05'),
      attorney_g28_present: f(true),
      investment_amount_usd: f(investmentAmountUsd),
    },
  };
}

function memory(...entries: PerPdfResult[]): TypedMemory {
  // Group by doc_type using the same logic as the production helper.
  const out: TypedMemory = {};
  for (const e of entries) {
    const t = e.facts?.doc_type ?? 'other';
    const list = out[t] ?? [];
    list.push(e);
    out[t] = list;
  }
  return out;
}

/* ---------------------------------------------------------------------- */
/* 1. Schema validation                                                   */
/* ---------------------------------------------------------------------- */

describe('ContractFactsSchema', () => {
  it('parses a complete Membership Interest Transfer Agreement payload', () => {
    const result = ContractFactsSchema.safeParse(membershipTransferPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contract_subtype).toBe('membership_interest_transfer_agreement');
      if (result.data.contract_subtype === 'membership_interest_transfer_agreement') {
        expect(result.data.total_consideration_amount.value).toBe(120000);
        expect(result.data.executive_role_granted.value).toBe('President');
      }
    }
  });

  it('parses a residential lease with a TUFE escalation clause', () => {
    const payload = {
      contract_subtype: 'residential_lease' as const,
      landlord_name: f('Spouse Name'),
      landlord_relationship_to_beneficiary: f('spouse' as const),
      tenant_name: f('Tenant Co'),
      tenant_account_last4: f('4242'),
      monthly_rent_initial_amount: f(14000),
      monthly_rent_initial_currency: f('TRY'),
      monthly_rent_current_amount: f(19000),
      monthly_rent_current_currency: f('TRY'),
      term_start: f('2024-06-01'),
      term_end: f('2026-06-01'),
      escalation_clause_verbatim: f('annual increase per TUFE published by TURKSTAT'),
      escalation_index_named: f('TUFE'),
    };
    const result = ContractFactsSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing the discriminator', () => {
    const payload: Record<string, unknown> = membershipTransferPayload();
    delete payload.contract_subtype;
    const result = ContractFactsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a bare value substituted for a Field<T>', () => {
    const payload = {
      ...membershipTransferPayload(),
      // total_consideration_amount must be a Field — bare number violates schema.
      total_consideration_amount: 120000,
    };
    const result = ContractFactsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown contract_subtype', () => {
    const payload = { ...membershipTransferPayload(), contract_subtype: 'made_up_subtype' };
    const result = ContractFactsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

/* ---------------------------------------------------------------------- */
/* 2. findConsiderationGateInputs (manual §4.5 gate scanner)              */
/* ---------------------------------------------------------------------- */

describe('findConsiderationGateInputs', () => {
  it('returns inputs when contract + I-129E are both present in USD', () => {
    const m = memory(
      contractEntry('membership-transfer.pdf', 120000),
      i129eEntry('i-129e.pdf', 120000),
    );
    const inputs = findConsiderationGateInputs(m);
    expect(inputs).not.toBeNull();
    expect(inputs?.contractFilename).toBe('membership-transfer.pdf');
    expect(inputs?.i129eFilename).toBe('i-129e.pdf');
    expect(inputs?.contractAmountUsd).toBe(120000);
    expect(inputs?.i129eAmountUsd).toBe(120000);
  });

  it('returns inputs for the Kacar-Salih drift case ($120k vs $115k)', () => {
    const m = memory(
      contractEntry('membership-transfer.pdf', 120000),
      i129eEntry('i-129e.pdf', 115000),
    );
    const inputs = findConsiderationGateInputs(m);
    expect(inputs).not.toBeNull();
    const drift = Math.abs((inputs?.contractAmountUsd ?? 0) - (inputs?.i129eAmountUsd ?? 0));
    expect(drift).toBeGreaterThan(CONSIDERATION_GATE_TOLERANCE);
  });

  it('returns null when the membership-transfer contract is missing', () => {
    const m = memory(i129eEntry('i-129e.pdf', 120000));
    expect(findConsiderationGateInputs(m)).toBeNull();
  });

  it('returns null when the I-129E form is missing', () => {
    const m = memory(contractEntry('membership-transfer.pdf', 120000));
    expect(findConsiderationGateInputs(m)).toBeNull();
  });

  it('returns null when the contract currency is not USD (skips FX comparison)', () => {
    const tryPayload = membershipTransferPayload();
    tryPayload.total_consideration_currency = f('TRY');
    const tryEntry: PerPdfResult = {
      filename: 'membership-transfer.pdf',
      pageCount: 6,
      contract: tryPayload,
    };
    const m = memory(tryEntry, i129eEntry('i-129e.pdf', 120000));
    expect(findConsiderationGateInputs(m)).toBeNull();
  });

  it('returns null when the I-129E investment amount is null', () => {
    const m = memory(
      contractEntry('membership-transfer.pdf', 120000),
      i129eEntry('i-129e.pdf', null),
    );
    expect(findConsiderationGateInputs(m)).toBeNull();
  });

  it('ignores non-I-129E USCIS forms (form_id="G-28")', () => {
    const m = memory(
      contractEntry('membership-transfer.pdf', 120000),
      i129eEntry('g-28.pdf', 120000, 'G-28'),
    );
    expect(findConsiderationGateInputs(m)).toBeNull();
  });

  it('matches the I-129E form even with a space in the form id', () => {
    const m = memory(
      contractEntry('membership-transfer.pdf', 120000),
      i129eEntry('i-129e.pdf', 120000, 'I-129 E Supplement'),
    );
    const inputs = findConsiderationGateInputs(m);
    expect(inputs).not.toBeNull();
    expect(inputs?.i129eAmountUsd).toBe(120000);
  });
});
