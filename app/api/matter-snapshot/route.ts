/**
 * GET / POST /api/matter-snapshot
 *
 * Disk-backed per-matter typedMemory cache. Replaces the localStorage
 * fallback that silently truncated on quota overflow for large matters.
 *
 * GET    ?matter_root=<absolute path>
 *   → { matter_root, snapshot: MatterSnapshot | null }
 *
 * POST   body: { matter_root, typed_memory, matter_filename? }
 *   → { ok: true, written_at }
 *
 * DELETE ?matter_root=<absolute path>
 *   → { ok: true }
 */

import path from 'node:path';
import {
  readMatterSnapshot,
  writeMatterSnapshot,
  deleteMatterSnapshot,
} from '@/lib/matter-snapshot';

export const runtime = 'nodejs';

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function isAbsoluteMatterRoot(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length < 500 &&
    path.isAbsolute(v)
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const matterRoot = url.searchParams.get('matter_root');
  if (!isAbsoluteMatterRoot(matterRoot)) {
    return badRequest('matter_root must be an absolute path');
  }
  try {
    const snapshot = await readMatterSnapshot(matterRoot);
    return Response.json({ matter_root: matterRoot, snapshot });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'read_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  if (!body || typeof body !== 'object') return badRequest('Body must be an object');
  const obj = body as Record<string, unknown>;

  const matterRoot = obj.matter_root;
  if (!isAbsoluteMatterRoot(matterRoot)) {
    return badRequest('matter_root must be an absolute path');
  }
  if (!('typed_memory' in obj)) {
    return badRequest('typed_memory is required');
  }

  const matterFilename =
    typeof obj.matter_filename === 'string' ? obj.matter_filename : undefined;

  try {
    await writeMatterSnapshot(matterRoot, obj.typed_memory, matterFilename);
    return Response.json({ ok: true, written_at: new Date().toISOString() });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'write_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const matterRoot = url.searchParams.get('matter_root');
  if (!isAbsoluteMatterRoot(matterRoot)) {
    return badRequest('matter_root must be an absolute path');
  }
  try {
    await deleteMatterSnapshot(matterRoot);
    return Response.json({ ok: true });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'delete_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
