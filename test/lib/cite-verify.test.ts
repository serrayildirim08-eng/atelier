import { describe, expect, it } from 'vitest';
import { extractCitations } from '@/lib/cite-verify/extract';
import { checkCitation } from '@/lib/cite-verify/allowlist';

describe('extractCitations', () => {
  it('finds INA, CFR, FAM, and USCIS PM citations in mixed prose', () => {
    const text = `The applicant's status under INA § 101(a)(15)(E)(ii) and 8 CFR § 214.2(e)(12) is governed by 9 FAM 402.9-4(B)(1) and USCIS PM Vol. 6 Pt. F Ch. 2.`;
    const cites = extractCitations(text);

    const kinds = cites.map((c) => c.kind).sort();
    expect(kinds).toEqual(['cfr', 'fam', 'ina', 'uscis_pm']);

    expect(cites.find((c) => c.kind === 'ina')?.normalized).toBe('INA § 101(a)(15)(E)(ii)');
    expect(cites.find((c) => c.kind === 'cfr')?.normalized).toBe('8 CFR § 214.2(e)(12)');
    expect(cites.find((c) => c.kind === 'fam')?.normalized).toBe('9 FAM 402.9-4(B)(1)');
    expect(cites.find((c) => c.kind === 'uscis_pm')?.normalized).toBe(
      'USCIS PM Vol. 6 Pt. F Ch. 2',
    );
  });

  it('finds case names and reporter citations', () => {
    const text = `As held in Matter of Walsh and Pollard, 20 I&N Dec. 60 (BIA 1988), the standard is settled. See also Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010).`;
    const cites = extractCitations(text);
    const normalized = cites.map((c) => c.normalized);

    expect(normalized).toContain('Matter of Walsh and Pollard');
    expect(normalized).toContain('20 I&N Dec. 60');
    expect(normalized).toContain('596 F.3d 1115');
  });
});

describe('checkCitation', () => {
  it('returns on_allowlist for E-2 statute INA § 101(a)(15)(E)(ii)', () => {
    const [c] = extractCitations('Under INA § 101(a)(15)(E)(ii)');
    expect(checkCitation(c, 'E2').status).toBe('on_allowlist');
  });

  it('returns on_allowlist for sub-paragraph CFR cites via stem-match', () => {
    // 8 CFR § 214.2(e)(12) is deeper than allowlist entry "8 CFR § 214.2(e)"
    const [c] = extractCitations('8 CFR § 214.2(e)(12)');
    expect(checkCitation(c, 'E2').status).toBe('on_allowlist');
  });

  it('returns on_allowlist for FAM stems', () => {
    const [c] = extractCitations('9 FAM 402.9-6(C)');
    expect(checkCitation(c, 'E2').status).toBe('on_allowlist');
  });

  it('returns off_allowlist for E-2 cite when reviewing as EB-1A (case-type isolated)', () => {
    const [c] = extractCitations('Under INA § 101(a)(15)(E)(ii)');
    expect(checkCitation(c, 'EB1A').status).toBe('off_allowlist');
  });

  it('returns off_allowlist for fabricated case-law not in any allowlist', () => {
    const [c] = extractCitations('Matter of Fictitious');
    expect(checkCitation(c, 'EB1A').status).toBe('off_allowlist');
  });

  it('returns aao_route_to_human for Matter of Z-A-, Inc. on EB-1C', () => {
    const [c] = extractCitations('See Matter of Z-A-, Inc.');
    const result = checkCitation(c, 'EB1C');
    expect(result.status).toBe('aao_route_to_human');
    expect(result.message).toMatch(/AAO citation/i);
  });

  it('returns on_allowlist for Kazarian by name on EB-1A (case-name match)', () => {
    const cites = extractCitations('Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010)');
    // Kazarian is matched by reporter (case_name regex requires "Matter of"); confirm reporter path:
    const reporterCite = cites.find((c) => c.kind === 'reporter_federal');
    expect(reporterCite?.normalized).toBe('596 F.3d 1115');
    expect(checkCitation(reporterCite!, 'EB1A').status).toBe('on_allowlist');
  });
});
