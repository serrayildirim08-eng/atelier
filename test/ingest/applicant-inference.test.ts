/**
 * Deterministic applicant-from-ownership inference tests. Pure logic, no
 * Anthropic / disk. The Haiku fallback is intentionally NOT exercised here
 * — it's gated by APPLICANT_HAIKU_FALLBACK_ENABLED and would require a
 * mocked Anthropic client; tests assert that the deterministic ladder
 * resolves all the cases the rule needs to cover.
 */

import { describe, expect, it } from 'vitest';
import {
  inferApplicantFromOwnership,
  TREATY_OWNERSHIP_THRESHOLD,
  type OwnershipEntryT,
} from '@/lib/e2/applicant-inference';
import {
  isTreatyNational,
  lookupTreatyCountry,
} from '@/lib/e2/treaty-countries';
import {
  enrichInvestorFromOwnershipChain,
} from '@/ingest/typed-aggregate';
import type { E2Facts } from '@/ingest/schema';

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: 'q' as string | null,
    confidence: 1 as number | null,
  };
}
const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

function owner(
  name: string | null,
  pct: number | null,
  nationality: string | null,
  direct: 'direct' | 'indirect' = 'direct',
): OwnershipEntryT {
  return {
    owner_name: name == null ? (fNull as OwnershipEntryT['owner_name']) : f(name),
    ownership_percent: pct == null ? (fNull as OwnershipEntryT['ownership_percent']) : f(pct),
    nationality:
      nationality == null
        ? (fNull as OwnershipEntryT['nationality'])
        : f(nationality),
    direct_or_indirect: f(direct),
  };
}

/** Build a minimal E2Facts shell with a given ownership_chain. */
function emptyFacts(
  chain: OwnershipEntryT[],
  investorName: string | null = null,
): E2Facts {
  const investor: E2Facts['investor'] = {
    full_name: investorName == null ? fNull : f(investorName),
    dob: fNull,
    place_of_birth: fNull,
    nationality: fNull,
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
    ownership_chain: chain as unknown as E2Facts['ownership_chain'],
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

/* ---------------------------------------------------------------------- */
/* Treaty country list                                                    */
/* ---------------------------------------------------------------------- */

describe('treaty-countries', () => {
  it('recognizes Turkish nationality and Türkiye / TR aliases', () => {
    expect(isTreatyNational('Turkish')).toBe(true);
    expect(isTreatyNational('TURKEY')).toBe(true);
    expect(isTreatyNational('Türkiye')).toBe(true);
    expect(isTreatyNational('Republic of Turkey')).toBe(true);
    expect(isTreatyNational('TR')).toBe(true);
    expect(isTreatyNational('TUR')).toBe(true);
    expect(lookupTreatyCountry('Turkish')?.name).toBe('Turkey');
  });

  it('recognizes a representative spread of treaty nationalities', () => {
    expect(isTreatyNational('French')).toBe(true);
    expect(isTreatyNational('German')).toBe(true);
    expect(isTreatyNational('British')).toBe(true);
    expect(isTreatyNational('Japanese')).toBe(true);
    expect(isTreatyNational('South Korean')).toBe(true);
    expect(isTreatyNational('Mexican')).toBe(true);
    expect(isTreatyNational('Taiwanese')).toBe(true);
    expect(isTreatyNational('Portuguese')).toBe(true);
  });

  it('rejects non-treaty countries (PRC, India, Russia, Brazil)', () => {
    expect(isTreatyNational('Chinese')).toBe(false);
    expect(isTreatyNational('China')).toBe(false);
    expect(isTreatyNational('Indian')).toBe(false);
    expect(isTreatyNational('India')).toBe(false);
    expect(isTreatyNational('Russian')).toBe(false);
    expect(isTreatyNational('Brazilian')).toBe(false);
    // Taiwan is on the list but the PRC is not — make sure "China" alone
    // doesn't get cross-matched by the "China (Taiwan)" entry.
    expect(lookupTreatyCountry('China')).toBeNull();
  });

  it('returns null for empty / non-string inputs', () => {
    expect(isTreatyNational(null)).toBe(false);
    expect(isTreatyNational(undefined)).toBe(false);
    expect(isTreatyNational('')).toBe(false);
    expect(isTreatyNational('   ')).toBe(false);
  });
});

/* ---------------------------------------------------------------------- */
/* Deterministic ladder — primary cases                                   */
/* ---------------------------------------------------------------------- */

describe('inferApplicantFromOwnership — deterministic ladder', () => {
  it('fills applicant when a single Turkish national holds 100%', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [owner('Salih Kaçar', 100, 'Turkish')],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('filled_single_treaty_majority');
    expect(r.full_name?.value).toBe('Salih Kaçar');
    expect(r.full_name?.confidence).toBe(0.9);
    expect(r.conflicts).toHaveLength(0);
  });

  it('fills applicant for Turkish 75% / American 25% (single treaty majority)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Mehmet Yılmaz', 75, 'Turkish'),
        owner('John Smith', 25, 'American'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('filled_single_treaty_majority');
    expect(r.full_name?.value).toBe('Mehmet Yılmaz');
    expect(r.conflicts).toHaveLength(0);
  });

  it('fills applicant when treaty owner sits at exactly 50% (boundary)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Aylin Demir', 50, 'Turkish'),
        owner('John Smith', 50, 'American'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('filled_single_treaty_majority');
    expect(r.full_name?.value).toBe('Aylin Demir');
    expect(TREATY_OWNERSHIP_THRESHOLD).toBe(50);
  });

  it('logs ambiguous when two Turkish nationals hold 50/50 (no individual majority)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Ali Veli', 50, 'Turkish'),
        owner('Ayşe Yılmaz', 50, 'Turkish'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('ambiguous_multiple_treaty_nationals');
    expect(r.full_name).toBeUndefined();
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].conflict_type.value).toBe('ambiguous_applicant_identity');
    expect(r.conflicts[0].severity.value).toBe(3);
    expect(r.conflicts[0].description.value).toMatch(/Ali Veli/);
    expect(r.conflicts[0].description.value).toMatch(/Ayşe Yılmaz/);
  });

  it('logs ambiguous when three treaty nationals together hold 60% but each is < 50%', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Ali', 25, 'Turkish'),
        owner('Maria', 20, 'Spanish'),
        owner('Hans', 15, 'German'),
        owner('John Smith', 40, 'American'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('ambiguous_multiple_treaty_nationals');
    expect(r.conflicts[0].conflict_type.value).toBe('ambiguous_applicant_identity');
    expect(r.conflicts[0].severity.value).toBe(3);
  });

  it('logs ownership_below_threshold when sole treaty national is 49% and American is 51%', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Mehmet Yılmaz', 49, 'Turkish'),
        owner('John Smith', 51, 'American'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('non_treaty_majority_owner');
    // The American 51% is the dispositive failure; we surface that first.
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].conflict_type.value).toBe('non_treaty_majority_owner');
    expect(r.conflicts[0].severity.value).toBe(4);
    expect(r.conflicts[0].description.value).toMatch(/John Smith/);
  });

  it('logs ownership_below_threshold when Turkish 30% / American 30% / German 40% (no majority anywhere)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Ali', 30, 'Turkish'),
        owner('John', 30, 'American'),
        owner('Hans', 40, 'German'),
      ],
      current_investor_full_name: null,
    });
    // Turkish + German = 70% treaty aggregated, no individual ≥ 50.
    expect(r.decision).toBe('ambiguous_multiple_treaty_nationals');
    expect(r.conflicts[0].conflict_type.value).toBe('ambiguous_applicant_identity');
  });

  it('logs ownership_below_threshold for sole Turkish 30% with no other owners', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [owner('Ali', 30, 'Turkish')],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('ownership_below_threshold');
    expect(r.conflicts[0].conflict_type.value).toBe('ownership_below_threshold');
    expect(r.conflicts[0].severity.value).toBe(3);
  });

  it('logs non_treaty_majority_owner when sole owner is 75% Chinese', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [owner('Wei Zhang', 75, 'Chinese')],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('non_treaty_majority_owner');
    expect(r.full_name).toBeUndefined();
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].conflict_type.value).toBe('non_treaty_majority_owner');
    expect(r.conflicts[0].severity.value).toBe(4);
    expect(r.conflicts[0].description.value).toMatch(/Wei Zhang/);
    expect(r.conflicts[0].description.value).toMatch(/NOT a qualifying E-2 treaty country/);
  });

  it('logs non_treaty_majority_owner for an Indian 60% / Turkish 40% chain', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Raj Patel', 60, 'Indian'),
        owner('Ali Yılmaz', 40, 'Turkish'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('non_treaty_majority_owner');
    expect(r.conflicts[0].description.value).toMatch(/Raj Patel/);
  });

  it('skips when investor.full_name is already populated (no overwrite)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [owner('Different Person', 100, 'Turkish')],
      current_investor_full_name: 'Already Set Investor',
    });
    expect(r.decision).toBe('skipped_existing_value');
    expect(r.full_name).toBeUndefined();
    expect(r.conflicts).toHaveLength(0);
  });

  it('returns no_ownership_data on empty chain', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('no_ownership_data');
    expect(r.conflicts).toHaveLength(0);
  });

  it('returns no_decision_needs_llm when nationalities are missing on every row', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Person A', 60, null),
        owner('Person B', 40, null),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('no_decision_needs_llm');
    expect(r.conflicts).toHaveLength(0);
  });

  it('returns no_decision_needs_llm when percents are missing (one Turkish, percent unknown)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Ali', null, 'Turkish'),
        owner('John', null, 'American'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('no_decision_needs_llm');
  });

  it('handles Taiwanese nationality (treaty) but rejects PRC Chinese (non-treaty)', () => {
    const taiwanese = inferApplicantFromOwnership({
      ownership_chain: [owner('Lin Ming', 100, 'Taiwanese')],
      current_investor_full_name: null,
    });
    expect(taiwanese.decision).toBe('filled_single_treaty_majority');
    expect(taiwanese.full_name?.value).toBe('Lin Ming');

    const prc = inferApplicantFromOwnership({
      ownership_chain: [owner('Wang Lei', 100, 'Chinese')],
      current_investor_full_name: null,
    });
    expect(prc.decision).toBe('non_treaty_majority_owner');
  });

  it('survives owner rows that have a name but missing percent + nationality', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [
        owner('Mystery Person', null, null),
        owner('Salih Kaçar', 100, 'Turkish'),
      ],
      current_investor_full_name: null,
    });
    expect(r.decision).toBe('filled_single_treaty_majority');
    expect(r.full_name?.value).toBe('Salih Kaçar');
  });

  it('treats blank-string investor name as still-empty (fills it)', () => {
    const r = inferApplicantFromOwnership({
      ownership_chain: [owner('Salih Kaçar', 100, 'Turkish')],
      current_investor_full_name: '   ',
    });
    expect(r.decision).toBe('filled_single_treaty_majority');
    expect(r.full_name?.value).toBe('Salih Kaçar');
  });
});

/* ---------------------------------------------------------------------- */
/* Aggregator integration — enrichInvestorFromOwnershipChain              */
/* ---------------------------------------------------------------------- */

describe('enrichInvestorFromOwnershipChain (aggregator integration)', () => {
  it('writes investor.full_name when blank and chain is unambiguous', () => {
    const facts = emptyFacts([owner('Salih Kaçar', 100, 'Turkish')], null);
    enrichInvestorFromOwnershipChain(facts);
    expect(facts.investor.full_name.value).toBe('Salih Kaçar');
    expect(facts.conflict_register).toHaveLength(0);
  });

  it('appends a conflict_register entry without overwriting existing investor name (skip path)', () => {
    const facts = emptyFacts(
      [owner('Different Person', 100, 'Turkish')],
      'Already Set',
    );
    enrichInvestorFromOwnershipChain(facts);
    expect(facts.investor.full_name.value).toBe('Already Set');
    expect(facts.conflict_register).toHaveLength(0);
  });

  it('logs an ambiguity conflict on 50/50 Turkish chain without filling name', () => {
    const facts = emptyFacts(
      [owner('Ali', 50, 'Turkish'), owner('Veli', 50, 'Turkish')],
      null,
    );
    enrichInvestorFromOwnershipChain(facts);
    expect(facts.investor.full_name.value).toBeNull();
    expect(facts.conflict_register).toHaveLength(1);
    expect(facts.conflict_register[0].conflict_type.value).toBe(
      'ambiguous_applicant_identity',
    );
    expect(facts.conflict_register[0].severity.value).toBe(3);
  });

  it('is idempotent: a second call does not append duplicate conflicts', () => {
    const facts = emptyFacts(
      [owner('Ali', 50, 'Turkish'), owner('Veli', 50, 'Turkish')],
      null,
    );
    enrichInvestorFromOwnershipChain(facts);
    enrichInvestorFromOwnershipChain(facts);
    expect(
      facts.conflict_register.filter(
        (c) => c.conflict_type.value === 'ambiguous_applicant_identity',
      ),
    ).toHaveLength(1);
  });

  it('logs non_treaty_majority_owner conflict for 75% Chinese owner', () => {
    const facts = emptyFacts([owner('Wei Zhang', 75, 'Chinese')], null);
    enrichInvestorFromOwnershipChain(facts);
    expect(facts.investor.full_name.value).toBeNull();
    expect(facts.conflict_register[0].conflict_type.value).toBe(
      'non_treaty_majority_owner',
    );
    expect(facts.conflict_register[0].severity.value).toBe(4);
  });
});
