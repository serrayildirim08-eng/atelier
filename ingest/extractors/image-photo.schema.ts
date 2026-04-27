/**
 * Per-PDF image / photo extractor schema.
 *
 * Single flat schema (no discriminated union) for image-bearing PDF
 * pages where text extraction is sparse: passport photos, signature
 * pages, apostille stamps, consular seals, and other image-only
 * artifacts. Used as a side-channel rich extraction that STACKS with
 * passport / i94 / government-doc when the same PDF carries both text
 * and an image-bearing page.
 *
 * Routes when:
 *   - the parsed PDF looks like a scan (looksLikeScan=true), OR
 *   - the filename matches /(photo|signature|stamp|apostille|seal|imza|fotoğraf|mühür)/i.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const ImagePhotoFactsSchema = z.object({
  /**
   * Kind of image artifact the PDF page represents. Optional flat field —
   * not a discriminator; downstream consumers can fan out on this if
   * needed but the schema stays a single shape.
   */
  image_subtype: Field(
    z.enum([
      'passport_photo',
      'signature_page',
      'apostille_stamp',
      'consular_seal',
      'other_image',
    ]),
  ),
  /**
   * Raw filename of a sibling PDF the image belongs to (e.g., a
   * `passport-signature-page.pdf` belongs to `passport-bio-page.pdf`).
   * Best-effort — null when the model cannot infer a parent.
   */
  linked_document_filename: Field(z.string()),
  has_visible_signature: Field(z.boolean()),
  has_visible_seal_or_stamp: Field(z.boolean()),
  /**
   * Verbatim transcription of any text overlay on the image (apostille
   * number, seal text, signature caption). Captured exactly as visible —
   * the aggregator can use this for cross-reference (e.g., apostille
   * number stamped on a translated foreign document must match the
   * apostille number on the parent record).
   */
  detected_text_overlay_verbatim: Field(z.string()),
});

export type ImagePhotoFacts = z.infer<typeof ImagePhotoFactsSchema>;

export const IMAGE_PHOTO_SUBTYPE_LABELS: Record<
  'passport_photo'
  | 'signature_page'
  | 'apostille_stamp'
  | 'consular_seal'
  | 'other_image',
  string
> = {
  passport_photo: 'Passport Photo',
  signature_page: 'Signature Page',
  apostille_stamp: 'Apostille Stamp',
  consular_seal: 'Consular Seal',
  other_image: 'Other Image',
};
