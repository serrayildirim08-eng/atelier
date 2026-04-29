/**
 * Phase 11 — /api/re-aggregate route tests.
 *
 * Validates request shape + cache-survival posture without making real
 * Anthropic calls. The aggregator + per-PDF extractor are mocked at the
 * module boundary so the route's wiring is exercised end-to-end (path
 * validation → walk → per-PDF cache read → aggregate → response shape).
 *
 * The PDF cache (db/pdf-cache/v1/<sha256>.json) is asserted to survive
 * across re-aggregation calls — that's the bug Phase 11 fixes.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  pdfContentHash,
  writePdfCache,
  readPdfCache,
} from '@/lib/pdf-cache';

// Mock the per-PDF classifier so the route does not need Anthropic.
vi.mock('@/ingest/typed-extract', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    classifyAndExtractOnePdf: vi.fn(async (input: { filename: string; buffer: Buffer }) => ({
      filename: input.filename,
      pageCount: 1,
      facts: { doc_type: 'other' as const },
    })),
    getTypedExtractConcurrency: () => 1,
    runWithConcurrency: async <T, R>(
      items: T[],
      _c: number,
      fn: (item: T) => Promise<R>,
    ): Promise<R[]> => Promise.all(items.map(fn)),
  };
});

// Mock the aggregator — return a minimal but schema-shaped payload.
vi.mock('@/ingest/typed-aggregate', () => ({
  aggregateTypedMemoryToE2: vi.fn(async () => ({
    caseFacts: {
      investor: {},
      enterprise: {},
      ownership_chain: [],
      investment: { items: [] },
      source_of_funds: [],
      elements_evidence: {},
      conflict_register: [],
    },
    usage: { input_tokens: 0, output_tokens: 0 },
    defensive_paragraphs_required: [],
    marginality_evidence_present: { has_payroll: false, employee_count: 0 },
    fx_gate_results: [],
    passport_validity_results: [],
    i94_status_results: [],
    translation_gate_results: [],
    salary_benchmark_results: [],
    cv_title_drift_results: [],
    personal_reference_results: [],
    credential_verifiability_results: [],
    tax_balance_sheet_results: [],
    pl_tax_net_income_results: [],
    real_estate_buyer_mismatch_results: [],
    incentive_recipient_mismatch_results: [],
    substantiality_recon_results: [],
    entity_coherence_results: [],
  })),
}));

// Import AFTER the mocks so the route picks up the stubbed modules.
const { POST } = await import('@/app/api/re-aggregate/route');

let tmpRoot: string;
let cacheDir: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 're-aggregate-route-'));
  cacheDir = join(tmpRoot, 'pdf-cache');
  mkdirSync(cacheDir, { recursive: true });
  process.env.PDF_CACHE_DIR = cacheDir;
  process.env.ANTHROPIC_API_KEY = 'sk-test';
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  delete process.env.PDF_CACHE_DIR;
  delete process.env.ANTHROPIC_API_KEY;
});

function reqWith(body: unknown): Request {
  return new Request('http://test/api/re-aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/re-aggregate', () => {
  it('rejects missing matter_root', async () => {
    const res = await POST(reqWith({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/matter_root/);
  });

  it('rejects relative paths', async () => {
    const res = await POST(reqWith({ matter_root: 'relative/path' }));
    expect(res.status).toBe(400);
  });

  it('rejects when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const folder = mkdtempSync(join(tmpdir(), 'matter-'));
    try {
      const res = await POST(reqWith({ matter_root: folder }));
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/ANTHROPIC_API_KEY/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('returns no_pdfs error for an empty folder', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'matter-'));
    try {
      const res = await POST(reqWith({ matter_root: folder }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        result: { error?: { code: string } };
      };
      expect(body.result.error?.code).toBe('no_pdfs');
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('runs aggregator and returns IngestSuccess shape; the on-disk cache is left intact', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'matter-'));
    try {
      writeFileSync(join(folder, 'doc1.pdf'), Buffer.from('%PDF-1.4 test1'));
      writeFileSync(join(folder, 'doc2.pdf'), Buffer.from('%PDF-1.4 test2'));

      // Seed the cache with a sentinel entry so we can confirm it's
      // never deleted by the re-aggregate path. Cast through unknown
      // because the real PerPdfFacts is a discriminated union with
      // many required leaves; the cache layer treats the value
      // opaquely so a stub shape suffices for the pinning we need.
      const buf = Buffer.from('%PDF-1.4 test1');
      const hash = pdfContentHash(buf);
      writePdfCache(hash, {
        pageCount: 1,
        facts: { doc_type: 'other' } as unknown as Parameters<typeof writePdfCache>[1]['facts'],
      });
      const before = readPdfCache(hash);
      expect(before).not.toBeNull();

      const res = await POST(reqWith({ matter_root: folder }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        result: {
          filename: string;
          caseFacts?: { case_type: string };
          aggregate_audit?: unknown;
          source_pdfs?: string[];
        };
      };
      expect(body.result.caseFacts?.case_type).toBe('E2');
      expect(body.result.aggregate_audit).toBeTruthy();
      expect(body.result.source_pdfs?.length).toBe(2);

      // Cache survival — the re-aggregate route must NEVER delete cache
      // entries. Re-read the sentinel.
      const after = readPdfCache(hash);
      expect(after).not.toBeNull();
      // Cache directory still exists with at least the seeded entry.
      const versioned = join(cacheDir, 'v1');
      expect(existsSync(versioned)).toBe(true);
      const files = readdirSync(versioned).filter((f) => f.endsWith('.json'));
      expect(files.length).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('rejects when path is a file, not a directory', async () => {
    const file = join(tmpRoot, 'not-a-folder.pdf');
    writeFileSync(file, Buffer.from('%PDF-1.4'));
    const res = await POST(reqWith({ matter_root: file }));
    expect(res.status).toBe(400);
  });
});
