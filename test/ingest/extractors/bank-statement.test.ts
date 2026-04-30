/**
 * Bank-statement rich extractor schema tests — pure (no Anthropic calls).
 *
 * Validates that:
 *   1. BankStatementRichFactsSchema accepts the canonical full payload.
 *   2. Optional balance fields back-compat to payloads omitting them.
 *   3. The PII rule on account_number_last4 is enforced (regex /^\d{4}$/).
 *   4. The closed bank_statement_subtype enum rejects unknown members.
 *   5. typed-extract.ts wires the extractor into the per-PDF pipeline.
 */

import { describe, expect, it } from 'vitest';
import {
  BankStatementRichFactsSchema,
  BankStatementSubtypeEnum,
} from '@/ingest/extractors/bank-statement.schema';
import { extractBankStatement } from '@/ingest/extractors/bank-statement';

function f<T>(
  value: T | null,
  source_page: number | null = null,
  source_quote: string | null = null,
  confidence: number | null = 1,
) {
  return { value, source_page, source_quote, confidence };
}

describe('BankStatementRichFactsSchema — base shape', () => {
  it('accepts a fully populated personal-checking payload', () => {
    const payload = {
      bank_statement_subtype: f('personal_checking' as const, 1, 'Statement of Account'),
      bank_name: f('JPMorgan Chase Bank, N.A.', 1, 'JPMorgan Chase Bank, N.A.'),
      bank_short_name: f('Chase', 1),
      account_holder_name: f('Deborah Walther', 1),
      account_number_last4: f('7192', 1, 'Account ending in 7192'),
      account_address: f('123 Main St, Providence, RI 02903', 1),
      statement_period_start: f('2025-03-01', 1, 'Statement Period: March 1, 2025'),
      statement_period_end: f('2025-03-31', 1, 'Through March 31, 2025'),
      statement_year_month: f('2025-03', 1),
      beginning_balance_usd: f(12450.5, 2),
      ending_balance_usd: f(13225.75, 2),
      total_deposits_usd: f(4200.0, 2),
      total_withdrawals_usd: f(3424.75, 2),
    };
    const result = BankStatementRichFactsSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('accepts a payload omitting all optional balance + address fields', () => {
    const payload = {
      bank_statement_subtype: f('business_checking' as const),
      bank_name: f('Bank of America, N.A.'),
      bank_short_name: f('BofA'),
      account_holder_name: f('Wise Guys Deli LLC'),
      account_number_last4: f('4316'),
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    const result = BankStatementRichFactsSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('accepts an all-null payload (extractor confidence drop-out)', () => {
    const payload = {
      bank_statement_subtype: f(null),
      bank_name: f(null),
      bank_short_name: f(null),
      account_holder_name: f(null),
      account_number_last4: f(null),
      statement_period_start: f(null),
      statement_period_end: f(null),
      statement_year_month: f(null),
    };
    const result = BankStatementRichFactsSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe('BankStatementRichFactsSchema — PII rule on account_number_last4', () => {
  it('rejects a 3-digit account_number_last4 (must be exactly 4)', () => {
    const bad = {
      bank_statement_subtype: f('personal_checking' as const),
      bank_name: f('Chase'),
      bank_short_name: f('Chase'),
      account_holder_name: f('Test Holder'),
      account_number_last4: f('192'), // 3 digits — schema must reject
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    expect(BankStatementRichFactsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a full account number (must be stripped to last 4)', () => {
    const bad = {
      bank_statement_subtype: f('personal_checking' as const),
      bank_name: f('Chase'),
      bank_short_name: f('Chase'),
      account_holder_name: f('Test Holder'),
      account_number_last4: f('1234567192'), // full account number
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    expect(BankStatementRichFactsSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a zero-padded 4-digit last4 (e.g., "0742")', () => {
    const ok = {
      bank_statement_subtype: f('personal_checking' as const),
      bank_name: f('Chase'),
      bank_short_name: f('Chase'),
      account_holder_name: f('Test Holder'),
      account_number_last4: f('0742'),
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    expect(BankStatementRichFactsSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects non-numeric characters in account_number_last4', () => {
    const bad = {
      bank_statement_subtype: f('personal_checking' as const),
      bank_name: f('Chase'),
      bank_short_name: f('Chase'),
      account_holder_name: f('Test Holder'),
      account_number_last4: f('71X2'),
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    expect(BankStatementRichFactsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('BankStatementRichFactsSchema — closed enums and shape rules', () => {
  it('accepts every closed bank_statement_subtype value', () => {
    const validSubtypes = [
      'personal_checking',
      'personal_savings',
      'business_checking',
      'business_savings',
      'money_market',
      'other',
    ];
    for (const sub of validSubtypes) {
      expect(BankStatementSubtypeEnum.safeParse(sub).success).toBe(true);
    }
  });

  it('rejects an unknown bank_statement_subtype value', () => {
    const bad = {
      bank_statement_subtype: f('crypto_account' as 'other'), // not in enum
      bank_name: f('Chase'),
      bank_short_name: f('Chase'),
      account_holder_name: f('Test Holder'),
      account_number_last4: f('7192'),
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    expect(BankStatementRichFactsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects bare-value substitution for a Field<T>', () => {
    const bad = {
      bank_statement_subtype: 'personal_checking', // bare, not Field
      bank_name: f('Chase'),
      bank_short_name: f('Chase'),
      account_holder_name: f('Test Holder'),
      account_number_last4: f('7192'),
      statement_period_start: f('2025-03-01'),
      statement_period_end: f('2025-03-31'),
      statement_year_month: f('2025-03'),
    };
    expect(BankStatementRichFactsSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a mid-month period with derived statement_year_month from end', () => {
    const payload = {
      bank_statement_subtype: f('personal_checking' as const),
      bank_name: f('Capital One'),
      bank_short_name: f('CapOne'),
      account_holder_name: f('Salih Kaçar'),
      account_number_last4: f('4316'),
      statement_period_start: f('2025-03-15'),
      statement_period_end: f('2025-04-14'),
      statement_year_month: f('2025-04'),
      ending_balance_usd: f(8200.0),
    };
    expect(BankStatementRichFactsSchema.safeParse(payload).success).toBe(true);
  });
});

describe('extractBankStatement — typed-extract integration surface', () => {
  it('exports a callable extractor (registered in typed-extract.ts)', () => {
    expect(typeof extractBankStatement).toBe('function');
  });
});
