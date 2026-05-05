/**
 * Plain-text (.txt) extractor — produces an ExtractedPdf-shaped result so
 * the downstream pipeline treats it as just another document.
 *
 * Single page synthesized; looksLikeScan=false. Decoder is utf-8 with
 * fallback to latin-1 when the buffer fails strict utf-8 (older Windows-
 * exported notes from foreign attorneys).
 */

import type { ExtractedPdf } from './pdf';

export function extractTxtText(buffer: Buffer): ExtractedPdf {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('latin1').decode(buffer);
  }
  return {
    text: `[page 1]\n${text}`,
    pageCount: 1,
    looksLikeScan: false,
  };
}
