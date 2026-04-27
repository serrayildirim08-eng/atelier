/**
 * POST /api/matter/[id]/preview
 *
 * Step 1 of the two-step approval flow. Runs a buildXxxPreview for the
 * requested generator, persists the payload at db/previews/<matter>/
 * <preview_id>.json with status='pending', and returns the payload to
 * the dashboard. NO Anthropic call.
 *
 * Body: {
 *   generator: PreviewGenerator,
 *   args?: object,
 *   case_facts?: CaseFacts,   // when provided, overrides mock matter
 *   typed_memory?: TypedMemory // when provided, overrides mock memory
 * }
 *
 * The home page's freshly-ingested matter sits in client state — it
 * passes `case_facts` + `typed_memory` in the body so the preview reads
 * the live data instead of the placeholder Mehmet-Demir mock.
 */

import { buildPreview } from '@/lib/preview-builders';
import { writePreview, type PreviewGenerator } from '@/lib/preview-store';
import type { CaseFacts } from '@/ingest/schema';
import type { TypedMemory } from '@/ingest/typed-memory';
import { getMockMatter, getMockTypedMemory } from '../mock-data';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_GENERATORS: ReadonlySet<PreviewGenerator> = new Set([
  'cover_letter',
  'noid_principal',
  'noid_dependent',
  'forms_i129',
  'forms_i129e',
  'forms_g28',
  'forms_i539',
  'forms_i539a',
  'declaration_beneficiary',
  'declaration_spouse',
  'declaration_enterprise_rep',
  'exhibit_list',
]);

function isPreviewGenerator(s: unknown): s is PreviewGenerator {
  return typeof s === 'string' && VALID_GENERATORS.has(s as PreviewGenerator);
}

/** Permissive type guard — server defers schema validation to the builder. */
function isCaseFacts(v: unknown): v is CaseFacts {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.case_type === 'string' && obj.facts !== undefined;
}

/** Memory is just an object map of doc_type → entries. */
function isTypedMemory(v: unknown): v is TypedMemory {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  let body: {
    generator?: unknown;
    args?: unknown;
    case_facts?: unknown;
    typed_memory?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isPreviewGenerator(body.generator)) {
    return Response.json(
      {
        error: 'Body must include `generator` set to one of the supported generator names',
        valid_generators: Array.from(VALID_GENERATORS),
      },
      { status: 400 },
    );
  }

  // Prefer caller-supplied case_facts/typed_memory (the home-page client
  // ships these as part of the request body — that's the live ingested
  // matter). Fall back to mock when absent so the demo route at
  // /matter/demo-001 still works.
  const caseFacts: CaseFacts =
    isCaseFacts(body.case_facts) ? body.case_facts : getMockMatter(id).caseFacts;
  const memory: TypedMemory = isTypedMemory(body.typed_memory)
    ? body.typed_memory
    : getMockTypedMemory(id);

  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : undefined;

  let payload;
  try {
    payload = await buildPreview({
      matterId: id,
      generator: body.generator,
      caseFacts,
      memory,
      args,
    });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'Preview build failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const record = await writePreview(payload);
  return Response.json(record);
}
