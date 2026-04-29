/**
 * Doctrine RAG types — shared by the chunker, embedder, indexer, and
 * retriever. The on-disk snapshot at `db/rag-index.json` is { meta, chunks }.
 */

export interface RagChunk {
  /** Stable id: `${relPath}#${ordinal}`. */
  id: string;
  /** Source path relative to the corpus root. */
  source: string;
  /** Heading breadcrumb, e.g. ["E2 Manual", "§5 Source of Funds", "5.2.1 FX gate"]. */
  heading_path: string[];
  /** Raw chunk text (markdown preserved). */
  text: string;
  /** Token estimate at chunking time (chars / 4). */
  approx_tokens: number;
  /** Fully-qualified embedded text (heading prefix + body) — what got embedded. */
  embed_input: string;
}

export interface RagChunkWithEmbedding extends RagChunk {
  embedding: number[];
}

export interface RagIndexMeta {
  /** Voyage model id, e.g. "voyage-3-large". */
  embedding_model: string;
  /** Vector dimensionality. */
  dim: number;
  /** ISO-8601 build timestamp. */
  built_at: string;
  /** Total chunks in the index. */
  chunk_count: number;
  /** Sources covered (relPath list). */
  sources: string[];
}

export interface RagIndex {
  meta: RagIndexMeta;
  chunks: RagChunkWithEmbedding[];
}

export interface RagSearchHit {
  chunk: RagChunk;
  /** Cosine similarity in [-1, 1]; for normalized vectors == dot product. */
  score: number;
}
