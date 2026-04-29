/**
 * Phase-0.7 typed-aggregate emission test.
 *
 * Acceptance lock from REFACTOR-NOTES-2026-04-29.md TODO list:
 *   "the typed-aggregate extractor doesn't yet emit the new optional
 *    gate inputs — the gates will run on `data_incomplete` until the
 *    extractor learns to populate `matter.co_petitioners`,
 *    `ownership_history`, `rfes`, etc."
 *
 * Phase-3 / Phase-4 / Phase-5 / Phase-6 / Phase-7 / Phase-8 / Phase-9
 * enrichers in `ingest/typed-aggregate.ts` close that loop. This test
 * does NOT re-validate every enricher (those have their own per-phase
 * suites at test/ingest/phase{3,4,6,7,8}-enrichment.test.ts); it asserts
 * the END-STATE contract: a populated E2Facts payload that mirrors what
 * a real E-2 case folder produces after the full enrichment chain MUST
 * NOT cause the deterministic gates to return `data_incomplete` on the
 * inputs the Phase-0.7 brief enumerated.
 *
 * Concretely:
 *   - matter.co_petitioners populated → co_petitioner_fund_circularity
 *     resolves to 'fired' or 'not_applicable' (not data_incomplete).
 *   - ownership_history populated + filed_date_i129 populated →
 *     ownership_volatility resolves to fired / not_applicable.
 *   - rfes[] populated with subject_category + assertions →
 *     multi_round_rfe_escalation + material_change_in_response_to_uscis
 *     resolve.
 *   - investment.claimed_amount_usd + source_of_funds[].documented_amount_usd
 *     populated → unaccounted_sof_share resolves.
 *   - investor.current_status / prior_status_expiration_date /
 *     work_authorization_date + enterprise.fully_operational_since_date
 *     populated → b2_status_violation_signal + status_gap_pre_filing
 *     resolve.
 */

import { describe, expect, it } from 'vitest';
import {
  ownershipVolatilityGate,
  coPetitionerFundCircularityGate,
  unaccountedSofShareGate,
  multiRoundRfeEscalationGate,
  b2StatusViolationSignalGate,
  statusGapPreFilingGate,
  materialChangeInResponseToUscisGate,
  runE2DeterministicGates,
} from '@/reason/checker';
import type { E2Facts } from '@/ingest/schema';

/* ---------------------------------------------------------------------- */
/* Fixture helpers                                                        */
/* ---------------------------------------------------------------------- */

function f<T>(
  value: T | null,
  source_page: number | null = 1,
  source_quote: string | null = 'q',
  confidence: number | null = 0.95,
) {
  return { value, source_page, source_quote, confidence };
}

const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

/**
 * Returns a doctrinally-shaped E2Facts payload mimicking what
 * `enrichPhase3Fields` + downstream phases produce for a real Subtype 1
 * case (Kacar-shape). Every Phase-0.7 optional field the brief
 * enumerated is populated. The resulting object is intentionally
 * benign — gates should land on `not_applicable` or fire on real
 * thresholds, but NOT on `data_incomplete`.
 */
function fullyEnrichedKacarShape(): E2Facts {
  return {
    investor: {
      full_name: f('Salih Kacar'),
      dob: f('1980-05-12'),
      place_of_birth: f('Istanbul, Turkey'),
      nationality: f('Turkey'),
      passport_number: f('U12345678'),
      passport_expiry: f('2029-08-15'),
      current_us_status: f('E-2'),
      // Phase-0.7+ optional gate inputs — POPULATED.
      current_status: f('E-2'),
      prior_status_expiration_date: f('2024-08-31'),
      work_authorization_date: f('2023-09-15'),
    },
    enterprise: {
      legal_name: f('Akalan LLC'),
      ein: f('98-7654321'),
      formation_date: f('2023-04-01'),
      state_of_formation: f('FL'),
      entity_type: f('LLC'),
      industry: f('Hospitality'),
      naics_code: f('721110'),
      physical_address: f('123 Ocean Dr, Miami, FL 33101'),
      // Phase-0.7+ optional gate inputs — POPULATED.
      fully_operational_since_date: f('2023-10-01'),
      claimed_business_model: f('Boutique hospitality and short-stay rental'),
      observed_business_model: f('Boutique hospitality and short-stay rental'),
    },
    ownership_chain: [
      {
        owner_name: f('Salih Kacar'),
        ownership_percent: f(50),
        nationality: f('Turkey'),
        direct_or_indirect: f('direct'),
      },
      {
        owner_name: f('Demir Akalan'),
        ownership_percent: f(50),
        nationality: f('Turkey'),
        direct_or_indirect: f('direct'),
      },
    ],
    investment: {
      total_committed_usd: f(240000),
      total_spent_usd: f(196000),
      total_cost_of_enterprise_usd: f(240000),
      proportionality_percent: f(81),
      items: [],
      // Phase-0.7+ optional gate input — POPULATED.
      claimed_amount_usd: f(240000),
    },
    source_of_funds: [
      {
        origin_category: f('property_sale'),
        origin_amount_usd: f(120000),
        origin_evidence: f('Tapu / Title Deed'),
        final_destination: f('Akalan LLC operating account'),
        notes: f('Personal property sale in Istanbul; full chain documented.'),
        // Phase-0.7+ optional gate inputs — POPULATED.
        documented_amount_usd: f(120000),
        source_person: { full_name: f('Salih Kacar') },
      },
      {
        origin_category: f('savings'),
        origin_amount_usd: f(120000),
        origin_evidence: f('Personal Turkish bank statements (2 yr)'),
        final_destination: f('Akalan LLC operating account'),
        notes: f('Beneficiary personal savings.'),
        documented_amount_usd: f(120000),
        source_person: { full_name: f('Salih Kacar') },
      },
    ],
    elements_evidence: {
      treaty_country_basis: f('Turkey-US E-2 treaty.'),
      substantial_investment_basis: f('Proportionality 81% per investment table.'),
      real_and_operating_basis: f('Hospitality LLC operational since Oct 2023.'),
      more_than_marginal_basis: f('5-year revenue projection $1.5M, 12 employees by year 5.'),
      develop_and_direct_basis: f('Beneficiary 50% member with operational control under Operating Agreement § 4.2.'),
    },
    conflict_register: [],

    // Phase-0.7+ optional top-level fields — POPULATED.
    matter: {
      co_petitioners: [
        {
          full_name: f('Eda Kacar'),
          role: f('Spouse / I-539 derivative'),
          relationship_to_principal: f('spouse'),
          sub_application_status: f('derivative_only'),
        },
      ],
      sub_application_aliases: {},
    },
    ownership_history: [
      {
        effective_date: f('2023-04-01'),
        owner_names: [f('Demir Akalan')],
        source_doc: f('articles-of-organization.pdf'),
      },
      {
        effective_date: f('2023-12-05'),
        owner_names: [f('Salih Kacar'), f('Demir Akalan')],
        source_doc: f('membership-interest-transfer.pdf'),
      },
    ],
    filed_date_i129: f('2024-03-12'),
    rfes: [
      {
        rfe_date: f('2024-06-10'),
        subject_category: f('substantial_investment'),
        notes: f('USCIS requested additional source-of-funds documentation.'),
        initial_filing_assertion: f('Total investment of $240,000 documented.'),
        response_assertion: f('Total investment of $240,000 documented; supplemental wire transfer evidence attached.'),
      },
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Per-gate emission tests                                                */
/* ---------------------------------------------------------------------- */

describe('Phase-0.7 typed-aggregate emission — per-gate inputs are populated', () => {
  it('ownership_volatility does NOT return data_incomplete when ownership_history + filed_date_i129 are populated', () => {
    const facts = fullyEnrichedKacarShape();
    const result = ownershipVolatilityGate(facts);
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });

  it('co_petitioner_fund_circularity does NOT return data_incomplete when matter.co_petitioners + source_person are populated', () => {
    const facts = fullyEnrichedKacarShape();
    const result = coPetitionerFundCircularityGate(facts);
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });

  it('unaccounted_sof_share does NOT return data_incomplete when claimed_amount_usd + documented_amount_usd are populated', () => {
    const facts = fullyEnrichedKacarShape();
    const result = unaccountedSofShareGate(facts);
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });

  it('multi_round_rfe_escalation does NOT return data_incomplete when rfes[] is populated', () => {
    const facts = fullyEnrichedKacarShape();
    const result = multiRoundRfeEscalationGate(facts);
    // With only 1 RFE the gate may legitimately return not_applicable;
    // it must NOT bail out to data_incomplete.
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });

  it('b2_status_violation_signal does NOT return data_incomplete when current_status + work_authorization_date + fully_operational_since_date are populated', () => {
    const facts = fullyEnrichedKacarShape();
    const result = b2StatusViolationSignalGate(facts);
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });

  it('status_gap_pre_filing does NOT return data_incomplete when prior_status_expiration_date + filed_date_i129 are populated', () => {
    const facts = fullyEnrichedKacarShape();
    const result = statusGapPreFilingGate(facts);
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });

  it('material_change_in_response_to_uscis does NOT return data_incomplete when rfes[] carries assertions', () => {
    const facts = fullyEnrichedKacarShape();
    const result = materialChangeInResponseToUscisGate(facts);
    if (!result.fired) {
      expect(result.reason).not.toBe('data_incomplete');
    }
  });
});

/* ---------------------------------------------------------------------- */
/* Suite-level: count data_incomplete gates                               */
/* ---------------------------------------------------------------------- */

describe('Phase-0.7 typed-aggregate emission — suite-level data_incomplete budget', () => {
  it('on a fully populated Kacar-shape fixture, no Phase-0.7-targeted gate returns data_incomplete', () => {
    const facts = fullyEnrichedKacarShape();
    const results = runE2DeterministicGates(facts);

    // The seven Phase-0.7-targeted gates (per REFACTOR-NOTES Phase-3 / Phase-4
    // open list). The three Phase-8 / Phase-9 gates (develop_and_direct_role
    // _authority_thin, five_year_horizon_marginal_failure,
    // five_year_horizon_vs_business_plan_drift) live on cover_letter_phase7
    // / business_plan_phase9 slots which the Kacar fixture does not populate
    // — those legitimately return data_incomplete here and are out of scope
    // for this acceptance test.
    const targeted = new Set([
      'ownership_volatility',
      'co_petitioner_fund_circularity',
      'unaccounted_sof_share',
      'multi_round_rfe_escalation',
      'b2_status_violation_signal',
      'status_gap_pre_filing',
      'material_change_in_response_to_uscis',
    ]);

    const targetedDataIncomplete = results.filter(
      (r) =>
        targeted.has(r.name) &&
        !r.outcome.fired &&
        r.outcome.reason === 'data_incomplete',
    );

    if (targetedDataIncomplete.length > 0) {
      const names = targetedDataIncomplete.map((r) => r.name).join(', ');
      throw new Error(
        `Phase-0.7 emission regression: ${targetedDataIncomplete.length} targeted gate(s) returned data_incomplete on a fully populated fixture: ${names}`,
      );
    }
    expect(targetedDataIncomplete.length).toBe(0);
  });
});
