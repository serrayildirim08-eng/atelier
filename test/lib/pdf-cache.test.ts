/**
 * pdf-cache tests — pure (no Anthropic calls, no PDF parsing).
 *
 * Covers:
 *   1. pdfContentHash is deterministic and byte-sensitive.
 *   2. readPdfCache returns null on miss.
 *   3. writePdfCache → readPdfCache round-trips a PerPdfResult-shaped entry.
 *   4. readPdfCache returns null on malformed on-disk JSON without throwing.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pdfContentHash, readPdfCache, writePdfCache } from '@/lib/pdf-cache';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'pdf-cache-test-'));
  process.env.PDF_CACHE_DIR = tmpDir;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.PDF_CACHE_DIR;
});

describe('pdfContentHash', () => {
  it('returns the same hash for identical buffers', () => {
    const a = Buffer.from('the quick brown fox');
    const b = Buffer.from('the quick brown fox');
    expect(pdfContentHash(a)).toBe(pdfContentHash(b));
  });

  it('returns a different hash when even one byte changes', () => {
    const a = Buffer.from('the quick brown fox');
    const b = Buffer.from('the quick brown Fox');
    expect(pdfContentHash(a)).not.toBe(pdfContentHash(b));
  });

  it('produces a 64-char hex digest', () => {
    expect(pdfContentHash(Buffer.from('x'))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('readPdfCache / writePdfCache', () => {
  it('returns null on a cold miss', () => {
    expect(readPdfCache('cafebabe'.repeat(8))).toBeNull();
  });

  it('round-trips a successful extraction entry', () => {
    const hash = pdfContentHash(Buffer.from('hello world'));
    const entry = {
      pageCount: 3,
      facts: {
        doc_type: 'other' as const,
        suggested_filename: {
          value: null,
          source_page: null,
          source_quote: null,
          confidence: null,
        },
        one_line_summary: {
          value: 'A test document.',
          source_page: 1,
          source_quote: 'A test',
          confidence: 0.9,
        },
        key_facts: [],
      },
    };
    writePdfCache(hash, entry);
    const got = readPdfCache(hash);
    expect(got).not.toBeNull();
    expect(got?.pageCount).toBe(3);
    expect(got?.facts?.doc_type).toBe('other');
  });

  it('returns null without throwing on malformed JSON', () => {
    const hash = 'deadbeef'.repeat(8);
    const dir = join(tmpDir, 'v1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${hash}.json`), '{ not valid json');
    expect(readPdfCache(hash)).toBeNull();
  });

  it('returns null without throwing on a structurally invalid entry', () => {
    const hash = 'feedface'.repeat(8);
    const dir = join(tmpDir, 'v1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${hash}.json`), JSON.stringify({ not: 'a result' }));
    expect(readPdfCache(hash)).toBeNull();
  });
});
