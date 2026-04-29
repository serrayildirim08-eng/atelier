/**
 * /api/matter-overrides — GET + PATCH integration.
 *
 * Validates request shape, path validation, doc_type enum guard, and
 * round-trip with the on-disk JSON sidecar.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;
let storePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'matter-overrides-route-'));
  storePath = join(tmpDir, 'overrides.json');
  process.env.MATTER_OVERRIDES_PATH = storePath;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.MATTER_OVERRIDES_PATH;
});

async function loadHandlers() {
  return await import('@/app/api/matter-overrides/route');
}

function patchReq(body: unknown): Request {
  return new Request('http://test/api/matter-overrides', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getReq(matterRoot: string | null): Request {
  const url = matterRoot
    ? `http://test/api/matter-overrides?matter_root=${encodeURIComponent(matterRoot)}`
    : 'http://test/api/matter-overrides';
  return new Request(url);
}

describe('GET /api/matter-overrides', () => {
  it('rejects missing matter_root', async () => {
    const { GET } = await loadHandlers();
    const res = await GET(getReq(null));
    expect(res.status).toBe(400);
  });

  it('rejects relative matter_root', async () => {
    const { GET } = await loadHandlers();
    const res = await GET(getReq('relative/path'));
    expect(res.status).toBe(400);
  });

  it('returns null for an unknown matter', async () => {
    const { GET } = await loadHandlers();
    const res = await GET(getReq('/unknown/matter'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matter_override: unknown };
    expect(body.matter_override).toBeNull();
  });
});

describe('PATCH /api/matter-overrides', () => {
  it('rejects an invalid body', async () => {
    const { PATCH } = await loadHandlers();
    const res = await PATCH(
      new Request('http://test/api/matter-overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects relative matter_root', async () => {
    const { PATCH } = await loadHandlers();
    const res = await PATCH(patchReq({ matter_root: 'rel' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid doc_type_override', async () => {
    const { PATCH } = await loadHandlers();
    const res = await PATCH(
      patchReq({
        matter_root: '/abs/m',
        document: { filename: 'a.pdf', doc_type_override: 'bogus' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('round-trips a matter display name plus a per-document override', async () => {
    const { PATCH, GET } = await loadHandlers();
    let res = await PATCH(
      patchReq({
        matter_root: '/abs/case-a',
        matter_display_name: 'Case A — Smith',
        document: {
          filename: 'C - Applicant Information/passport.pdf',
          display_name: "John's passport",
          doc_type_override: 'passport',
        },
      }),
    );
    expect(res.status).toBe(200);

    res = await GET(getReq('/abs/case-a'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      matter_override: {
        matter_display_name?: string;
        documents: Record<
          string,
          { display_name?: string; doc_type_override?: string }
        >;
      } | null;
    };
    expect(body.matter_override?.matter_display_name).toBe('Case A — Smith');
    const doc =
      body.matter_override?.documents['C - Applicant Information/passport.pdf'];
    expect(doc?.display_name).toBe("John's passport");
    expect(doc?.doc_type_override).toBe('passport');
  });

  it('null clears matter_display_name', async () => {
    const { PATCH, GET } = await loadHandlers();
    await PATCH(
      patchReq({ matter_root: '/abs/m', matter_display_name: 'X' }),
    );
    await PATCH(
      patchReq({ matter_root: '/abs/m', matter_display_name: null }),
    );
    const res = await GET(getReq('/abs/m'));
    const body = (await res.json()) as { matter_override: unknown };
    // Whole matter pruned when nothing remains.
    expect(body.matter_override).toBeNull();
  });
});
