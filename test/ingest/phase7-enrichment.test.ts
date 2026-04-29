/**
 * Phase-7 enrichment tests — I-129E supplement extractor (NAICS 3-source),
 * sub-application alias-map fallback (Task B), cover-letter Phase-7 field
 * extensions (Task C). Pure logic — no Anthropic / no disk.
 *
 * Coverage (16 active tests):
 * - 6 I-129E supplement schema + 3-source NAICS drift integration.
 * - 3 sub-application alias resolver (filename / alias / attorney override).
 * - 6 cover-letter Phase-7 fields (3 fields × 2 cases).
 * - 1 NAICS 3-source orchestrator (all three populated → 3SRC conflict).
 */

import { describe, expect, it } from 'vitest';
import {
  deriveNaicsDriftConflicts,
  deriveCoPetitionersEnriched,
  deriveCoverLetterPhase7Fields,
  enrichPhase6Fields,
} from '@/ingest/typed-aggregate';
import {
  resolveSubApplicationAlias,
  SUB_APPLICATION_ALIAS_MAP,
} from '@/lib/case-folder-aliases';
import {
  CoverLetterRichFactsSchema,
  type CoverLetterRichFacts,
} from '@/ingest/extractors/cover-letter.schema';
import { I129ESupplementFactsSchema } from '@/ingest/extractors/i129e-supplement.schema';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';
import type { E2Facts } from '@/ingest/schema';

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

function i129eSupplementEntry(
  filename: string,
  industry: string | null,
  naics: string | null,
): PerPdfResult {
  return {
    filename,
    pageCount: 3,
    facts: {
      doc_type: 'uscis_or_dos_form',
      suggested_filename: fNull,
      display_name: fNull,
      form_id: f('I-129E'),
      form_edition: fNull,
      beneficiary_name: f('Salih Kacar'),
      petitioner_name: f('Akalan LLC'),
      signature_present: f(true),
      signature_date: f('2026-01-05'),
      attorney_g28_present: f(true),
      investment_amount_usd: f(150000),
    } as unknown as PerPdfResult['facts'],
    i129eSupplement: {
      industry_classification: industry ? f(industry) : fNull,
      naics_code: naics ? f(naics) : fNull,
      investment_amount_usd: f(150000),
      treaty_country: f('Türkiye'),
      beneficiary_ownership_percent: f(100),
    },
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
/* Task A — I-129 E Supplement extractor + 3-source NAICS drift            */
/* ====================================================================== */

describe('I129ESupplementFactsSchema', () => {
  it('parses a fully populated supplement payload', () => {
    const raw = {
      industry_classification: f('Full-service restaurant — Mediterranean cuisine'),
      naics_code: f('722511'),
      investment_amount_usd: f(150000),
      treaty_country: f('Türkiye'),
      beneficiary_ownership_percent: f(100),
    };
    const parsed = I129ESupplementFactsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.industry_classification.value).toContain('Mediterranean');
      expect(parsed.data.naics_code.value).toBe('722511');
      expect(parsed.data.investment_amount_usd.value).toBe(150000);
      expect(parsed.data.beneficiary_ownership_percent.value).toBe(100);
    }
  });

  it('parses an empty supplement payload (all null leaves)', () => {
    const raw = {
      industry_classification: fNull,
      naics_code: fNull,
      investment_amount_usd: fNull,
      treaty_country: fNull,
      beneficiary_ownership_percent: fNull,
    };
    const parsed = I129ESupplementFactsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.industry_classification.value).toBeNull();
      expect(parsed.data.investment_amount_usd.value).toBeNull();
    }
  });
});

describe('deriveNaicsDriftConflicts — I-129E as third source', () => {
  it('emits a 2-source conflict when only cover-letter and I-129E disagree on NAICS code', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      i129eSupplementEntry('i129e.pdf', null, '811111'),
    ]);
    const out = deriveNaicsDriftConflicts(memory);
    expect(out).toHaveLength(1);
    expect(out[0].conflict_type).toBe('naics_industry_drift');
    expect(out[0].fact_a.value).toBe('722511');
    expect(out[0].fact_b.value).toBe('811111');
  });

  it('emits a 3-source conflict when all three disagree on NAICS code', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      businessPlanEntry('plan.pdf', null, '811111'),
      i129eSupplementEntry('i129e.pdf', null, '541110'),
    ]);
    const out = deriveNaicsDriftConflicts(memory);
    expect(out).toHaveLength(1);
    expect(out[0].conflict_id).toBe('NAICS_DRIFT_3SRC');
    expect(out[0].fact_c?.value).toBeDefined();
    const codes = [out[0].fact_a.value, out[0].fact_b.value, out[0].fact_c?.value];
    expect(new Set(codes).size).toBe(3);
  });

  it('emits no conflict when all three sources carry the same NAICS code', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      businessPlanEntry('plan.pdf', null, '722511'),
      i129eSupplementEntry('i129e.pdf', null, '722511'),
    ]);
    expect(deriveNaicsDriftConflicts(memory)).toEqual([]);
  });

  it('treats I-129E industry_classification as a drift source when phrases diverge', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        claimed_business_model: f('B2B e-commerce platform'),
      }),
      i129eSupplementEntry('i129e.pdf', 'Automotive repair services', null),
    ]);
    const out = deriveNaicsDriftConflicts(memory);
    expect(out).toHaveLength(1);
    expect(out[0].fact_a.value.toLowerCase()).toContain('e-commerce');
    expect(out[0].fact_b.value.toLowerCase()).toContain('automotive');
  });
});

describe('enrichPhase6Fields — 3-source NAICS conflict_register', () => {
  it('writes a NAICS_DRIFT_3SRC entry into conflict_register with the gate label', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', { claimed_industry_naics: f('722511') }),
      businessPlanEntry('plan.pdf', null, '811111'),
      i129eSupplementEntry('i129e.pdf', null, '541110'),
    ]);
    const facts = emptyFacts();
    enrichPhase6Fields(facts, memory);
    expect(facts.conflict_register).toHaveLength(1);
    const entry = facts.conflict_register[0];
    expect(entry.conflict_type.value).toBe('naics_industry_drift');
    expect(entry.severity.value).toBe(4);
    expect(entry.description.value).toContain('i129e.pdf');
    expect(entry.description.source_quote).toContain('Phase-7');
  });
});

/* ====================================================================== */
/* Task B — Sub-application alias-map fallback                              */
/* ====================================================================== */

describe('resolveSubApplicationAlias', () => {
  it('resolves a static alias when the filename uses a non-canonical prefix', () => {
    expect(resolveSubApplicationAlias('Subordinate-One_PetitionerB.pdf')).toBe('sub1');
    expect(resolveSubApplicationAlias('S2_AyseTarlaci-passport.pdf')).toBe('sub2');
    expect(resolveSubApplicationAlias('SubFour-Berkant.pdf')).toBe('sub4');
  });

  it('returns null when no alias matches the filename', () => {
    expect(resolveSubApplicationAlias('passport.pdf')).toBeNull();
    expect(resolveSubApplicationAlias('articles-of-org.pdf')).toBeNull();
    // The static map only covers sub1..sub6, not arbitrary numbers.
    expect(resolveSubApplicationAlias('Sub7-NotASlot.pdf')).toBeNull();
  });

  it('respects attorney per-matter overrides over the static map', () => {
    // Firm-internal "PetB" used to indicate Sub2 but the static map doesn't
    // know that. The attorney-supplied override resolves it.
    const overrides = { PetB: 'sub2', PetC: 'sub3' };
    expect(resolveSubApplicationAlias('PetB-AyseTarlaci.pdf', overrides)).toBe('sub2');
    expect(resolveSubApplicationAlias('PetC-Berkant.pdf', overrides)).toBe('sub3');
    // Override wins even when the static map has a different mapping for
    // the SAME filename via a different alias substring.
    const conflictOverride = { S1: 'sub3' };
    expect(resolveSubApplicationAlias('S1-PetB.pdf', conflictOverride)).toBe('sub3');
  });
});

describe('deriveCoPetitionersEnriched — alias-map fallback', () => {
  it('falls back to the alias map when filename pattern misses', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesEntry('articles.pdf', [
        { name: 'Salih Kacar', pct: 50 },
        { name: 'Ayse Tarlaci', pct: 50 },
      ]),
      // Filename uses 'S2_' prefix — Phase-6 regex misses, alias map hits.
      passport('Ayse Tarlaci', 'S2_AyseTarlaci-passport.pdf'),
    ]);
    const out = deriveCoPetitionersEnriched(memory);
    const tarlaci = out.find((c) => c.full_name.value === 'Ayse Tarlaci');
    expect(tarlaci?.sub_application_status?.value).toBe('sub2');
  });
});

/* ====================================================================== */
/* Task C — Cover-letter Phase-7 fields                                    */
/* ====================================================================== */

describe('CoverLetterRichFactsSchema — Phase-7 extensions', () => {
  it('parses a payload with all three Phase-7 fields populated', () => {
    const raw = {
      fully_operational_since_date: fNull,
      claimed_business_model: fNull,
      claimed_industry_naics: fNull,
      principal_treaty_investor_identity: fNull,
      co_petitioner_relationships: [],
      prior_passport_renewal_footnote: {
        paragraph_text:
          "the Beneficiary's prior passport (No. U12345678) was renewed and the current passport (No. U99999999) is appended hereto",
        prior_passport_number: 'U12345678',
        current_passport_number: 'U99999999',
      },
      five_year_business_horizon: {
        year_1_revenue_usd: 250000,
        year_3_revenue_usd: 1500000,
        year_5_revenue_usd: 4000000,
        year_5_employee_count: 18,
      },
      develop_and_direct_role_grant: {
        role_title: 'President',
        granting_document_ref: 'Section 5.2 of the Operating Agreement',
        authority_scope: ['contract_signing', 'banking_authority', 'hire_fire'],
      },
    };
    const parsed = CoverLetterRichFactsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.prior_passport_renewal_footnote?.prior_passport_number).toBe('U12345678');
      expect(parsed.data.five_year_business_horizon?.year_5_employee_count).toBe(18);
      expect(parsed.data.develop_and_direct_role_grant?.authority_scope).toContain('hire_fire');
    }
  });

  it('parses a legacy payload that omits the Phase-7 fields entirely', () => {
    const raw = {
      fully_operational_since_date: f('2022-08-19'),
      claimed_business_model: f('Turkish-American restaurant'),
      claimed_industry_naics: fNull,
      principal_treaty_investor_identity: fNull,
    };
    const parsed = CoverLetterRichFactsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.prior_passport_renewal_footnote).toBeNull();
      expect(parsed.data.five_year_business_horizon).toBeNull();
      expect(parsed.data.develop_and_direct_role_grant).toBeNull();
    }
  });
});

describe('deriveCoverLetterPhase7Fields', () => {
  it('returns the prior_passport_renewal_footnote when present on a cover letter', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        prior_passport_renewal_footnote: {
          paragraph_text: 'prior passport renewed',
          prior_passport_number: 'U1',
          current_passport_number: 'U2',
        },
      }),
    ]);
    const out = deriveCoverLetterPhase7Fields(memory);
    expect(out.prior_passport_renewal_footnote?.prior_passport_number).toBe('U1');
    expect(out.prior_passport_renewal_footnote?.current_passport_number).toBe('U2');
  });

  it('returns the five_year_business_horizon when present on a cover letter', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        five_year_business_horizon: {
          year_1_revenue_usd: 100000,
          year_3_revenue_usd: 500000,
          year_5_revenue_usd: 2000000,
          year_5_employee_count: 12,
        },
      }),
    ]);
    const out = deriveCoverLetterPhase7Fields(memory);
    expect(out.five_year_business_horizon?.year_5_revenue_usd).toBe(2000000);
    expect(out.five_year_business_horizon?.year_5_employee_count).toBe(12);
  });

  it('returns the develop_and_direct_role_grant with empty authority_scope (E5 vulnerability marker)', () => {
    const memory = memoryFrom([
      coverLetterEntry('cover.pdf', {
        develop_and_direct_role_grant: {
          role_title: 'President',
          granting_document_ref: 'Operating Agreement',
          authority_scope: [],
        },
      }),
    ]);
    const out = deriveCoverLetterPhase7Fields(memory);
    expect(out.develop_and_direct_role_grant?.role_title).toBe('President');
    expect(out.develop_and_direct_role_grant?.authority_scope).toEqual([]);
  });

  it('returns null Phase-7 fields when no cover letter is present', () => {
    const memory = memoryFrom([passport('Salih Kacar')]);
    const out = deriveCoverLetterPhase7Fields(memory);
    expect(out.prior_passport_renewal_footnote).toBeNull();
    expect(out.five_year_business_horizon).toBeNull();
    expect(out.develop_and_direct_role_grant).toBeNull();
  });
});

describe('SUB_APPLICATION_ALIAS_MAP integrity', () => {
  it('every alias maps to a canonical sub1..sub6 slot', () => {
    for (const slot of Object.values(SUB_APPLICATION_ALIAS_MAP)) {
      expect(slot).toMatch(/^sub[1-6]$/);
    }
  });
});
