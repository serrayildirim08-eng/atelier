/**
 * POST /api/matter/[id]/preview
 *
 * Step 1 of the two-step approval flow. Runs a buildXxxPreview for the
 * requested generator, persists the payload at db/previews/<matter>/
 * <preview_id>.json with status='pending', and returns the payload to
 * the dashboard. NO Anthropic call.
 *
 * Body: { generator: PreviewGenerator, args?: Record<string, unknown> }
 */

import { buildPreview } from '@/lib/preview-builders';
import { writePreview, type PreviewGenerator } from '@/lib/preview-store';
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

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  let body: { generator?: unknown; args?: unknown };
  try {
    body = (await request.json()) as { generator?: unknown; args?: unknown };
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

  const matter = getMockMatter(id);
  const memory = getMockTypedMemory(id);

  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : undefined;

  let payload;
  try {
    payload = await buildPreview({
      matterId: id,
      generator: body.generator,
      caseFacts: matter.caseFacts,
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
