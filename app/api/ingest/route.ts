import {
  ingestPdf,
  type IngestResult,
  type IngestSuccess,
  type CaseFacts,
} from '@/ingest';
import { draftCoverLetter } from '@/draft';
import { checkDraft } from '@/reason';

export const runtime = 'nodejs';
export const maxDuration = 300;

function asCaseFacts(r: IngestSuccess): CaseFacts {
  // `r` is CommonIngestFields & CaseFacts. Re-emit the discriminator
  // explicitly so the literal-type narrowing survives JSON serialisation
  // boundaries and downstream calls.
  switch (r.case_type) {
    case 'E2':
      return { case_type: 'E2', facts: r.facts };
    case 'EB1A':
      return { case_type: 'EB1A', facts: r.facts };
    case 'EB1B':
      return { case_type: 'EB1B', facts: r.facts };
    case 'EB1C':
      return { case_type: 'EB1C', facts: r.facts };
  }
}

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

      let result: IngestResult;
      try {
        result = await ingestPdf(buffer, file.name);
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

      if ('error' in result) {
        return result;
      }

      // Drafting (Opus 4.7, case-type-aware system prompt)
      const caseFacts = asCaseFacts(result);
      let letter: string;
      try {
        const drafted = await draftCoverLetter(caseFacts);
        letter = drafted.letter;
        result = { ...result, draft: letter };
      } catch (e: unknown) {
        return {
          ...result,
          draftError: {
            code: 'draft_failed',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }

      // Review (Opus 4.7, case-type-aware checker)
      try {
        const reviewed = await checkDraft(caseFacts, letter);
        return { ...result, review: reviewed.report };
      } catch (e: unknown) {
        return {
          ...result,
          reviewError: {
            code: 'review_failed',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }),
  );

  return Response.json({ results });
}
