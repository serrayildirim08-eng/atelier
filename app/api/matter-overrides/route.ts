/**
 * GET / PATCH /api/matter-overrides
 *
 * Persistent per-matter manual corrections (matter display name, per-document
 * display name, per-document doc_type override). Metadata-only — never
 * renames source files or folders.
 *
 * GET    ?matter_root=<absolute path>
 *   → { matter_root, matter_override: MatterOverride | null }
 *
 * PATCH  body: { matter_root, matter_display_name?, document? }
 *   matter_display_name === null clears it.
 *   document.display_name / doc_type_override === null clears that field.
 *   → { matter_root, matter_override: MatterOverride | null }
 */

import path from 'node:path';
import {
  applyOverridePatch,
  getMatterOverride,
  type DocumentPatch,
  type UpsertPatch,
} from '@/lib/matter-overrides';
import { isDocType } from '@/lib/matter-overrides';

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
    const override = await getMatterOverride(matterRoot);
    return Response.json({ matter_root: matterRoot, matter_override: override });
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

export async function PATCH(request: Request): Promise<Response> {
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

  const patch: UpsertPatch = { matter_root: matterRoot };

  if ('matter_display_name' in obj) {
    const v = obj.matter_display_name;
    if (v !== null && typeof v !== 'string') {
      return badRequest('matter_display_name must be a string or null');
    }
    patch.matter_display_name = v as string | null;
  }

  if ('document' in obj && obj.document !== undefined && obj.document !== null) {
    const d = obj.document;
    if (typeof d !== 'object' || Array.isArray(d)) {
      return badRequest('document must be an object');
    }
    const dObj = d as Record<string, unknown>;
    if (typeof dObj.filename !== 'string' || dObj.filename.length === 0) {
      return badRequest('document.filename must be a non-empty string');
    }
    const docPatch: DocumentPatch = { filename: dObj.filename };
    if ('display_name' in dObj) {
      const v = dObj.display_name;
      if (v !== null && typeof v !== 'string') {
        return badRequest('document.display_name must be a string or null');
      }
      docPatch.display_name = v as string | null;
    }
    if ('doc_type_override' in dObj) {
      const v = dObj.doc_type_override;
      if (v !== null && !isDocType(v)) {
        return badRequest(
          'document.doc_type_override must be a valid DocType or null',
        );
      }
      docPatch.doc_type_override = v;
    }
    patch.document = docPatch;
  }

  try {
    const updated = await applyOverridePatch(patch);
    console.log(
      '[audit:matter-overrides]',
      JSON.stringify({
        ts: new Date().toISOString(),
        matter_root: matterRoot,
        matter_display_name_set:
          patch.matter_display_name !== undefined ? true : undefined,
        document_filename: patch.document?.filename,
        document_display_name_set:
          patch.document?.display_name !== undefined ? true : undefined,
        document_doc_type_override:
          patch.document?.doc_type_override ?? undefined,
      }),
    );
    return Response.json({ matter_root: matterRoot, matter_override: updated });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'write_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }
}
