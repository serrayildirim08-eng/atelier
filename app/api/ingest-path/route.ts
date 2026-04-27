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
import {
  detectE2Subtype,
  pickRawDocSamplePaths,
} from '@/ingest/extractors/subtype-detect';
import type { E2CaseSubtype } from '@/ingest/extractors/subtype-detect.schema';
import { extractPdfText } from '@/ingest/pdf';
import { draftCoverLetterStream } from '@/draft';
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
      // §12). Production: raw_docs mode. The bot reads ONLY raw client
      // documents (passports, contracts, CVs, bank statements, etc.) — no
      // cover letter, no Job Offer Letter, no I-129 (those are bot
      // OUTPUTS, not inputs). Sampling uses filename-pattern heuristics
      // to pick up to 6 signal-dense PDFs across four buckets: contract,
      // CV, passport, bank statement. The first three alphabetically are
      // a fallback if no filename matches.
      //
      // Runs in parallel with Phase 1 (per-PDF classify + extract): the
      // subtype result is only consumed when the final IngestSuccess is
      // assembled, so its model call overlaps the per-PDF wave entirely.
      // Frees the 3-8 s detect critical-path cost.
      send(controller, {
        type: 'progress',
        stage: 'subtype_detecting',
        label: 'Classifying E-2 sub-type from raw client documents',
        total: pdfPaths.length,
      });

      const e2SubtypePromise: Promise<E2CaseSubtype | null> = (async () => {
        try {
          const samplePaths = pickRawDocSamplePaths(pdfPaths);
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
          if (samples.length === 0) return null;
          const subtype = await detectE2Subtype(samples, { mode: 'raw_docs' });
          send(controller, {
            type: 'subtype_result',
            principal_subtype: subtype.principal_subtype,
            procedural_posture: subtype.procedural_posture,
            has_dependents: subtype.has_dependents,
            detection_confidence: subtype.detection_confidence,
            sample_files: samples.map((s) => s.filename),
          });
          return subtype;
        } catch (e: unknown) {
          send(controller, {
            type: 'subtype_error',
            message: e instanceof Error ? e.message : String(e),
          });
          return null;
        }
      })();

      // Phase 1 — per-PDF classify + extract (Haiku, parallel). Runs
      // concurrently with Phase 0.6 above. Stream events from the two
      // phases interleave on the wire; the UI handles each event type
      // independently.
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

      // Resolve the Phase 0.6 promise. By now Phase 1's wave dwarfs the
      // subtype call, so this is typically a no-op await.
      const e2Subtype = await e2SubtypePromise;

      // Load attorney-accepted filename aliases for this matter, if any.
      // The rename API persists them at db/filename-aliases.json keyed by
      // matter_id (the matter folder basename). Best-effort — a missing
      // file just means no aliases yet and the aggregator falls back to
      // suggested_filename / raw filenames.
      const aliasesPath =
        process.env.FILENAME_ALIASES_PATH ?? 'db/filename-aliases.json';
      let aliases: Record<string, { alias: string }> = {};
      try {
        const aliasRaw = await fs.readFile(aliasesPath, 'utf8');
        const aliasParsed = JSON.parse(aliasRaw) as Record<
          string,
          Record<string, { alias: string }>
        >;
        aliases = aliasParsed[matterName] ?? {};
      } catch {
        aliases = {};
      }

      let result: IngestResult;
      try {
        const { caseFacts } = await aggregateTypedMemoryToE2(memory, {
          aliases,
        });
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

      // Streaming drafter: text deltas flow to the UI as they're written
      // (~30 s wall-clock for a 16K-token letter; first paragraph in 3-5 s).
      // We still assemble the full letter server-side from the final-event
      // payload so the downstream reviewer + the closing `result` event
      // get the same authoritative text the deltas built up.
      try {
        let draft = '';
        for await (const event of draftCoverLetterStream(result.caseFacts)) {
          if (event.type === 'text_delta') {
            draft += event.delta;
            send(controller, { type: 'draft_delta', delta: event.delta });
          } else {
            draft = event.letter;
          }
        }
        result = { ...result, draft };
        send(controller, { type: 'draft_done' });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        result = {
          ...result,
          draftError: { code: 'draft_failed', message },
        };
        send(controller, { type: 'draft_error', message });
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
