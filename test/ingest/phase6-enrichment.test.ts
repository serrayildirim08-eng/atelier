/**
 * Phase-6 enrichment tests — NAICS drift conflict_register entry,
 * co-petitioner role enrichment (3 fields), and observed_business_model
 * manual-input stub. Pure logic — no Anthropic / no disk.
 *
 * Coverage:
 * - 4 NAICS drift: matching codes / mismatching codes / phrase drift /
 *   single-source data missing.
 * - 6 co-petitioner enrichment: 3 fields × 2 cases (populated + null).
 * - 3 observed_business_model_manual_input: matches claim → no fire,
 *   differs → fires, null → data_incomplete.
 */

import { describe, expect, it } from 'vitest';
import {
  deriveNaicsDriftConflicts,
  deriveCoPetitionersEnriched,
  deriveObservedBusinessModel,
  enrichPhase6Fields,
} from '@/ingest/typed-aggregate';
import { externalEvidenceContradictionRiskGate } from '@/reason';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';
import type { E2Facts } from '@/ingest/schema';
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

function coverLetterEntry(
  filename: string,
  rich: Partial<CoverLetterRichFacts>,
): PerPdfResult {
  const richFull = {
    fully_operational_since_date: rich.fully_operational_since_date ?? fNull,
    claimed_business_model: rich.claimed_business_model ?? fNull,
    claimed_industry_naics: rich.claimed_industry_naics ?? fNull,
    principal_treaty_investor_identity: rich.principal_treaty_investor_identity ?? fNull,
    co_petitioner_relationships: rich.co_petitioner_relationships ?? [],
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
      attorney_name: f('Akalan'),
      attorney_signature_present: f(true),
      letter_date: f('2026-01-07'),
      word_count_estimate: f(2000),
    } as unknown as PerPdfResult['facts'],
    coverLetter: richFull,
  };
}

function businessPlanEntry(
  filename: string,
  industry: string | null,
  naics: string | null,
): PerPdfResult {
  return {
    filename,
    pageCount: 12,
    facts: {
      doc_type: 'business_plan',
      suggested_filename: fNull,
      display_name: fNull,
      enterprise_name: f('Akalan LLC'),
      industry: industry ? f(industry) : fNull,
      naics_code: naics ? f(naics) : fNull,
      projected_revenue_year1_usd: fNull,
      projected_revenue_year5_usd: fNull,
      hire_plan_summary: fNull,
      market_summary: fNull,
      five_year_horizon_addressed: f(true),
    } as unknown as PerPdfResult['facts'],
  };
}

function articlesEntry(
  filename: string,
  members: { name: string; pct: number; role?: string }[],
): PerPdfResult {
  return {
    filename,
    pageCount: 3,
    facts: {
      doc_type: 'formation_doc',
      suggested_filename: fNull,
      display_name: fNull,
      kind: f('articles_of_organization'),
      entity_legal_name: f('Akalan LLC'),
      entity_type: fNull,
      formation_date: fNull,
      state_of_formation: fNull,
      ein: fNull,
    } as unknown as PerPdfResult['facts'],
    corporateFormation: {
      formation_doc_subtype: 'articles_of_organization',
      entity_legal_name: f('Akalan LLC'),
      entity_state_or_country: f('FL'),
      entity_type: f('LLC'),
      filing_date_or_effective_date: f('2024-02-01'),
      registered_agent_name: fNull,
      registrant_name: fNull,
      members_or_shareholders: members.map((m) => ({
        name: f(m.name),
        ownership_percent: f(m.pct),
        role: m.role ? f(m.role) : fNull,
      })),
      organizer_or_incorporator_name: fNull,
      signed_date: fNull,
    } as unknown as PerPdfResult['corporateFormation'],
  };
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
/* Task A — NAICS drift                                                    */
/* ====================================================================== */

describe('deriveNaicsDriftConflicts', () => {
  it('returns [] when cover letter and business plan agree on NAICS code', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      businessPlanEntry('plan.pdf', 'Full-Service Restaurants', '722511'),
    ]);
    expect(deriveNaicsDriftConflicts(memory)).toEqual([]);
  });

  it('emits one conflict when NAICS codes differ across sources', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      businessPlanEntry('plan.pdf', null, '811111'),
    ]);
    const out = deriveNaicsDriftConflicts(memory);
    expect(out).toHaveLength(1);
    expect(out[0].conflict_type).toBe('naics_industry_drift');
    expect(out[0].severity).toBe(4);
    expect(out[0].fact_a.value).toBe('722511');
    expect(out[0].fact_b.value).toBe('811111');
  });

  it('emits one conflict when industry phrases drift dramatically (no codes)', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        claimed_business_model: f('e-commerce beauty retail'),
      }),
      businessPlanEntry('plan.pdf', 'Automotive repair services', null),
    ]);
    const out = deriveNaicsDriftConflicts(memory);
    expect(out).toHaveLength(1);
    expect(out[0].conflict_type).toBe('naics_industry_drift');
    expect(out[0].fact_a.value.toLowerCase()).toContain('beauty');
    expect(out[0].fact_b.value.toLowerCase()).toContain('automotive');
  });

  it('returns [] when only one source has data (single-source not enough to drift)', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      passport('Salih Kacar'),
    ]);
    expect(deriveNaicsDriftConflicts(memory)).toEqual([]);
  });
});

/* ====================================================================== */
/* Task B — Co-petitioner role enrichment                                  */
/* ====================================================================== */

describe('deriveCoPetitionersEnriched — relationship_to_principal', () => {
  it('attaches relationship from cover-letter co_petitioner_relationships list', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [
        { name: 'Salih Kacar', pct: 50 },
        { name: 'Ayse Tarlaci', pct: 50, role: 'Member-Manager' },
      ]),
      coverLetterEntry('cover.pdf', {
        co_petitioner_relationships: [
          {
            full_name: f('Ayse Tarlaci'),
            relationship: f('co_investor' as const),
          },
        ],
      }),
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci?.relationship_to_principal?.value).toBe('co_investor');
  });

  it('leaves relationship_to_principal undefined when no cover-letter prose names a relationship', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [
        { name: 'Salih Kacar', pct: 50 },
        { name: 'Ayse Tarlaci', pct: 50 },
      ]),
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci?.relationship_to_principal).toBeUndefined();
  });
});

describe('deriveCoPetitionersEnriched — sub_application_status', () => {
  it('detects sub_application_status from filename pattern (Sub2)', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [
        { name: 'Salih Kacar', pct: 50 },
        { name: 'Ayse Tarlaci', pct: 50 },
      ]),
      passport('Ayse Tarlaci', 'Sub2-AyseTarlaci-passport.pdf'),
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci?.sub_application_status?.value).toBe('sub2');
  });

  it('leaves sub_application_status undefined when no Sub-N filename appears', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [
        { name: 'Salih Kacar', pct: 50 },
        { name: 'Ayse Tarlaci', pct: 50 },
      ]),
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci?.sub_application_status).toBeUndefined();
  });
});

describe('deriveCoPetitionersEnriched — role_in_petitioner_entity', () => {
  it('builds role_in_petitioner_entity from members_or_shareholders role + percent', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [
        { name: 'Salih Kacar', pct: 50 },
        { name: 'Ayse Tarlaci', pct: 50, role: 'Member-Manager' },
      ]),
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci?.role_in_petitioner_entity?.value).toContain('50%');
    expect(tarlaci?.role_in_petitioner_entity?.value).toContain('Member-Manager');
  });

  it('leaves role_in_petitioner_entity undefined when articles list omits the co-petitioner', () => {
    // Tarlaci appears only via MITA transfer, not in articles members.
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [{ name: 'Salih Kacar', pct: 100 }]),
      {
        filename: 'mita.pdf',
        pageCount: 4,
        facts: {
          doc_type: 'business_contract',
          suggested_filename: fNull,
          display_name: fNull,
          counterparty_name: fNull,
          role: fNull,
          contract_value_usd: f(50000),
          term_summary: fNull,
          signed_date: f('2024-03-01'),
        } as unknown as PerPdfResult['facts'],
        contract: {
          contract_subtype: 'membership_interest_transfer_agreement',
          effective_date: f('2024-03-01'),
          petitioner_legal_name: f('Akalan LLC'),
          transferor: { name: f('Salih Kacar'), is_individual: f(true) },
          transferee: { name: f('Ayse Tarlaci'), is_individual: f(true) },
          membership_interest_transferred_percent: f(50),
          total_consideration_amount: f(50000),
          total_consideration_currency: f('USD'),
          governing_law: fNull,
        } as unknown as PerPdfResult['contract'],
      },
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci).toBeDefined();
    expect(tarlaci?.role_in_petitioner_entity).toBeUndefined();
  });
});

/* ====================================================================== */
/* Task C — observed_business_model_manual_input                            */
/* ====================================================================== */

describe('deriveObservedBusinessModel + external_evidence_contradiction_risk gate', () => {
  it('does not fire when manual input matches claimed business model', () => {
    const facts = emptyFacts();
    facts.enterprise.claimed_business_model = f('Turkish-American restaurant');
    enrichPhase6Fields(facts, {}, {
      observedBusinessModelManualInput: 'Turkish-American restaurant',
    });
    const outcome = externalEvidenceContradictionRiskGate(facts);
    expect(outcome.fired).toBe(false);
    if (outcome.fired === false) expect(outcome.reason).toBe('not_applicable');
  });

  it('fires severity 4 when manual input differs from claimed', () => {
    const facts = emptyFacts();
    facts.enterprise.claimed_business_model = f('B2B e-commerce platform');
    enrichPhase6Fields(facts, {}, {
      observedBusinessModelManualInput:
        'Yelp shows automotive repair services at this address',
    });
    const outcome = externalEvidenceContradictionRiskGate(facts);
    expect(outcome.fired).toBe(true);
    if (outcome.fired) {
      expect(outcome.severity).toBe(4);
      expect(outcome.finding).toContain('attorney manual input');
    }
  });

  it('returns data_incomplete when manual input is null and observed is null', () => {
    const facts = emptyFacts();
    facts.enterprise.claimed_business_model = f('B2B e-commerce platform');
    enrichPhase6Fields(facts, {}, { observedBusinessModelManualInput: null });
    expect(facts.enterprise.observed_business_model_manual_input).toBeUndefined();
    const outcome = externalEvidenceContradictionRiskGate(facts);
    expect(outcome.fired).toBe(false);
    if (outcome.fired === false) expect(outcome.reason).toBe('data_incomplete');
  });
});

describe('deriveObservedBusinessModel direct return', () => {
  it('returns null when manualInput is undefined or empty string', () => {
    expect(deriveObservedBusinessModel({}, undefined)).toBeNull();
    expect(deriveObservedBusinessModel({}, '')).toBeNull();
    expect(deriveObservedBusinessModel({}, '   ')).toBeNull();
  });
});
