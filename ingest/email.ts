/**
 * Email (.eml + .msg) text extractor — produces an ExtractedPdf-shaped
 * result so the downstream pipeline (typed-extract, classifier, rich
 * extractors) treats emails as just another document.
 *
 * The rendered text is structured as:
 *
 *   [page 1]
 *   From: ...
 *   To: ...
 *   Cc: ...
 *   Date: ...
 *   Subject: ...
 *
 *   <body text>
 *
 *   --- Attachments ---
 *   - filename.pdf (application/pdf, 12345 bytes)
 *   - photo.jpg (image/jpeg, 8910 bytes)
 *
 * Header preamble is critical for the doc-type classifier — RFE notices,
 * USCIS correspondence, expert-letter drafts, and client fact emails all
 * cluster on subject line + sender domain patterns. Body text is HTML-
 * stripped (mailparser handles this) and trimmed.
 *
 * Attachments are LISTED but not extracted from the email here — the
 * caller is responsible for unpacking them as separate PerPdfResults if
 * the firm wants them re-ingested.
 */

import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import MsgReader from '@kenjiuno/msgreader';
import type { ExtractedPdf } from './pdf';

function renderAddress(field: AddressObject | AddressObject[] | undefined): string | null {
  if (!field) return null;
  const arr = Array.isArray(field) ? field : [field];
  const text = arr
    .map((a) => a.text?.trim())
    .filter((s): s is string => !!s && s.length > 0)
    .join(', ');
  return text.length > 0 ? text : null;
}

function buildPreamble(headers: Record<string, string | null>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    if (v != null && v.length > 0) lines.push(`${k}: ${v}`);
  }
  return lines.join('\n');
}

/**
 * Parse a raw .eml buffer (RFC-5322) and render to ExtractedPdf shape.
 */
export async function extractEmlText(buffer: Buffer): Promise<ExtractedPdf> {
  const parsed: ParsedMail = await simpleParser(buffer);
  const preamble = buildPreamble({
    From: renderAddress(parsed.from),
    To: renderAddress(parsed.to),
    Cc: renderAddress(parsed.cc),
    Bcc: renderAddress(parsed.bcc),
    Date: parsed.date ? parsed.date.toISOString() : null,
    Subject: parsed.subject?.trim() ?? null,
  });

  const body = (parsed.text ?? '').trim();
  const attachmentLines = (parsed.attachments ?? [])
    .filter((a) => a.filename || a.contentType)
    .map(
      (a) =>
        `- ${a.filename ?? '(unnamed)'} (${a.contentType ?? 'application/octet-stream'}, ${a.size ?? 0} bytes)`,
    );
  const attachmentsBlock = attachmentLines.length
    ? `\n\n--- Attachments ---\n${attachmentLines.join('\n')}`
    : '';

  const text = `[page 1]\n${preamble}\n\n${body}${attachmentsBlock}`;
  return { text, pageCount: 1, looksLikeScan: false };
}

/**
 * Parse an Outlook .msg buffer (CFB/MAPI) and render to ExtractedPdf
 * shape. msgreader returns a flat object with senderName, senderEmail,
 * recipients[], subject, body, attachments[].
 */
export async function extractMsgText(buffer: Buffer): Promise<ExtractedPdf> {
  // MsgReader wants an ArrayBuffer; Buffer is a Uint8Array view onto a
  // shared pool, so slice off a fresh ArrayBuffer of the exact bytes.
  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const reader = new MsgReader(ab);
  const data = reader.getFileData();

  const sender =
    data.senderName && data.senderEmail
      ? `${data.senderName} <${data.senderEmail}>`
      : data.senderName ?? data.senderEmail ?? null;

  const recipients = (data.recipients ?? [])
    .map((r: { name?: string; email?: string; recipType?: string }) => {
      const text = r.name && r.email ? `${r.name} <${r.email}>` : r.name ?? r.email ?? '';
      return { text, type: (r.recipType ?? 'to').toLowerCase() };
    })
    .filter((r: { text: string }) => r.text.length > 0);

  const to = recipients.filter((r: { type: string }) => r.type === 'to').map((r: { text: string }) => r.text).join(', ');
  const cc = recipients.filter((r: { type: string }) => r.type === 'cc').map((r: { text: string }) => r.text).join(', ');
  const bcc = recipients.filter((r: { type: string }) => r.type === 'bcc').map((r: { text: string }) => r.text).join(', ');

  const preamble = buildPreamble({
    From: sender,
    To: to.length > 0 ? to : null,
    Cc: cc.length > 0 ? cc : null,
    Bcc: bcc.length > 0 ? bcc : null,
    Date: data.messageDeliveryTime ?? data.clientSubmitTime ?? null,
    Subject: data.subject?.trim() ?? null,
  });

  const body = (data.body ?? '').trim();
  const attachmentLines = (data.attachments ?? [])
    .filter((a: { fileName?: string; mimeType?: string }) => a.fileName || a.mimeType)
    .map(
      (a: { fileName?: string; mimeType?: string; contentLength?: number }) =>
        `- ${a.fileName ?? '(unnamed)'} (${a.mimeType ?? 'application/octet-stream'}, ${a.contentLength ?? 0} bytes)`,
    );
  const attachmentsBlock = attachmentLines.length
    ? `\n\n--- Attachments ---\n${attachmentLines.join('\n')}`
    : '';

  const text = `[page 1]\n${preamble}\n\n${body}${attachmentsBlock}`;
  return { text, pageCount: 1, looksLikeScan: false };
}
