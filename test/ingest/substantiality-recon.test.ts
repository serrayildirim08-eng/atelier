/**
 * reconcileSubstantiality tests — pure logic, no Anthropic / disk.
 *
 * Pinned behavior:
 *   - clean: coverage in [0.85, 1.15] → 'within_tolerance', no conflict
 *   - under: coverage < 0.85 → 'under_documented' (severity 3 caller)
 *   - over: coverage > 1.15 → 'over_documented' (severity 2 caller)
 *   - missing committed amount → 'no_committed_amount' (no-op)
 *   - missing all evidence → coverage 0 → 'under_documented'
 */

import { describe, expect, it } from 'vitest';
import { reconcileSubstantiality } from '@/ingest/typed-aggregate';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: null as string | null,
    confidence: 1 as number | null,
  };
}

function entry(
  filename: string,
  pageCount: number,
  facts: Record<string, unknown>,
  contract?: Record<string, unknown>,
): PerPdfResult {
  const out: PerPdfResult = {
    filename,
    pageCount,
    facts: facts as unknown as PerPdfResult['facts'],
  };
  if (contract) {
    out.contract = contract as unknown as PerPdfResult['contract'];
  }
  return out;
}

function passport(name: string): PerPdfResult {
  return entry('passport.pdf', 2, {
    doc_type: 'passport',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    full_name: f(name),
  });
}

function mita(filename: string, amountUsd: number, effectiveDate: string): PerPdfResult {
  return entry(
    filename,
    4,
    {
      doc_type: 'business_contract',
      suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    },
    {
      contract_subtype: 'membership_interest_transfer_agreement',
      effective_date: f(effectiveDate),
      total_consideration_amount: f(amountUsd),
      total_consideration_currency: f('USD'),
    },
  );
}

function moneyMovement(
  filename: string,
  amountUsd: number,
  fromHolder: string,
  date: string,
): PerPdfResult {
  return entry(filename, 1, {
    doc_type: 'money_movement',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    amount_usd: f(amountUsd),
    date: f(date),
    from_holder: f(fromHolder),
  });
}

function invoice(filename: string, amountUsd: number, vendor: string): PerPdfResult {
  return entry(filename, 1, {
    doc_type: 'invoice_or_receipt',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    amount_usd: f(amountUsd),
    vendor: f(vendor),
  });
}

function billOfSale(filename: string, amountUsd: number): PerPdfResult {
  return entry(
    filename,
    2,
    {
      doc_type: 'business_contract',
      suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    },
    {
      contract_subtype: 'bill_of_sale',
      consideration_amount: f(amountUsd),
      consideration_currency: f('USD'),
    },
  );
}

function memoryFrom(entries: PerPdfResult[]): TypedMemory {
  const memory: TypedMemory = {};
  for (const e of entries) {
    if (!e.facts) continue;
    const bucket = e.facts.doc_type;
    const list = memory[bucket] ?? [];
    list.push(e);
    memory[bucket] = list;
  }
  return memory;
}

describe('reconcileSubstantiality', () => {
  it("verdict 'within_tolerance' when documented spend ~= committed", () => {
    const memory = memoryFrom([
      passport('Mehmet Demir'),
      mita('mita.pdf', 100_000, '2024-12-15'),
      moneyMovement('wire.pdf', 70_000, 'Mehmet Demir', '2024-12-18'),
      invoice('legal-fee.pdf', 15_000, 'Akalan Immigration Law'),
      billOfSale('equipment.pdf', 12_000),
    ]);
    const result = reconcileSubstantiality(memory);
    expect(result.verdict).toBe('within_tolerance');
    expect(result.coverage_ratio).toBeGreaterThanOrEqual(0.85);
    expect(result.coverage_ratio).toBeLessThanOrEqual(1.15);
    expect(result.evidence_doc).toHaveLength(3);
  });

  it("verdict 'under_documented' when documented spend << committed", () => {
    const memory = memoryFrom([
      passport('Mehmet Demir'),
      mita('mita.pdf', 100_000, '2024-12-15'),
      moneyMovement('wire.pdf', 30_000, 'Mehmet Demir', '2024-12-18'),
    ]);
    const result = reconcileSubstantiality(memory);
    expect(result.verdict).toBe('under_documented');
    expect(result.coverage_ratio).toBeLessThan(0.85);
  });

  it("verdict 'over_documented' when documented spend >> committed", () => {
    const memory = memoryFrom([
      passport('Mehmet Demir'),
      mita('mita.pdf', 100_000, '2024-12-15'),
      moneyMovement('wire.pdf', 95_000, 'Mehmet Demir', '2024-12-18'),
      invoice('legal.pdf', 20_000, 'Akalan'),
      invoice('build-out.pdf', 30_000, 'Build Co'),
    ]);
    const result = reconcileSubstantiality(memory);
    expect(result.verdict).toBe('over_documented');
    expect(result.coverage_ratio).toBeGreaterThan(1.15);
  });

  it("verdict 'no_committed_amount' when neither contract nor I-129E supply a committed figure", () => {
    const memory = memoryFrom([
      passport('Mehmet Demir'),
      moneyMovement('wire.pdf', 70_000, 'Mehmet Demir', '2024-12-18'),
    ]);
    const result = reconcileSubstantiality(memory);
    expect(result.verdict).toBe('no_committed_amount');
    expect(result.total_committed_usd).toBeNull();
    expect(result.coverage_ratio).toBeNull();
  });

  it("verdict 'under_documented' when committed exists but no evidence at all", () => {
    const memory = memoryFrom([
      passport('Mehmet Demir'),
      mita('mita.pdf', 100_000, '2024-12-15'),
    ]);
    const result = reconcileSubstantiality(memory);
    expect(result.verdict).toBe('under_documented');
    expect(result.coverage_ratio).toBe(0);
    expect(result.sum_outflows_usd).toBe(0);
    expect(result.sum_invoices_usd).toBe(0);
    expect(result.sum_equipment_usd).toBe(0);
  });
});
