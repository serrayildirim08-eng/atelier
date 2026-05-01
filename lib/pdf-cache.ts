/**
 * Content-hash dedup cache for per-PDF extraction.
 *
 * Byte-identical PDFs (translation pairs left as originals, email-attachment
 * forwards, OneDrive sync copies) recur often enough in case folders that
 * skipping the Haiku classify+extract on a cache hit pays back in both
 * tokens and wall-clock — concurrent extract waves shrink by one slot per
 * deduped PDF.
 *
 * Scope of what is cached:
 *  - pdf-parse v2 result + Haiku classify+extract output + any second-pass
 *    extractor result (contract / bank-receipt / wire-confirmation /
 *    government-doc).
 *  - Vision-fallback responses are NOT deterministic; the call site only
 *    invokes this cache on the text-extraction path.
 *  - Errors are NOT cached: a parse failure may be transient.
 *
 * Cache versioning: bump CACHE_VERSION when PerPdfFacts or any rich
 * extractor schema changes shape. Old version dirs become silently ignored
 * on read; can be deleted manually.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PerPdfResult } from '@/ingest/typed-memory';

/** Bump when PerPdfResult-shaped fields change. */
const CACHE_VERSION = 'v2';

const DEFAULT_CACHE_DIR = 'db/pdf-cache';

function cacheDir(): string {
  const base = process.env.PDF_CACHE_DIR ?? DEFAULT_CACHE_DIR;
  return join(base, CACHE_VERSION);
}

/** SHA-256 hex digest of the PDF buffer. Stable across processes. */
export function pdfContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** What we persist — everything in PerPdfResult except the per-call filename. */
type CacheEntry = Omit<PerPdfResult, 'filename' | 'error'>;

function entryPath(hash: string): string {
  return join(cacheDir(), `${hash}.json`);
}

/**
 * Try to load a cached extraction. Returns null on miss, on read/parse
 * error, or if the on-disk shape doesn't match what we expect (defensive
 * against partial writes or version drift the directory tag missed).
 */
export function readPdfCache(hash: string): CacheEntry | null {
  const path = entryPath(hash);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { pageCount?: unknown }).pageCount !== 'number'
    ) {
      return null;
    }
    return parsed as CacheEntry;
  } catch {
    return null;
  }
}

/**
 * Persist a successful extraction. Silent on I/O failure: a cache miss the
 * next time around is preferable to crashing the ingest pipeline.
 */
export function writePdfCache(hash: string, entry: CacheEntry): void {
  try {
    const path = entryPath(hash);
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(entry));
  } catch (e) {
    console.warn(
      '[pdf-cache] write failed:',
      e instanceof Error ? e.message : String(e),
    );
  }
}
