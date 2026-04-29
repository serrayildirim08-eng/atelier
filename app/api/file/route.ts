import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

/**
 * Serve a local document for inline preview in the desktop app.
 *
 * The Electron renderer is sandboxed (no file:// access), so we go through
 * the Next.js server. The server runs on the same host as the Electron
 * window and only the local user can hit it, but we still validate:
 *   - path must be absolute
 *   - file must exist and be a regular file
 *   - extension must be in the allow-list (PDF, common images, DOCX)
 */
const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return new Response('Missing path query parameter', { status: 400 });
  }

  if (!path.isAbsolute(filePath)) {
    return new Response('Path must be absolute', { status: 400 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    return new Response(
      `Unsupported extension: ${ext}. Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}`,
      { status: 400 },
    );
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (e: unknown) {
    return new Response(
      e instanceof Error ? e.message : String(e),
      { status: 404 },
    );
  }

  if (!stat.isFile()) {
    return new Response('Path is not a regular file', { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (e: unknown) {
    return new Response(
      e instanceof Error ? e.message : String(e),
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
