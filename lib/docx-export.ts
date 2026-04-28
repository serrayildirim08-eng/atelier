/**
 * Render Markdown text to a .docx Blob using the `docx` library.
 *
 * Handles the subset our generators emit:
 *   - # / ## / ### headings (H1/H2/H3)
 *   - paragraphs (with **bold** and *italic*)
 *   - blockquotes (single-line `> ...`)
 *   - unordered lists (`- ...`) and ordered lists (`1. ...`)
 *   - GitHub-style pipe tables
 *   - horizontal rules (---) → blank line
 *
 * Anything more exotic (footnotes, images, nested code blocks) is
 * rendered as plain paragraph text — fine for the cover-letter /
 * declaration / business-plan / exhibit-list payloads we ship.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

function inlineRuns(line: string): TextRun[] {
  // Tokenize **bold** and *italic*. Boring but predictable.
  const out: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > lastIndex) {
      out.push(new TextRun(line.slice(lastIndex, m.index!)));
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    } else {
      out.push(new TextRun({ text: tok.slice(1, -1), italics: true }));
    }
    lastIndex = m.index! + tok.length;
  }
  if (lastIndex < line.length) {
    out.push(new TextRun(line.slice(lastIndex)));
  }
  if (out.length === 0) out.push(new TextRun(''));
  return out;
}

function tableFromBlock(rows: string[]): Table {
  const cells: string[][] = rows
    .filter((r) => !/^\s*\|?\s*[-:|\s]+\|?\s*$/.test(r)) // drop separator row
    .map((r) =>
      r
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: cells.map(
      (cellTexts, ri) =>
        new TableRow({
          children: cellTexts.map(
            (txt) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: inlineRuns(txt).map((r) =>
                      ri === 0
                        ? new TextRun({
                            text: (r as unknown as { text: string }).text ?? '',
                            bold: true,
                          })
                        : r,
                    ),
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

export async function markdownToDocxBuffer(markdown: string): Promise<Buffer> {
  const lines = markdown.split('\n');
  const children: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Pipe table: detect a `|...|` line followed by a separator row
    if (/^\|.+\|$/.test(line.trim()) && i + 1 < lines.length && /^\|?\s*[-:|\s]+\|?\s*$/.test(lines[i + 1].trim())) {
      const block: string[] = [];
      while (i < lines.length && /\|/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      children.push(tableFromBlock(block));
      continue;
    }

    if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('> ')) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(2), italics: true })],
          alignment: AlignmentType.LEFT,
          indent: { left: 720 },
        }),
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      children.push(
        new Paragraph({
          children: inlineRuns(line.replace(/^\s*[-*]\s+/, '')),
          bullet: { level: 0 },
        }),
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      children.push(
        new Paragraph({
          children: inlineRuns(line.replace(/^\s*\d+\.\s+/, '')),
          numbering: { reference: 'numbered', level: 0 },
        }),
      );
    } else if (line.trim() === '---' || line.trim() === '') {
      children.push(new Paragraph({ children: [new TextRun('')] }));
    } else {
      children.push(new Paragraph({ children: inlineRuns(line) }));
    }
    i++;
  }

  const doc = new Document({
    creator: 'AKALAN atelier',
    title: 'Generated document',
    numbering: {
      config: [
        {
          reference: 'numbered',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}
