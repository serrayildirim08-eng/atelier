/**
 * Document-classifier-renamer accept/reject endpoint.
 *
 * The thin classifier (ingest/typed-extract.ts) emits a kebab-case
 * `suggested_filename` for every PDF. The dashboard renders that
 * suggestion next to the raw input filename and lets the attorney
 * accept it (apply the alias) or reject it (clear any prior alias).
 *
 * SAFETY: this endpoint NEVER renames the source PDF on disk. It writes
 * a sidecar mapping at db/filename-aliases.json. Downstream consumers
 * (aggregator, drafter, dashboard) read the alias when present and fall
 * back to the raw filename when not.
 *
 * Sidecar shape:
 *   {
 *     "<matter_id>": {
 *       "<pdf_path>": {
 *         "alias": "kacar-salih-passport-bio-page.pdf",
 *         "suggested_filename": "kacar-salih-passport-bio-page.pdf",
 *         "applied_at": "2026-04-27T22:00:00.000Z"
 *       }
 *     }
 *   }
 *
 * The `pdf_path` key is the raw filename / relative path the per-PDF
 * extractor recorded — same form that flows through the typed memory
 * (e.g., "C - Applicant Information/passport.pdf").
 */

import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export const runtime = 'nodejs';

const ALIASES_PATH = process.env.FILENAME_ALIASES_PATH ?? 'db/filename-aliases.json';
const MAX_ALIAS_LEN = 80;

interface AliasEntry {
  alias: string;
  suggested_filename: string;
  applied_at: string;
}

type AliasesFile = Record<string, Record<string, AliasEntry>>;

interface PatchBody {
  pdf_path?: unknown;
  suggested_filename?: unknown;
  accept_or_reject?: unknown;
}

async function readAliasesFile(): Promise<AliasesFile> {
  try {
    const raw = await fs.readFile(ALIASES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AliasesFile;
    }
    return {};
  } catch (e: unknown) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

async function writeAliasesFile(data: AliasesFile): Promise<void> {
  const dir = dirname(ALIASES_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ALIASES_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Validates a kebab-case ASCII suggested filename:
 *   - lowercase, ASCII only
 *   - hyphen-separated tokens
 *   - ends in .pdf
 *   - ≤ 80 chars
 *   - no path separators
 */
function validateSuggestedFilename(value: string): string | null {
  if (typeof value !== 'string') return 'suggested_filename must be a string';
  if (value.length === 0) return 'suggested_filename is empty';
  if (value.length > MAX_ALIAS_LEN) {
    return `suggested_filename exceeds ${MAX_ALIAS_LEN} chars`;
  }
  if (!/^[a-z0-9][a-z0-9.-]*\.pdf$/.test(value)) {
    return 'suggested_filename must be lowercase kebab-case ASCII ending in .pdf';
  }
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    return 'suggested_filename must not contain path separators';
  }
  return null;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id || id.length === 0 || id.length > 200) {
    return Response.json({ error: 'invalid matter id' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pdfPath = typeof body.pdf_path === 'string' ? body.pdf_path : null;
  if (!pdfPath || pdfPath.length === 0 || pdfPath.length > 500) {
    return Response.json(
      { error: 'pdf_path must be a non-empty string under 500 chars' },
      { status: 400 },
    );
  }

  const action = body.accept_or_reject;
  if (action !== 'accept' && action !== 'reject') {
    return Response.json(
      { error: 'accept_or_reject must be "accept" or "reject"' },
      { status: 400 },
    );
  }

  const suggested =
    typeof body.suggested_filename === 'string' ? body.suggested_filename : null;

  if (action === 'accept') {
    if (!suggested) {
      return Response.json(
        { error: 'accept requires suggested_filename' },
        { status: 400 },
      );
    }
    const validationError = validateSuggestedFilename(suggested);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
  }

  let data: AliasesFile;
  try {
    data = await readAliasesFile();
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'Failed to read aliases file',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const matterAliases = data[id] ?? {};

  let applied: AliasEntry | null = null;
  if (action === 'accept' && suggested) {
    applied = {
      alias: suggested,
      suggested_filename: suggested,
      applied_at: new Date().toISOString(),
    };
    matterAliases[pdfPath] = applied;
  } else {
    // reject: drop any prior alias for this pdf_path
    delete matterAliases[pdfPath];
  }

  if (Object.keys(matterAliases).length > 0) {
    data[id] = matterAliases;
  } else {
    delete data[id];
  }

  try {
    await writeAliasesFile(data);
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'Failed to persist aliases',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  console.log(
    '[audit:matter-rename]',
    JSON.stringify({
      ts: new Date().toISOString(),
      matter_id: id,
      pdf_path: pdfPath,
      action,
      applied,
    }),
  );

  return Response.json({
    ok: true,
    matter_id: id,
    pdf_path: pdfPath,
    action,
    applied,
  });
}

/**
 * GET — return the alias map for a matter so the dashboard can render
 * applied aliases on initial render. Returns `{ aliases: {} }` when no
 * aliases have been accepted yet (file may not exist on disk).
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  let data: AliasesFile;
  try {
    data = await readAliasesFile();
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'Failed to read aliases file',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
  return Response.json({ matter_id: id, aliases: data[id] ?? {} });
}
