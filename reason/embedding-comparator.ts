/**
 * Embedding-based comparator for `material_change_in_response_to_uscis`.
 *
 * Phase-10 alternative to the LLM (Haiku) comparator in
 * `material-change-comparator.ts`. Uses the same embedder the RAG layer
 * uses (`lib/rag/embed.ts` — OpenAI text-embedding-3-large @1024d when
 * OPENAI_API_KEY is set, local bge-small @384d otherwise) so we don't
 * bring in a second embedding stack. Cosine similarity ≥ threshold ⇒
 * `same`. Default threshold 0.85: empirical RAG retrieval sweet spot
 * for "semantically equivalent" pairs is 0.85–0.92 depending on the
 * model; we pick the conservative end so paraphrases co-fire with the
 * Izummi gate but materially-different assertions still trip it.
 *
 * Failure-tolerant: any embedder throw degrades to string equality and
 * a logged warning, mirroring the `lib/rag/retrieve.ts` posture (RAG
 * silently returns `[]` on index miss; we silently fall back here).
 */
import { embedBatch, normalize } from '@/lib/rag/embed';
import type {
  AssertionComparator,
  AssertionComparison,
} from './material-change-comparator';

export interface EmbeddingComparatorOptions {
  /** Override the embedder. Tests pass a stub. */
  embedder?: EmbedFn;
  /** Cosine-similarity gate. Default 0.85. */
  threshold?: number;
  /** Per-request similarity cache. Caller owns the lifetime. */
  cache?: Map<string, number>;
}

export interface EmbeddingComparison {
  same: boolean;
  similarity: number;
}

/**
 * Embedder shape the comparator depends on. Matches the contract of
 * `embedBatch` from `lib/rag/embed.ts`. Lifted as a separate type so
 * tests can substitute a deterministic stub without going through the
 * provider singleton.
 */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export const EMBEDDING_COMPARATOR_DEFAULT_THRESHOLD = 0.85;

function defaultEmbedder(): EmbedFn {
  return (texts) => embedBatch(texts, { inputType: 'query' });
}

function cacheKey(a: string, b: string): string {
  // Order-independent key. Quoted separator avoids the collision class
  // {a="x|y", b="z"} ↔ {a="x", b="y|z"}.
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${JSON.stringify(x)}|${JSON.stringify(y)}`;
}

function cosine(u: number[], v: number[]): number {
  if (u.length !== v.length) return 0;
  let dot = 0;
  for (let i = 0; i < u.length; i++) dot += u[i] * v[i];
  return dot;
}

/**
 * Compare two assertions by cosine similarity of their embeddings.
 * `same = similarity >= threshold`. On embedder failure, falls back to
 * `a === b` and logs a warning. Cache (when supplied) holds the
 * similarity number — `same` is recomputed against the threshold so
 * callers can vary the threshold across calls without polluting the
 * cache.
 */
export async function embeddingMaterialChangeComparator(
  a: string,
  b: string,
  opts: EmbeddingComparatorOptions = {},
): Promise<EmbeddingComparison> {
  const threshold = opts.threshold ?? EMBEDDING_COMPARATOR_DEFAULT_THRESHOLD;
  const cache = opts.cache;
  const key = cacheKey(a, b);

  if (cache) {
    const cached = cache.get(key);
    if (typeof cached === 'number') {
      return { same: cached >= threshold, similarity: cached };
    }
  }

  if (a === b) {
    if (cache) cache.set(key, 1);
    return { same: true, similarity: 1 };
  }

  const embedder = opts.embedder ?? defaultEmbedder();
  let similarity: number;
  try {
    const [va, vb] = await embedder([a, b]);
    if (!va || !vb) throw new Error('embedder returned fewer vectors than inputs');
    similarity = cosine(normalize(va), normalize(vb));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[embedding-comparator] embedder failed (${msg}); falling back to string equality.`,
    );
    const same = a === b;
    return { same, similarity: same ? 1 : 0 };
  }

  if (cache) cache.set(key, similarity);
  return { same: similarity >= threshold, similarity };
}

/**
 * Adapter: lift the embedding comparator into the `AssertionComparator`
 * contract used by `materialChangeInResponseToUscisGateAsync`. The
 * gate's `confidence >= 0.7` threshold consumes the similarity (or
 * 1 - similarity for `same: false`) so the gate's existing semantics
 * stay unchanged when the embedding path replaces the LLM path.
 */
export function createEmbeddingAssertionComparator(
  opts: EmbeddingComparatorOptions = {},
): AssertionComparator {
  // Per-comparator cache: matches createAssertionComparator() lifecycle
  // (one comparator instance per runFullReview call, cache lives for
  // that call's RFE pairs only).
  const cache = opts.cache ?? new Map<string, number>();
  return async function compare(a: string, b: string): Promise<AssertionComparison> {
    const { same, similarity } = await embeddingMaterialChangeComparator(a, b, {
      ...opts,
      cache,
    });
    // Map similarity onto the existing AssertionComparison.confidence
    // contract: confident-same when sim is high, confident-different
    // when sim is low. Mid-band (similarity ~ threshold) → low
    // confidence so the gate's 0.7 floor stays gentle on borderline
    // paraphrases.
    const confidence = same ? similarity : 1 - similarity;
    return {
      same,
      confidence,
      explanation: `embedding cosine ${similarity.toFixed(3)} (threshold ${(opts.threshold ?? EMBEDDING_COMPARATOR_DEFAULT_THRESHOLD).toFixed(2)})`,
    };
  };
}
