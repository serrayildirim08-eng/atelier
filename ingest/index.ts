import { extractPdfText } from './pdf';
import { extractFactsWithClaude } from './claude';
import type { E2Facts } from './schema';

export type { E2Facts } from './schema';

export interface IngestSuccess {
  filename: string;
  pageCount: number;
  facts: E2Facts;
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

  try {
    const { facts } = await extractFactsWithClaude(pdf.text);
    return { filename, pageCount: pdf.pageCount, facts };
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
