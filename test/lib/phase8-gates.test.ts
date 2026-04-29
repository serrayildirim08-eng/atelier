/**
 * Phase-8 deterministic gate tests — pure logic, no Anthropic / no disk.
 *
 * One block per new gate: (a) fires when met, (b) doesn't fire absent,
 * (c) null-safe → either `not_applicable` or `data_incomplete`, never throws.
 *
 *  - develop_and_direct_role_authority_thin (severity 4)
 *      Authority: 9 FAM 402.9-7(1) develop-and-direct.
 *  - five_year_horizon_marginal_failure (severity 4)
 *      Authority: 9 FAM 402.9-6(E); Matter of Walsh and Pollard.
 */

import { describe, expect, it } from 'vitest';
import type { E2Facts } from '@/ingest/schema';
import {
  developAndDirectRoleAuthorityThinGate,
  fiveYearHorizonMarginalFailureGate,
  fiveYearHorizonVsBusinessPlanDriftGate,
} from '@/reason';

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

describe('developAndDirectRoleAuthorityThinGate', () => {
  it('fires when role grant lists no operational authority items', () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      develop_and_direct_role_grant: {
        role_title: 'President',
        granting_document_ref: 'Member Resolution dated 2025-09-01',
        authority_scope: ['strategic_planning'],
      },
    };
    const out = developAndDirectRoleAuthorityThinGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(4);
      expect(out.authority).toBe('9 FAM 402.9-7(1) develop-and-direct');
      expect(out.finding).toContain('President');
    }
  });

  it("doesn't fire when authority_scope includes contract_signing", () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      develop_and_direct_role_grant: {
        role_title: 'Managing Member',
        granting_document_ref: 'Operating Agreement § 5.1',
        authority_scope: ['contract_signing', 'strategic_planning'],
      },
    };
    expect(developAndDirectRoleAuthorityThinGate(facts).fired).toBe(false);
  });

  it("doesn't fire when banking_authority OR day_to_day_operations is granted", () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      develop_and_direct_role_grant: {
        role_title: 'Director',
        granting_document_ref: 'Resolution',
        authority_scope: ['banking_authority'],
      },
    };
    expect(developAndDirectRoleAuthorityThinGate(facts).fired).toBe(false);
    facts.cover_letter_phase7.develop_and_direct_role_grant!.authority_scope = [
      'day_to_day_operations',
    ];
    expect(developAndDirectRoleAuthorityThinGate(facts).fired).toBe(false);
  });

  it('null-safe — absent grant returns data_incomplete', () => {
    const out = developAndDirectRoleAuthorityThinGate(baseFacts());
    expect(out).toEqual({ fired: false, reason: 'data_incomplete' });
  });
});

describe('fiveYearHorizonMarginalFailureGate', () => {
  it('fires when year_5_employee_count is 1 (Beneficiary-only employment)', () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: 250000,
        year_3_revenue_usd: 600000,
        year_5_revenue_usd: 1500000,
        year_5_employee_count: 1,
      },
    };
    const out = fiveYearHorizonMarginalFailureGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(4);
      expect(out.authority).toContain('Walsh and Pollard');
    }
  });

  it('fires when year_5_employee_count is 0 (no employees at all)', () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: null,
        year_5_employee_count: 0,
      },
    };
    expect(fiveYearHorizonMarginalFailureGate(facts).fired).toBe(true);
  });

  it("doesn't fire when year_5_employee_count is 2 or more", () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: 100000,
        year_3_revenue_usd: 200000,
        year_5_revenue_usd: 400000,
        year_5_employee_count: 2,
      },
    };
    expect(fiveYearHorizonMarginalFailureGate(facts).fired).toBe(false);
  });

  it('null-safe — missing horizon or null employee count returns data_incomplete', () => {
    expect(fiveYearHorizonMarginalFailureGate(baseFacts())).toEqual({
      fired: false,
      reason: 'data_incomplete',
    });
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: 1,
        year_3_revenue_usd: 1,
        year_5_revenue_usd: 1,
        year_5_employee_count: null,
      },
    };
    expect(fiveYearHorizonMarginalFailureGate(facts)).toEqual({
      fired: false,
      reason: 'data_incomplete',
    });
  });
});

describe('fiveYearHorizonVsBusinessPlanDriftGate', () => {
  it('fires when year-5 revenue diverges by more than 25% across the two sources', () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: 250000,
        year_3_revenue_usd: 600000,
        year_5_revenue_usd: 1000000,
        year_5_employee_count: 5,
      },
    };
    facts.business_plan_phase9 = {
      five_year_horizon: {
        year_1_revenue_usd: 250000,
        year_3_revenue_usd: 600000,
        year_5_revenue_usd: 2000000,
        year_5_employee_count: 5,
      },
    };
    const out = fiveYearHorizonVsBusinessPlanDriftGate(facts);
    expect(out.fired).toBe(true);
    if (out.fired) {
      expect(out.severity).toBe(4);
      expect(out.authority).toContain('Matter of Ho');
      expect(out.finding).toContain('year-5 revenue');
    }
  });

  it("doesn't fire when year-5 revenue and headcount are within tolerance", () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: 1000000,
        year_5_employee_count: 6,
      },
    };
    facts.business_plan_phase9 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: 1100000, // 10% drift, under 25% threshold
        year_5_employee_count: 8, // 25% drift, under 50% threshold
      },
    };
    expect(fiveYearHorizonVsBusinessPlanDriftGate(facts).fired).toBe(false);
  });

  it('null-safe — either side absent returns data_incomplete', () => {
    expect(fiveYearHorizonVsBusinessPlanDriftGate(baseFacts())).toEqual({
      fired: false,
      reason: 'data_incomplete',
    });
    const onlyCover = baseFacts();
    onlyCover.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: 0,
        year_3_revenue_usd: 0,
        year_5_revenue_usd: 1000000,
        year_5_employee_count: 5,
      },
    };
    expect(fiveYearHorizonVsBusinessPlanDriftGate(onlyCover)).toEqual({
      fired: false,
      reason: 'data_incomplete',
    });
    const bothPresentBothNumbersNull = baseFacts();
    bothPresentBothNumbersNull.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: null,
        year_5_employee_count: null,
      },
    };
    bothPresentBothNumbersNull.business_plan_phase9 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: null,
        year_5_employee_count: null,
      },
    };
    expect(fiveYearHorizonVsBusinessPlanDriftGate(bothPresentBothNumbersNull)).toEqual({
      fired: false,
      reason: 'data_incomplete',
    });
  });

  it('threshold edge — exactly 25% revenue drift does NOT fire; just over does', () => {
    const facts = baseFacts();
    facts.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: 800000,
        year_5_employee_count: null,
      },
    };
    facts.business_plan_phase9 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        // |800k - 1.0M| / 1.0M = 0.20, well under 0.25 → no fire.
        year_5_revenue_usd: 1000000,
        year_5_employee_count: null,
      },
    };
    expect(fiveYearHorizonVsBusinessPlanDriftGate(facts).fired).toBe(false);

    // Bump business plan to 1.07M → drift = (1.07M - 800k) / 1.07M ≈ 0.252
    facts.business_plan_phase9.five_year_horizon!.year_5_revenue_usd = 1070000;
    expect(fiveYearHorizonVsBusinessPlanDriftGate(facts).fired).toBe(true);

    // Employee-only path: 50% drift exactly does not fire; 51% does.
    const facts2 = baseFacts();
    facts2.cover_letter_phase7 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: null,
        year_5_employee_count: 4,
      },
    };
    facts2.business_plan_phase9 = {
      five_year_horizon: {
        year_1_revenue_usd: null,
        year_3_revenue_usd: null,
        year_5_revenue_usd: null,
        // |4 - 8| / 8 = 0.5 — exactly 50%, does NOT exceed threshold.
        year_5_employee_count: 8,
      },
    };
    expect(fiveYearHorizonVsBusinessPlanDriftGate(facts2).fired).toBe(false);
    facts2.business_plan_phase9.five_year_horizon!.year_5_employee_count = 9;
    // |4 - 9| / 9 ≈ 0.555 → fire.
    expect(fiveYearHorizonVsBusinessPlanDriftGate(facts2).fired).toBe(true);
  });
});
