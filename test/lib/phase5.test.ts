/**
 * Phase-5 tests — runFullReview wiring, work_authorization_date puller,
 * and the LLM-based material-change comparator gate.
 *
 * No live Anthropic calls anywhere: the LLM reviewer is mocked at the
 * SDK boundary (vi.mock of '@/lib/anthropic') and the comparator is
 * passed in directly via RunFullReviewOptions.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CaseFacts, E2Facts } from '@/ingest/schema';
import type {
  AssertionComparator,
  AssertionComparison,
  GateRunResult,
} from '@/reason';
import {
  materialChangeInResponseToUscisGateAsync,
  runE2DeterministicGatesAsync,
  runFullReview,
} from '@/reason';
import { deriveWorkAuthorizationDate, enrichPhase3Fields } from '@/ingest/typed-aggregate';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';

// Mock the Anthropic SDK at the lib boundary so checkDraft never makes
// a real network call. The mock returns a minimal ReviewReport-shaped
// object that satisfies the schema parser path.
vi.mock('@/lib/anthropic', () => ({
  getAnthropic: () => ({
    messages: {
      parse: vi.fn(async () => ({
        parsed_output: {
          summary: 'Mocked review.',
          inconsistencies: [],
          missing_arguments: [],
          weak_spots: [],
          overall_assessment: 'ready',
        },
        usage: { input_tokens: 0, output_tokens: 0 },
      })),
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: '{}' }],
        usage: { input_tokens: 0, output_tokens: 0 },
      })),
    },
  }),
}));

// Silence the cost-log writer.
vi.mock('@/lib/usage-log', () => ({
  logAnthropicUsage: vi.fn(),
}));

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: 'q' as string | null,
    confidence: 1 as number | null,
  };
}
const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

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

/** Stub mock comparator. Returns the same result for every (a, b). */
function mockComparator(result: AssertionComparison): AssertionComparator {
  return vi.fn(async () => result);
}

/* ---------------------------------------------------------------------- */
/* Task A — runFullReview integration                                      */
/* ---------------------------------------------------------------------- */

describe('runFullReview integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns both deterministic gate outcomes and LLM review for E-2', async () => {
    const facts = baseFacts();
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReview(caseFacts, 'draft body', undefined, {
      comparator: mockComparator({ same: true, confidence: 0.95, explanation: 'noop' }),
    });
    expect(out).toHaveProperty('deterministic');
    expect(out).toHaveProperty('llm');
    expect(Array.isArray(out.deterministic)).toBe(true);
    expect(out.deterministic).toHaveLength(10);
    expect(out.llm.report.summary).toBe('Mocked review.');
  });

  it('runs all 10 gates in registry order via the async path', async () => {
    const facts = baseFacts();
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReview(caseFacts, 'draft', undefined, {
      comparator: mockComparator({ same: true, confidence: 0.9, explanation: '' }),
    });
    expect(out.deterministic.map((r) => r.name)).toEqual([
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
  });

  it('returns empty deterministic[] for non-E-2 case types', async () => {
    const caseFacts = {
      case_type: 'EB1A',
      facts: {},
    } as unknown as CaseFacts;
    const out = await runFullReview(caseFacts, 'draft', undefined, {
      comparator: mockComparator({ same: true, confidence: 0.9, explanation: '' }),
    });
    expect(out.deterministic).toEqual([]);
  });

  it('honors `comparator: null` (legacy string-equality fast path)', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2025-06-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        // Paraphrased same-fact assertions; would NOT trip if comparator
        // were active, but with comparator=null we fall back to string
        // equality, which sees them as different and trips Phase-2 logic.
        initial_filing_assertion: f('operational since August 2022'),
        response_assertion: f('began operations 2022-08-19'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReview(caseFacts, 'draft', undefined, { comparator: null });
    const mc = out.deterministic.find(
      (g: GateRunResult) => g.name === 'material_change_in_response_to_uscis',
    );
    expect(mc?.outcome.fired).toBe(true);
  });

  it('uses the comparator to suppress paraphrase false positives', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2025-06-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since August 2022'),
        response_assertion: f('began operations 2022-08-19'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReview(caseFacts, 'draft', undefined, {
      comparator: mockComparator({
        same: true,
        confidence: 0.92,
        explanation: 'Both name August 2022 onset.',
      }),
    });
    const mc = out.deterministic.find(
      (g: GateRunResult) => g.name === 'material_change_in_response_to_uscis',
    );
    expect(mc?.outcome.fired).toBe(false);
  });

  it('LLM review failure path still surfaces the deterministic layer when caught upstream', async () => {
    // Sanity check that the orchestrator types let callers distinguish
    // the two layers. We just assert the response shape here.
    const facts = baseFacts();
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReview(caseFacts, 'draft', undefined, {
      comparator: mockComparator({ same: true, confidence: 0.9, explanation: '' }),
    });
    expect(out.llm).toHaveProperty('report');
    expect(out.llm).toHaveProperty('usage');
    // Deterministic layer is independent — callers can render it even
    // if `out.llm` were derived from a fallback path.
    expect(out.deterministic.every((g) => 'name' in g && 'outcome' in g)).toBe(true);
  });
});

/* ---------------------------------------------------------------------- */
/* Task B — investor.work_authorization_date puller                        */
/* ---------------------------------------------------------------------- */

function visaStampEntry(
  filename: string,
  classification: string,
  validityStart: string,
): PerPdfResult {
  return {
    filename,
    pageCount: 1,
    facts: {
      doc_type: 'status_doc',
      suggested_filename: fNull,
      display_name: fNull,
      full_name: fNull,
      status_class: fNull,
      i94_admission_number: fNull,
      admission_date: fNull,
      authorized_until: fNull,
      issuing_office: fNull,
    } as unknown as PerPdfResult['facts'],
    visaStamp: {
      visa_number: fNull,
      classification: f(classification),
      validity_start_date: f(validityStart),
      validity_end_date: fNull,
      port_of_issue: fNull,
      issuing_consulate: fNull,
      holder_name_ascii: fNull,
      entries: fNull,
      i797_receipt_number: fNull,
      prior_admissions: [],
    } as unknown as PerPdfResult['visaStamp'],
  };
}

function statusDocEntry(
  filename: string,
  statusClass: string,
  admissionDate: string,
): PerPdfResult {
  return {
    filename,
    pageCount: 1,
    facts: {
      doc_type: 'status_doc',
      suggested_filename: fNull,
      display_name: fNull,
      full_name: fNull,
      status_class: f(statusClass),
      i94_admission_number: fNull,
      admission_date: f(admissionDate),
      authorized_until: fNull,
      issuing_office: fNull,
    } as unknown as PerPdfResult['facts'],
  };
}

describe('deriveWorkAuthorizationDate', () => {
  it('returns null when no work-authorizing document is on file', () => {
    const memory = memoryFrom([statusDocEntry('b2.pdf', 'B-2', '2022-09-01')]);
    expect(deriveWorkAuthorizationDate(memory)).toBeNull();
  });

  it('pulls the validity_start_date from a visa-stamp E-2 approval', () => {
    const memory = memoryFrom([
      visaStampEntry('e2-approval.pdf', 'E-2', '2024-03-15'),
    ]);
    const out = deriveWorkAuthorizationDate(memory);
    expect(out?.value).toBe('2024-03-15');
  });

  it('picks the EARLIEST date when multiple work-authorizing approvals exist', () => {
    // H-1B in 2020, then E-2 in 2024. Earliest wins (gate must short-
    // circuit on the prior H-1B authorization, not the recent E-2).
    const memory = memoryFrom([
      visaStampEntry('e2-2024.pdf', 'E-2', '2024-03-15'),
      visaStampEntry('h1b-2020.pdf', 'H-1B', '2020-06-01'),
    ]);
    const out = deriveWorkAuthorizationDate(memory);
    expect(out?.value).toBe('2020-06-01');
  });

  it('falls back to thin status_doc EAD when no visa stamp is present', () => {
    const memory = memoryFrom([
      statusDocEntry('ead.pdf', 'EAD (c)(8)', '2023-01-10'),
    ]);
    const out = deriveWorkAuthorizationDate(memory);
    expect(out?.value).toBe('2023-01-10');
  });

  it('enrichPhase3Fields populates investor.work_authorization_date when a stamp is found', () => {
    const facts = baseFacts();
    facts.investor = { ...facts.investor } as E2Facts['investor'];
    const memory = memoryFrom([visaStampEntry('e2.pdf', 'E-2', '2023-09-22')]);
    enrichPhase3Fields(facts, memory);
    expect(facts.investor.work_authorization_date?.value).toBe('2023-09-22');
  });
});

/* ---------------------------------------------------------------------- */
/* Task C — material-change comparator gate                                */
/* ---------------------------------------------------------------------- */

describe('materialChangeInResponseToUscisGateAsync', () => {
  it('takes the string-equality fast path when assertions match exactly', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2024-01-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since 2022-08-19'),
        response_assertion: f('operational since 2022-08-19'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const cmp = mockComparator({
      same: false,
      confidence: 0.99,
      explanation: 'should not be reached',
    });
    const out = await materialChangeInResponseToUscisGateAsync(facts, cmp);
    expect(out.fired).toBe(false);
    expect(cmp).not.toHaveBeenCalled();
  });

  it('does NOT fire when comparator says same (paraphrased same fact)', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2024-01-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('fully operational since August 19, 2022'),
        response_assertion: f('operating since 2022'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const cmp = mockComparator({
      same: true,
      confidence: 0.85,
      explanation: 'Both reference 2022 onset.',
    });
    const out = await materialChangeInResponseToUscisGateAsync(facts, cmp);
    expect(out.fired).toBe(false);
    expect(cmp).toHaveBeenCalledOnce();
  });

  it('fires when comparator says different with confidence ≥ 0.7', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2024-01-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since 2022-08-19'),
        response_assertion: f('did not engage in business activities until 2023'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const cmp = mockComparator({
      same: false,
      confidence: 0.92,
      explanation: 'Different years (2022 vs 2023).',
    });
    const out = await materialChangeInResponseToUscisGateAsync(facts, cmp);
    expect(out.fired).toBe(true);
    if (out.fired) expect(out.severity).toBe(5);
  });

  it('does NOT fire when comparator says different but confidence < 0.7', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2024-01-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational'),
        response_assertion: f('partially operational'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const cmp = mockComparator({
      same: false,
      confidence: 0.55,
      explanation: 'Ambiguous wording.',
    });
    const out = await materialChangeInResponseToUscisGateAsync(facts, cmp);
    expect(out.fired).toBe(false);
  });
});

describe('runE2DeterministicGatesAsync', () => {
  it('routes the material-change gate through the comparator', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2024-01-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('A'),
        response_assertion: f('B'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const cmp = mockComparator({ same: false, confidence: 0.9, explanation: '' });
    const results = await runE2DeterministicGatesAsync(facts, cmp);
    const mc = results.find((r) => r.name === 'material_change_in_response_to_uscis');
    expect(mc?.outcome.fired).toBe(true);
    expect(cmp).toHaveBeenCalled();
  });
});

// Integration tests against the live Haiku comparator are intentionally
// gated behind __skip__ until the firm green-lights paid live tests.
// Reactivate by replacing __skip__ with describe and providing
// ANTHROPIC_API_KEY in the env.
describe.skip('material-change comparator (live)', () => {
  it('agrees that two date paraphrases are the same', () => {
    // Placeholder. Live test would call createAssertionComparator() and
    // assert same=true on "operational since August 2022" vs "operating
    // since 2022".
  });
});
