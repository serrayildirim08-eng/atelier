import mammoth from 'mammoth';
import type { ExtractedPdf } from './pdf';

/**
 * DOCX text extractor — produces an ExtractedPdf-shaped result so the
 * downstream pipeline (typed-extract, classifier, rich extractors)
 * doesn't need to special-case Word documents.
 *
 * DOCX has no concept of pages, so we synthesize a single `[page 1]`
 * marker and report pageCount=1. looksLikeScan is always false — if
 * mammoth returned text at all, the doc has machine-readable content.
 */
export async function extractDocxText(buffer: Buffer): Promise<ExtractedPdf> {
  const { value } = await mammoth.extractRawText({ buffer });
  const text = `[page 1]\n${value ?? ''}`;
  return { text, pageCount: 1, looksLikeScan: false };
}
