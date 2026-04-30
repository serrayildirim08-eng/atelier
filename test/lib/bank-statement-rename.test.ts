/**
 * Tests for the deterministic bank-statement display-name derivation.
 *
 * Validates:
 *   1. Full-path render produces "Chase · Deborah Walther · ****7192 · 2025-03".
 *   2. Missing slots collapse cleanly (no empty separators / no "—" placeholder).
 *   3. All-null facts return null (caller falls back to filename).
 *   4. The ****-mask is gated by the same /^\d{4}$/ rule the schema enforces.
 *   5. getBankStatementDisplayLabel honors the override → llm → derived priority.
 */

import { describe, expect, it } from 'vitest';
import {
  deriveBankStatementDisplayName,
  getBankStatementDisplayLabel,
} from '@/lib/e2/bank-statement-rename';
import type { BankStatementRichFacts } from '@/ingest/extractors/bank-statement.schema';

function f<T>(value: T | null) {
  return { value, source_page: null, source_quote: null, confidence: null };
}

function pick<T>(override: T | null | undefined, fallback: T): T | null {
  // explicit null → null; undefined → fallback. Lets tests force a slot off.
  if (override === null) return null;
  if (override === undefined) return fallback;
  return override;
}

function makeFacts(
  overrides: Partial<{
    bankShortName: string | null;
    accountHolderName: string | null;
    accountLast4: string | null;
    yearMonth: string | null;
  }> = {},
): BankStatementRichFacts {
  return {
    bank_statement_subtype: f('personal_checking'),
    bank_name: f('JPMorgan Chase Bank, N.A.'),
    bank_short_name: f(pick(overrides.bankShortName, 'Chase')),
    account_holder_name: f(pick(overrides.accountHolderName, 'Deborah Walther')),
    account_number_last4: f(pick(overrides.accountLast4, '7192')),
    statement_period_start: f('2025-03-01'),
    statement_period_end: f('2025-03-31'),
    statement_year_month: f(pick(overrides.yearMonth, '2025-03')),
  } as BankStatementRichFacts;
}

describe('deriveBankStatementDisplayName — full-path rendering', () => {
  it('renders all 4 slots joined by " · "', () => {
    const out = deriveBankStatementDisplayName(makeFacts());
    expect(out).toBe('Chase · Deborah Walther · ****7192 · 2025-03');
  });

  it('preserves diacritics in the holder slot', () => {
    const out = deriveBankStatementDisplayName(
      makeFacts({ accountHolderName: 'Salih Kaçar', bankShortName: 'Akbank' }),
    );
    expect(out).toBe('Akbank · Salih Kaçar · ****7192 · 2025-03');
  });
});

describe('deriveBankStatementDisplayName — missing slots collapse cleanly', () => {
  it('drops the holder slot when account_holder_name is null', () => {
    const out = deriveBankStatementDisplayName(
      makeFacts({ accountHolderName: null }),
    );
    expect(out).toBe('Chase · ****7192 · 2025-03');
  });

  it('drops the bank slot when bank_short_name is null', () => {
    const out = deriveBankStatementDisplayName(
      makeFacts({ bankShortName: null }),
    );
    expect(out).toBe('Deborah Walther · ****7192 · 2025-03');
  });

  it('drops the last4 slot when account_number_last4 is null', () => {
    const out = deriveBankStatementDisplayName(
      makeFacts({ accountLast4: null }),
    );
    expect(out).toBe('Chase · Deborah Walther · 2025-03');
  });

  it('drops the period slot when statement_year_month is null', () => {
    const out = deriveBankStatementDisplayName(
      makeFacts({ yearMonth: null }),
    );
    expect(out).toBe('Chase · Deborah Walther · ****7192');
  });

  it('drops the last4 slot when value is malformed (not 4 digits)', () => {
    // The schema would reject this at parse time, but the derive helper must
    // also be resilient — never emit "****19" or similar.
    const out = deriveBankStatementDisplayName(
      makeFacts({ accountLast4: '19' }),
    );
    expect(out).toBe('Chase · Deborah Walther · 2025-03');
  });
});

describe('deriveBankStatementDisplayName — empty / null inputs', () => {
  it('returns null when facts is null', () => {
    expect(deriveBankStatementDisplayName(null)).toBeNull();
  });

  it('returns null when facts is undefined', () => {
    expect(deriveBankStatementDisplayName(undefined)).toBeNull();
  });

  it('returns null when every slot value is null', () => {
    const empty = makeFacts({
      bankShortName: null,
      accountHolderName: null,
      accountLast4: null,
      yearMonth: null,
    });
    expect(deriveBankStatementDisplayName(empty)).toBeNull();
  });

  it('returns null when every slot value is whitespace-only', () => {
    const blank = makeFacts({
      bankShortName: '   ',
      accountHolderName: '\t',
      accountLast4: null,
      yearMonth: '  ',
    });
    expect(deriveBankStatementDisplayName(blank)).toBeNull();
  });
});

describe('getBankStatementDisplayLabel — priority chain', () => {
  it('returns the manual override when present (highest priority)', () => {
    const out = getBankStatementDisplayLabel({
      manualOverride: 'My custom label',
      llmDisplayName: 'Chase · Some other label',
      rich: makeFacts(),
    });
    expect(out).toBe('My custom label');
  });

  it('falls through to the LLM display_name when manual override is missing', () => {
    const out = getBankStatementDisplayLabel({
      manualOverride: null,
      llmDisplayName: 'Chase · LLM label · 2025-03',
      rich: makeFacts(),
    });
    expect(out).toBe('Chase · LLM label · 2025-03');
  });

  it('falls through to the derived name when neither override nor LLM is set', () => {
    const out = getBankStatementDisplayLabel({
      manualOverride: null,
      llmDisplayName: null,
      rich: makeFacts(),
    });
    expect(out).toBe('Chase · Deborah Walther · ****7192 · 2025-03');
  });

  it('returns null when nothing is available (caller falls back to filename)', () => {
    const out = getBankStatementDisplayLabel({
      manualOverride: null,
      llmDisplayName: null,
      rich: null,
    });
    expect(out).toBeNull();
  });

  it('treats whitespace-only override / llm names as missing', () => {
    const out = getBankStatementDisplayLabel({
      manualOverride: '   ',
      llmDisplayName: '\t\n',
      rich: makeFacts(),
    });
    expect(out).toBe('Chase · Deborah Walther · ****7192 · 2025-03');
  });
});
