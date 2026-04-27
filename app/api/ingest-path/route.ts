import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type IngestResult, type IngestSuccess } from '@/ingest';
import {
  classifyAndExtractOnePdf,
  getTypedExtractConcurrency,
  runWithConcurrency,
} from '@/ingest/typed-extract';
import {
  groupByDocType,
  type PerPdfResult,
} from '@/ingest/typed-memory';
import { aggregateTypedMemoryToE2 } from '@/ingest/typed-aggregate';
import { detectE2Subtype } from '@/ingest/extractors/subtype-detect';
import type { E2CaseSubtype } from '@/ingest/extractors/subtype-detect.schema';
import { extractPdfText } from '@/ingest/pdf';
import { draftCoverLetter } from '@/draft';
import { checkDraft } from '@/reason';

export const runtime = 'nodejs';
export const maxDuration = 3600;

async function walkPdfs(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recur(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await recur(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        out.push(full);
      }
    }
  }
  await recur(root);
  return out;
}

export async function POST(request: Request): Promise<Response> {
  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rootPath = body.path;
  if (!rootPath || !path.isAbsolute(rootPath)) {
    return Response.json(
      { error: 'Provide an absolute folder path under "path".' },
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

  let stat;
  try {
    stat = await fs.stat(rootPath);
  } catch (e: unknown) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  if (!stat.isDirectory()) {
    return Response.json(
      { error: 'Path is not a directory.' },
      { status: 400 },
    );
  }

  const pdfPaths = await walkPdfs(rootPath);
  const matterName = path.basename(rootPath);

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, obj: unknown) => {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  };

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { type: 'start', total: pdfPaths.length, matter: matterName });

      if (pdfPaths.length === 0) {
        send(controller, {
          type: 'result',
          result: {
            filename: matterName,
            pageCount: 0,
            error: { code: 'no_pdfs', message: 'No PDFs found in folder.' },
          } satisfies IngestResult,
        });
        send(controller, { type: 'done', total: 0 });
        controller.close();
        return;
      }

      // Phase 0.6 — case-subtype detection (manuals/_E2-SUBTYPE-TAXONOMY.md
      // §12). The case_type is fixed to E-2 in this pipeline (this route
      // is the typed-memory E-2 path), so we skip the case-type detector
      // and run the sub-type classifier directly. Sample text comes from
      // the first ≤3 PDFs — typically Tab A (cover letter / TOC) and the
      // forms tab, which carry the strongest §7 signals (letterhead,
      // REQUESTED CLASSIFICATION line, Job Offer Letter, etc.).
      send(controller, {
        type: 'progress',
        stage: 'subtype_detecting',
        label: 'Classifying E-2 sub-type from cover-letter and form samples',
        total: pdfPaths.length,
      });

      let e2Subtype: E2CaseSubtype | null = null;
      try {
        const samplePaths = pdfPaths.slice(0, 3);
        const samples = await Promise.all(
          samplePaths.map(async (p) => {
            const buf = await fs.readFile(p);
            const parsed = await extractPdfText(buf);
            return {
              filename: path.relative(rootPath, p),
              text: parsed.text,
            };
          }),
        );
        if (samples.length > 0) {
          e2Subtype = await detectE2Subtype(samples);
          send(controller, {
            type: 'subtype_result',
            principal_subtype: e2Subtype.principal_subtype,
            procedural_posture: e2Subtype.procedural_posture,
            has_dependents: e2Subtype.has_dependents,
            detection_confidence: e2Subtype.detection_confidence,
          });
        }
      } catch (e: unknown) {
        send(controller, {
          type: 'subtype_error',
          message: e instanceof Error ? e.message : String(e),
        });
      }

      // Phase 1 — per-PDF classify + extract (Haiku, parallel)
      send(controller, {
        type: 'progress',
        stage: 'classifying',
        label: `Reading ${pdfPaths.length} PDFs in parallel`,
        total: pdfPaths.length,
      });

      const inputs = pdfPaths.map((p) => ({ filename: path.relative(rootPath, p), absPath: p }));
      const concurrency = getTypedExtractConcurrency();

      const perPdfResults = await runWithConcurrency(
        inputs,
        concurrency,
        async (item) => {
          const buffer = await fs.readFile(item.absPath);
          return classifyAndExtractOnePdf({ filename: item.filename, buffer });
        },
        (i, r) => {
          send(controller, {
            type: 'pdf_result',
            index: i,
            total: pdfPaths.length,
            filename: r.filename,
            doc_type: r.facts?.doc_type ?? null,
            error: r.error ?? null,
            facts: r.facts ?? null,
            pageCount: r.pageCount,
          });
        },
      );

      const successCount = perPdfResults.filter((r) => r.facts && !r.error).length;
      const totalPages = perPdfResults.reduce((acc, r) => acc + r.pageCount, 0);
      const sourcePdfs = perPdfResults.map((r) => r.filename);

      // Phase 2 — aggregate typed memory → unified E2 facts (Sonnet)
      send(controller, {
        type: 'progress',
        stage: 'aggregating',
        label: `Reconciling ${successCount} per-document extractions into unified case facts`,
        total: pdfPaths.length,
      });

      const usable = perPdfResults.filter(
        (r): r is PerPdfResult & { facts: NonNullable<PerPdfResult['facts']> } =>
          !!r.facts && !r.error,
      );
      const memory = groupByDocType(usable);

      let result: IngestResult;
      try {
        const { caseFacts } = await aggregateTypedMemoryToE2(memory);
        result = {
          filename: matterName,
          pageCount: totalPages,
          detection_confidence: 1,
          detection_reasoning:
            'Case-type fixed to E-2 in v1 of typed-memory pipeline; per-document classifier feeds the aggregator directly. Sub-type from Phase-0.6 classifier.',
          caseFacts: { case_type: 'E2', facts: caseFacts },
          e2_subtype: e2Subtype,
          source_pdfs: sourcePdfs,
        } satisfies IngestSuccess;
      } catch (e: unknown) {
        result = {
          filename: matterName,
          pageCount: totalPages,
          source_pdfs: sourcePdfs,
          error: {
            code: 'aggregation_failed',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }

      if ('error' in result) {
        send(controller, { type: 'result', result });
        send(controller, { type: 'done', total: pdfPaths.length });
        controller.close();
        return;
      }

      // Phase 3 — draft (Sonnet)
      send(controller, {
        type: 'progress',
        stage: 'drafting',
        label: 'Drafting cover letter from unified facts',
        total: pdfPaths.length,
      });

      try {
        const drafted = await draftCoverLetter(result.caseFacts);
        result = { ...result, draft: drafted.letter };
      } catch (e: unknown) {
        result = {
          ...result,
          draftError: {
            code: 'draft_failed',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }

      // Phase 4 — review (Sonnet)
      if ('draft' in result && result.draft) {
        send(controller, {
          type: 'progress',
          stage: 'reviewing',
          label: 'Auditing the draft against the unified facts',
          total: pdfPaths.length,
        });

        try {
          const reviewed = await checkDraft(result.caseFacts, result.draft);
          result = { ...result, review: reviewed.report };
        } catch (e: unknown) {
          result = {
            ...result,
            reviewError: {
              code: 'review_failed',
              message: e instanceof Error ? e.message : String(e),
            },
          };
        }
      }

      send(controller, { type: 'result', result });
      send(controller, { type: 'done', total: pdfPaths.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
