/**
 * Spreadsheet (.xlsx, .xls, .ods, .csv) extractor — produces an
 * ExtractedPdf-shaped result so the downstream pipeline treats tabular
 * data as just another document.
 *
 * .xlsx / .xls / .ods → SheetJS reads every sheet, renders rows as
 * pipe-delimited lines under a `## <sheet name>` heading. Empty cells
 * collapse to the empty string. We cap each sheet at MAX_ROWS rows to
 * keep the LLM context manageable; truncation is announced inline.
 *
 * .csv → csv-parse in sync mode; rendered as a single sheet under the
 * heading `## CSV`.
 *
 * No header detection — first row is treated like every other row. The
 * downstream classifier does not need typed columns; it just needs the
 * text to score keyword matches (citation table, payroll, BLS survey).
 */

import * as XLSX from 'xlsx';
import { parse as parseCsvSync } from 'csv-parse/sync';
import type { ExtractedPdf } from './pdf';

const MAX_ROWS_PER_SHEET = 500;

function renderRows(rows: unknown[][], sheetName: string): string {
  const truncated = rows.length > MAX_ROWS_PER_SHEET;
  const slice = truncated ? rows.slice(0, MAX_ROWS_PER_SHEET) : rows;
  const body = slice
    .map((row) =>
      row
        .map((cell) =>
          cell === null || cell === undefined ? '' : String(cell).trim(),
        )
        .join(' | '),
    )
    .join('\n');
  const suffix = truncated
    ? `\n[...truncated, ${rows.length - MAX_ROWS_PER_SHEET} more rows omitted]`
    : '';
  return `## ${sheetName}\n${body}${suffix}`;
}

export function extractSpreadsheetText(buffer: Buffer, filename: string): ExtractedPdf {
  const lower = filename.toLowerCase();
  const isCsv = lower.endsWith('.csv');

  const sections: string[] = [];

  if (isCsv) {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder('latin1').decode(buffer);
    }
    let rows: unknown[][];
    try {
      rows = parseCsvSync(text, {
        skip_empty_lines: true,
        relax_column_count: true,
      }) as unknown[][];
    } catch {
      rows = text.split(/\r?\n/).map((line) => line.split(','));
    }
    sections.push(renderRows(rows, 'CSV'));
  } else {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
        defval: '',
      }) as unknown[][];
      if (rows.length === 0) continue;
      sections.push(renderRows(rows, sheetName));
    }
  }

  const text = `[page 1]\n${sections.join('\n\n')}`;
  return { text, pageCount: 1, looksLikeScan: false };
}
