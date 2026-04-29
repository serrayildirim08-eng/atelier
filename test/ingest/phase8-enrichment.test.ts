/**
 * Phase-8 enrichment + drafter binding tests — pure logic, no Anthropic / disk.
 *
 * Coverage (8 active tests):
 *  - 4 enrichPhase8Fields shape (footnote / horizon / role grant / null-safe).
 *  - 2 schema parse (full Phase-8 cover_letter_phase7 shape + back-compat).
 *  - 2 drafter slim-prompt binding (PHASE8_BINDING_FRAME contents +
 *    buildE2SlimPrompt embeds the binding frame).
 */

import { describe, expect, it } from 'vitest';
import { enrichPhase8Fields } from '@/ingest/typed-aggregate';
import { E2FactsSchema, type E2Facts } from '@/ingest/schema';
import {
  CoverLetterRichFactsSchema,
  type CoverLetterRichFacts,
} from '@/ingest/extractors/cover-letter.schema';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';
import {
  buildE2SlimPrompt,
  PHASE8_BINDING_FRAME,
} from '@/draft/cover-letter';

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
  const richFull: CoverLetterRichFacts = {
    fully_operational_since_date: rich.fully_operational_since_date ?? fNull,
    claimed_business_model: rich.claimed_business_model ?? fNull,
    claimed_industry_naics: rich.claimed_industry_naics ?? fNull,
    principal_treaty_investor_identity: rich.principal_treaty_investor_identity ?? fNull,
    co_petitioner_relationships: rich.co_petitioner_relationships ?? [],
    prior_passport_renewal_footnote: rich.prior_passport_renewal_footnote ?? null,
    five_year_business_horizon: rich.five_year_business_horizon ?? null,
    develop_and_direct_role_grant: rich.develop_and_direct_role_grant ?? null,
  };
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
      word_count_estimate: f(2500),
    } as unknown as PerPdfResult['facts'],
    coverLetter: richFull,
  };
}

function baseFacts(): E2Facts {
  return {
    investor: {} as E2Facts['investor'],
    enterprise: {} as E2Facts['enterprise'],
    ownership_chain: [],
    investment: { items: [] } as unknown as E2Facts['investment'],
    source_of_funds: [],
    elements_evidence: {} as E2Facts['elements_evidence'],
    conflict_register: [],
  } as E2Facts;
}

describe('enrichPhase8Fields', () => {
  it('routes a populated passport_renewal_footnote onto facts.cover_letter_phase7', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        prior_passport_renewal_footnote: {
          paragraph_text:
            'The Beneficiary was issued a B-2 visa in a prior passport, which has since expired.',
          prior_passport_number: 'S02174044',
          current_passport_number: 'U26585648',
        },
      }),
    ]);
    const facts = baseFacts();
    enrichPhase8Fields(facts, memory);
    expect(facts.cover_letter_phase7?.passport_renewal_footnote).toEqual({
      paragraph_text:
        'The Beneficiary was issued a B-2 visa in a prior passport, which has since expired.',
      prior_passport_number: 'S02174044',
      current_passport_number: 'U26585648',
    });
    expect(facts.cover_letter_phase7?.five_year_horizon ?? null).toBeNull();
    expect(facts.cover_letter_phase7?.develop_and_direct_role_grant ?? null).toBeNull();
  });

  it('routes a populated five_year_business_horizon onto cover_letter_phase7.five_year_horizon', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        five_year_business_horizon: {
          year_1_revenue_usd: 250000,
          year_3_revenue_usd: 600000,
          year_5_revenue_usd: 1200000,
          year_5_employee_count: 4,
        },
      }),
    ]);
    const facts = baseFacts();
    enrichPhase8Fields(facts, memory);
    expect(facts.cover_letter_phase7?.five_year_horizon).toEqual({
      year_1_revenue_usd: 250000,
      year_3_revenue_usd: 600000,
      year_5_revenue_usd: 1200000,
      year_5_employee_count: 4,
    });
  });

  it('routes a populated develop_and_direct_role_grant; filters unknown authority_scope values', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        develop_and_direct_role_grant: {
          role_title: 'President',
          granting_document_ref: 'Member Resolution dated 2025-09-01',
          // Includes one unknown enum value ("ceremonial_role") that
          // should be silently dropped by the enricher.
          authority_scope: ['contract_signing', 'ceremonial_role', 'banking_authority'],
        },
      }),
    ]);
    const facts = baseFacts();
    enrichPhase8Fields(facts, memory);
    expect(facts.cover_letter_phase7?.develop_and_direct_role_grant).toEqual({
      role_title: 'President',
      granting_document_ref: 'Member Resolution dated 2025-09-01',
      authority_scope: ['contract_signing', 'banking_authority'],
    });
  });

  it('null-safe — no cover_letter entries leaves cover_letter_phase7 absent', () => {
    const memory = memoryFrom([]);
    const facts = baseFacts();
    enrichPhase8Fields(facts, memory);
    expect(facts.cover_letter_phase7).toBeUndefined();
  });
});

describe('CoverLetterPhase7Schema (E2FactsSchema slot)', () => {
  it('parses an E2Facts object with a fully populated cover_letter_phase7 block', () => {
    const seed = {
      investor: {
        full_name: f('Salih Kacar'),
        dob: fNull,
        place_of_birth: fNull,
        nationality: fNull,
        passport_number: fNull,
        passport_expiry: fNull,
        current_us_status: fNull,
      },
      enterprise: {
        legal_name: f('Akalan LLC'),
        ein: fNull,
        formation_date: fNull,
        state_of_formation: fNull,
        entity_type: fNull,
        industry: fNull,
        naics_code: fNull,
        physical_address: fNull,
      },
      ownership_chain: [],
      investment: {
        total_committed_usd: fNull,
        total_spent_usd: fNull,
        total_cost_of_enterprise_usd: fNull,
        proportionality_percent: fNull,
        items: [],
      },
      source_of_funds: [],
      elements_evidence: {
        treaty_country_basis: fNull,
        substantial_investment_basis: fNull,
        real_and_operating_basis: fNull,
        more_than_marginal_basis: fNull,
        develop_and_direct_basis: fNull,
      },
      conflict_register: [],
      cover_letter_phase7: {
        passport_renewal_footnote: {
          paragraph_text: 'p',
          prior_passport_number: 'S1',
          current_passport_number: 'U1',
        },
        five_year_horizon: {
          year_1_revenue_usd: 100,
          year_3_revenue_usd: 300,
          year_5_revenue_usd: 600,
          year_5_employee_count: 3,
        },
        develop_and_direct_role_grant: {
          role_title: 'Manager',
          granting_document_ref: 'OA',
          authority_scope: ['day_to_day_operations'],
        },
      },
    };
    const parsed = E2FactsSchema.parse(seed);
    expect(parsed.cover_letter_phase7?.develop_and_direct_role_grant?.role_title).toBe(
      'Manager',
    );
  });

  it('back-compat — parses a legacy E2Facts without cover_letter_phase7', () => {
    const seed = {
      investor: {
        full_name: fNull,
        dob: fNull,
        place_of_birth: fNull,
        nationality: fNull,
        passport_number: fNull,
        passport_expiry: fNull,
        current_us_status: fNull,
      },
      enterprise: {
        legal_name: fNull,
        ein: fNull,
        formation_date: fNull,
        state_of_formation: fNull,
        entity_type: fNull,
        industry: fNull,
        naics_code: fNull,
        physical_address: fNull,
      },
      ownership_chain: [],
      investment: {
        total_committed_usd: fNull,
        total_spent_usd: fNull,
        total_cost_of_enterprise_usd: fNull,
        proportionality_percent: fNull,
        items: [],
      },
      source_of_funds: [],
      elements_evidence: {
        treaty_country_basis: fNull,
        substantial_investment_basis: fNull,
        real_and_operating_basis: fNull,
        more_than_marginal_basis: fNull,
        develop_and_direct_basis: fNull,
      },
      conflict_register: [],
    };
    const parsed = E2FactsSchema.parse(seed);
    expect(parsed.cover_letter_phase7).toBeUndefined();
  });
});

describe('drafter Phase-8 binding frame', () => {
  it('PHASE8_BINDING_FRAME instructs the verbatim defensive footnote pattern', () => {
    expect(PHASE8_BINDING_FRAME).toContain('passport_renewal_footnote');
    expect(PHASE8_BINDING_FRAME).toContain('Defensive footnote pattern');
    expect(PHASE8_BINDING_FRAME).toContain('VERBATIM');
    expect(PHASE8_BINDING_FRAME).toContain('Do NOT paraphrase the structure');
    expect(PHASE8_BINDING_FRAME).toContain('five_year_horizon');
    expect(PHASE8_BINDING_FRAME).toContain('develop_and_direct_role_grant');
    expect(PHASE8_BINDING_FRAME).toContain('contract_signing');
    expect(PHASE8_BINDING_FRAME).toContain('E5 WEAK');
  });

  it('buildE2SlimPrompt embeds the Phase-8 binding frame for E-2 drafts', () => {
    const prompt = buildE2SlimPrompt('individual_investor', 'initial');
    expect(prompt).toContain('Phase-8 narrative-claim bindings');
    expect(prompt).toContain('facts.cover_letter_phase7.passport_renewal_footnote');
    expect(prompt).toContain('facts.cover_letter_phase7.five_year_horizon');
    expect(prompt).toContain('facts.cover_letter_phase7.develop_and_direct_role_grant');
  });
});

// Ensure the cover-letter schema continues to drive the enricher; this
// silences the "imported but unused" lint when the schema is referenced
// only at the type level above.
void CoverLetterRichFactsSchema;
