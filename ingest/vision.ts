import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { renderPdfPages } from './pdf';
import { SYSTEM_PROMPTS, FORMATS } from './claude';
import type { CaseFacts, CaseType } from './schema';

/**
 * Cap pages sent to Claude in a single vision call. Each page at scale=2.0
 * runs ~1500-2500 vision tokens; 20 pages is a reasonable ceiling for one
 * Sonnet call. Cases with more pages should be split — flag for now.
 */
const MAX_VISION_PAGES = 20;
const RENDER_SCALE = 2.0;

export interface VisionExtractionUsage {
  input_tokens: number;
  output_tokens: number;
  pages_rendered: number;
  pages_total: number;
}

export interface VisionExtractionResult {
  caseFacts: CaseFacts;
  usage: VisionExtractionUsage;
  truncated: boolean;
}

/**
 * Vision fallback for scanned PDFs. Renders pages to PNG via pdf-parse v2's
 * native getScreenshot, sends them as image content blocks to Sonnet 4.6
 * with the same case-type system prompt the text path uses, and returns
 * the same CaseFacts shape. Provenance fields (source_page, source_quote)
 * stay populated by the model — Citations API integration in Iteration 4
 * will tighten this further.
 */
export async function extractFactsViaVision(
  buffer: Buffer,
  case_type: CaseType,
): Promise<VisionExtractionResult> {
  const pages = await renderPdfPages(buffer, {
    scale: RENDER_SCALE,
    maxPages: MAX_VISION_PAGES,
  });

  if (pages.length === 0) {
    throw new Error('Vision fallback: pdf-parse rendered zero pages');
  }

  const imageBlocks = pages.map((p) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: p.base64,
    },
  }));

  const userInstruction = `The ${pages.length} image${pages.length === 1 ? '' : 's'} above are scanned pages of a ${case_type} case document, in order (image 1 = page 1). Extract the case facts per the schema. Use the page number (1-indexed, matching image position) for source_page. For source_quote, transcribe a short verbatim phrase from the page that supports the value. The PDF is a scan, so OCR-style reading applies — reduce confidence for low-readability text.`;

  const response = await getAnthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPTS[case_type],
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: userInstruction }],
      },
    ],
    output_config: {
      format: FORMATS[case_type],
    },
  });

  if (!response.parsed_output) {
    throw new Error(`Vision extractor for ${case_type} did not match the schema`);
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-sonnet-4-6',
    case_type,
    usage: response.usage,
  });

  // pages.length is what we actually sent; pdf may have more pages we capped.
  // We don't recompute total here — caller can probe with extractPdfText if
  // they need the full count for the truncated flag below.
  return {
    caseFacts: { case_type, facts: response.parsed_output } as CaseFacts,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      pages_rendered: pages.length,
      pages_total: pages.length, // populated by caller if known
    },
    truncated: pages.length === MAX_VISION_PAGES,
  };
}
