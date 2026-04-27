import { ingestPdf, type IngestResult } from '@/ingest';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const entries = formData.getAll('files');
  const files = entries.filter((e): e is File => e instanceof File);

  if (files.length === 0) {
    return Response.json(
      { error: 'No files provided. Upload PDFs under the field name "files".' },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          'ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and fill in the key.',
      },
      { status: 500 },
    );
  }

  const results: IngestResult[] = await Promise.all(
    files.map(async (file): Promise<IngestResult> => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return {
          filename: file.name,
          pageCount: 0,
          error: { code: 'not_pdf', message: 'Only .pdf files are supported.' },
        };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        return await ingestPdf(buffer, file.name);
      } catch (e: unknown) {
        return {
          filename: file.name,
          pageCount: 0,
          error: {
            code: 'unexpected',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }),
  );

  return Response.json({ results });
}
