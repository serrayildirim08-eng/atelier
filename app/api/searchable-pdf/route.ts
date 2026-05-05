import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { convertToSearchablePdf } from '@/lib/searchable-pdf';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * Convert any ingestable document to a searchable PDF that visually
 * matches the original. Supports the same extensions as the ingest
 * pipeline (.pdf, image, .docx, .xlsx, .csv, .txt, .html, .eml).
 *
 * Caching: result keyed by the SHA-256 of the source bytes + language
 * option. Cache lives in `<tmpdir>/atelier-searchable-cache/<hash>.pdf`.
 * Stale entries roll off when the OS clears tmpdir (boot).
 *
 * GET  /api/searchable-pdf?path=/absolute/path/to/doc[.pdf|...]
 *   → reads the source from disk, converts, returns the searchable PDF
 *   inline. Same security model as /api/file (absolute paths only).
 *
 * POST /api/searchable-pdf
 *   body: multipart/form-data with `file` field
 *   → returns the searchable PDF blob.
 */

const CACHE_DIR = path.join(os.tmpdir(), 'atelier-searchable-cache');

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function cacheKey(buffer: Buffer, languages: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(buffer)
    .update(`|${languages}`)
    .digest('hex');
  return path.join(CACHE_DIR, `${hash}.pdf`);
}

async function getOrConvert(
  buffer: Buffer,
  filename: string,
  languages: string | undefined,
): Promise<Buffer> {
  await ensureCacheDir();
  const langs = languages ?? 'eng+tur';
  const cachePath = cacheKey(buffer, langs);
  try {
    return await fs.readFile(cachePath);
  } catch {
    // Cache miss — compute below.
  }
  const out = await convertToSearchablePdf(buffer, filename, { languages: langs });
  await fs.writeFile(cachePath, out);
  return out;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');
  const languages = url.searchParams.get('lang') ?? undefined;

  if (!filePath) {
    return new Response('Missing path query parameter', { status: 400 });
  }
  if (!path.isAbsolute(filePath)) {
    return new Response('Path must be absolute', { status: 400 });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (e: unknown) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 404 });
  }
  if (!stat.isFile()) {
    return new Response('Path is not a regular file', { status: 400 });
  }

  let source: Buffer;
  try {
    source = await fs.readFile(filePath);
  } catch (e: unknown) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }

  let pdf: Buffer;
  try {
    pdf = await getOrConvert(source, path.basename(filePath), languages);
  } catch (e: unknown) {
    return new Response(
      `searchable-pdf conversion failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }

  const baseName = path.basename(filePath, path.extname(filePath));
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `inline; filename="${baseName}-searchable.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response('Expected multipart/form-data with a "file" field', { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e: unknown) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return new Response('Missing "file" field in form-data', { status: 400 });
  }

  const languages = (form.get('lang') as string | null) ?? undefined;
  const buffer = Buffer.from(await file.arrayBuffer());

  let pdf: Buffer;
  try {
    pdf = await getOrConvert(buffer, file.name, languages);
  } catch (e: unknown) {
    return new Response(
      `searchable-pdf conversion failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }

  const baseName = path.basename(file.name, path.extname(file.name));
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `attachment; filename="${baseName}-searchable.pdf"`,
    },
  });
}
