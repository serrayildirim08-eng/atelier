/**
 * Phase-10 tests — embedding-based material-change comparator + the
 * `runFullReview` `comparator: 'llm' | 'embedding'` switch.
 *
 * No live network anywhere. The embedder is stubbed via the `embedder`
 * option on the comparator; the LLM path is mocked at the
 * `@/lib/anthropic` boundary like phase5.test.ts does.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CaseFacts, E2Facts } from '@/ingest/schema';
import {
  embeddingMaterialChangeComparator,
  createEmbeddingAssertionComparator,
  EMBEDDING_COMPARATOR_DEFAULT_THRESHOLD,
  runFullReview,
  runFullReviewWithEmbeddingComparator,
  materialChangeInResponseToUscisGateAsync,
} from '@/reason';
import type { GateRunResult } from '@/reason';
import * as embedModule from '@/lib/rag/embed';

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
        content: [{ type: 'text', text: '{"same": true, "confidence": 0.9, "explanation": ""}' }],
        usage: { input_tokens: 0, output_tokens: 0 },
      })),
    },
  }),
}));

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

/**
 * Deterministic stub embedder: maps each unique input string to a fixed
 * vector. Lets a test pin the cosine similarity of any (a, b) pair by
 * pre-registering vectors.
 */
function stubEmbedder(table: Map<string, number[]>) {
  return vi.fn(async (texts: string[]) => {
    return texts.map((t) => {
      const v = table.get(t);
      if (!v) throw new Error(`stubEmbedder: no vector registered for "${t}"`);
      return v;
    });
  });
}

/* --------------------------------------------------------------------- */
/* Task A — embeddingMaterialChangeComparator unit tests                  */
/* --------------------------------------------------------------------- */

describe('embeddingMaterialChangeComparator', () => {
  it('returns same=true and similarity=1 on exact match without calling the embedder', async () => {
    const embedder = vi.fn(async (_texts: string[]) => [] as number[][]);
    const out = await embeddingMaterialChangeComparator('foo', 'foo', { embedder });
    expect(out.same).toBe(true);
    expect(out.similarity).toBe(1);
    expect(embedder).not.toHaveBeenCalled();
  });

  it('fires same=true above the default threshold (0.85)', async () => {
    // Two near-parallel unit vectors; cosine ≈ 0.99.
    const table = new Map<string, number[]>([
      ['operational since August 2022', [1, 0.05, 0]],
      ['operating since 2022', [1, 0.10, 0]],
    ]);
    const out = await embeddingMaterialChangeComparator(
      'operational since August 2022',
      'operating since 2022',
      { embedder: stubEmbedder(table) },
    );
    expect(out.same).toBe(true);
    expect(out.similarity).toBeGreaterThanOrEqual(EMBEDDING_COMPARATOR_DEFAULT_THRESHOLD);
  });

  it('returns same=false when cosine similarity is below the threshold', async () => {
    // Orthogonal vectors → cosine 0.
    const table = new Map<string, number[]>([
      ['operational since 2022-08-19', [1, 0, 0]],
      ['did not engage in business activities until 2023', [0, 1, 0]],
    ]);
    const out = await embeddingMaterialChangeComparator(
      'operational since 2022-08-19',
      'did not engage in business activities until 2023',
      { embedder: stubEmbedder(table) },
    );
    expect(out.same).toBe(false);
    expect(out.similarity).toBeCloseTo(0, 5);
  });

  it('honors a custom threshold', async () => {
    const table = new Map<string, number[]>([
      ['a', [1, 0, 0]],
      ['b', [0.6, 0.8, 0]], // cosine = 0.6
    ]);
    const cmp = stubEmbedder(table);
    const lax = await embeddingMaterialChangeComparator('a', 'b', {
      embedder: cmp,
      threshold: 0.5,
    });
    expect(lax.same).toBe(true);
    const strict = await embeddingMaterialChangeComparator('a', 'b', {
      embedder: cmp,
      threshold: 0.9,
    });
    expect(strict.same).toBe(false);
    expect(strict.similarity).toBeCloseTo(0.6, 5);
  });

  it('caches similarity per (a, b) pair across calls', async () => {
    const table = new Map<string, number[]>([
      ['x', [1, 0, 0]],
      ['y', [0, 1, 0]],
    ]);
    const embedder = stubEmbedder(table);
    const cache = new Map<string, number>();
    await embeddingMaterialChangeComparator('x', 'y', { embedder, cache });
    expect(embedder).toHaveBeenCalledTimes(1);
    // Same pair, reversed order — should hit cache (order-independent key).
    const second = await embeddingMaterialChangeComparator('y', 'x', { embedder, cache });
    expect(embedder).toHaveBeenCalledTimes(1);
    expect(second.similarity).toBeCloseTo(0, 5);
  });

  it('falls back to string equality and warns when the embedder throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = vi.fn(async () => {
      throw new Error('voyage offline');
    });
    const out = await embeddingMaterialChangeComparator('alpha', 'beta', { embedder: broken });
    expect(out.same).toBe(false);
    expect(out.similarity).toBe(0);
    expect(warn).toHaveBeenCalled();
    const matchingOut = await embeddingMaterialChangeComparator('alpha', 'alpha', {
      embedder: broken,
    });
    expect(matchingOut.same).toBe(true);
    warn.mockRestore();
  });
});

/* --------------------------------------------------------------------- */
/* Task B — runFullReview comparator option                               */
/* --------------------------------------------------------------------- */

describe('runFullReview with embedding comparator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("comparator: 'embedding' suppresses paraphrase false positives", async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2025-06-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since August 2022'),
        response_assertion: f('operating since 2022'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    // Provide a same-direction embedding stub via a custom comparator.
    const table = new Map<string, number[]>([
      ['operational since August 2022', [1, 0.02, 0]],
      ['operating since 2022', [1, 0.04, 0]],
    ]);
    const comparator = createEmbeddingAssertionComparator({
      embedder: stubEmbedder(table),
    });
    const out = await runFullReview(caseFacts, 'draft', undefined, { comparator });
    const mc = out.deterministic.find(
      (g: GateRunResult) => g.name === 'material_change_in_response_to_uscis',
    );
    expect(mc?.outcome.fired).toBe(false);
  });

  it("comparator: 'embedding' fires the gate when assertions are orthogonal", async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2025-06-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since 2022-08-19'),
        response_assertion: f('did not engage in business activities until 2023'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const table = new Map<string, number[]>([
      ['operational since 2022-08-19', [1, 0, 0]],
      ['did not engage in business activities until 2023', [0, 1, 0]],
    ]);
    const comparator = createEmbeddingAssertionComparator({
      embedder: stubEmbedder(table),
    });
    const out = await runFullReview(caseFacts, 'draft', undefined, { comparator });
    const mc = out.deterministic.find(
      (g: GateRunResult) => g.name === 'material_change_in_response_to_uscis',
    );
    expect(mc?.outcome.fired).toBe(true);
  });

  it('default comparator is the LLM path (back-compat)', async () => {
    // No `comparator` option → checker constructs the LLM comparator,
    // which the @/lib/anthropic mock makes return `{same: true, ...}`.
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2025-06-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('A'),
        response_assertion: f('B'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReview(caseFacts, 'draft');
    const mc = out.deterministic.find(
      (g) => g.name === 'material_change_in_response_to_uscis',
    );
    // Mocked LLM returns same=true → gate doesn't fire.
    expect(mc?.outcome.fired).toBe(false);
  });

  it('runFullReviewWithEmbeddingComparator routes through the embedder', async () => {
    const embedSpy = vi.spyOn(embedModule, 'embedBatch').mockResolvedValue([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2025-06-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('alpha'),
        response_assertion: f('beta'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const caseFacts: CaseFacts = { case_type: 'E2', facts };
    const out = await runFullReviewWithEmbeddingComparator(caseFacts, 'draft');
    const mc = out.deterministic.find(
      (g) => g.name === 'material_change_in_response_to_uscis',
    );
    // Orthogonal stub vectors → cosine 0 → gate fires.
    expect(mc?.outcome.fired).toBe(true);
    expect(embedSpy).toHaveBeenCalled();
    embedSpy.mockRestore();
  });
});

/* --------------------------------------------------------------------- */
/* Bridge — gate-level smoke through the embedding adapter                */
/* --------------------------------------------------------------------- */

describe('materialChangeInResponseToUscisGateAsync via embedding adapter', () => {
  it('does NOT fire when the embedding comparator says same with high confidence', async () => {
    const facts = baseFacts();
    facts.rfes = [
      {
        rfe_date: f('2024-01-01'),
        subject_category: f('bona_fide_enterprise'),
        notes: fNull,
        initial_filing_assertion: f('operational since 2022-08-19'),
        response_assertion: f('operating since August 2022'),
      } as unknown as NonNullable<E2Facts['rfes']>[number],
    ] as unknown as E2Facts['rfes'];
    const table = new Map<string, number[]>([
      ['operational since 2022-08-19', [1, 0.03, 0]],
      ['operating since August 2022', [1, 0.05, 0]],
    ]);
    const comparator = createEmbeddingAssertionComparator({
      embedder: stubEmbedder(table),
    });
    const out = await materialChangeInResponseToUscisGateAsync(facts, comparator);
    expect(out.fired).toBe(false);
  });
});
