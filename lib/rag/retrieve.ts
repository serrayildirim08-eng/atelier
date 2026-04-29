import { embedOne, getEmbedProvider, normalize } from './embed';
import { tryLoadIndex } from './index-store';
import type { RagSearchHit } from './types';

/**
 * Retrieve top-K doctrine chunks for a query string.
 *
 * Returns [] (not an error) when the index has not been built yet —
 * the drafter degrades gracefully to its current "no doctrine context"
 * behavior so the firm can ship a build before the index exists.
 *
 * Source-bias: results are de-duplicated by source so a single fat
 * manual section doesn't crowd out the rest of the corpus. After
 * de-dup we keep the highest-scoring chunk per source, then pick the
 * top-K of the survivors.
 */
export interface RetrieveOptions {
  /** Number of chunks to return. Default 8. */
  k?: number;
  /** Minimum cosine similarity. Default 0.30 — below this, doctrine is too far afield to help. */
  minScore?: number;
  /** Whether to dedupe by source (one chunk per source file). Default true. */
  dedupeBySource?: boolean;
  /** Index path override (mostly for tests). */
  indexPath?: string;
}

export async function retrieveDoctrine(
  query: string,
  options: RetrieveOptions = {},
): Promise<RagSearchHit[]> {
  const k = options.k ?? 8;
  const minScore = options.minScore ?? 0.3;
  const dedupeBySource = options.dedupeBySource ?? true;

  const index = await tryLoadIndex(options.indexPath);
  if (!index) return [];

  // Dim mismatch guard: the index was built with one provider, but the
  // current process is configured for another (e.g., OPENAI_API_KEY was
  // added or removed since last build). Silent dot-product against
  // mismatched dims would either throw or — worse — return garbage
  // partial overlaps. Bail loudly so the operator rebuilds.
  const provider = getEmbedProvider();
  if (provider.dim !== index.meta.dim) {
    throw new Error(
      `RAG index dim mismatch: index was built with ${index.meta.embedding_model} (${index.meta.dim}d) but the current embedder is ${provider.model} (${provider.dim}d). Run \`npm run rag:build\` to rebuild against the current provider.`,
    );
  }

  const queryEmbedding = normalize(await embedOne(query, { inputType: 'query' }));

  // Score every chunk by dot product (chunk vectors are already
  // normalized at index-build time so dot product == cosine). Linear
  // scan is fine at corpus scale (~hundreds of chunks); upgrade to a
  // proper ANN store if we ever pass 100K chunks.
  const scored: RagSearchHit[] = [];
  for (const chunk of index.chunks) {
    const emb = chunk.embedding;
    let dot = 0;
    for (let i = 0; i < queryEmbedding.length; i++) dot += queryEmbedding[i] * emb[i];
    if (dot < minScore) continue;
    scored.push({
      chunk: {
        id: chunk.id,
        source: chunk.source,
        heading_path: chunk.heading_path,
        text: chunk.text,
        approx_tokens: chunk.approx_tokens,
        embed_input: chunk.embed_input,
      },
      score: dot,
    });
  }
  scored.sort((a, b) => b.score - a.score);

  if (!dedupeBySource) return scored.slice(0, k);

  const seen = new Set<string>();
  const survivors: RagSearchHit[] = [];
  for (const hit of scored) {
    if (seen.has(hit.chunk.source)) continue;
    seen.add(hit.chunk.source);
    survivors.push(hit);
    if (survivors.length >= k) break;
  }

  // If de-dup left us short of k, backfill from the un-deduped list.
  if (survivors.length < k) {
    for (const hit of scored) {
      if (survivors.includes(hit)) continue;
      survivors.push(hit);
      if (survivors.length >= k) break;
    }
  }

  return survivors;
}

/**
 * Render hits as a markdown block ready to inject into a Claude system
 * prompt. Each hit shows source, breadcrumb, and body — the model can
 * cite by `(Doctrine: <source> ▸ <heading>)`.
 */
export function renderHitsAsMarkdown(hits: RagSearchHit[]): string {
  if (hits.length === 0) {
    return `## RELEVANT DOCTRINE\n\n_(No doctrine retrieved — RAG index not built or no chunks above threshold.)_`;
  }
  const blocks = hits.map((h, i) => {
    const breadcrumb = h.chunk.heading_path.length
      ? h.chunk.heading_path.join(' ▸ ')
      : '(unheaded)';
    return `### Doctrine ${i + 1} — ${h.chunk.source}\n**Section:** ${breadcrumb}\n**Relevance:** ${h.score.toFixed(3)}\n\n${h.chunk.text}`;
  });
  return `## RELEVANT DOCTRINE (top ${hits.length} by semantic similarity)\n\nUse these passages as authority and quote inline (e.g., \`(Doctrine: ${hits[0].chunk.source} ▸ ${hits[0].chunk.heading_path[0] ?? '...'})\`) where they support a claim. Do NOT invent doctrine outside this block.\n\n${blocks.join('\n\n---\n\n')}`;
}
