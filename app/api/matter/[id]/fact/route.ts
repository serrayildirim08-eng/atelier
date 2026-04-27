/**
 * Inline-edit endpoint. The dashboard cells PATCH a single field path
 * (e.g., "investor.passport_number" or "source_of_funds[1].notes") with
 * a new value. Persistence is stubbed — we log to the audit substrate
 * (server console for now) so we have provenance the moment a real
 * data store is wired up. Schema validation is intentionally permissive
 * here; the source-of-truth schema lives in `ingest/schema.ts` and the
 * server-side merge will re-validate before commit.
 */

export const runtime = 'nodejs';

interface PatchBody {
  field_path?: unknown;
  new_value?: unknown;
  source_quote?: unknown;
  source_page?: unknown;
}

interface AuditEntry {
  ts: string;
  matter_id: string;
  field_path: string;
  new_value: unknown;
  source_quote: string | null;
  source_page: number | null;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fieldPath = typeof body.field_path === 'string' ? body.field_path : null;
  if (!fieldPath || fieldPath.length === 0 || fieldPath.length > 200) {
    return Response.json(
      { error: 'field_path must be a non-empty string under 200 chars' },
      { status: 400 },
    );
  }

  const sourceQuote =
    typeof body.source_quote === 'string' ? body.source_quote : null;
  const sourcePage =
    typeof body.source_page === 'number' && Number.isInteger(body.source_page)
      ? body.source_page
      : null;

  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    matter_id: id,
    field_path: fieldPath,
    new_value: body.new_value ?? null,
    source_quote: sourceQuote,
    source_page: sourcePage,
  };

  console.log('[audit:matter-fact-edit]', JSON.stringify(entry));

  return Response.json({ ok: true, applied: entry });
}
