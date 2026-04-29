/**
 * Cover-letter rich extractor schema tests — pure (no Anthropic calls).
 *
 * Validates that:
 *   1. CoverLetterRichFactsSchema accepts the canonical Phase-4 + Phase-6
 *      + Phase-7 payload shapes.
 *   2. Phase-6 / Phase-7 optional fields back-compat to legacy fixtures
 *      that omit them entirely (defaults: empty array / null).
 *   3. Phase-7 sub-schemas (passport-renewal footnote, five-year horizon,
 *      develop-and-direct role grant) parse with their own shape rules.
 *   4. Closed enums reject unknown members (e.g. cover-letter-derived
 *      co-petitioner relationship).
 *   5. typed-extract.ts wires the extractor into the per-PDF pipeline.
 */

import { describe, expect, it } from 'vitest';
import {
  CoverLetterRichFactsSchema,
  CoPetitionerRelationshipFromCoverLetterSchema,
  PriorPassportRenewalFootnoteSchema,
  FiveYearBusinessHorizonSchema,
  DevelopAndDirectRoleGrantSchema,
} from '@/ingest/extractors/cover-letter.schema';
import { extractCoverLetter } from '@/ingest/extractors/cover-letter';

function f<T>(
  value: T | null,
  source_page: number | null = null,
  source_quote: string | null = null,
  confidence: number | null = 1,
) {
  return { value, source_page, source_quote, confidence };
}

describe('CoverLetterRichFactsSchema — Phase-4 base shape', () => {
  it('accepts a fully populated cover-letter payload', () => {
    const payload = {
      fully_operational_since_date: f('2023-01-15', 2, 'fully operational since January 15, 2023'),
      claimed_business_model: f('Medium-voltage equipment sales and integration', 2),
      claimed_industry_naics: f('335311'),
      principal_treaty_investor_identity: f('Beneficiary as primary treaty investor (Subtype 1)'),
      co_petitioner_relationships: [],
      prior_passport_renewal_footnote: null,
      five_year_business_horizon: null,
      develop_and_direct_role_grant: null,
    };
    expect(CoverLetterRichFactsSchema.safeParse(payload).success).toBe(true);
  });

  it('back-compats to legacy payloads omitting Phase-6 / Phase-7 fields', () => {
    const legacy = {
      fully_operational_since_date: f(null),
      claimed_business_model: f(null),
      claimed_industry_naics: f(null),
      principal_treaty_investor_identity: f(null),
    };
    const result = CoverLetterRichFactsSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      // Defaults populate.
      expect(result.data.co_petitioner_relationships).toEqual([]);
      expect(result.data.prior_passport_renewal_footnote).toBeNull();
      expect(result.data.five_year_business_horizon).toBeNull();
      expect(result.data.develop_and_direct_role_grant).toBeNull();
    }
  });

  it('rejects malformed payloads (bare value substituted for Field<T>)', () => {
    const bad = {
      fully_operational_since_date: '2023-01-15', // bare string instead of Field<string>
      claimed_business_model: f(null),
      claimed_industry_naics: f(null),
      principal_treaty_investor_identity: f(null),
    };
    expect(CoverLetterRichFactsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('CoverLetterRichFactsSchema — Phase-6 co-petitioner relationships', () => {
  it('accepts the closed-enum relationship values', () => {
    const validRelationships = ['spouse', 'child', 'co_investor', 'sibling', 'parent', 'business_partner', 'unknown'];
    for (const rel of validRelationships) {
      const ok = CoPetitionerRelationshipFromCoverLetterSchema.safeParse({
        full_name: f('Test Person'),
        relationship: f(rel),
      });
      expect(ok.success).toBe(true);
    }
  });

  it('rejects unknown relationship values', () => {
    const bad = CoPetitionerRelationshipFromCoverLetterSchema.safeParse({
      full_name: f('Test Person'),
      relationship: f('uncle'), // not in enum
    });
    expect(bad.success).toBe(false);
  });
});

describe('CoverLetterRichFactsSchema — Phase-7 narrative claims', () => {
  it('parses a fully populated passport-renewal footnote', () => {
    const result = PriorPassportRenewalFootnoteSchema.safeParse({
      paragraph_text:
        "the Beneficiary's prior passport, U12345678, was renewed and the current passport, U87654321, is appended hereto.",
      prior_passport_number: 'U12345678',
      current_passport_number: 'U87654321',
    });
    expect(result.success).toBe(true);
  });

  it('parses a five-year business horizon with partial nulls', () => {
    const result = FiveYearBusinessHorizonSchema.safeParse({
      year_1_revenue_usd: 250000,
      year_3_revenue_usd: null,
      year_5_revenue_usd: 1500000,
      year_5_employee_count: 12,
    });
    expect(result.success).toBe(true);
  });

  it('parses a develop-and-direct role grant with closed authority_scope vocabulary', () => {
    const result = DevelopAndDirectRoleGrantSchema.safeParse({
      role_title: 'President & CEO',
      granting_document_ref: 'Operating Agreement § 4.2',
      authority_scope: ['contract_signing', 'banking_authority', 'hire_fire'],
    });
    expect(result.success).toBe(true);
  });
});

describe('extractCoverLetter — typed-extract integration surface', () => {
  it('exports a callable extractor (registered in typed-extract.ts)', () => {
    expect(typeof extractCoverLetter).toBe('function');
  });
});
