import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RagIndex } from './types';

/**
 * On-disk RAG index lives at `db/rag-index.json` by default. Override
 * with RAG_INDEX_PATH (absolute path). The retriever loads it once into
 * memory at first call and never re-reads — for the doctrine corpus
 * (~hundreds of chunks) this is well under 10MB and amortizes a single
 * cold start.
 */

export const DEFAULT_INDEX_PATH = path.resolve(
  process.cwd(),
  process.env.RAG_INDEX_PATH ?? 'db/rag-index.json',
);

export async function writeIndex(index: RagIndex, indexPath = DEFAULT_INDEX_PATH): Promise<void> {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index), 'utf8');
}

let _cachedIndex: RagIndex | null = null;
let _cachedPath: string | null = null;

export async function loadIndex(indexPath = DEFAULT_INDEX_PATH): Promise<RagIndex> {
  if (_cachedIndex && _cachedPath === indexPath) return _cachedIndex;
  const raw = await fs.readFile(indexPath, 'utf8');
  const parsed = JSON.parse(raw) as RagIndex;
  _cachedIndex = parsed;
  _cachedPath = indexPath;
  return parsed;
}

/** Best-effort load — returns null if the index does not exist yet. */
export async function tryLoadIndex(indexPath = DEFAULT_INDEX_PATH): Promise<RagIndex | null> {
  try {
    return await loadIndex(indexPath);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export function clearIndexCache(): void {
  _cachedIndex = null;
  _cachedPath = null;
}
