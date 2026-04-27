import { extractPdfText } from './pdf';
import { extractFactsByCaseType } from './claude';
import { detectCaseType } from './detect';
import type { CaseFacts, CaseType, E2Facts, EB1AFacts, EB1BFacts, EB1CFacts } from './schema';
import type { ReviewReport } from '@/reason';

export type {
  CaseType,
  CaseFacts,
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
  draft?: string;
  draftError?: { code: string; message: string };
  review?: ReviewReport;
  reviewError?: { code: string; message: string };
}

export interface IngestFailure {
  filename: string;
  pageCount: number;
  error: { code: string; message: string };
}

export type IngestResult = IngestSuccess | IngestFailure;

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

  if (pdf.looksLikeScan) {
    return {
      filename,
      pageCount: pdf.pageCount,
      error: {
        code: 'scan_not_supported',
        message:
          'PDF appears to be a scan (very low text density). Vision fallback is the next phase.',
      },
    };
  }

  let caseType: CaseType;
  let detectionConfidence: number;
  let detectionReasoning: string;
  try {
    const detection = await detectCaseType([{ filename, text: pdf.text }]);
    caseType = detection.case_type;
    detectionConfidence = detection.confidence;
    detectionReasoning = detection.reasoning;
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
    const { caseFacts } = await extractFactsByCaseType(caseType, pdf.text);
    return {
      filename,
      pageCount: pdf.pageCount,
      detection_confidence: detectionConfidence,
      detection_reasoning: detectionReasoning,
      caseFacts,
    };
  } catch (e: unknown) {
    return {
      filename,
      pageCount: pdf.pageCount,
      error: {
        code: 'extraction_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
