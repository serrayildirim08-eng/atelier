import { describe, expect, it } from 'vitest';
import { postDraft, reportToReviewerPrompt } from '@/lib/verify';

describe('postDraft (verify Phase B)', () => {
  it('returns ok=true when the draft only cites on-allowlist authorities and uses canonical terms', () => {
    const letter = `## I. Introduction
The Petitioner submits this petition for the Beneficiary under INA § 203(b)(1)(A) and 8 CFR § 204.5(h)(3). See Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010).`;
    const report = postDraft(letter, 'EB1A');
    expect(report.ok).toBe(true);
    expect(report.flagged_count).toBe(0);
    expect(report.citations.on_allowlist).toBeGreaterThanOrEqual(1);
  });

  it('flags an off-allowlist case-law citation', () => {
    const letter = `As held in Matter of Fictitious, the standard is satisfied.`;
    const report = postDraft(letter, 'EB1A');
    expect(report.ok).toBe(false);
    expect(report.citations.off_allowlist).toBe(1);
  });

  it('routes Matter of Z-A-, Inc. (AAO non-precedent) to human review on EB-1C', () => {
    const letter = `See Matter of Z-A-, Inc.`;
    const report = postDraft(letter, 'EB1C');
    expect(report.citations.aao_routed).toBe(1);
    expect(report.ok).toBe(false);
  });

  it('flags defined-term drift on E-2', () => {
    const letter = `The Applicant invested in the company.`;
    const report = postDraft(letter, 'E2');
    expect(report.lint.length).toBeGreaterThan(0);
    expect(report.lint[0].category).toBe('defined_term_drift');
  });

  it('reportToReviewerPrompt returns the clean message when ok=true', () => {
    const letter = `INA § 203(b)(1)(A) governs.`;
    const prompt = reportToReviewerPrompt(postDraft(letter, 'EB1A'));
    expect(prompt).toMatch(/No automated findings/i);
  });

  it('reportToReviewerPrompt enumerates flagged spans when ok=false', () => {
    const letter = `As held in Matter of Fictitious, the company should prevail.`;
    const prompt = reportToReviewerPrompt(postDraft(letter, 'E2'));
    expect(prompt).toMatch(/off the per-case-type allowlist/i);
    expect(prompt).toMatch(/Matter of Fictitious/);
  });
});
