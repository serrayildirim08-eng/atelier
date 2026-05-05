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
import { aggregateTypedMemoryToEb1a } from '@/ingest/typed-aggregate-eb1a';
import {
  detectE2Subtype,
  pickRawDocSamplePaths,
} from '@/ingest/extractors/subtype-detect';
import type { E2CaseSubtype } from '@/ingest/extractors/subtype-detect.schema';
import { detectCaseType } from '@/ingest/detect';
import type { CaseType } from '@/ingest/schema';
import { extractPdfText } from '@/ingest/pdf';
import { classifyEb1aVariant } from '@/ingest/extractors/eb1a-variant-classify';
import { getMatterOverride } from '@/lib/matter-overrides';

export const runtime = 'nodejs';
export const maxDuration = 3600;

const INGESTABLE_EXTENSIONS = [
  '.pdf', '.docx', '.eml', '.msg', '.txt',
  '.html', '.htm', '.mhtml', '.mht', '.webarchive',
  '.xlsx', '.xls', '.ods', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
];

async function walkIngestableFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recur(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await recur(full);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (INGESTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
          out.push(full);
        }
      }
    }
  }
  await recur(root);
  return out;
}

export async function POST(request: Request): Promise<Response> {
  let body: { path?: string; case_type_override?: CaseType };
  try {
    body = (await request.json()) as { path?: string; case_type_override?: CaseType };
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

  const caseTypeOverride: CaseType | undefined = body.case_type_override;
  const VALID_OVERRIDES: ReadonlySet<CaseType> = new Set<CaseType>(['E2', 'EB1A', 'EB1B', 'EB1C']);
  if (caseTypeOverride !== undefined && !VALID_OVERRIDES.has(caseTypeOverride)) {
    return Response.json(
      { error: `case_type_override must be one of E2, EB1A, EB1B, EB1C` },
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

  let pdfPaths: string[];
  try {
    pdfPaths = await walkIngestableFiles(rootPath);
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'walk_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
  const matterName = path.basename(rootPath);

  // Load any persisted manual overrides for this matter (display names +
  // doc_type overrides). Re-opening a folder picks corrections back up.
  // Best-effort — absent file means no overrides yet.
  let matterOverride;
  try {
    matterOverride = await getMatterOverride(rootPath);
  } catch (e: unknown) {
    console.warn(
      '[ingest-path] failed to read matter overrides:',
      e instanceof Error ? e.message : String(e),
    );
    matterOverride = null;
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, obj: unknown) => {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
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

      // Phase 0 — case-type detection. Sample up to 3 raw-doc PDFs and
      // run the Haiku 4.5 case-type classifier (E2 / EB1A / EB1B / EB1C).
      // Runs in parallel with Phase 1 below; the verdict is awaited
      // before the aggregator picks its branch.
      send(controller, {
        type: 'progress',
        stage: 'case_type_detecting',
        label: 'Detecting case type (E-2 vs EB-1A/B/C) from raw documents',
        total: pdfPaths.length,
      });

      // When the UI explicitly picks a case type (E-2 vs EB-1A button in the
      // sidebar), skip Phase-0 detection entirely and trust the override.
      // Without an override, sample up to 3 raw-doc PDFs and run the
      // Haiku 4.5 case-type classifier in parallel with Phase 1.
      const caseTypePromise: Promise<{
        case_type: CaseType;
        confidence: number;
        reasoning: string;
      }> = caseTypeOverride
        ? Promise.resolve({
            case_type: caseTypeOverride,
            confidence: 1,
            reasoning: `case_type forced to ${caseTypeOverride} by the UI sidebar`,
          })
        : (async () => {
            try {
              const samplePathsForDetect = pickRawDocSamplePaths(pdfPaths);
              const samples = await Promise.all(
                samplePathsForDetect.slice(0, 3).map(async (p) => {
                  const buf = await fs.readFile(p);
                  const parsed = await extractPdfText(buf);
                  return { filename: path.relative(rootPath, p), text: parsed.text };
                }),
              );
              if (samples.length === 0) {
                return { case_type: 'E2' as CaseType, confidence: 0, reasoning: 'no samples available; defaulted to E-2' };
              }
              const detection = await detectCaseType(samples);
              send(controller, {
                type: 'case_type_result',
                case_type: detection.case_type,
                confidence: detection.confidence,
                reasoning: detection.reasoning,
              });
              return {
                case_type: detection.case_type,
                confidence: detection.confidence,
                reasoning: detection.reasoning,
              };
            } catch (e: unknown) {
              send(controller, {
                type: 'case_type_error',
                message: e instanceof Error ? e.message : String(e),
              });
              return { case_type: 'E2' as CaseType, confidence: 0, reasoning: 'detection failed; defaulted to E-2' };
            }
          })();

      // Surface the forced case_type to the client so the loading overlay
      // can label what's happening accurately.
      if (caseTypeOverride) {
        send(controller, {
          type: 'case_type_result',
          case_type: caseTypeOverride,
          confidence: 1,
          reasoning: `forced by UI: ${caseTypeOverride}`,
        });
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
      // Runs in parallel with Phase 1 (per-PDF classify + extract). Only
      // fires when Phase 0 returns case_type='E2' — for EB-1A/B/C the
      // subtype concept doesn't apply and the call would be wasted.
      // Frees the 3-8 s detect critical-path cost.
      send(controller, {
        type: 'progress',
        stage: 'subtype_detecting',
        label: 'Classifying E-2 sub-type from raw client documents',
        total: pdfPaths.length,
      });

      const e2SubtypePromise: Promise<E2CaseSubtype | null> = (async () => {
        try {
          const detected = await caseTypePromise;
          if (detected.case_type !== 'E2') return null;
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
          const docOverride = matterOverride?.documents?.[item.filename];
          return classifyAndExtractOnePdf({
            filename: item.filename,
            buffer,
            forcedDocType: docOverride?.doc_type_override ?? undefined,
            // When the user forced EB1A via UI, run the deterministic
            // variant classifier inline. The detection-driven path runs
            // it post-detection below since `caseTypePromise` resolves
            // after Phase-1 has already started.
            caseTypeHint: caseTypeOverride === 'EB1A' ? 'EB1A' : undefined,
          });
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
            // Rich-extractor subtype discriminators — strings only, used
            // by lib/e2 audit to map coarse doc_type to fine-grained ids.
            subtypes: {
              formation_doc_subtype: r.corporateFormation?.formation_doc_subtype ?? null,
              contract_subtype: r.contract?.contract_subtype ?? null,
              government_doc_subtype: r.governmentDoc?.government_doc_subtype ?? null,
              tax_return_subtype: r.taxReturn?.tax_return_subtype ?? null,
              statement_subtype: r.financialStatement?.statement_subtype ?? null,
              credential_subtype: r.credential?.credential_subtype ?? null,
              payroll_subtype: r.payroll?.payroll_subtype ?? null,
              wire_subtype: r.wireConfirmation?.wire_subtype ?? null,
              vital_record_subtype: r.vitalRecords?.vital_record_subtype ?? null,
              foreign_doc_subtype: r.foreignCorporate?.foreign_doc_subtype ?? null,
              bank_statement_subtype:
                r.bankStatement?.bank_statement_subtype?.value ?? null,
            },
            // Full rich extraction content — used by the PDF detail modal
            // to show structured per-document facts (CV current title,
            // wire amount + FX rate, contract parties, etc.). Each field
            // is optional; only attached when the second-pass extractor
            // ran successfully on this PDF.
            rich: {
              passport: r.passport ?? null,
              visaStamp: r.visaStamp ?? null,
              i94: r.i94 ?? null,
              vitalRecords: r.vitalRecords ?? null,
              corporateFormation: r.corporateFormation ?? null,
              foreignCorporate: r.foreignCorporate ?? null,
              contract: r.contract ?? null,
              customerContract: r.customerContract ?? null,
              realEstatePurchase: r.realEstatePurchase ?? null,
              bankReceipt: r.bankReceipt ?? null,
              wireConfirmation: r.wireConfirmation ?? null,
              taxReturn: r.taxReturn ?? null,
              financialStatement: r.financialStatement ?? null,
              payroll: r.payroll ?? null,
              jobOffer: r.jobOffer ?? null,
              serviceRecord: r.serviceRecord ?? null,
              cv: r.cv ?? null,
              credential: r.credential ?? null,
              recommendationLetter: r.recommendationLetter ?? null,
              governmentDoc: r.governmentDoc ?? null,
              imagePhoto: r.imagePhoto ?? null,
              incentiveDocument: r.incentiveDocument ?? null,
              bankStatement: r.bankStatement ?? null,
            },
            // EB-1A 41-variant classification (only populated when the
            // user forced caseTypeOverride === 'EB1A' OR the detection-
            // driven post-pass below has run). The frontend EB-1A
            // criteria UI consumes this for per-criterion document
            // counts and (h)(3) routing.
            eb1aVariant: r.eb1aVariant ?? null,
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

      // Heartbeat: aggregator/draft/review go silent for many seconds while
      // Anthropic crunches. Without periodic events the dev server (and
      // some intermediate proxies) close the response, the client sees an
      // EOF without a `result` event, and the UI bounces back to "no
      // matters". 5s heartbeats keep the connection warm AND drive a
      // visible "still working — Xs elapsed" label in the loading overlay
      // (we re-emit `progress` so the existing reducer ticks the label).
      const startHeartbeat = (
        stage: 'aggregating' | 'drafting' | 'reviewing',
        baseLabel: string,
      ) => {
        const startedAt = Date.now();
        return setInterval(() => {
          const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
          try {
            send(controller, { type: 'heartbeat', stage, ts: Date.now() });
            // Re-emit a `progress` event so the loading overlay's typewriter
            // label tick visibly rather than freezing at the initial label.
            send(controller, {
              type: 'progress',
              stage,
              label: `${baseLabel} · ${elapsedSec}s elapsed`,
              total: pdfPaths.length,
            });
          } catch {
            /* controller already closed — let the outer flow notice */
          }
        }, 5000);
      };

      let result: IngestResult;
      const aggHeartbeat = startHeartbeat(
        'aggregating',
        `Reconciling ${successCount} per-document extractions into unified case facts`,
      );
      const detected = await caseTypePromise;
      try {
        if (detected.case_type === 'E2') {
          const aggregate = await aggregateTypedMemoryToE2(memory, {
            aliases,
          });
          const { caseFacts, ...gates } = aggregate;
          result = {
            filename: matterName,
            pageCount: totalPages,
            detection_confidence: detected.confidence,
            detection_reasoning:
              detected.reasoning ||
              'Case-type detected as E-2; per-document classifier feeds the aggregator directly. Sub-type from Phase-0.6 classifier.',
            caseFacts: { case_type: 'E2', facts: caseFacts },
            e2_subtype: e2Subtype,
            source_pdfs: sourcePdfs,
            // Forward all 15 deterministic-gate row arrays + derived flags so
            // the client audit can fold them into the unified conflict
            // register without re-running gate logic.
            aggregate_audit: {
              defensive_paragraphs_required: gates.defensive_paragraphs_required,
              marginality_evidence_present: gates.marginality_evidence_present,
              fx_gate_results: gates.fx_gate_results,
              passport_validity_results: gates.passport_validity_results,
              i94_status_results: gates.i94_status_results,
              translation_gate_results: gates.translation_gate_results,
              salary_benchmark_results: gates.salary_benchmark_results,
              cv_title_drift_results: gates.cv_title_drift_results,
              personal_reference_results: gates.personal_reference_results,
              credential_verifiability_results: gates.credential_verifiability_results,
              tax_balance_sheet_results: gates.tax_balance_sheet_results,
              pl_tax_net_income_results: gates.pl_tax_net_income_results,
              real_estate_buyer_mismatch_results: gates.real_estate_buyer_mismatch_results,
              incentive_recipient_mismatch_results: gates.incentive_recipient_mismatch_results,
              substantiality_recon_results: gates.substantiality_recon_results,
              entity_coherence_results: gates.entity_coherence_results,
            },
          } satisfies IngestSuccess;
        } else if (detected.case_type === 'EB1A') {
          // EB-1A Tier-0 variant classifier: 41-variant manifest at
          // ingest/extractors/eb1a-variant-manifest.ts. Pure regex/keyword
          // pass (zero LLM cost), runs over filename + first-page text per
          // PDF and attaches the result to the in-memory PerPdfResult so
          // the criterion gates downstream + the frontend criteria UI can
          // route documents into (h)(3)(i)–(x) buckets. Best-effort —
          // first-page parse failures fall through to filename-only.
          // pdfPaths preserves insertion order; build a relative-path →
          // absolute-path lookup (filtered `usable` array doesn't track
          // back to `pdfPaths` by index after the !error filter).
          const filenameToAbs = new Map(
            pdfPaths.map((p) => [path.relative(rootPath, p), p]),
          );
          await Promise.all(
            usable.map(async (r) => {
              if (r.eb1aVariant) return; // already attached by override path
              const absPath = filenameToAbs.get(r.filename);
              if (!absPath) return;
              let firstPageText = '';
              const lower = r.filename.toLowerCase();
              if (lower.endsWith('.pdf')) {
                try {
                  const buf = await fs.readFile(absPath);
                  const parsed = await extractPdfText(buf);
                  firstPageText = parsed.text.slice(0, 4000);
                } catch {
                  /* fall through to filename-only */
                }
              }
              if (
                !firstPageText &&
                r.facts &&
                'one_line_summary' in r.facts &&
                r.facts.one_line_summary?.value
              ) {
                firstPageText = r.facts.one_line_summary.value;
              }
              r.eb1aVariant = classifyEb1aVariant({
                filename: r.filename,
                first_page_text: firstPageText,
              });
            }),
          );

          const facts = await aggregateTypedMemoryToEb1a(memory);
          result = {
            filename: matterName,
            pageCount: totalPages,
            detection_confidence: detected.confidence,
            detection_reasoning: detected.reasoning,
            caseFacts: { case_type: 'EB1A', facts },
            source_pdfs: sourcePdfs,
          } satisfies IngestSuccess;
        } else {
          // EB-1B / EB-1C aggregator paths are not yet implemented. Surface
          // a clean error rather than running the wrong aggregator.
          result = {
            filename: matterName,
            pageCount: totalPages,
            source_pdfs: sourcePdfs,
            error: {
              code: 'unsupported_case_type',
              message: `Case type ${detected.case_type} is not yet supported by the typed-memory aggregator. Detection reasoning: ${detected.reasoning}`,
            },
          };
        }
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
      } finally {
        clearInterval(aggHeartbeat);
      }

      if ('error' in result) {
        send(controller, { type: 'result', result });
        send(controller, { type: 'done', total: pdfPaths.length });
        controller.close();
        return;
      }

      // Drafting and review no longer auto-fire on ingest — the user
      // triggers each artifact explicitly via the matter dashboard's
      // Generate buttons after they've classified enough of the corpus.
      send(controller, { type: 'result', result, matter_override: matterOverride ?? null });
      send(controller, { type: 'done', total: pdfPaths.length });
      controller.close();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : '';
        console.error('[ingest-path] fatal in stream:', e);
        try {
          send(controller, {
            type: 'result',
            result: {
              filename: matterName,
              pageCount: 0,
              error: {
                code: 'ingest_fatal',
                message: stack ? `${message}\n${stack}` : message,
              },
            },
          });
          send(controller, { type: 'done', total: 0 });
        } catch {}
        try {
          controller.close();
        } catch {}
      }
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
