/**
 * HTML / MHTML extractor — produces an ExtractedPdf-shaped result so the
 * downstream pipeline treats web pages as just another document.
 *
 * Uses Mozilla Readability against a JSDOM-parsed document to strip nav,
 * sidebars, ads, and footers. When Readability can't find an article
 * (e.g., a USCIS form page or a search-result page), falls back to a
 * cheerio sweep that pulls visible text from <main>, <article>, or
 * <body>, in that order.
 *
 * Title + canonical URL + author land in a header preamble so the
 * downstream classifier has the same metadata signals it gets from email
 * (From/Subject) and PDF (filename).
 *
 * MHTML (.mhtml / .webarchive) handling: MHTML wraps an HTML payload in
 * a multipart MIME envelope. We sniff the Content-Type boundary, pull
 * the text/html part, and route through the same Readability path.
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import type { ExtractedPdf } from './pdf';

function buildPreamble(headers: Record<string, string | null>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    if (v != null && v.length > 0) lines.push(`${k}: ${v}`);
  }
  return lines.join('\n');
}

/**
 * Extract the text/html payload from an MHTML envelope. MHTML is RFC-2557
 * multipart; we find the boundary, locate the first text/html part, and
 * decode quoted-printable / base64 if present. Failure returns null so
 * the caller can try plain-HTML parsing.
 */
function extractHtmlFromMhtml(raw: string): string | null {
  const boundaryMatch = raw.match(/boundary=["']?([^"'\r\n;]+)/i);
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1];
  const parts = raw.split(`--${boundary}`);
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toLowerCase();
    if (!headers.includes('content-type: text/html')) continue;
    let body = part.slice(headerEnd + 4);
    if (headers.includes('content-transfer-encoding: quoted-printable')) {
      body = body
        .replace(/=\r\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } else if (headers.includes('content-transfer-encoding: base64')) {
      try {
        body = Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
      } catch {
        return null;
      }
    }
    return body;
  }
  return null;
}

export function extractHtmlText(buffer: Buffer, filename: string): ExtractedPdf {
  const lower = filename.toLowerCase();
  const isMhtml = lower.endsWith('.mhtml') || lower.endsWith('.mht') || lower.endsWith('.webarchive');

  let html: string;
  try {
    html = buffer.toString('utf-8');
  } catch {
    html = buffer.toString('latin1');
  }
  if (isMhtml) {
    const inner = extractHtmlFromMhtml(html);
    if (inner) html = inner;
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const titleEl = doc.querySelector('title');
  const canonicalEl = doc.querySelector('link[rel="canonical"]');
  const authorMeta = doc.querySelector('meta[name="author"]');
  const ogUrl = doc.querySelector('meta[property="og:url"]');
  const ogSite = doc.querySelector('meta[property="og:site_name"]');

  const preamble = buildPreamble({
    Title: titleEl?.textContent?.trim() ?? null,
    URL: canonicalEl?.getAttribute('href') ?? ogUrl?.getAttribute('content') ?? null,
    Site: ogSite?.getAttribute('content') ?? null,
    Author: authorMeta?.getAttribute('content') ?? null,
  });

  let articleText = '';
  try {
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article?.textContent) {
      articleText = article.textContent.trim();
    }
  } catch {
    // Readability throws on some malformed documents; fall through to
    // the cheerio sweep below.
  }

  if (!articleText) {
    const $ = cheerio.load(html);
    const candidate =
      $('main').text().trim() ||
      $('article').text().trim() ||
      $('body').text().trim();
    articleText = candidate.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  const text = `[page 1]\n${preamble}\n\n${articleText}`;
  return { text, pageCount: 1, looksLikeScan: false };
}
