#!/usr/bin/env -S node --import tsx
/**
 * Build the doctrine RAG index from local markdown corpora.
 *
 * Walks each root in CORPUS_ROOTS, picks up *.md and *.txt files,
 * chunks them by markdown heading, embeds with Voyage 3 large, and
 * writes the snapshot to db/rag-index.json.
 *
 * Usage:
 *   VOYAGE_API_KEY=... npm run rag:build
 *
 * The index is loaded once per Atelier process at first retrieval call
 * (see lib/rag/index-store.ts) and stays in memory for the process
 * lifetime. Re-run this script whenever the corpus changes; in dev,
 * call clearIndexCache() to force a reload.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chunkMarkdown } from '../lib/rag/chunk';
import { embedBatch, normalize, getEmbedProvider } from '../lib/rag/embed';
import { writeIndex, DEFAULT_INDEX_PATH } from '../lib/rag/index-store';
import type { RagChunk, RagChunkWithEmbedding, RagIndex } from '../lib/rag/types';

interface CorpusRoot {
  /** Absolute path to the root. */
  abs: string;
  /** Label used in the relative source path (e.g. "manuals", "context"). */
  label: string;
}

function resolveHome(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return path.resolve(p);
}

const REPO_ROOT = process.cwd();

/**
 * Default corpus roots. Order matters: earlier roots win when sources
 * collide on the same relative path. Override with RAG_CORPUS_ROOTS
 * (comma-separated `label:path` pairs).
 */
const DEFAULT_ROOTS: CorpusRoot[] = [
  { label: 'manuals', abs: path.join(REPO_ROOT, 'manuals') },
  { label: 'context', abs: resolveHome('~/akalan-context') },
];

function parseRootsEnv(): CorpusRoot[] | null {
  const raw = process.env.RAG_CORPUS_ROOTS;
  if (!raw) return null;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, p] = entry.split(':', 2);
      if (!label || !p) {
        throw new Error(
          `RAG_CORPUS_ROOTS entry must be "label:path" — got "${entry}"`,
        );
      }
      return { label, abs: resolveHome(p) };
    });
}

const SUPPORTED_EXTENSIONS = ['.md', '.txt'];

async function walk(dir: string, base: string, label: string): Promise<{ relPath: string; abs: string }[]> {
  const out: { relPath: string; abs: string }[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base, label)));
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) continue;
      const rel = path.relative(base, full);
      out.push({ relPath: `${label}/${rel}`, abs: full });
    }
  }
  return out;
}

async function main() {
  const roots = parseRootsEnv() ?? DEFAULT_ROOTS;
  const t0 = Date.now();
  const provider = getEmbedProvider();
  console.log(`[rag] embedding model: ${provider.model} (${provider.dim} dims)`);
  console.log(`[rag] roots:`);
  for (const r of roots) console.log(`  - ${r.label}: ${r.abs}`);

  const allChunks: RagChunk[] = [];
  const sources: string[] = [];

  for (const root of roots) {
    const files = await walk(root.abs, root.abs, root.label);
    if (files.length === 0) {
      console.warn(`[rag] no markdown/txt files under ${root.abs} — skipping`);
      continue;
    }
    for (const file of files) {
      const md = await fs.readFile(file.abs, 'utf8');
      const chunks = chunkMarkdown(file.relPath, md);
      if (chunks.length === 0) {
        console.warn(`[rag] no chunks produced from ${file.relPath} (likely empty)`);
        continue;
      }
      sources.push(file.relPath);
      allChunks.push(...chunks);
      console.log(`  · ${file.relPath} → ${chunks.length} chunk${chunks.length === 1 ? '' : 's'}`);
    }
  }

  if (allChunks.length === 0) {
    throw new Error('No chunks produced; nothing to embed.');
  }
  console.log(`[rag] ${allChunks.length} chunks across ${sources.length} sources`);

  const tEmbed0 = Date.now();
  const embeddings = await embedBatch(
    allChunks.map((c) => c.embed_input),
    { inputType: 'document' },
  );
  const tEmbed = Date.now() - tEmbed0;
  console.log(`[rag] embedded in ${tEmbed}ms`);

  const withEmbeddings: RagChunkWithEmbedding[] = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: normalize(embeddings[i]),
  }));

  const index: RagIndex = {
    meta: {
      embedding_model: provider.model,
      dim: provider.dim,
      built_at: new Date().toISOString(),
      chunk_count: withEmbeddings.length,
      sources,
    },
    chunks: withEmbeddings,
  };

  await writeIndex(index);
  const sizeBytes = (await fs.stat(DEFAULT_INDEX_PATH)).size;
  console.log(`[rag] wrote ${DEFAULT_INDEX_PATH} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[rag] total ${Date.now() - t0}ms`);
}

main().catch((e: unknown) => {
  console.error('[rag] failed:', e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
