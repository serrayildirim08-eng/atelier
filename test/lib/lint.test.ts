import { describe, expect, it } from 'vitest';
import { lintDefinedTerms } from '@/lib/lint/defined-terms';
import { lintCitationFormat } from '@/lib/lint/citation-format';

describe('lintDefinedTerms', () => {
  it('flags "the company" in E-2 letters (canonical: the Enterprise)', () => {
    const findings = lintDefinedTerms(
      'The applicant invested in the company in 2024.',
      'E2',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/the Enterprise/);
  });

  it('flags "the foreign national" in EB-1A letters (canonical: the Beneficiary)', () => {
    const findings = lintDefinedTerms(
      'the foreign national has authored more than 30 papers.',
      'EB1A',
    );
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.message.includes('the Beneficiary'))).toBe(true);
  });

  it('does NOT flag canonical terms in correct usage', () => {
    const findings = lintDefinedTerms(
      'The Petitioner argues that the Beneficiary qualifies.',
      'EB1B',
    );
    expect(findings).toHaveLength(0);
  });

  it('respects case-type scoping (E-2 rules do not fire on EB-1A letters)', () => {
    // "the Enterprise" is an E-2-only canonical term, so "the company" only
    // flags on E-2 case type.
    const e2 = lintDefinedTerms('the company is profitable.', 'E2');
    const eb1a = lintDefinedTerms('the company is profitable.', 'EB1A');
    expect(e2.length).toBeGreaterThan(0);
    expect(eb1a).toHaveLength(0);
  });
});

describe('lintCitationFormat', () => {
  it('flags INA citation missing section symbol', () => {
    const findings = lintCitationFormat('See INA 101 for the standard.');
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/section symbol/);
  });

  it('does NOT flag INA citation with section symbol', () => {
    expect(lintCitationFormat('See INA § 101 for the standard.')).toHaveLength(0);
  });

  it('flags CFR citation missing section symbol', () => {
    const findings = lintCitationFormat('See 8 CFR 214.2(e)');
    expect(findings).toHaveLength(1);
  });

  it('flags Vol without trailing period', () => {
    const findings = lintCitationFormat('USCIS Policy Manual Vol 6 Pt. F Ch. 2');
    expect(findings).toHaveLength(1);
  });
});
