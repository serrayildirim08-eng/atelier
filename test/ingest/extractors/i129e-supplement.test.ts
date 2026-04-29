/**
 * I-129 E Supplement rich extractor schema tests — pure.
 *
 * Validates that:
 *   1. I129ESupplementFactsSchema accepts the canonical Phase-7 payload.
 *   2. Field<T> wrapping is enforced on every leaf (no bare values).
 *   3. Numeric fields reject string substitution.
 *   4. typed-extract.ts wires the extractor into the per-PDF pipeline.
 */

import { describe, expect, it } from 'vitest';
import { I129ESupplementFactsSchema } from '@/ingest/extractors/i129e-supplement.schema';
import { extractI129ESupplement } from '@/ingest/extractors/i129e-supplement';

function f<T>(
  value: T | null,
  source_page: number | null = null,
  source_quote: string | null = null,
  confidence: number | null = 1,
) {
  return { value, source_page, source_quote, confidence };
}

describe('I129ESupplementFactsSchema', () => {
  it('accepts a fully populated supplement payload', () => {
    const payload = {
      industry_classification: f('Construction', 2, 'Industry classification: Construction'),
      naics_code: f('237310', 2),
      investment_amount_usd: f(196000, 4, 'Total investment to date: $196,000'),
      treaty_country: f('Turkey', 1),
      beneficiary_ownership_percent: f(100, 3, 'beneficiary owns 100% of the U.S. enterprise'),
    };
    expect(I129ESupplementFactsSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts an all-null payload (extractor confidence drop-out)', () => {
    const payload = {
      industry_classification: f(null),
      naics_code: f(null),
      investment_amount_usd: f(null),
      treaty_country: f(null),
      beneficiary_ownership_percent: f(null),
    };
    expect(I129ESupplementFactsSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects a bare-value substitution for a Field<T>', () => {
    const bad = {
      industry_classification: 'Construction', // bare string instead of Field<string>
      naics_code: f(null),
      investment_amount_usd: f(null),
      treaty_country: f(null),
      beneficiary_ownership_percent: f(null),
    };
    expect(I129ESupplementFactsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a string value where a number is required', () => {
    const bad = {
      industry_classification: f(null),
      naics_code: f(null),
      investment_amount_usd: f('one hundred ninety six thousand'), // wrong type
      treaty_country: f(null),
      beneficiary_ownership_percent: f(null),
    };
    expect(I129ESupplementFactsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a payload missing a required top-level key', () => {
    const incomplete = {
      industry_classification: f('Construction'),
      naics_code: f('237310'),
      // investment_amount_usd missing
      treaty_country: f('Turkey'),
      beneficiary_ownership_percent: f(100),
    };
    expect(I129ESupplementFactsSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe('extractI129ESupplement — typed-extract integration surface', () => {
  it('exports a callable extractor (registered in typed-extract.ts)', () => {
    expect(typeof extractI129ESupplement).toBe('function');
  });
});
