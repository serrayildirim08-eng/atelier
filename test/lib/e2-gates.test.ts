/**
 * Phase-0.7 E-2 deterministic-gate tests — pure logic, no Anthropic / disk.
 *
 * One block per gate: (a) fires when met, (b) doesn't fire absent,
 * (c) null-safe → either `not_applicable` or `data_incomplete`, never throws.
 *
 * Empirical anchors (per _CROSS-CASE-SYNTHESIS-2026-04-29.md § 6):
 *   - ownership_volatility:        Flatturbo
 *   - co_petitioner_fund_circularity: Flatturbo (Tarlaci loan)
 *   - unaccounted_sof_share:       Flatturbo (10× claim) + Cemre
 *   - multi_round_rfe_escalation:  B&B International (RFE-1 + RFE-2)
 */

import { describe, expect, it } from 'vitest';
import type { E2Facts } from '@/ingest/schema';
import {
  ownershipVolatilityGate,
  coPetitionerFundCircularityGate,
  unaccountedSofShareGate,
  multiRoundRfeEscalationGate,
  b2StatusViolationSignalGate,
  statusGapPreFilingGate,
  materialChangeInResponseToUscisGate,
  externalEvidenceContradictionRiskGate,
  runE2DeterministicGates,
  renderGateBlock,
} from '@/reason';

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: null as string | null,
    confidence: 1 as number | null,
  };
}
const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

/** Minimal E2Facts seed; tests override the fields they care about. */
function baseFacts(): E2Facts {
  // Cast around the fact wrapper — these tests only exercise the gate
  // surfaces, not the schema validator. Keeping the seed terse beats
  // wiring the entire 50-field provenance shape per test.
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

describe('ownershipVolatilityGate', () => {
  it('fires when 2+ owner-set transitions land within 365d before filing', () => {
    const facts = baseFacts();
    facts.filed_date_i129 = f('2025-12-01');
    facts.ownership_history = [
      { effective_date: f('2024-09-01'), owner_names: [f('Alice')], source_doc: f('amend1') },
      { effective_date: f('2025-03-01'), owner_names: [f('Alice'), f('Bob')], source_doc: f('amend2') },
      { effective_date: f('2025-08-01'), owner_names: [f('Alice'), f('Bob'), f('Carol')], source_doc: f('amend3') },
    ];
    const out = ownershipVolatilityGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(4);
      expect(out.authority).toBe('9 FAM 402.9-7(1)');
    }
  });

  it("doesn't fire when transitions are outside the 365d window", () => {
    const facts = baseFacts();
    facts.filed_date_i129 = f('2025-12-01');
    facts.ownership_history = [
      { effective_date: f('2020-01-01'), owner_names: [f('Alice')], source_doc: f('a') },
      { effective_date: f('2021-01-01'), owner_names: [f('Alice'), f('Bob')], source_doc: f('b') },
      { effective_date: f('2022-01-01'), owner_names: [f('Bob')], source_doc: f('c') },
    ];
    expect(ownershipVolatilityGate(facts).fired).toBe(false);
  });

  it('null-safe — no history or no filing date returns data_incomplete', () => {
    const facts = baseFacts();
    const out = ownershipVolatilityGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('coPetitionerFundCircularityGate', () => {
  it('fires when SOF source_person matches a co-petitioner full_name', () => {
    const facts = baseFacts();
    facts.matter = {
      co_petitioners: [
        { full_name: f('Mehmet Tarlaci'), role: f('co-investor') },
      ],
    };
    facts.source_of_funds = [
      {
        origin_category: f('loan'),
        origin_amount_usd: f(100000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        source_person: { full_name: f('Mehmet Tarlaci') },
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    const out = coPetitionerFundCircularityGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(5);
      expect(out.authority).toBe('9 FAM 402.9-6(B)');
    }
  });

  it("doesn't fire when SOF references an unrelated person", () => {
    const facts = baseFacts();
    facts.matter = {
      co_petitioners: [{ full_name: f('Mehmet Tarlaci'), role: f('co-investor') }],
    };
    facts.source_of_funds = [
      {
        origin_category: f('property_sale'),
        origin_amount_usd: f(200000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        source_person: { full_name: f('Ayşe Yıldız') },
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    expect(coPetitionerFundCircularityGate(facts).fired).toBe(false);
  });

  it('null-safe — no co-petitioners or no SOF returns data_incomplete', () => {
    const facts = baseFacts();
    const out = coPetitionerFundCircularityGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('unaccountedSofShareGate', () => {
  it('fires when claimed > 1.5 × documented SOF total', () => {
    const facts = baseFacts();
    facts.investment = {
      ...facts.investment,
      claimed_amount_usd: f(500_000),
    } as unknown as E2Facts['investment'];
    facts.source_of_funds = [
      {
        origin_category: f('property_sale'),
        origin_amount_usd: f(150_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        documented_amount_usd: f(150_000),
      } as unknown as E2Facts['source_of_funds'][number],
      {
        origin_category: f('savings'),
        origin_amount_usd: f(50_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        documented_amount_usd: f(50_000),
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    const out = unaccountedSofShareGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(5);
      expect(out.authority).toBe('9 FAM 402.9-6(C)');
    }
  });

  it("doesn't fire when claimed is within 1.5× documented", () => {
    const facts = baseFacts();
    facts.investment = {
      ...facts.investment,
      claimed_amount_usd: f(200_000),
    } as unknown as E2Facts['investment'];
    facts.source_of_funds = [
      {
        origin_category: f('property_sale'),
        origin_amount_usd: f(180_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        documented_amount_usd: f(180_000),
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    expect(unaccountedSofShareGate(facts).fired).toBe(false);
  });

  it('null-safe — missing claimed or no documented amounts returns data_incomplete (no fire)', () => {
    const facts = baseFacts();
    // Both sides null
    expect(unaccountedSofShareGate(facts).fired).toBe(false);

    // Only claimed populated
    facts.investment = {
      ...facts.investment,
      claimed_amount_usd: f(500_000),
    } as unknown as E2Facts['investment'];
    facts.source_of_funds = [
      {
        origin_category: f('savings'),
        origin_amount_usd: f(100_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        // documented_amount_usd intentionally omitted
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    const out = unaccountedSofShareGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('multiRoundRfeEscalationGate', () => {
  it('fires when rfes.length ≥ 2 AND latest subject is substantive', () => {
    const facts = baseFacts();
    facts.rfes = [
      { rfe_date: f('2025-02-01'), subject_category: f('maintenance_of_status'), notes: fNull },
      { rfe_date: f('2025-06-01'), subject_category: f('bona_fide_enterprise'), notes: fNull },
    ] as unknown as E2Facts['rfes'];
    const out = multiRoundRfeEscalationGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(5);
      expect(out.authority).toBe('manual § 12.5');
    }
  });

  it("doesn't fire when only one RFE issued", () => {
    const facts = baseFacts();
    facts.rfes = [
      { rfe_date: f('2025-02-01'), subject_category: f('marginality'), notes: fNull },
    ] as unknown as E2Facts['rfes'];
    expect(multiRoundRfeEscalationGate(facts).fired).toBe(false);
  });

  it("doesn't fire when latest subject is procedural", () => {
    const facts = baseFacts();
    facts.rfes = [
      { rfe_date: f('2025-02-01'), subject_category: f('marginality'), notes: fNull },
      { rfe_date: f('2025-06-01'), subject_category: f('maintenance_of_status'), notes: fNull },
    ] as unknown as E2Facts['rfes'];
    expect(multiRoundRfeEscalationGate(facts).fired).toBe(false);
  });

  it('null-safe — no rfes returns not_applicable', () => {
    const facts = baseFacts();
    const out = multiRoundRfeEscalationGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('not_applicable');
  });
});

describe('b2StatusViolationSignalGate', () => {
  it('fires when on B-2 AND ops claimed before work-auth date', () => {
    const facts = baseFacts();
    facts.investor = {
      ...facts.investor,
      current_status: f('B-2'),
      work_authorization_date: f('2023-09-22'),
    } as unknown as E2Facts['investor'];
    facts.enterprise = {
      ...facts.enterprise,
      fully_operational_since_date: f('2022-08-19'),
    } as unknown as E2Facts['enterprise'];
    const out = b2StatusViolationSignalGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(5);
      expect(out.authority).toContain('INA § 101(a)(15)(B)');
    }
  });

  it("doesn't fire when principal is not on a B-class status", () => {
    const facts = baseFacts();
    facts.investor = {
      ...facts.investor,
      current_status: f('E-2'),
      work_authorization_date: f('2023-01-01'),
    } as unknown as E2Facts['investor'];
    facts.enterprise = {
      ...facts.enterprise,
      fully_operational_since_date: f('2022-06-01'),
    } as unknown as E2Facts['enterprise'];
    const out = b2StatusViolationSignalGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('not_applicable');
  });

  it('null-safe — missing status or operational date returns data_incomplete', () => {
    const facts = baseFacts();
    const out = b2StatusViolationSignalGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('statusGapPreFilingGate', () => {
  it('fires when prior status expired before I-129 filed', () => {
    const facts = baseFacts();
    facts.investor = {
      ...facts.investor,
      prior_status_expiration_date: f('2023-03-22'),
    } as unknown as E2Facts['investor'];
    facts.filed_date_i129 = f('2023-09-22');
    const out = statusGapPreFilingGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(5);
      expect(out.authority).toBe('8 CFR § 248.1(b)');
    }
  });

  it("doesn't fire when filing precedes status expiration", () => {
    const facts = baseFacts();
    facts.investor = {
      ...facts.investor,
      prior_status_expiration_date: f('2024-01-01'),
    } as unknown as E2Facts['investor'];
    facts.filed_date_i129 = f('2023-09-22');
    expect(statusGapPreFilingGate(facts).fired).toBe(false);
  });

  it('null-safe — missing dates returns data_incomplete', () => {
    const facts = baseFacts();
    const out = statusGapPreFilingGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('materialChangeInResponseToUscisGate', () => {
  it('fires when initial vs response assertions diverge on a material point', () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2023-12-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since 2022-08-19'),
        response_assertion: f('did not engage in business activities until 2023'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const out = materialChangeInResponseToUscisGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(5);
      expect(out.authority).toContain('Izummi');
    }
  });

  it("doesn't fire when initial and response assertions match", () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2023-12-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since 2022-08-19'),
        response_assertion: f('operational since 2022-08-19'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const out = materialChangeInResponseToUscisGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('not_applicable');
  });

  it('null-safe — no rfes or no assertions returns data_incomplete', () => {
    const facts = baseFacts();
    const out = materialChangeInResponseToUscisGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('externalEvidenceContradictionRiskGate', () => {
  it('fires when claimed and observed business models differ', () => {
    const facts = baseFacts();
    facts.enterprise = {
      ...facts.enterprise,
      claimed_business_model: f('e-commerce only'),
      observed_business_model: f('automotive repair services'),
    } as unknown as E2Facts['enterprise'];
    const out = externalEvidenceContradictionRiskGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(4);
      expect(out.authority).toBe('firm policy');
    }
  });

  it("doesn't fire when claimed and observed match", () => {
    const facts = baseFacts();
    facts.enterprise = {
      ...facts.enterprise,
      claimed_business_model: f('E-commerce'),
      observed_business_model: f('e-commerce'),
    } as unknown as E2Facts['enterprise'];
    const out = externalEvidenceContradictionRiskGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('not_applicable');
  });

  it('null-safe — observed missing downgrades to data_incomplete', () => {
    const facts = baseFacts();
    facts.enterprise = {
      ...facts.enterprise,
      claimed_business_model: f('e-commerce only'),
    } as unknown as E2Facts['enterprise'];
    const out = externalEvidenceContradictionRiskGate(facts);
    expect(out.fired).toBe(false);
    if (!out.fired) expect(out.reason).toBe('data_incomplete');
  });
});

describe('runE2DeterministicGates registry', () => {
  it('runs all 10 gates and returns one outcome per gate, in registry order', () => {
    const results = runE2DeterministicGates(baseFacts());
    expect(results.map((r) => r.name)).toEqual([
      'ownership_volatility',
      'co_petitioner_fund_circularity',
      'unaccounted_sof_share',
      'multi_round_rfe_escalation',
      'b2_status_violation_signal',
      'status_gap_pre_filing',
      'material_change_in_response_to_uscis',
      'external_evidence_contradiction_risk',
      'develop_and_direct_role_authority_thin',
      'five_year_horizon_marginal_failure',
    ]);
    for (const r of results) expect(r.outcome.fired).toBe(false);
  });

  it('renderGateBlock emits a Markdown table with one row per gate', () => {
    const facts = baseFacts();
    facts.investor = {
      ...facts.investor,
      prior_status_expiration_date: f('2023-03-22'),
    } as unknown as E2Facts['investor'];
    facts.filed_date_i129 = f('2023-09-22');
    const block = renderGateBlock(runE2DeterministicGates(facts));
    expect(block).toContain('Deterministic gate findings');
    expect(block).toContain('| status_gap_pre_filing | 5 | fired |');
    // 10 gate rows + header row + separator row (`|---|...|`)
    expect(block.split('\n').filter((l) => l.startsWith('|'))).toHaveLength(12);
  });
});
