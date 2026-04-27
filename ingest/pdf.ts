import { PDFParse } from 'pdf-parse';

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  looksLikeScan: boolean;
}

const SCAN_DETECTION_CHARS_PER_PAGE = 50;

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    const pageCount = info.total ?? 0;

    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const r = await parser.getText({ partial: [i] });
      pages.push(`[page ${i}]\n${r.text ?? ''}`);
    }

    const text = pages.join('\n\n');
    const charsPerPage = pageCount > 0 ? text.length / pageCount : 0;
    const looksLikeScan = pageCount > 0 && charsPerPage < SCAN_DETECTION_CHARS_PER_PAGE;

    return { text, pageCount, looksLikeScan };
  } finally {
    await parser.destroy();
  }
}
