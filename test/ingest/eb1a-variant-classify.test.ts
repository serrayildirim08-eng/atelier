/**
 * EB-1A Tier-0 41-variant classifier — fixture-based sanity tests.
 *
 * Synthetic short fixtures exercise (a) every doc_type that appears in
 * the cross-review § 6 disambiguation rules and (b) the cv_or_resume
 * non-anchor cascade flag. Source-of-truth: research/2026-05-05_eb1a-
 * doc-variant-taxonomy.md and manuals/_EB1A-CROSS-REVIEW-v1.md § 6.
 *
 * Fixtures are inline strings; no external corpus dependency.
 */

import { describe, expect, it } from 'vitest';
import { classifyEb1aVariant } from '@/ingest/extractors/eb1a-variant-classify';

function classify(filename: string, firstPageText = '') {
  return classifyEb1aVariant({ filename, first_page_text: firstPageText });
}

describe('EB-1A variant classifier — happy-path coverage', () => {
  it('award certificate v1 fires on certificate diction', () => {
    const r = classify(
      'best-paper-award-2024.pdf',
      'CERTIFICATE OF EXCELLENCE — This is hereby awarded to Dr. Demir for outstanding research in computational biology. Signed, the Chair.',
    );
    expect(r.doc_type).toBe('award_certificate');
    expect(r.variant_id).toBe('award_certificate:v1');
    expect(r.criterion_map).toContain('h3_i');
  });

  it('citation_report v3 fires on FWCI / SciVal vocabulary', () => {
    const r = classify(
      'fwci-scival-2024.pdf',
      'Field-Weighted Citation Impact (FWCI): 4.2. Source: SciVal. Top 1% in field. ASJC code: 1706.',
    );
    expect(r.doc_type).toBe('citation_report');
    expect(r.variant_id).toBe('citation_report:v3');
    expect(r.criterion_map).toEqual(
      expect.arrayContaining(['h3_v', 'h3_vi']),
    );
  });

  it('membership_credential v1 fires on induction language', () => {
    const r = classify(
      'IEEE-fellow-induction-letter.pdf',
      'We are pleased to inform you that you have been elected as a Fellow of the IEEE for outstanding contributions to medium-voltage switchgear engineering.',
    );
    expect(r.doc_type).toBe('membership_credential');
    expect(r.variant_id).toBe('membership_credential:v1');
    expect(r.criterion_map).toContain('h3_ii');
  });

  it('exhibition_record v1 fires on curator statement diction', () => {
    const r = classify(
      'sergi-katalog-istanbul-modern-2024.pdf',
      'Curatorial Note. The exhibition presents works by emerging Turkish artists. Medium: oil on canvas. Year: 2024.',
    );
    expect(r.doc_type).toBe('exhibition_record');
    expect(r.criterion_map).toContain('h3_vii');
  });

  it('commercial_success_record v1 fires on box office report', () => {
    const r = classify(
      'box-office-mojo-audited-2024.pdf',
      'Box Office Mojo audited report. Opening weekend: $24M. Worldwide gross: $312M. Tickets sold: 4.1M.',
    );
    expect(r.doc_type).toBe('commercial_success_record');
    expect(r.criterion_map).toContain('h3_x');
  });

  it('comparable_evidence_packet v1 fires on h(4) brief', () => {
    const r = classify(
      'comparable-evidence-h4-brief.pdf',
      'Pursuant to 8 CFR § 204.5(h)(4), the firm submits comparable evidence for criterion (vii) which does not readily apply. See Visinscaia.',
    );
    expect(r.doc_type).toBe('comparable_evidence_packet');
  });
});

describe('EB-1A cross-review § 6 #1 — recommendation_letter v1 vs v2', () => {
  it('independent expert letter routes to v1', () => {
    const r = classify(
      'expert-opinion-prof-stein-brown.pdf',
      [
        'I have never collaborated with Dr. Demir, nor are we affiliated.',
        'My institutional letterhead is from Brown University.',
        'Background. Field. Contribution. Significance. Conclusion.',
        'Sincerely, Prof. Mary Stein, mary.stein@brown.edu',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('recommendation_letter');
    expect(r.variant_id).toBe('recommendation_letter:v1');
  });

  it('dependent / collaborator letter routes to v2 (excludes v1)', () => {
    const r = classify(
      'collaborator-letter-prof-yilmaz.pdf',
      [
        'I supervised Dr. Demir during his postdoc in my lab at ITU.',
        'We co-authored three papers on switchgear thermal modeling.',
        'My former student became a key contributor to the field.',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('recommendation_letter');
    expect(r.variant_id).toBe('recommendation_letter:v2');
  });
});

describe('EB-1A cross-review § 6 #2 — conference_invitation v1 vs editorial_board v1', () => {
  it('keynote invitation routes to conference_invitation:v1 (NOT editorial_board)', () => {
    const r = classify(
      'keynote-invitation-acm-2024.pdf',
      [
        'Dear Dr. Demir,',
        'On behalf of the program chair, we invite you to deliver the keynote speaker address at ACM Conference 2024.',
        'A travel stipend will be provided.',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('conference_invitation');
    expect(r.variant_id).toBe('conference_invitation:v1');
    expect(r.criterion_map).toContain('h3_v');
  });

  it('editorial board invitation routes to editorial_board_notice:v1 (NOT conference)', () => {
    const r = classify(
      'editorial-board-appointment-IEEE-TPAMI.pdf',
      [
        'We are pleased to invite you to serve as an Associate Editor on the editorial board of IEEE TPAMI.',
        'Term length: three-year term.',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('editorial_board_notice');
    expect(r.variant_id).toBe('editorial_board_notice:v1');
    expect(r.criterion_map).toContain('h3_iv');
  });
});

describe('EB-1A cross-review § 6 #3 — published_paper v1 vs media_article v1', () => {
  it('peer-reviewed paper with DOI + References fires published_paper:v1', () => {
    const r = classify(
      'demir-2024-applied-ml-radiology.pdf',
      [
        'Abstract',
        'We propose a novel ML approach. doi.org/10.1234/abcd.2024.567',
        'Volume 42, Issue 3, pp. 1129-1145. ORCID 0000-0002-...',
        'References',
        '[1] Foo et al., 2020...',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('published_paper');
    expect(r.variant_id).toBe('published_paper:v1');
  });

  it('media feature article (no DOI, no References) fires media_article:v1', () => {
    const r = classify(
      'wired-feature-on-demir.pdf',
      [
        'By Sarah Johnson',
        'Photo: Getty Images',
        'Forbes spoke with Dr. Demir at his lab last month. The 38-year-old engineer is reshaping the way medium-voltage switchgear is designed.',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('media_article');
    expect(r.variant_id).toBe('media_article:v1');
  });
});

describe('EB-1A predatory-venue red-flag (published_paper:v4)', () => {
  it('flags pay-to-publish + fast-track signals', () => {
    const r = classify(
      'omics-fast-track-paper.pdf',
      [
        'Article Processing Charge: $2400.',
        'Fast-track review.',
        'Submission to publication: 9 days.',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('published_paper');
    expect(r.variant_id).toBe('published_paper:v4');
    expect(r.hard_flag).toBe('predatory_venue_redflag');
  });
});

describe('EB-1A cv_or_resume cascade flag (non-anchor)', () => {
  it('CV is classified but flagged orienting-only', () => {
    const r = classify(
      'demir-cv-2024.pdf',
      [
        'Curriculum Vitae',
        'Awards',
        'Publications',
        'Talks / Invited Lectures',
      ].join('\n\n'),
    );
    expect(r.doc_type).toBe('cv_or_resume');
    expect(r.cv_orienting_only).toBe(true);
    // Non-anchor variants must NOT carry criterion_map weight on their own.
    expect(r.criterion_map).toEqual([]);
  });
});

describe('EB-1A salary_evidence v3 — non-US benchmark coverage', () => {
  it('fires on TÜİK / Eurostat SES / Robert Half EMEA tokens', () => {
    const r = classify(
      'eurostat-ses-2023-isco.pdf',
      'Eurostat SES 2023 — ISCO 2511. 50th percentile. NUTS-2 region.',
    );
    expect(r.doc_type).toBe('salary_evidence');
    expect(r.variant_id).toBe('salary_evidence:v3');
    expect(r.criterion_map).toContain('h3_ix');
  });
});

describe('EB-1A classifier — confidence + candidates surface', () => {
  it('returns top-N candidates with raw scores even on a confident hit', () => {
    const r = classify(
      'IEEE-fellow-induction-letter.pdf',
      'We are pleased to inform you that you have been elected as a Fellow of the IEEE.',
    );
    expect(r.candidates.length).toBeGreaterThanOrEqual(1);
    expect(r.candidates[0]?.variant_id).toBe('membership_credential:v1');
    expect(r.confidence).toBeGreaterThan(0.45);
  });

  it('returns null doc_type for a document below the confidence threshold', () => {
    const r = classify('random.pdf', 'Lorem ipsum dolor sit amet.');
    expect(r.doc_type).toBeNull();
    expect(r.variant_id).toBeNull();
  });
});
