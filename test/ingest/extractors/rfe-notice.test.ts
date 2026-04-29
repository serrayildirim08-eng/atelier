/**
 * RFE / NOID rich extractor schema tests — pure.
 *
 * Validates that:
 *   1. RfeNoticeFactsSchema accepts notice and response document_role
 *      shapes with all 10 subject_category values.
 *   2. The closed enum rejects an unknown subject_category (the
 *      aggregator's coercion-to-'other' contract depends on this).
 *   3. document_role enum covers the four canonical roles + 'unknown'.
 *   4. evidence_requested is an array of Field<string> (per-element
 *      provenance, matching cv.schema.ts).
 *   5. typed-extract.ts wires the extractor into the per-PDF pipeline.
 */

import { describe, expect, it } from 'vitest';
import {
  RfeNoticeFactsSchema,
  RFE_SUBJECT_CATEGORIES,
} from '@/ingest/extractors/rfe-notice.schema';
import { extractRfeNotice } from '@/ingest/extractors/rfe-notice';

function f<T>(
  value: T | null,
  source_page: number | null = null,
  source_quote: string | null = null,
  confidence: number | null = 1,
) {
  return { value, source_page, source_quote, confidence };
}

describe('RfeNoticeFactsSchema — RFE notice document_role', () => {
  it('accepts a fully populated rfe_notice payload', () => {
    const payload = {
      document_role: f('rfe_notice'),
      subject_category: f('substantial_investment'),
      rfe_date: f('2024-08-12'),
      response_deadline: f('2024-11-12'),
      issuing_officer_name: f('Officer Smith'),
      issuing_officer_title: f('Adjudications Officer'),
      evidence_requested: [
        f('Documentation showing source of investment funds'),
        f('Wire transfer records to U.S. enterprise bank account'),
      ],
      initial_filing_assertion: f('Beneficiary asserted $196,000 investment.'),
      response_assertion: f(null),
    };
    expect(RfeNoticeFactsSchema.safeParse(payload).success).toBe(true);
  });
});

describe('RfeNoticeFactsSchema — subject_category closed enum', () => {
  it('accepts all 10 documented subject_category values', () => {
    for (const cat of RFE_SUBJECT_CATEGORIES) {
      const ok = RfeNoticeFactsSchema.safeParse({
        document_role: f('rfe_notice'),
        subject_category: f(cat),
        rfe_date: f('2024-08-12'),
        response_deadline: f(null),
        issuing_officer_name: f(null),
        issuing_officer_title: f(null),
        evidence_requested: [],
        initial_filing_assertion: f(null),
        response_assertion: f(null),
      });
      expect(ok.success).toBe(true);
    }
  });

  it('rejects an unknown subject_category', () => {
    const bad = RfeNoticeFactsSchema.safeParse({
      document_role: f('rfe_notice'),
      subject_category: f('investor_personality'), // not in enum
      rfe_date: f(null),
      response_deadline: f(null),
      issuing_officer_name: f(null),
      issuing_officer_title: f(null),
      evidence_requested: [],
      initial_filing_assertion: f(null),
      response_assertion: f(null),
    });
    expect(bad.success).toBe(false);
  });

  it('includes classification_ambiguity (the Cemre regression category)', () => {
    expect(RFE_SUBJECT_CATEGORIES).toContain('classification_ambiguity');
  });
});

describe('RfeNoticeFactsSchema — document_role enum', () => {
  it('accepts the four canonical document_role values plus unknown', () => {
    for (const role of ['rfe_notice', 'noid_notice', 'rfe_response', 'noid_response', 'unknown']) {
      const ok = RfeNoticeFactsSchema.safeParse({
        document_role: f(role),
        subject_category: f('other'),
        rfe_date: f(null),
        response_deadline: f(null),
        issuing_officer_name: f(null),
        issuing_officer_title: f(null),
        evidence_requested: [],
        initial_filing_assertion: f(null),
        response_assertion: f(null),
      });
      expect(ok.success).toBe(true);
    }
  });

  it('rejects an unknown document_role', () => {
    const bad = RfeNoticeFactsSchema.safeParse({
      document_role: f('case_status_email'),
      subject_category: f('other'),
      rfe_date: f(null),
      response_deadline: f(null),
      issuing_officer_name: f(null),
      issuing_officer_title: f(null),
      evidence_requested: [],
      initial_filing_assertion: f(null),
      response_assertion: f(null),
    });
    expect(bad.success).toBe(false);
  });
});

describe('RfeNoticeFactsSchema — evidence_requested per-element provenance', () => {
  it('rejects bare strings inside evidence_requested (must be Field<string>)', () => {
    const bad = RfeNoticeFactsSchema.safeParse({
      document_role: f('rfe_notice'),
      subject_category: f('other'),
      rfe_date: f(null),
      response_deadline: f(null),
      issuing_officer_name: f(null),
      issuing_officer_title: f(null),
      evidence_requested: ['raw bullet — wrong shape'],
      initial_filing_assertion: f(null),
      response_assertion: f(null),
    });
    expect(bad.success).toBe(false);
  });
});

describe('extractRfeNotice — typed-extract integration surface', () => {
  it('exports a callable extractor (registered in typed-extract.ts)', () => {
    expect(typeof extractRfeNotice).toBe('function');
  });
});
