/**
 * POST /api/re-aggregate
 *
 * Phase 11 — re-runs the cross-document aggregator (`aggregateTypedMemoryToE2`)
 * against the existing per-PDF cache without re-extracting anything.
 *
 * Use case: attorney already ingested a case folder once (the per-PDF
 * cache at `db/pdf-cache/v1/<sha256>.json` is populated), but wants to
 * pick up a typed-aggregate change OR re-derive the unified facts after
 * editing aliases / intake — without paying the O(n) Haiku tokens for
 * every PDF a second time. The home page's "Re-aggregate" button posts
 * the matter root here.
 *
 * What runs:
 *   - walkPdfs over `matter_root` (no Anthropic)
 *   - classifyAndExtractOnePdf per PDF — the content-hash cache hits and
 *     returns the cached PerPdfResult; misses (any PDF added since last
 *     ingest) extract through the normal path
 *   - aggregateTypedMemoryToE2 against the rebuilt typed memory
 *
 * What does NOT run: Phase-0.6 subtype detection, drafter, reviewer.
 * This route is read-only against the cache; it never deletes prior
 * extracts and never wipes the on-disk cache.
 *
 * Body:    { matter_root: string }       (absolute folder path)
 * Response: IngestSuccess (subset — caseFacts + aggregate_audit + source_pdfs)
 *           OR { error, code, message }
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type IngestResult, type IngestSuccess } from '@/ingest';
import {
  classifyAndExtractOnePdf,
  getTypedExtractConcurrency,
  runWithConcurrency,
} from '@/ingest/typed-extract';
import { groupByDocType, type PerPdfResult } from '@/ingest/typed-memory';
import { aggregateTypedMemoryToE2 } from '@/ingest/typed-aggregate';

export const runtime = 'nodejs';
export const maxDuration = 600;

const INGESTABLE_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.gif'];

async function walkPdfs(root: string): Promise<string[]> {
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
  let body: { matter_root?: string };
  try {
    body = (await request.json()) as { matter_root?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rootPath = body.matter_root;
  if (!rootPath || !path.isAbsolute(rootPath)) {
    return Response.json(
      { error: 'Provide an absolute folder path under "matter_root".' },
      { status: 400 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not set.' },
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
    return Response.json({ error: 'Path is not a directory.' }, { status: 400 });
  }

  const matterName = path.basename(rootPath);
  let pdfPaths: string[];
  try {
    pdfPaths = await walkPdfs(rootPath);
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'walk_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
  if (pdfPaths.length === 0) {
    const empty: IngestResult = {
      filename: matterName,
      pageCount: 0,
      error: { code: 'no_pdfs', message: 'No PDFs found in folder.' },
    };
    return Response.json({ result: empty });
  }

  const inputs = pdfPaths.map((p) => ({ filename: path.relative(rootPath, p), absPath: p }));
  const concurrency = getTypedExtractConcurrency();

  let perPdfResults: PerPdfResult[];
  try {
    perPdfResults = await runWithConcurrency(
      inputs,
      concurrency,
      async (item) => {
        const buffer = await fs.readFile(item.absPath);
        return classifyAndExtractOnePdf({ filename: item.filename, buffer });
      },
    );
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'extract_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const successCount = perPdfResults.filter((r) => r.facts && !r.error).length;
  const totalPages = perPdfResults.reduce((acc, r) => acc + r.pageCount, 0);
  const sourcePdfs = perPdfResults.map((r) => r.filename);

  const usable = perPdfResults.filter(
    (r): r is PerPdfResult & { facts: NonNullable<PerPdfResult['facts']> } =>
      !!r.facts && !r.error,
  );
  const memory = groupByDocType(usable);

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
    const aggregate = await aggregateTypedMemoryToE2(memory, { aliases });
    const { caseFacts, ...gates } = aggregate;
    result = {
      filename: matterName,
      pageCount: totalPages,
      detection_confidence: 1,
      detection_reasoning:
        'Re-aggregated from cached per-PDF extracts (no PDF parsing or per-PDF Haiku calls).',
      caseFacts: { case_type: 'E2', facts: caseFacts },
      source_pdfs: sourcePdfs,
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
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'aggregation_failed',
        code: 'aggregation_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  return Response.json({
    result,
    stats: {
      pdf_count: pdfPaths.length,
      success_count: successCount,
      total_pages: totalPages,
    },
  });
}
