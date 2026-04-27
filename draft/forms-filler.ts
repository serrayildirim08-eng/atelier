/**
 * Mechanical PDF AcroForm filler (no LLM).
 *
 * Loads a blank USCIS / DOS form PDF, walks a JSON field-map that pairs
 * AcroField names with JSONPath references into the matter's data, and
 * writes the filled PDF to ~/akalan-context/<matter>/output/forms/.
 *
 * Decisions:
 *   - Field maps live at draft/forms/<form-id>.json. Each is a flat
 *     `{ "<acroform_field_name>": "$.path.into.data" }` mapping.
 *     The maps are starter skeletons calibrated to the public form
 *     edition; the official blank PDF must be downloaded from USCIS /
 *     state.gov and dropped into app/forms/blank/<form-id>.pdf.
 *   - JSONPath syntax: `$.a.b.c`, `$.a[0].b`. Field<T> values
 *     transparently unwrap — `$.investor.full_name` resolves the .value
 *     of the Field wrapper, not the wrapper object itself.
 *   - Boolean fields (checkboxes) accept true/'X'/'Yes' as checked,
 *     falsy values as unchecked. Numeric fields are stringified.
 *   - Unfilled and failed fields are reported (not thrown) so the
 *     dashboard can surface a punch list for attorney review.
 *   - Source PDFs are NEVER mutated — a fresh copy of the blank is
 *     loaded for every fill.
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } from 'pdf-lib';

export interface FormFieldMap {
  [acroFieldName: string]: string;
}

export interface FillFormReport {
  form_id: string;
  filled: string[];
  unfilled: string[];
  errors: { field: string; message: string }[];
  output_path: string;
}

const FORMS_BLANK_DIR =
  process.env.AKALAN_FORMS_BLANK_DIR ??
  join(process.cwd(), 'app', 'forms', 'blank');

const FORMS_MAP_DIR =
  process.env.AKALAN_FORMS_MAP_DIR ??
  join(process.cwd(), 'draft', 'forms');

const AKALAN_CONTEXT_DIR =
  process.env.AKALAN_CONTEXT_DIR ?? join(homedir(), 'akalan-context');

/* ---------------------------------------------------------------------- */
/* JSONPath                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Minimal JSONPath resolver. Supports:
 *   - $ (root)
 *   - .field
 *   - [n] for numeric index
 *   - .field[n].nested
 * Field<T>-shaped values (`{ value, source_page, source_quote, confidence }`)
 * automatically unwrap to `.value` when the path lands on the wrapper —
 * callers write `$.investor.full_name`, not `$.investor.full_name.value`.
 *
 * Returns the resolved value or undefined if any segment misses.
 */
export function resolveJsonPath(root: unknown, path: string): unknown {
  if (typeof path !== 'string' || path.length === 0) return undefined;
  if (!path.startsWith('$')) return undefined;
  // Tokenize: drop the leading '$', then split on '.' and '[…]'.
  let cursor: unknown = root;
  let i = 1;
  while (i < path.length) {
    const c = path[i];
    if (c === '.') {
      i += 1;
      let key = '';
      while (i < path.length && path[i] !== '.' && path[i] !== '[') {
        key += path[i];
        i += 1;
      }
      if (key.length === 0) return undefined;
      cursor = readKey(cursor, key);
    } else if (c === '[') {
      i += 1;
      let n = '';
      while (i < path.length && path[i] !== ']') {
        n += path[i];
        i += 1;
      }
      if (path[i] !== ']' || n.length === 0) return undefined;
      i += 1;
      const idx = Number.parseInt(n, 10);
      if (!Number.isFinite(idx)) return undefined;
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[idx];
    } else {
      return undefined;
    }
  }
  return unwrapField(cursor);
}

function readKey(target: unknown, key: string): unknown {
  if (target === null || typeof target !== 'object') return undefined;
  return (target as Record<string, unknown>)[key];
}

/** If the value looks like a Field<T> wrapper, return .value; else return as-is. */
function unwrapField(v: unknown): unknown {
  if (
    v &&
    typeof v === 'object' &&
    'value' in v &&
    'source_page' in v &&
    'confidence' in v
  ) {
    return (v as { value: unknown }).value;
  }
  return v;
}

/* ---------------------------------------------------------------------- */
/* Field-map loading                                                       */
/* ---------------------------------------------------------------------- */

export async function loadFieldMap(formId: string): Promise<FormFieldMap> {
  const path = join(FORMS_MAP_DIR, `${formId}.json`);
  const raw = await fs.readFile(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Field map at ${path} is not a JSON object`);
  }
  // Strip JSON-comment-style metadata keys (start with '_'). Keeps the
  // same map file usable as both the runtime config and a documented
  // skeleton.
  const out: FormFieldMap = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k.startsWith('_')) continue;
    if (typeof v !== 'string') continue;
    out[k] = v;
  }
  return out;
}

/* ---------------------------------------------------------------------- */
/* Blank-form loading                                                      */
/* ---------------------------------------------------------------------- */

async function loadBlankForm(formId: string): Promise<Buffer> {
  const path = join(FORMS_BLANK_DIR, `${formId}.pdf`);
  return fs.readFile(path);
}

/* ---------------------------------------------------------------------- */
/* Filling                                                                 */
/* ---------------------------------------------------------------------- */

/** Convert any resolved value into a string suitable for a PDF text field. */
function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** Truthy mapping for checkbox-style fields. */
function isChecked(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'x' || s === 'yes' || s === 'true' || s === '1';
  }
  if (typeof v === 'number') return v === 1;
  return false;
}

export interface FillFormInputs {
  formId: string;
  matterId: string;
  data: unknown;
  /** Override the on-disk field map (e.g., for tests). */
  fieldMap?: FormFieldMap;
  /** Override the blank PDF source (e.g., for tests). */
  blankPdf?: Buffer;
  /** Override the output directory (e.g., for tests). */
  outputDir?: string;
}

/**
 * Fill a form. Returns a structured report of what landed where.
 * Throws only on infrastructure failures (missing blank PDF, missing
 * field map, malformed PDF). Per-field failures are reported, not
 * thrown, so the caller can present a punch list.
 */
export async function fillForm(
  inputs: FillFormInputs,
): Promise<FillFormReport> {
  const fieldMap =
    inputs.fieldMap ?? (await loadFieldMap(inputs.formId));
  const blank = inputs.blankPdf ?? (await loadBlankForm(inputs.formId));

  const pdfDoc = await PDFDocument.load(blank);
  const form = pdfDoc.getForm();

  const filled: string[] = [];
  const unfilled: string[] = [];
  const errors: { field: string; message: string }[] = [];

  for (const [fieldName, jsonPath] of Object.entries(fieldMap)) {
    const value = resolveJsonPath(inputs.data, jsonPath);
    if (value === undefined || value === null || value === '') {
      unfilled.push(fieldName);
      continue;
    }
    try {
      const field = form.getFieldMaybe(fieldName);
      if (!field) {
        errors.push({
          field: fieldName,
          message: `Field not present in PDF (check field name or form edition)`,
        });
        continue;
      }
      if (field instanceof PDFTextField) {
        field.setText(stringify(value));
        filled.push(fieldName);
      } else if (field instanceof PDFCheckBox) {
        if (isChecked(value)) field.check();
        else field.uncheck();
        filled.push(fieldName);
      } else if (field instanceof PDFDropdown) {
        field.select(stringify(value));
        filled.push(fieldName);
      } else {
        errors.push({
          field: fieldName,
          message: `Unsupported field kind: ${field.constructor.name}`,
        });
      }
    } catch (e: unknown) {
      errors.push({
        field: fieldName,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Save filled PDF to ~/akalan-context/<matter>/output/forms/<form-id>.pdf
  const outDir =
    inputs.outputDir ??
    join(AKALAN_CONTEXT_DIR, inputs.matterId, 'output', 'forms');
  const outPath = join(outDir, `${inputs.formId}.pdf`);
  const bytes = await pdfDoc.save();
  await fs.mkdir(dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, bytes);

  return {
    form_id: inputs.formId,
    filled,
    unfilled,
    errors,
    output_path: outPath,
  };
}

/* ---------------------------------------------------------------------- */
/* Forms inventory                                                         */
/* ---------------------------------------------------------------------- */

export interface GeneratedFormSummary {
  form_id: string;
  output_path: string;
  size_bytes: number;
  generated_at: string;
}

/** List filled forms on disk for a given matter. */
export async function listGeneratedForms(
  matterId: string,
  outputDir?: string,
): Promise<GeneratedFormSummary[]> {
  const dir =
    outputDir ?? join(AKALAN_CONTEXT_DIR, matterId, 'output', 'forms');
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: GeneratedFormSummary[] = [];
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.pdf')) continue;
    const path = join(dir, name);
    try {
      const stat = await fs.stat(path);
      out.push({
        form_id: name.replace(/\.pdf$/i, ''),
        output_path: path,
        size_bytes: stat.size,
        generated_at: stat.mtime.toISOString(),
      });
    } catch {
      // skip
    }
  }
  return out.sort((a, b) => a.form_id.localeCompare(b.form_id, 'en'));
}
