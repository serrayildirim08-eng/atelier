/**
 * POST /api/export
 *
 * Convert a generator's inline markdown output into a downloadable
 * .docx file. Body: { content: string, filename?: string, title?: string }.
 * Returns the .docx as a binary blob with Content-Disposition: attachment.
 *
 * Stays inside the Anthropic-free path: this is pure markdown→docx
 * rendering done with the `docx` npm package (no LLM, no network).
 */

import { markdownToDocxBuffer } from '@/lib/docx-export';

export const runtime = 'nodejs';

interface Body {
  content?: unknown;
  filename?: unknown;
}

function safeFilename(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return 'document.docx';
  const cleaned = raw.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return cleaned.toLowerCase().endsWith('.docx') ? cleaned : `${cleaned}.docx`;
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.content !== 'string' || body.content.length === 0) {
    return Response.json({ error: 'Missing content' }, { status: 400 });
  }
  const filename = safeFilename(body.filename);

  let buffer: Buffer;
  try {
    buffer = await markdownToDocxBuffer(body.content);
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'docx_render_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
