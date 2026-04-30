/**
 * Deterministic dependent-from-family-docs inference tests. Pure logic, no
 * Anthropic / disk. The Haiku fallback is intentionally NOT exercised here
 * — it is gated by DEPENDENT_HAIKU_FALLBACK_ENABLED and would require a
 * mocked Anthropic client; tests assert that the deterministic ladder
 * resolves the cases the rule needs to cover and that the aggregator
 * integration is idempotent.
 */

import { describe, expect, it } from 'vitest';
import {
  inferDependentsFromFamilyDocs,
  type DependentInferenceInput,
  type PassportCandidate,
  type MarriageBinding,
  type BirthBinding,
  type NufusBinding,
} from '@/lib/e2/dependent-inference';
import { isTreatyNational } from '@/lib/e2/treaty-countries';
import { enrichDependentsFromFamilyDocs } from '@/ingest/typed-aggregate';
import type { E2Facts } from '@/ingest/schema';
import type { TypedMemory, PerPdfResult } from '@/ingest/typed-memory';

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function passport(
  filename: string,
  full_name: string | null,
  nationality: string | null = 'Turkish',
  dob: string | null = null,
): PassportCandidate {
  return { filename, full_name, nationality, dob };
}

function marriage(
  filename: string,
  spouse_a: string | null,
  spouse_b: string | null,
): MarriageBinding {
  return { filename, spouse_a_name: spouse_a, spouse_b_name: spouse_b };
}

function birth(
  filename: string,
  child: string | null,
  parent1: string | null,
  parent2: string | null = null,
  child_dob: string | null = null,
): BirthBinding {
  return {
    filename,
    child_name: child,
    child_dob,
    parent1_name: parent1,
    parent2_name: parent2,
  };
}

function nufus(
  filename: string,
  household_member_names: string[] = [],
): NufusBinding {
  return { filename, household_member_names };
}

function input(overrides: Partial<DependentInferenceInput>): DependentInferenceInput {
  return {
    passports: [],
    principal_name: 'Salih Kaçar',
    principal_nationality: 'Turkish',
    principal_passport_filename: 'salih-passport.pdf',
    marriages: [],
    births: [],
    nufus: [],
    ...overrides,
  };
}

/* ---------------------------------------------------------------------- */
/* Treaty-country sanity check (used as a building block)                 */
/* ---------------------------------------------------------------------- */

describe('treaty-countries (used by dependent inference)', () => {
  it('recognizes Turkish nationality so the same-household heuristic applies', () => {
    expect(isTreatyNational('Turkish')).toBe(true);
  });
});

/* ---------------------------------------------------------------------- */
/* Deterministic ladder                                                   */
/* ---------------------------------------------------------------------- */

describe('inferDependentsFromFamilyDocs — deterministic ladder', () => {
  it('binds spouse via marriage_certificate when principal is one party', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar'),
        ],
        marriages: [marriage('marriage.pdf', 'Salih Kaçar', 'Aysegul Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(1);
    expect(r.dependents[0].full_name.value).toBe('Aysegul Kaçar');
    expect(r.dependents[0].relationship.value).toBe('spouse');
    expect(r.dependents[0].dependent_doc_basis.value).toBe('marriage.pdf');
    expect(r.conflicts).toHaveLength(0);
  });

  it('binds two children via two birth_certificates', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('child1-passport.pdf', 'Mehmet Kaçar'),
          passport('child2-passport.pdf', 'Ayşe Kaçar'),
        ],
        births: [
          birth('birth-mehmet.pdf', 'Mehmet Kaçar', 'Salih Kaçar', 'Aysegul Kaçar'),
          birth('birth-ayse.pdf', 'Ayşe Kaçar', 'Salih Kaçar', 'Aysegul Kaçar'),
        ],
      }),
    );
    expect(r.dependents).toHaveLength(2);
    expect(r.dependents.map((d) => d.relationship.value)).toEqual(['child', 'child']);
    expect(r.dependents.map((d) => d.full_name.value).sort()).toEqual([
      'Ayşe Kaçar',
      'Mehmet Kaçar',
    ]);
    expect(r.conflicts).toHaveLength(0);
  });

  it('binds spouse + child when marriage + birth certificates are both present', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar'),
          passport('mehmet-passport.pdf', 'Mehmet Kaçar'),
        ],
        marriages: [marriage('marriage.pdf', 'Salih Kaçar', 'Aysegul Kaçar')],
        births: [birth('birth.pdf', 'Mehmet Kaçar', 'Salih Kaçar', 'Aysegul Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(2);
    const byRel = Object.fromEntries(r.dependents.map((d) => [d.relationship.value, d]));
    expect(byRel.spouse?.full_name.value).toBe('Aysegul Kaçar');
    expect(byRel.child?.full_name.value).toBe('Mehmet Kaçar');
    expect(r.conflicts).toHaveLength(0);
  });

  it('returns empty dependents and no conflicts when only the principal passport exists', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [passport('salih-passport.pdf', 'Salih Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(0);
    expect(r.conflicts).toHaveLength(0);
  });

  it('logs unmatched_passport (severity 2) when a non-principal passport has no family doc', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('mystery-passport.pdf', 'Mystery Person'),
        ],
      }),
    );
    expect(r.dependents).toHaveLength(0);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].conflict_type.value).toBe('unmatched_passport');
    expect(r.conflicts[0].severity.value).toBe(2);
    expect(r.conflicts[0].fact_a_doc.value).toBe('mystery-passport.pdf');
  });

  it('handles 3 passports + 2 family docs binding 2 of them: 2 dependents + 1 unmatched conflict', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar'),
          passport('mehmet-passport.pdf', 'Mehmet Kaçar'),
          passport('orphan-passport.pdf', 'Random Bystander'),
        ],
        marriages: [marriage('marriage.pdf', 'Salih Kaçar', 'Aysegul Kaçar')],
        births: [birth('birth.pdf', 'Mehmet Kaçar', 'Salih Kaçar', 'Aysegul Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(2);
    const unmatched = r.conflicts.filter(
      (c) => c.conflict_type.value === 'unmatched_passport',
    );
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].fact_a_doc.value).toBe('orphan-passport.pdf');
  });

  it('refuses to bind dependents when principal name is unknown (cannot identify principal vs dependent)', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        principal_name: null,
        principal_passport_filename: null,
        passports: [
          passport('one.pdf', 'Person A'),
          passport('two.pdf', 'Person B'),
        ],
        marriages: [marriage('marriage.pdf', 'Person A', 'Person B')],
      }),
    );
    expect(r.dependents).toHaveLength(0);
    // We don't log unmatched_passport when there's no principal — the
    // applicant-inference layer is the right place to surface that gap.
    expect(r.conflicts).toHaveLength(0);
  });

  it('logs dependent_relationship_unclear (severity 2) when marriage cert lacks the principal', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('other-passport.pdf', 'Random Other'),
        ],
        marriages: [marriage('marriage.pdf', 'Different Husband', 'Different Wife')],
      }),
    );
    expect(r.dependents).toHaveLength(0);
    const types = r.conflicts.map((c) => c.conflict_type.value);
    expect(types).toContain('dependent_relationship_unclear');
    // Plus the orphan passport surfaces as unmatched.
    expect(types).toContain('unmatched_passport');
  });

  it('logs dependent_relationship_unclear when birth cert names a child but no passport is on file', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [passport('salih-passport.pdf', 'Salih Kaçar')],
        births: [birth('birth.pdf', 'Missing Kid', 'Salih Kaçar', 'Aysegul Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(0);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].conflict_type.value).toBe('dependent_relationship_unclear');
    expect(r.conflicts[0].fact_a_doc.value).toBe('birth.pdf');
  });

  it('does not bind anyone via Nüfus alone when the registry has no structured names; logs unmatched_passport', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar', 'Turkish'),
        ],
        nufus: [nufus('nufus_kayit_ornegi.pdf', [])],
      }),
    );
    expect(r.dependents).toHaveLength(0);
    expect(r.conflicts.some((c) => c.conflict_type.value === 'unmatched_passport')).toBe(
      true,
    );
  });

  it('binds household members via Nüfus when the registry surfaces structured names', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar'),
          passport('mehmet-passport.pdf', 'Mehmet Kaçar'),
        ],
        nufus: [
          nufus('nufus.pdf', [
            'Salih Kaçar',
            'Aysegul Kaçar',
            'Mehmet Kaçar',
          ]),
        ],
      }),
    );
    expect(r.dependents).toHaveLength(2);
    const names = r.dependents.map((d) => d.full_name.value).sort();
    expect(names).toEqual(['Aysegul Kaçar', 'Mehmet Kaçar']);
    // Nüfus-only bindings surface as 'other_dependent' since the registry
    // doesn't disambiguate spouse vs child in this code path.
    expect(r.dependents.every((d) => d.relationship.value === 'other_dependent')).toBe(
      true,
    );
  });

  it('logs dependent_count_inconsistent when Nüfus is present but ≥ 2 passports remain unbound', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('p1.pdf', 'Aysegul Kaçar'),
          passport('p2.pdf', 'Person Two'),
          passport('p3.pdf', 'Person Three'),
        ],
        marriages: [marriage('marriage.pdf', 'Salih Kaçar', 'Aysegul Kaçar')],
        nufus: [nufus('nufus.pdf', [])],
      }),
    );
    expect(r.dependents).toHaveLength(1);
    expect(
      r.conflicts.some((c) => c.conflict_type.value === 'dependent_count_inconsistent'),
    ).toBe(true);
  });

  it('skips the principal passport even when a marriage cert lists them as one spouse', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar'),
        ],
        marriages: [marriage('marriage.pdf', 'Aysegul Kaçar', 'Salih Kaçar')],
      }),
    );
    // Principal must NOT appear as a dependent.
    expect(
      r.dependents.find((d) => d.full_name.value === 'Salih Kaçar'),
    ).toBeUndefined();
    expect(r.dependents).toHaveLength(1);
    expect(r.dependents[0].full_name.value).toBe('Aysegul Kaçar');
  });

  it('matches names across diacritic and case differences (Salih Kaçar ↔ SALIH KACAR)', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'SALIH KACAR'),
          passport('aysegul-passport.pdf', 'AYSEGUL KACAR'),
        ],
        marriages: [marriage('marriage.pdf', 'Salih Kaçar', 'Aysegül Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(1);
    expect(r.dependents[0].relationship.value).toBe('spouse');
  });

  it('preserves dependent nationality for treaty-country verification', () => {
    const r = inferDependentsFromFamilyDocs(
      input({
        passports: [
          passport('salih-passport.pdf', 'Salih Kaçar', 'Turkish'),
          passport('aysegul-passport.pdf', 'Aysegul Kaçar', 'Turkish'),
        ],
        marriages: [marriage('marriage.pdf', 'Salih Kaçar', 'Aysegul Kaçar')],
      }),
    );
    expect(r.dependents).toHaveLength(1);
    expect(r.dependents[0].nationality.value).toBe('Turkish');
    expect(isTreatyNational(r.dependents[0].nationality.value)).toBe(true);
  });
});

/* ---------------------------------------------------------------------- */
/* Aggregator integration — enrichDependentsFromFamilyDocs                */
/* ---------------------------------------------------------------------- */

const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: 'q' as string | null,
    confidence: 1 as number | null,
  };
}

/** Build a minimal E2Facts shell with a populated investor.full_name. */
function factsWithPrincipal(principalName: string): E2Facts {
  const investor: E2Facts['investor'] = {
    full_name: f(principalName),
    dob: fNull,
    place_of_birth: fNull,
    nationality: f('Turkish'),
    passport_number: fNull,
    passport_expiry: fNull,
    current_us_status: fNull,
  } as unknown as E2Facts['investor'];
  return {
    investor,
    enterprise: {
      legal_name: fNull,
      ein: fNull,
      formation_date: fNull,
      state_of_formation: fNull,
      entity_type: fNull,
      industry: fNull,
      naics_code: fNull,
      physical_address: fNull,
    } as unknown as E2Facts['enterprise'],
    ownership_chain: [],
    investment: {
      total_committed_usd: fNull,
      total_spent_usd: fNull,
      total_cost_of_enterprise_usd: fNull,
      proportionality_percent: fNull,
      items: [],
    } as unknown as E2Facts['investment'],
    source_of_funds: [],
    elements_evidence: {
      treaty_country_basis: fNull,
      substantial_investment_basis: fNull,
      real_and_operating_basis: fNull,
      more_than_marginal_basis: fNull,
      develop_and_direct_basis: fNull,
    } as unknown as E2Facts['elements_evidence'],
    conflict_register: [],
  };
}

function memoryWithPassportsAndMarriage(): TypedMemory {
  const principalEntry: PerPdfResult = {
    filename: 'salih-passport.pdf',
    pageCount: 2,
    facts: {
      doc_type: 'passport',
      suggested_filename: f('salih-passport.pdf'),
      display_name: f('Salih Kaçar · Passport'),
      full_name: f('Salih Kaçar'),
      dob: f('1980-01-01'),
      nationality: f('Turkish'),
      passport_number: f('U12345678'),
      passport_expiry: f('2030-01-01'),
      place_of_birth: f('Istanbul'),
      issue_date: f('2020-01-01'),
    } as unknown as PerPdfResult['facts'],
  };
  const spouseEntry: PerPdfResult = {
    filename: 'aysegul-passport.pdf',
    pageCount: 2,
    facts: {
      doc_type: 'passport',
      suggested_filename: f('aysegul-passport.pdf'),
      display_name: f('Aysegul Kaçar · Passport'),
      full_name: f('Aysegul Kaçar'),
      dob: f('1982-05-15'),
      nationality: f('Turkish'),
      passport_number: f('U87654321'),
      passport_expiry: f('2031-05-15'),
      place_of_birth: f('Istanbul'),
      issue_date: f('2021-05-15'),
    } as unknown as PerPdfResult['facts'],
  };
  const marriageEntry: PerPdfResult = {
    filename: 'marriage.pdf',
    pageCount: 1,
    facts: {
      doc_type: 'vital_record',
      suggested_filename: f('marriage.pdf'),
      display_name: f('Marriage Certificate'),
      record_kind: f('marriage_certificate'),
      primary_party_name: f('Salih Kaçar'),
      secondary_party_name: f('Aysegul Kaçar'),
      event_date: f('2010-06-01'),
      registry_office: fNull,
      registry_country: f('Turkey'),
      has_certified_translation: f(true),
    } as unknown as PerPdfResult['facts'],
    vitalRecords: {
      vital_record_subtype: 'marriage_certificate',
      spouse1_name: f('Salih Kaçar'),
      spouse2_name: f('Aysegul Kaçar'),
      marriage_date: f('2010-06-01'),
      marriage_place: f('Istanbul'),
      registry: f('Istanbul Registry'),
      certified_translation_present: f(true),
      translator_name: f('Some Translator'),
      translator_certification_date: f('2024-01-01'),
    } as unknown as PerPdfResult['vitalRecords'],
  };
  return {
    passport: [principalEntry, spouseEntry],
    vital_record: [marriageEntry],
  };
}

describe('enrichDependentsFromFamilyDocs (aggregator integration)', () => {
  it('writes facts.dependents from passports + marriage certificate', () => {
    const facts = factsWithPrincipal('Salih Kaçar');
    const memory = memoryWithPassportsAndMarriage();
    enrichDependentsFromFamilyDocs(facts, memory);
    expect(facts.dependents).toBeDefined();
    expect(facts.dependents).toHaveLength(1);
    expect(facts.dependents?.[0].full_name?.value).toBe('Aysegul Kaçar');
    expect(facts.dependents?.[0].relationship?.value).toBe('spouse');
    expect(facts.dependents?.[0].dependent_doc_basis?.value).toBe('marriage.pdf');
    expect(facts.conflict_register).toHaveLength(0);
  });

  it('is idempotent: a second call does not duplicate dependents or conflicts', () => {
    const facts = factsWithPrincipal('Salih Kaçar');
    const memory = memoryWithPassportsAndMarriage();
    enrichDependentsFromFamilyDocs(facts, memory);
    enrichDependentsFromFamilyDocs(facts, memory);
    expect(facts.dependents).toHaveLength(1);
    expect(facts.conflict_register).toHaveLength(0);
  });

  it('appends unmatched_passport conflict for orphan passports without doubling on rerun', () => {
    const facts = factsWithPrincipal('Salih Kaçar');
    const memory = memoryWithPassportsAndMarriage();
    // Add an orphan passport with no matching family doc.
    memory.passport!.push({
      filename: 'orphan-passport.pdf',
      pageCount: 2,
      facts: {
        doc_type: 'passport',
        suggested_filename: f('orphan-passport.pdf'),
        display_name: f('Orphan · Passport'),
        full_name: f('Orphan Person'),
        dob: f('1990-01-01'),
        nationality: f('Turkish'),
        passport_number: f('X11111111'),
        passport_expiry: f('2030-01-01'),
        place_of_birth: f('Ankara'),
        issue_date: f('2020-01-01'),
      } as unknown as PerPdfResult['facts'],
    });
    enrichDependentsFromFamilyDocs(facts, memory);
    enrichDependentsFromFamilyDocs(facts, memory);
    const unmatched = facts.conflict_register.filter(
      (c) => c.conflict_type.value === 'unmatched_passport',
    );
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].fact_a_doc.value).toBe('orphan-passport.pdf');
    expect(unmatched[0].severity.value).toBe(2);
    expect(facts.dependents).toHaveLength(1);
  });

  it('does nothing when no passports are in memory', () => {
    const facts = factsWithPrincipal('Salih Kaçar');
    const memory: TypedMemory = {};
    enrichDependentsFromFamilyDocs(facts, memory);
    expect(facts.dependents).toBeUndefined();
    expect(facts.conflict_register).toHaveLength(0);
  });

  it('refuses to bind anything when investor.full_name is blank', () => {
    const facts = factsWithPrincipal('');
    // Force null
    facts.investor.full_name = fNull as unknown as E2Facts['investor']['full_name'];
    const memory = memoryWithPassportsAndMarriage();
    enrichDependentsFromFamilyDocs(facts, memory);
    expect(facts.dependents).toBeUndefined();
    // No unmatched_passport noise either — applicant-inference is the
    // canonical place to surface "no principal yet" warnings.
    expect(
      facts.conflict_register.filter(
        (c) => c.conflict_type.value === 'unmatched_passport',
      ),
    ).toHaveLength(0);
  });
});
