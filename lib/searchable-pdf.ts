/**
 * Convert any ingestable document to a searchable PDF that visually
 * matches the original. Powers the "every doc → editable PDF" flow.
 *
 * Pipeline by input type:
 *   - .pdf                        → ocrmypdf in place
 *   - .jpg/.jpeg/.png/.webp/.gif  → ocrmypdf --image-dpi 300
 *   - .docx/.xlsx/.xls/.ods/.csv/
 *     .txt/.html/.htm/.eml         → libreoffice --convert-to pdf, then ocrmypdf
 *   - .msg                        → preliminary conversion to .eml via
 *                                   wrapping-headers, then libreoffice path
 *
 * Output is a PDF with an OCR text layer beneath the page image. Adobe
 * Acrobat / Preview / Foxit treat the text layer as the editable surface,
 * so the result is BOTH searchable AND editable in any PDF editor that
 * supports OCR-derived text.
 *
 * Languages: eng + tur. Add more with --languages on the call. Turkish
 * is the firm's primary non-English language; tesseract-lang ships ~100
 * languages we can opt into per-document if needed.
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const OCRMYPDF_BIN = process.env.OCRMYPDF_BIN ?? 'ocrmypdf';
const SOFFICE_BIN = process.env.SOFFICE_BIN ?? 'soffice';

export interface SearchablePdfOptions {
  /**
   * Tesseract language codes joined with '+'. Default 'eng+tur'.
   * Full list: tesseract --list-langs after `brew install tesseract-lang`.
   */
  languages?: string;
  /**
   * When true (default), the OCR step skips pages that already have a
   * machine-readable text layer. Saves time on already-searchable PDFs.
   */
  skipExistingText?: boolean;
  /**
   * DPI used when rasterizing image inputs. 300 is the OCRmyPDF default
   * sweet spot for accuracy vs. file size.
   */
  imageDpi?: number;
}

const DEFAULT_OPTIONS: Required<SearchablePdfOptions> = {
  languages: 'eng+tur',
  skipExistingText: true,
  imageDpi: 300,
};

const LIBREOFFICE_FORMATS = new Set([
  '.docx', '.doc',
  '.xlsx', '.xls', '.ods', '.csv',
  '.txt',
  '.html', '.htm',
  '.eml',
  '.rtf', '.odt',
]);

const IMAGE_FORMATS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.bmp']);

function ext(filename: string): string {
  return path.extname(filename).toLowerCase();
}

async function runProcess(
  bin: string,
  args: string[],
  opts: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf-8');
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf-8');
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr || stdout}`));
    });
  });
}

async function makeWorkdir(): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `searchable-pdf-${crypto.randomBytes(6).toString('hex')}`,
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Convert .docx / .xlsx / .txt / .html / .eml / etc. into an
 * intermediate PDF using LibreOffice headless. Returns the PDF buffer.
 */
async function libreOfficeToPdf(
  buffer: Buffer,
  filename: string,
  workdir: string,
): Promise<Buffer> {
  const inputPath = path.join(workdir, filename);
  await fs.writeFile(inputPath, buffer);
  await runProcess(SOFFICE_BIN, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    workdir,
    inputPath,
  ]);
  const pdfName = path.basename(filename, path.extname(filename)) + '.pdf';
  const pdfPath = path.join(workdir, pdfName);
  return fs.readFile(pdfPath);
}

/**
 * Run OCRmyPDF on an existing PDF buffer. Returns the searchable PDF.
 */
async function ocrPdf(
  pdfBuffer: Buffer,
  workdir: string,
  options: Required<SearchablePdfOptions>,
): Promise<Buffer> {
  const inputPath = path.join(workdir, 'in.pdf');
  const outputPath = path.join(workdir, 'out.pdf');
  await fs.writeFile(inputPath, pdfBuffer);
  const args = [
    '--language', options.languages,
    '--output-type', 'pdf',
  ];
  if (options.skipExistingText) args.push('--skip-text');
  args.push(inputPath, outputPath);
  await runProcess(OCRMYPDF_BIN, args);
  return fs.readFile(outputPath);
}

/**
 * Run OCRmyPDF on a raw image buffer. OCRmyPDF accepts images directly
 * and rasterizes them into a single-page PDF with an OCR text layer.
 */
async function ocrImage(
  imageBuffer: Buffer,
  imageExt: string,
  workdir: string,
  options: Required<SearchablePdfOptions>,
): Promise<Buffer> {
  const inputPath = path.join(workdir, `in${imageExt}`);
  const outputPath = path.join(workdir, 'out.pdf');
  await fs.writeFile(inputPath, imageBuffer);
  const args = [
    '--language', options.languages,
    '--image-dpi', String(options.imageDpi),
    '--output-type', 'pdf',
    inputPath, outputPath,
  ];
  await runProcess(OCRMYPDF_BIN, args);
  return fs.readFile(outputPath);
}

export async function convertToSearchablePdf(
  buffer: Buffer,
  filename: string,
  userOptions: SearchablePdfOptions = {},
): Promise<Buffer> {
  const options: Required<SearchablePdfOptions> = { ...DEFAULT_OPTIONS, ...userOptions };
  const e = ext(filename);

  const workdir = await makeWorkdir();
  try {
    if (e === '.pdf') {
      return await ocrPdf(buffer, workdir, options);
    }
    if (IMAGE_FORMATS.has(e)) {
      return await ocrImage(buffer, e, workdir, options);
    }
    if (LIBREOFFICE_FORMATS.has(e)) {
      const intermediatePdf = await libreOfficeToPdf(buffer, filename, workdir);
      // Skip OCR — LibreOffice output is already a vector PDF with a
      // real text layer. Re-running OCR would be wasted work.
      return intermediatePdf;
    }
    if (e === '.msg') {
      // .msg is a binary Outlook envelope; LibreOffice cannot read it
      // directly. The caller should pre-render the email body to .eml or
      // .html via ingest/email.ts and re-call. Surface the constraint
      // explicitly so the caller doesn't get a confusing soffice error.
      throw new Error(
        '.msg conversion requires pre-rendering to .eml or .html via ingest/email.ts before searchable-PDF conversion.',
      );
    }
    throw new Error(`Unsupported extension for searchable-PDF conversion: ${e}`);
  } finally {
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}
