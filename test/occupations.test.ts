/**
 * Occupations reference-data integrity test.
 *
 * Loads the 4 JSON files produced by `scripts/build-occupations.ts` and
 * asserts shape + size invariants. Run via `npm run test -- occupations`.
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(__dirname, '..', 'data', 'occupations');

async function readJson<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

interface SocEntry {
  soc_code: string;
  title: string;
  major_group: string;
  description: string;
}

interface OnetEntry {
  onet_soc_code: string;
  title: string;
  description: string;
  parent_soc: string;
  alt_titles: string[];
}

interface RecognizedField {
  field_label: string;
  domain: string;
  aliases: string[];
  typical_specializations: string[];
  representative_soc_codes: string[];
  goldilocks_specificity: 'broad_field' | 'specialty_within_field';
  notes: string | null;
}

interface FieldToSocEntry {
  field_label: string;
  primary_soc: string;
  primary_soc_title: string;
  alternate_socs: Array<{ soc_code: string; title: string; rationale: string }>;
  closest_onet_codes: string[];
}

describe('occupations reference data', () => {
  it('soc-codes.json holds the 867 detailed BLS SOC 2018 occupations', async () => {
    const soc = await readJson<SocEntry[]>('soc-codes.json');
    expect(soc.length).toBe(867);
    for (const entry of soc) {
      expect(entry.soc_code).toMatch(/^\d{2}-\d{4}$/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.major_group.length).toBeGreaterThan(0);
    }
  });

  it('onet-titles.json holds > 900 ONET 28 occupations', async () => {
    const onet = await readJson<OnetEntry[]>('onet-titles.json');
    expect(onet.length).toBeGreaterThan(900);
    for (const entry of onet) {
      expect(entry.onet_soc_code).toMatch(/^\d{2}-\d{4}\.\d{2}$/);
      expect(entry.parent_soc).toMatch(/^\d{2}-\d{4}$/);
      expect(entry.title.length).toBeGreaterThan(0);
    }
  });

  it('recognized-fields.json covers all 9 domains and 100–200 entries', async () => {
    const fields = await readJson<RecognizedField[]>('recognized-fields.json');
    expect(fields.length).toBeGreaterThanOrEqual(100);
    expect(fields.length).toBeLessThanOrEqual(200);

    const domains = new Set(fields.map((f) => f.domain));
    const expected = new Set([
      'tech', 'engineering', 'sciences', 'arts', 'business',
      'medicine', 'law', 'education', 'other',
    ]);
    expect(domains.size).toBe(expected.size);
    for (const d of expected) expect(domains.has(d)).toBe(true);

    // Spot check: AI engineering exists, primary SOC starts with 15-.
    const ai = fields.find((f) => f.field_label === 'AI engineering');
    expect(ai).toBeDefined();
    expect(ai!.representative_soc_codes[0]).toMatch(/^15-/);
    expect(ai!.aliases.length).toBeGreaterThan(0);
    expect(ai!.typical_specializations.length).toBeGreaterThan(0);
  });

  it('field-to-soc-map.json matches recognized-fields length and shape', async () => {
    const fields = await readJson<RecognizedField[]>('recognized-fields.json');
    const map = await readJson<FieldToSocEntry[]>('field-to-soc-map.json');
    expect(map.length).toBe(fields.length);

    for (const entry of map) {
      expect(entry.field_label.length).toBeGreaterThan(0);
      expect(entry.primary_soc).toMatch(/^\d{2}-\d{4}$/);
      expect(entry.primary_soc_title.length).toBeGreaterThan(0);
    }

    const ai = map.find((m) => m.field_label === 'AI engineering');
    expect(ai).toBeDefined();
    expect(ai!.primary_soc).toMatch(/^15-/);
  });
});
