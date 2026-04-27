/**
 * forms-filler tests — fixture-based, no Anthropic / network.
 *
 * Each test synthesizes a tiny blank PDF in-memory using pdf-lib (one
 * page, three AcroForm fields: a TextField, a CheckBox, and a Dropdown).
 * That keeps the tests self-contained — no binary fixtures on disk.
 *
 * Pinned behavior:
 *   - JSONPath resolves nested object + array index access
 *   - Field<T> wrappers transparently unwrap to .value
 *   - Text field gets stringified value; checkbox toggles on truthy;
 *     dropdown selects matching option
 *   - Missing field in PDF lands as an `errors` entry, not a throw
 *   - Null / undefined / empty resolution lands as `unfilled`
 *   - Output PDF is written to the requested directory
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { fillForm, resolveJsonPath } from '@/draft/forms-filler';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'forms-filler-test-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function makeBlankPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  const text = form.createTextField('full_name');
  text.addToPage(page, { x: 50, y: 320, width: 240, height: 24 });
  const check = form.createCheckBox('has_dependents');
  check.addToPage(page, { x: 50, y: 280, width: 16, height: 16 });
  const dropdown = form.createDropdown('treaty_country');
  dropdown.addOptions(['Türkiye', 'United Kingdom', 'Germany']);
  dropdown.addToPage(page, { x: 50, y: 240, width: 240, height: 24 });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

const FIELD_MAP = {
  full_name: '$.facts.investor.full_name',
  has_dependents: '$.facts.has_dependents',
  treaty_country: '$.facts.investor.nationality',
};

describe('resolveJsonPath', () => {
  it('walks dotted property paths', () => {
    expect(resolveJsonPath({ a: { b: { c: 7 } } }, '$.a.b.c')).toBe(7);
  });

  it('walks numeric array indices', () => {
    expect(resolveJsonPath({ items: [{ x: 1 }, { x: 2 }] }, '$.items[1].x')).toBe(2);
  });

  it('unwraps Field<T> wrappers to .value', () => {
    const data = {
      investor: {
        full_name: {
          value: 'Mehmet Demir',
          source_page: 1,
          source_quote: 'name',
          confidence: 0.99,
        },
      },
    };
    expect(resolveJsonPath(data, '$.investor.full_name')).toBe('Mehmet Demir');
  });

  it('returns undefined on missing segments', () => {
    expect(resolveJsonPath({ a: 1 }, '$.b.c')).toBeUndefined();
  });

  it('returns undefined when path does not start with $', () => {
    expect(resolveJsonPath({ a: 1 }, 'a')).toBeUndefined();
  });

  it('returns undefined on empty path', () => {
    expect(resolveJsonPath({ a: 1 }, '')).toBeUndefined();
  });
});

describe('fillForm', () => {
  it('fills text + checkbox + dropdown from JSONPaths into Field<T> data', async () => {
    const blank = await makeBlankPdf();
    const data = {
      facts: {
        investor: {
          full_name: { value: 'Mehmet Demir', source_page: 1, source_quote: '', confidence: 1 },
          nationality: { value: 'Türkiye', source_page: 1, source_quote: '', confidence: 1 },
        },
        has_dependents: { value: true, source_page: null, source_quote: null, confidence: 1 },
      },
    };
    const report = await fillForm({
      formId: 'tiny',
      matterId: 'TEST-1',
      data,
      fieldMap: FIELD_MAP,
      blankPdf: blank,
      outputDir: workDir,
    });

    expect(report.filled.sort()).toEqual(['full_name', 'has_dependents', 'treaty_country']);
    expect(report.unfilled).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.output_path).toBe(join(workDir, 'tiny.pdf'));

    // Reload the saved PDF and verify the values stuck.
    const saved = await PDFDocument.load(readFileSync(report.output_path));
    const form = saved.getForm();
    expect(form.getTextField('full_name').getText()).toBe('Mehmet Demir');
    expect(form.getCheckBox('has_dependents').isChecked()).toBe(true);
    expect(form.getDropdown('treaty_country').getSelected()).toEqual(['Türkiye']);
  });

  it('marks missing JSONPath resolutions as unfilled (not errors)', async () => {
    const blank = await makeBlankPdf();
    const data = {
      facts: {
        investor: {
          full_name: { value: 'Mehmet Demir', source_page: 1, source_quote: '', confidence: 1 },
          // nationality intentionally missing
        },
        // has_dependents intentionally missing
      },
    };
    const report = await fillForm({
      formId: 'tiny',
      matterId: 'TEST-2',
      data,
      fieldMap: FIELD_MAP,
      blankPdf: blank,
      outputDir: workDir,
    });

    expect(report.filled).toEqual(['full_name']);
    expect(report.unfilled.sort()).toEqual(['has_dependents', 'treaty_country']);
    expect(report.errors).toEqual([]);
  });

  it('reports an error (not throw) when a mapped field is missing in the PDF', async () => {
    const blank = await makeBlankPdf();
    const data = {
      facts: {
        investor: {
          full_name: { value: 'Test', source_page: null, source_quote: null, confidence: 1 },
        },
      },
    };
    const report = await fillForm({
      formId: 'tiny',
      matterId: 'TEST-3',
      data,
      fieldMap: { full_name: '$.facts.investor.full_name', not_in_pdf: '$.facts.investor.full_name' },
      blankPdf: blank,
      outputDir: workDir,
    });

    expect(report.filled).toContain('full_name');
    expect(report.errors.map((e) => e.field)).toContain('not_in_pdf');
  });

  it('treats falsy values for checkboxes as unchecked', async () => {
    const blank = await makeBlankPdf();
    const data = {
      facts: {
        investor: {
          full_name: { value: 'X', source_page: null, source_quote: null, confidence: 1 },
          nationality: { value: 'Türkiye', source_page: null, source_quote: null, confidence: 1 },
        },
        has_dependents: { value: false, source_page: null, source_quote: null, confidence: 1 },
      },
    };
    const report = await fillForm({
      formId: 'tiny',
      matterId: 'TEST-4',
      data,
      fieldMap: FIELD_MAP,
      blankPdf: blank,
      outputDir: workDir,
    });
    // false becomes unchecked, but the field IS filled (we set its state).
    expect(report.filled).toContain('has_dependents');
    const saved = await PDFDocument.load(readFileSync(report.output_path));
    expect(saved.getForm().getCheckBox('has_dependents').isChecked()).toBe(false);
  });
});
