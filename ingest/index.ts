import { extractPdfText } from './pdf';
import { extractFactsByCaseType } from './claude';
import { extractFactsViaVision } from './vision';
import { detectCaseTypeWithSubtype } from './detect';
import type {
  CaseFacts,
  CaseType,
  E2CaseSubtype,
  E2Facts,
  EB1AFacts,
  EB1BFacts,
  EB1CFacts,
} from './schema';
import type { ReviewReport } from '@/reason';
import type { VerifyReport } from '@/lib/verify';

export type {
  CaseType,
  CaseFacts,
  E2CaseSubtype,
  E2Facts,
  EB1AFacts,
  EB1BFacts,
  EB1CFacts,
} from './schema';

export interface IngestSuccess {
  filename: string;
  pageCount: number;
  detection_confidence: number;
  detection_reasoning: string;
  caseFacts: CaseFacts;
  /**
   * Phase-0.6 sub-type detection (manuals/_E2-SUBTYPE-TAXONOMY.md §12).
   * Populated when caseFacts.case_type === 'E2'; null otherwise. Carries
   * principal_subtype, procedural_posture, and dependent breakdown — the
   * downstream drafter / reviewer / extractor branch on this.
   */
  e2_subtype?: E2CaseSubtype | null;
  draft?: string;
  draftError?: { code: string; message: string };
  verify_report?: VerifyReport;
  review?: ReviewReport;
  reviewError?: { code: string; message: string };
  source_pdfs?: string[];
  scanned_pdfs?: string[];
}

export interface IngestFailure {
  filename: string;
  pageCount: number;
  error: { code: string; message: string };
}

export type IngestResult = IngestSuccess | IngestFailure;

/**
 * Treat a folder of PDFs as a single matter (one client, one case).
 * Concatenates the text of every PDF with [doc: <relpath>] markers, runs
 * detect once, extracts once. Caller is responsible for draft/review.
 *
 * Scanned PDFs are skipped from the merged text (vision fallback would
 * blow the context budget at matter scale) and reported in scanned_pdfs.
 */
export async function ingestMatter(
  matterName: string,
  pdfs: { relPath: string; buffer: Buffer }[],
): Promise<IngestResult> {
  if (pdfs.length === 0) {
    return {
      filename: matterName,
      pageCount: 0,
      error: { code: 'no_pdfs', message: 'No PDFs in folder.' },
    };
  }

  const docs: { relPath: string; text: string; pages: number; scanned: boolean }[] = [];
  for (const { relPath, buffer } of pdfs) {
    try {
      const parsed = await extractPdfText(buffer);
      docs.push({
        relPath,
        text: parsed.text,
        pages: parsed.pageCount,
        scanned: parsed.looksLikeScan,
      });
    } catch (e: unknown) {
      docs.push({
        relPath,
        text: `[parse_failed: ${e instanceof Error ? e.message : String(e)}]`,
        pages: 0,
        scanned: false,
      });
    }
  }

  const sourcePdfs = docs.map((d) => d.relPath);
  const scannedPdfs = docs.filter((d) => d.scanned).map((d) => d.relPath);
  const totalPages = docs.reduce((acc, d) => acc + d.pages, 0);

  const usable = docs.filter((d) => !d.scanned);
  if (usable.length === 0) {
    return {
      filename: matterName,
      pageCount: totalPages,
      source_pdfs: sourcePdfs,
      scanned_pdfs: scannedPdfs,
      error: {
        code: 'all_scanned',
        message:
          'Every PDF in this folder appears to be a scan (very low text density). Vision fallback at matter scale is not yet supported.',
      },
    };
  }

  const merged = usable
    .map((d) => `=== DOCUMENT: ${d.relPath} ===\n\n${d.text}`)
    .join('\n\n');

  const samples = usable.slice(0, 3).map((d) => ({ filename: d.relPath, text: d.text }));

  let caseType: CaseType;
  let detectionConfidence: number;
  let detectionReasoning: string;
  let e2Subtype: E2CaseSubtype | null;
  try {
    const detection = await detectCaseTypeWithSubtype(samples);
    caseType = detection.case_type;
    detectionConfidence = detection.confidence;
    detectionReasoning = detection.reasoning;
    e2Subtype = detection.e2_subtype;
  } catch (e: unknown) {
    return {
      filename: matterName,
      pageCount: totalPages,
      source_pdfs: sourcePdfs,
      scanned_pdfs: scannedPdfs,
      error: {
        code: 'detection_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  try {
    const { caseFacts } = await extractFactsByCaseType(caseType, merged);
    return {
      filename: matterName,
      pageCount: totalPages,
      detection_confidence: detectionConfidence,
      detection_reasoning: detectionReasoning,
      caseFacts,
      e2_subtype: e2Subtype,
      source_pdfs: sourcePdfs,
      scanned_pdfs: scannedPdfs,
    };
  } catch (e: unknown) {
    return {
      filename: matterName,
      pageCount: totalPages,
      source_pdfs: sourcePdfs,
      scanned_pdfs: scannedPdfs,
      error: {
        code: 'extraction_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

export async function ingestPdf(buffer: Buffer, filename: string): Promise<IngestResult> {
  let pdf;
  try {
    pdf = await extractPdfText(buffer);
  } catch (e: unknown) {
    return {
      filename,
      pageCount: 0,
      error: {
        code: 'pdf_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let caseType: CaseType;
  let detectionConfidence: number;
  let detectionReasoning: string;
  let e2Subtype: E2CaseSubtype | null;
  try {
    const detection = await detectCaseTypeWithSubtype([
      { filename, text: pdf.text },
    ]);
    caseType = detection.case_type;
    detectionConfidence = detection.confidence;
    detectionReasoning = pdf.looksLikeScan
      ? `${detection.reasoning} [Note: PDF appears scanned; detection ran on sparse OCR-like text.]`
      : detection.reasoning;
    e2Subtype = detection.e2_subtype;
  } catch (e: unknown) {
    return {
      filename,
      pageCount: pdf.pageCount,
      error: {
        code: 'detection_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  try {
    const { caseFacts } = pdf.looksLikeScan
      ? await extractFactsViaVision(buffer, caseType)
      : await extractFactsByCaseType(caseType, pdf.text);
    return {
      filename,
      pageCount: pdf.pageCount,
      detection_confidence: detectionConfidence,
      detection_reasoning: detectionReasoning,
      caseFacts,
      e2_subtype: e2Subtype,
    };
  } catch (e: unknown) {
    return {
      filename,
      pageCount: pdf.pageCount,
      error: {
        code: pdf.looksLikeScan ? 'vision_extraction_failed' : 'extraction_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
