import { PDFParse } from 'pdf-parse';

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  looksLikeScan: boolean;
}

export interface RenderedPage {
  page: number;
  base64: string;
  width: number;
  height: number;
}

export interface RenderOptions {
  scale?: number;
  maxPages?: number;
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

/**
 * Render PDF pages to base64-encoded PNG using pdf-parse v2's native
 * getScreenshot. No external image-rendering dependency.
 *
 * Used by ingest/vision.ts as the bridge from raw PDF bytes to Claude
 * Vision content blocks for scanned documents.
 */
export async function renderPdfPages(
  buffer: Buffer,
  options: RenderOptions = {},
): Promise<RenderedPage[]> {
  const { scale = 2.0, maxPages } = options;
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    const total = info.total ?? 0;
    if (total === 0) return [];

    const pageNumbers =
      maxPages && maxPages < total
        ? Array.from({ length: maxPages }, (_, i) => i + 1)
        : Array.from({ length: total }, (_, i) => i + 1);

    const result = await parser.getScreenshot({
      scale,
      partial: pageNumbers,
      imageBuffer: true,
      imageDataUrl: false,
    });

    return result.pages.map((p) => ({
      page: p.pageNumber,
      base64: Buffer.from(p.data).toString('base64'),
      width: p.width,
      height: p.height,
    }));
  } finally {
    await parser.destroy();
  }
}
