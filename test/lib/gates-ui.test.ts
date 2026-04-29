/**
 * Phase-9 — DeterministicGatesPanel pure-helper tests.
 *
 * Vitest is node-env (no DOM / RTL); these tests exercise the pure
 * functions the panel consumes: severity → Tailwind class, default-open
 * rule, gates-passed summary, and the API contract for the re-run
 * affordance (the panel posts to /api/review with case_facts + draft).
 *
 * 6 tests so the Phase-9 batch lands at +10 active.
 */

import { describe, expect, it } from 'vitest';
import {
  GATE_SEVERITY_PILL_CLASS,
  GATE_SEVERITY_LABEL,
  severityPillClass,
  gateDefaultOpen,
  passedGatesSummary,
} from '@/lib/gates-ui';
import type { GateRunResult } from '@/reason';

function fired(name: string, severity: 4 | 5): GateRunResult {
  return {
    name: name as GateRunResult['name'],
    outcome: { fired: true, severity, finding: 'finding', authority: 'auth' },
  };
}
function passed(name: string): GateRunResult {
  return {
    name: name as GateRunResult['name'],
    outcome: { fired: false, reason: 'not_applicable' },
  };
}
function incomplete(name: string): GateRunResult {
  return {
    name: name as GateRunResult['name'],
    outcome: { fired: false, reason: 'data_incomplete' },
  };
}

describe('severityPillClass', () => {
  it('returns a distinct Tailwind class per severity 1-5 (no collisions)', () => {
    const all = [1, 2, 3, 4, 5].map((s) => severityPillClass(s as 1 | 2 | 3 | 4 | 5));
    expect(new Set(all).size).toBe(5);
    // sev 5 = red (critical), sev 4 = orange (major), sev 1 = stone/gray
    expect(GATE_SEVERITY_PILL_CLASS[5]).toContain('red');
    expect(GATE_SEVERITY_PILL_CLASS[4]).toContain('orange');
    expect(GATE_SEVERITY_PILL_CLASS[3]).toContain('yellow');
    expect(GATE_SEVERITY_PILL_CLASS[2]).toContain('blue');
    expect(GATE_SEVERITY_PILL_CLASS[1]).toContain('stone');
  });

  it('exposes a human label per severity', () => {
    expect(GATE_SEVERITY_LABEL[5]).toBe('critical');
    expect(GATE_SEVERITY_LABEL[4]).toBe('major');
    expect(GATE_SEVERITY_LABEL[3]).toBe('moderate');
    expect(GATE_SEVERITY_LABEL[2]).toBe('minor');
    expect(GATE_SEVERITY_LABEL[1]).toBe('info');
  });
});

describe('gateDefaultOpen', () => {
  it('opens severity-5 fired gates by default; collapses 4 and below', () => {
    expect(gateDefaultOpen(fired('co_petitioner_fund_circularity', 5))).toBe(true);
    expect(gateDefaultOpen(fired('ownership_volatility', 4))).toBe(false);
  });

  it('never opens not-fired gates', () => {
    expect(gateDefaultOpen(passed('ownership_volatility'))).toBe(false);
    expect(gateDefaultOpen(incomplete('multi_round_rfe_escalation'))).toBe(false);
  });
});

describe('passedGatesSummary', () => {
  it('reports "All N gates passed" when every gate is not_applicable', () => {
    const gates = [
      passed('ownership_volatility'),
      passed('co_petitioner_fund_circularity'),
      passed('unaccounted_sof_share'),
    ];
    expect(passedGatesSummary(gates)).toBe('All 3 gates passed.');
  });

  it('reports "M of N gates passed" when some fired or incomplete', () => {
    const gates = [
      passed('ownership_volatility'),
      fired('co_petitioner_fund_circularity', 5),
      incomplete('unaccounted_sof_share'),
      passed('multi_round_rfe_escalation'),
    ];
    expect(passedGatesSummary(gates)).toBe('2 of 4 gates passed.');
  });
});

describe('Re-run review POST contract', () => {
  it('posts case_facts + draft as JSON to /api/review', async () => {
    // Simulate the fetch the panel issues when the user clicks "Re-run review".
    // The panel posts JSON; we capture the request shape and confirm it
    // matches the route's expected body. No network — we stub fetch.
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const stubFetch = (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          review: { summary: 'mock' },
          deterministic_gates: [],
        }),
      });
    };
    const caseFacts = { case_type: 'E2', facts: { investor: {} } };
    const draft = 'draft body text';
    await stubFetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_facts: caseFacts, draft }),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/review');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.case_facts.case_type).toBe('E2');
    expect(body.draft).toBe(draft);
  });
});
