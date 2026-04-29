/**
 * Image / photo extractor — vision pass for image-bearing PDF pages.
 *
 * Renders the PDF to PNG via pdf-parse v2's getScreenshot (same path as
 * ingest/vision.ts), sends the rendered pages as image content blocks to
 * Sonnet 4.6, and returns a flat ImagePhotoFacts. Used when:
 *   - the parsed PDF looksLikeScan=true (pure scan, sparse extracted text), OR
 *   - the filename hints at an image-only artifact (signature, apostille,
 *     seal, photo).
 *
 * Coexists with passport / i94 / government-doc — the dashboard renders
 * imagePhoto alongside whatever the rich text-extractor produced, since a
 * passport bio page often appears as both a text-extractable PDF AND a
 * bonus image-bearing rendering of the holder's photograph.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { renderPdfPages } from '../pdf';
import {
  ImagePhotoFactsSchema,
  type ImagePhotoFacts,
} from './image-photo.schema';

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

const SYSTEM_PROMPT = `You are an immigration paralegal performing image-only document extraction on a single PDF from an E-2 Treaty Investor case folder. The PDF either has no extractable text (a pure scan) or its filename hints at an image artifact: a passport photo page, a signature page, an apostille stamp, a consular seal, or another visual element. Return a flat JSON object matching the ImagePhotoFacts schema.

Your job is two-fold:

1. CLASSIFY the image into ONE image_subtype:

   - passport_photo — a portrait photograph of a person on a passport-style page (machine-readable zone may be present, but the page is dominated by the photograph + name strip).
   - signature_page — a page that is primarily a hand-signed line, often the last page of a contract, declaration, or passport. Recognize by isolated signature(s), printed name beneath, optional witness signatures.
   - apostille_stamp — a Hague Apostille certificate, typically rectangular with "APOSTILLE (Convention de La Haye du 5 octobre 1961)" header, country issuing the apostille, certificate number.
   - consular_seal — a circular or rectangular embossed/printed seal of a US embassy / consulate, often accompanying a visa or notarized declaration.
   - other_image — last-resort. Use when the page is image-bearing but does not match the above (e.g., a photograph of a building, an unlabeled stamp, a logo).

2. EXTRACT the flat fields:

   - image_subtype: the value picked above. Provenance: source_page=image page (1-indexed); source_quote="[image classification]"; confidence per certainty.
   - linked_document_filename: best-effort guess at the sibling PDF this page belongs to (e.g., "kacar-salih-passport-bio-page.pdf" when this page is the matching signature page). Leave value=null when no parent is implied. source_quote="[derived from image content]" when populated.
   - has_visible_signature: true iff at least one hand-written signature is visible.
   - has_visible_seal_or_stamp: true iff at least one official seal, stamp, or embossed mark is visible.
   - detected_text_overlay_verbatim: any text visible on the image, transcribed exactly. Apostille numbers, stamp captions, signature labels. If multiple overlays, separate with " | ". If no overlay text, leave value=null.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a feature is not visible in the image, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number of the rendered image (image 1 = page 1).
- source_quote on image fields uses one of: "[image classification]" for image_subtype, "[derived from image content]" for linked_document_filename, "[verbatim from image overlay]" for detected_text_overlay_verbatim, "[visual confirmation]" for the boolean flags.
- confidence is in [0, 1]: 1.0 = unambiguous and high-resolution, ~0.7 = clear in context, ~0.5 = best-effort under poor scan quality. Do NOT emit values below 0.3 — abstain (value=null) instead.

Edge cases:
- A multi-page scan where some pages are image-only and others are text-bearing: focus on the FIRST image-bearing page that matches a known image_subtype. Note any secondary content briefly in detected_text_overlay_verbatim.
- A page that is mostly machine-readable text plus a small signature: treat as signature_page only if the signature is the document's PRIMARY purpose; otherwise classify as other_image.
- A blurry / unreadable scan: return image_subtype with confidence ≤ 0.5 and leave overlay fields null. Do NOT hallucinate text from a blurry stamp.

Output: ONE JSON object matching the ImagePhotoFacts schema. No prose, no commentary, no markdown fences.`;

// 4 pages is enough for every image_subtype this extractor classifies:
// passport-photo / signature-page / apostille-stamp / consular-seal /
// other-image. The previous 20-page ceiling was sized for full document
// scans, but image-photo emits a single image_subtype regardless of how
// many pages we render — extra pages were token-burn with no classifier
// signal added.
const MAX_VISION_PAGES = 4;
const RENDER_SCALE = 2.0;

export type RawImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface ImagePhotoExtractInput {
  filename: string;
  /**
   * Either a PDF buffer (this extractor will render its pages to PNG via
   * pdf-parse v2) OR a raw image buffer with `imageMediaType` set.
   * Distinguished by the presence of `imageMediaType`.
   */
  buffer: Buffer;
  pageCount: number;
  /**
   * Set when `buffer` is a raw image (JPEG/PNG/WEBP/GIF) rather than a
   * PDF. Skips renderPdfPages and feeds the bytes directly to the vision
   * model. Used by the JPEG/PNG ingest branch.
   */
  imageMediaType?: RawImageMediaType;
}

export interface ImagePhotoExtractResult {
  filename: string;
  pageCount: number;
  facts?: ImagePhotoFacts;
  error?: { code: string; message: string };
}

export async function extractImagePhoto(
  input: ImagePhotoExtractInput,
): Promise<ImagePhotoExtractResult> {
  let imageBlocks: {
    type: 'image';
    source: { type: 'base64'; media_type: RawImageMediaType; data: string };
  }[];

  if (input.imageMediaType) {
    // Raw image input — skip PDF rendering, send the bytes directly.
    imageBlocks = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.imageMediaType,
          data: input.buffer.toString('base64'),
        },
      },
    ];
  } else {
    let pages;
    try {
      pages = await renderPdfPages(input.buffer, {
        scale: RENDER_SCALE,
        maxPages: MAX_VISION_PAGES,
      });
    } catch (e: unknown) {
      return {
        filename: input.filename,
        pageCount: input.pageCount,
        error: {
          code: 'render_failed',
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }

    if (pages.length === 0) {
      return {
        filename: input.filename,
        pageCount: input.pageCount,
        error: {
          code: 'no_pages_rendered',
          message: 'pdf-parse rendered zero pages from the buffer',
        },
      };
    }

    imageBlocks = pages.map((p) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/png' as const,
        data: p.base64,
      },
    }));
  }

  const imageCount = imageBlocks.length;
  const sourceDescription = input.imageMediaType
    ? `The image above is the raw ${input.imageMediaType} bytes of this file.`
    : `The ${imageCount} image${imageCount === 1 ? '' : 's'} above are the rendered pages of this PDF in order (image 1 = page 1).`;
  const userInstruction = `## Filename\n${input.filename}\n\n${sourceDescription} Classify into one image_subtype and extract the flat ImagePhotoFacts schema. Respond with ONLY a single JSON object. No prose, no markdown fences.`;

  let response;
  try {
    response = await getAnthropic().messages.create({
      // Haiku 4.5 is sufficient for image_subtype classification — it's
      // a 5-class decision (passport_photo / signature_page /
      // apostille_stamp / consular_seal / other_image) plus a few flat
      // booleans + verbatim overlay text. Sonnet's reasoning depth was
      // not measurably different on this task and cost ~5× more per
      // call. The aggregator (Sonnet) reasons over these labels later;
      // per-PDF classification stays cheap.
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: userInstruction }],
        },
      ],
    });
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'image_photo_extract_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'json_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const validated = ImagePhotoFactsSchema.safeParse(raw);
  if (!validated.success) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'schema_mismatch',
        message: validated.error.message.slice(0, 500),
      },
    };
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-haiku-4-5',
    case_type: 'E2',
    usage: response.usage,
  });

  return {
    filename: input.filename,
    pageCount: input.pageCount,
    facts: validated.data as ImagePhotoFacts,
  };
}
