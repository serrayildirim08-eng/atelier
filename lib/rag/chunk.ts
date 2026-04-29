import type { RagChunk } from './types';

/**
 * Markdown chunker tuned for the Akalan doctrine corpus (manuals, FAM
 * excerpts, firm playbook, briefings). Splits by H2 (## ) primarily; if
 * a section exceeds MAX_TOKENS, falls back to H3 (### ); if a single
 * H3 still overflows, slides a paragraph window with overlap.
 *
 * Heading breadcrumb is preserved on each chunk so retrieval results
 * cite "E2-Manual ▸ §5.2 SOF chain ▸ 5.2.1 FX gate" instead of just a
 * filename + offset.
 */

const MAX_CHARS = 6_000; // ~1500 tokens at 4 chars/token
const OVERLAP_CHARS = 400;

interface MarkdownSection {
  heading_path: string[];
  body: string;
}

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/**
 * Split markdown into sections keyed by heading breadcrumb. H1 (# ) is
 * treated as the document title and inherited by every section.
 */
function splitByHeadings(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];
  let currentH1: string | null = null;
  let currentH2: string | null = null;
  let currentH3: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const body = buffer.join('\n').trim();
    if (!body) {
      buffer = [];
      return;
    }
    const path: string[] = [];
    if (currentH1) path.push(currentH1);
    if (currentH2) path.push(currentH2);
    if (currentH3) path.push(currentH3);
    sections.push({ heading_path: path, body });
    buffer = [];
  };

  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line);
    const h2 = /^##\s+(.+)$/.exec(line);
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h1) {
      flush();
      currentH1 = h1[1].trim();
      currentH2 = null;
      currentH3 = null;
      continue;
    }
    if (h2) {
      flush();
      currentH2 = h2[1].trim();
      currentH3 = null;
      continue;
    }
    if (h3) {
      flush();
      currentH3 = h3[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

/**
 * Slide a paragraph-aware window over text that's too big for a single
 * chunk. Splits on blank lines, packs paragraphs up to MAX_CHARS, then
 * starts the next chunk with OVERLAP_CHARS of trailing context for
 * recall continuity.
 */
function slideWindow(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > MAX_CHARS && current) {
      chunks.push(current);
      const tail = current.slice(-OVERLAP_CHARS);
      current = tail + '\n\n' + p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export function chunkMarkdown(source: string, markdown: string): RagChunk[] {
  const sections = splitByHeadings(markdown);
  const out: RagChunk[] = [];
  let ordinal = 0;
  for (const section of sections) {
    const subChunks = slideWindow(section.body);
    for (const text of subChunks) {
      const headingLine = section.heading_path.length
        ? section.heading_path.join(' ▸ ')
        : '(unheaded)';
      const embed_input = `Source: ${source}\nHeading: ${headingLine}\n\n${text}`;
      out.push({
        id: `${source}#${ordinal}`,
        source,
        heading_path: section.heading_path,
        text,
        approx_tokens: approxTokens(text),
        embed_input,
      });
      ordinal++;
    }
  }
  return out;
}
