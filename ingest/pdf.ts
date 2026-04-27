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

/**
 * PDFs at or under this page count get a full text extract. The
 * downstream sampler (sampleLongText, MAX_TEXT_CHARS=60K) only keeps
 * ~20 pages worth of chars anyway, so for anything bigger we restrict
 * the parse itself to a front+back window — same sample shape as the
 * char-level "front 75% / back 25%" pattern, applied at the page level
 * to skip the per-page font/glyph extraction work pdf-parse does.
 */
const FULL_PARSE_PAGE_THRESHOLD = 50;
const LARGE_PDF_FRONT_PAGES = 40;
const LARGE_PDF_BACK_PAGES = 10;

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: buffer });
  try {
    // Cheap metadata read — no parsePageInfo, just total. This lets us
    // decide whether to do a full parse or a windowed one before paying
    // the per-page cost.
    const info = await parser.getInfo();
    const total = info.total ?? 0;

    let result;
    let omittedRange: { from: number; to: number } | null = null;
    if (total === 0 || total <= FULL_PARSE_PAGE_THRESHOLD) {
      result = await parser.getText();
    } else {
      // Front + back window with a gap. Real page numbers are preserved
      // in the [page N] markers so source_page citations remain accurate
      // against the live PDF; the dropped middle range is announced
      // inline so the classifier knows it's a sampled view.
      const frontPages = Array.from(
        { length: LARGE_PDF_FRONT_PAGES },
        (_, i) => i + 1,
      );
      const backStart = total - LARGE_PDF_BACK_PAGES + 1;
      const backPages = Array.from(
        { length: LARGE_PDF_BACK_PAGES },
        (_, i) => backStart + i,
      );
      result = await parser.getText({ partial: [...frontPages, ...backPages] });
      omittedRange = {
        from: LARGE_PDF_FRONT_PAGES + 1,
        to: backStart - 1,
      };
    }

    const pageCount = total || result.total || result.pages.length;
    const sortedPages = [...result.pages].sort((a, b) => a.num - b.num);
    const sections: string[] = [];
    let prev = 0;
    for (const p of sortedPages) {
      if (omittedRange && prev < omittedRange.from && p.num > omittedRange.to) {
        sections.push(
          `[pages ${omittedRange.from}-${omittedRange.to} omitted for ingest sampling]`,
        );
      }
      sections.push(`[page ${p.num}]\n${p.text ?? ''}`);
      prev = p.num;
    }
    const text = sections.join('\n\n');

    // Scan detection uses chars-per-PARSED-page, not chars-per-total —
    // a 200-page bank statement we sampled to 50 pages should still
    // register as text-extractable when those 50 pages have text.
    const parsedPageCount = sortedPages.length || 1;
    const charsPerPage = text.length / parsedPageCount;
    const looksLikeScan =
      parsedPageCount > 0 && charsPerPage < SCAN_DETECTION_CHARS_PER_PAGE;

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
