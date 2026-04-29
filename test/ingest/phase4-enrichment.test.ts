/**
 * Phase-4 enrichment tests — cover-letter rich + RFE/NOID rich.
 * Pure logic: no Anthropic / no disk.
 *
 * Coverage:
 * - deriveCoverLetterFields: 4 fields × {populated, null-safe} = 8 tests
 * - deriveRfesRich + enrichPhase4Fields RFE pairing: 9 subject_category
 *   values represented across ~10 fixture cases + null-safe (the brief's
 *   "subject category × 9 categories × 2 cases — but consolidate ~10
 *   fixture cases covering all 9 + null") = 16 tests
 *
 * The tests build memory fixtures without invoking the Haiku extractor;
 * they construct PerPdfResult objects with .coverLetter / .rfeNotice
 * already populated to mimic the second-pass output.
 */

import { describe, expect, it } from 'vitest';
import {
  deriveCoverLetterFields,
  deriveRfesRich,
  enrichPhase4Fields,
} from '@/ingest/typed-aggregate';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';
import type { E2Facts } from '@/ingest/schema';
import type {
  RfeNoticeFacts,
  RfeSubjectCategory,
} from '@/ingest/extractors/rfe-notice.schema';
import type { CoverLetterRichFacts } from '@/ingest/extractors/cover-letter.schema';

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: 'q' as string | null,
    confidence: 0.9 as number | null,
  };
}
const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

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

function passport(name: string, filename = 'passport.pdf'): PerPdfResult {
  return {
    filename,
    pageCount: 2,
    facts: {
      doc_type: 'passport',
      suggested_filename: fNull,
      display_name: fNull,
      full_name: f(name),
      dob: fNull,
      nationality: fNull,
      passport_number: fNull,
      passport_expiry: fNull,
      place_of_birth: fNull,
      issue_date: fNull,
    } as unknown as PerPdfResult['facts'],
  };
}

function coverLetterEntry(
  filename: string,
  letterDate: string | null,
  rich: Partial<CoverLetterRichFacts>,
): PerPdfResult {
  const richFull: CoverLetterRichFacts = {
    fully_operational_since_date: rich.fully_operational_since_date ?? fNull,
    claimed_business_model: rich.claimed_business_model ?? fNull,
    claimed_industry_naics: rich.claimed_industry_naics ?? fNull,
    principal_treaty_investor_identity: rich.principal_treaty_investor_identity ?? fNull,
  } as CoverLetterRichFacts;
  return {
    filename,
    pageCount: 4,
    facts: {
      doc_type: 'cover_letter',
      suggested_filename: fNull,
      display_name: fNull,
      visa_type_argued: f('E-2'),
      addressee: f('USCIS'),
      attorney_name: f('Yasin Bilgehan Akalan'),
      attorney_signature_present: f(true),
      letter_date: letterDate ? f(letterDate) : fNull,
      word_count_estimate: f(2500),
    } as unknown as PerPdfResult['facts'],
    coverLetter: richFull,
  };
}

function rfeNoticeEntry(
  filename: string,
  role: RfeNoticeFacts['document_role']['value'],
  category: RfeSubjectCategory,
  opts: Partial<RfeNoticeFacts> = {},
): PerPdfResult {
  const rich: RfeNoticeFacts = {
    document_role: { ...f(role), confidence: 0.9 } as RfeNoticeFacts['document_role'],
    subject_category: { ...f(category), confidence: 0.9 } as RfeNoticeFacts['subject_category'],
    rfe_date: opts.rfe_date ?? fNull,
    response_deadline: opts.response_deadline ?? fNull,
    issuing_officer_name: opts.issuing_officer_name ?? fNull,
    issuing_officer_title: opts.issuing_officer_title ?? fNull,
    evidence_requested: opts.evidence_requested ?? [],
    initial_filing_assertion: opts.initial_filing_assertion ?? fNull,
    response_assertion: opts.response_assertion ?? fNull,
  } as RfeNoticeFacts;
  // Notices route through doc_type='other' or status_doc; responses
  // through doc_type='cover_letter'. The thin doc_type does not affect
  // the Phase-4 logic which reads entry.rfeNotice directly.
  const docType = role === 'rfe_notice' || role === 'noid_notice' ? 'other' : 'cover_letter';
  const baseFacts =
    docType === 'cover_letter'
      ? ({
          doc_type: 'cover_letter',
          suggested_filename: fNull,
          display_name: fNull,
          visa_type_argued: f('E-2'),
          addressee: f('USCIS'),
          attorney_name: f('Akalan'),
          attorney_signature_present: f(true),
          letter_date: fNull,
          word_count_estimate: f(2000),
        } as unknown as PerPdfResult['facts'])
      : ({
          doc_type: 'other',
          suggested_filename: fNull,
          display_name: fNull,
          one_line_summary: f('USCIS RFE notice'),
          key_facts: [],
        } as unknown as PerPdfResult['facts']);
  return {
    filename,
    pageCount: 5,
    facts: baseFacts,
    rfeNotice: rich,
  };
}

function emptyFacts(): E2Facts {
  return {
    investor: { full_name: f('Salih Kacar') } as unknown as E2Facts['investor'],
    enterprise: {} as E2Facts['enterprise'],
    ownership_chain: [],
    investment: { items: [] } as unknown as E2Facts['investment'],
    source_of_funds: [],
    elements_evidence: {} as E2Facts['elements_evidence'],
    conflict_register: [],
  } as E2Facts;
}

/* ====================================================================== */
/* deriveCoverLetterFields — 8 tests                                       */
/* ====================================================================== */

describe('deriveCoverLetterFields', () => {
  it('populates fully_operational_since_date from rich extraction', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', '2026-01-07', {
        fully_operational_since_date: f('2022-08-19'),
      }),
    ]);
    const out = deriveCoverLetterFields(memory);
    expect(out.fully_operational_since_date?.value).toBe('2022-08-19');
  });

  it('returns null fully_operational_since_date when no cover letter present', () => {
    const memory = memoryFrom([passport('Salih Kacar')]);
    expect(deriveCoverLetterFields(memory).fully_operational_since_date).toBeNull();
  });

  it('populates claimed_business_model from rich extraction', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', '2026-01-07', {
        claimed_business_model: f('B2B e-commerce platform for medium-voltage equipment'),
      }),
    ]);
    expect(deriveCoverLetterFields(memory).claimed_business_model?.value).toContain(
      'B2B e-commerce',
    );
  });

  it('returns null claimed_business_model when extractor produced null', () => {
    const memory = memoryFrom([coverLetterEntry('cover.pdf', '2026-01-07', {})]);
    expect(deriveCoverLetterFields(memory).claimed_business_model).toBeNull();
  });

  it('populates claimed_industry_naics when cover letter cites a NAICS', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', '2026-01-07', {
        claimed_industry_naics: f('722511'),
      }),
    ]);
    expect(deriveCoverLetterFields(memory).claimed_industry_naics?.value).toBe('722511');
  });

  it('returns null NAICS when not cited', () => {
    const memory = memoryFrom([coverLetterEntry('cover.pdf', '2026-01-07', {})]);
    expect(deriveCoverLetterFields(memory).claimed_industry_naics).toBeNull();
  });

  it('populates principal_treaty_investor_identity for Subtype-3/4', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', '2024-02-08', {
        principal_treaty_investor_identity: f('Pomega Energy A.S.'),
      }),
    ]);
    expect(deriveCoverLetterFields(memory).principal_treaty_investor_identity?.value).toBe(
      'Pomega Energy A.S.',
    );
  });

  it('prefers earliest cover letter when multiple present (initial vs RFE response)', () => {
    const memory = memoryFrom([
      coverLetterEntry('rfe-cover.pdf', '2026-04-08', {
        fully_operational_since_date: f('2024-01-01'),
      }),
      coverLetterEntry('initial-cover.pdf', '2026-01-07', {
        fully_operational_since_date: f('2022-08-19'),
      }),
    ]);
    expect(deriveCoverLetterFields(memory).fully_operational_since_date?.value).toBe(
      '2022-08-19',
    );
  });
});

/* ====================================================================== */
/* deriveRfesRich + enrichPhase4Fields — 16 tests                          */
/* ====================================================================== */

describe('deriveRfesRich — subject_category coverage', () => {
  it('classifies bona_fide_enterprise', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-bfe.pdf', 'rfe_notice', 'bona_fide_enterprise', {
        rfe_date: f('2026-04-28'),
      }),
    ]);
    const out = deriveRfesRich(memory);
    expect(out).toHaveLength(1);
    expect(out[0].subject_category.value).toBe('bona_fide_enterprise');
    expect(out[0].rfe_date.value).toBe('2026-04-28');
  });

  it('classifies marginality', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-marg.pdf', 'rfe_notice', 'marginality'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe('marginality');
  });

  it('classifies substantial_investment', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-sub.pdf', 'rfe_notice', 'substantial_investment'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe('substantial_investment');
  });

  it('classifies nationality_or_ownership', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-nat.pdf', 'rfe_notice', 'nationality_or_ownership'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe(
      'nationality_or_ownership',
    );
  });

  it('classifies develop_and_direct', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-dd.pdf', 'rfe_notice', 'develop_and_direct'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe('develop_and_direct');
  });

  it('classifies procedural_status', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-proc.pdf', 'rfe_notice', 'procedural_status'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe('procedural_status');
  });

  it('classifies source_of_funds', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-sof.pdf', 'rfe_notice', 'source_of_funds'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe('source_of_funds');
  });

  it('classifies classification_ambiguity', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-amb.pdf', 'rfe_notice', 'classification_ambiguity'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe(
      'classification_ambiguity',
    );
  });

  it('classifies multiple for compound RFEs', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-multi.pdf', 'rfe_notice', 'multiple'),
    ]);
    expect(deriveRfesRich(memory)[0].subject_category.value).toBe('multiple');
  });

  it('returns [] when no rich rfeNotice extractions present (null-safe)', () => {
    const memory = memoryFrom([passport('Alice')]);
    expect(deriveRfesRich(memory)).toHaveLength(0);
  });
});

describe('deriveRfesRich — assertion pairing', () => {
  it('pairs notice initial_filing_assertion with response_assertion by category', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-bfe-notice.pdf', 'rfe_notice', 'bona_fide_enterprise', {
        initial_filing_assertion: f('Petitioner has been fully operational since August 19, 2022'),
      }),
      rfeNoticeEntry('rfe-bfe-response.pdf', 'rfe_response', 'bona_fide_enterprise', {
        response_assertion: f('Petitioner did not engage in business activities until 2023'),
      }),
    ]);
    const out = deriveRfesRich(memory);
    expect(out).toHaveLength(1);
    expect(out[0].initial_filing_assertion?.value).toContain('August 19, 2022');
    expect(out[0].response_assertion?.value).toContain('2023');
  });

  it('leaves response_assertion undefined when no matching response present', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-marg-notice.pdf', 'rfe_notice', 'marginality', {
        initial_filing_assertion: f('Net income $50,000'),
      }),
    ]);
    const out = deriveRfesRich(memory);
    expect(out[0].initial_filing_assertion?.value).toBe('Net income $50,000');
    expect(out[0].response_assertion).toBeUndefined();
  });

  it('emits one rfes[] entry per notice when multiple notices exist', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-1.pdf', 'rfe_notice', 'procedural_status'),
      rfeNoticeEntry('rfe-2.pdf', 'rfe_notice', 'bona_fide_enterprise'),
    ]);
    const out = deriveRfesRich(memory);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.subject_category.value).sort()).toEqual([
      'bona_fide_enterprise',
      'procedural_status',
    ]);
  });
});

describe('enrichPhase4Fields orchestrator', () => {
  it('writes cover-letter fields onto enterprise', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', '2026-01-07', {
        fully_operational_since_date: f('2022-08-19'),
        claimed_business_model: f('Auto-turbo e-commerce'),
      }),
    ]);
    const facts = emptyFacts();
    enrichPhase4Fields(facts, memory);
    expect(facts.enterprise.fully_operational_since_date?.value).toBe('2022-08-19');
    expect(facts.enterprise.claimed_business_model?.value).toBe('Auto-turbo e-commerce');
  });

  it('replaces stub Phase-3 rfes[] with rich Phase-4 entries when available', () => {
    const memory = memoryFrom([
      rfeNoticeEntry('rfe-1.pdf', 'rfe_notice', 'bona_fide_enterprise', {
        rfe_date: f('2026-04-28'),
      }),
    ]);
    const facts = emptyFacts();
    facts.rfes = [
      {
        rfe_date: f('2026-04-28'),
        subject_category: f('other'),
        notes: f('Phase-3 stub'),
      },
    ];
    enrichPhase4Fields(facts, memory);
    expect(facts.rfes).toHaveLength(1);
    expect(facts.rfes![0].subject_category.value).toBe('bona_fide_enterprise');
  });

  it('does not overwrite already-populated enterprise fields (idempotence)', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', '2026-01-07', {
        fully_operational_since_date: f('2099-01-01'),
      }),
    ]);
    const facts = emptyFacts();
    facts.enterprise.fully_operational_since_date = f('2022-08-19');
    enrichPhase4Fields(facts, memory);
    expect(facts.enterprise.fully_operational_since_date?.value).toBe('2022-08-19');
  });
});
