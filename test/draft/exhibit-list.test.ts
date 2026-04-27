/**
 * exhibit-list tests — pure logic, no Anthropic / disk / network.
 *
 * Pinned behavior:
 *   - DocType → Tab routing matches the firm's A-L convention
 *   - I-539 / I-539A forms route to Tab J (dependents), not Tab A
 *   - Display-name precedence: alias > suggested_filename > raw filename
 *   - Empty buckets are dropped from the rendered output
 *   - Page-count totals are correct per tab and overall
 *   - Markdown rendering names every tab with its heading + element line
 */

import { describe, expect, it } from 'vitest';
import {
  buildExhibitList,
  renderExhibitListCompact,
  renderExhibitListMarkdown,
} from '@/draft/exhibit-list';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: null as string | null,
    confidence: 0.9 as number | null,
  };
}
const NULL_FIELD = {
  value: null,
  source_page: null,
  source_quote: null,
  confidence: null,
};

/**
 * Lightweight fixture builder. The pure-logic exhibit-list code only
 * reads `doc_type`, `suggested_filename`, and (for uscis_or_dos_form)
 * `form_id`. Casting via `unknown` keeps the test fixtures terse —
 * exhaustive schema fixtures live in the per-extractor tests.
 */
function entry(
  filename: string,
  pageCount: number,
  facts: Record<string, unknown>,
): PerPdfResult {
  return {
    filename,
    pageCount,
    facts: facts as unknown as PerPdfResult['facts'],
  };
}

function passportEntry(filename: string, suggested?: string): PerPdfResult {
  return entry(filename, 2, {
    doc_type: 'passport',
    suggested_filename: suggested ? f(suggested) : NULL_FIELD,
  });
}

function uscisFormEntry(filename: string, formId: string, pages = 4): PerPdfResult {
  return entry(filename, pages, {
    doc_type: 'uscis_or_dos_form',
    suggested_filename: NULL_FIELD,
    form_id: f(formId),
  });
}

function vitalRecordEntry(filename: string, pages = 2): PerPdfResult {
  return entry(filename, pages, {
    doc_type: 'vital_record',
    suggested_filename: NULL_FIELD,
  });
}

function otherEntry(filename: string, summary: string): PerPdfResult {
  return entry(filename, 1, {
    doc_type: 'other',
    suggested_filename: NULL_FIELD,
    one_line_summary: f(summary),
    key_facts: [],
  });
}

function memoryFrom(entries: PerPdfResult[]): TypedMemory {
  const memory: TypedMemory = {};
  for (const entry of entries) {
    if (!entry.facts) continue;
    const bucket = entry.facts.doc_type;
    const list = memory[bucket] ?? [];
    list.push(entry);
    memory[bucket] = list;
  }
  return memory;
}

describe('buildExhibitList', () => {
  it('groups passports under Tab C and forms under Tab A', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf'),
      uscisFormEntry('i-129.pdf', 'I-129'),
      uscisFormEntry('g-28.pdf', 'G-28'),
    ]);
    const list = buildExhibitList({ memory });
    const tabA = list.tabs.find((t) => t.tab === 'A');
    const tabC = list.tabs.find((t) => t.tab === 'C');
    expect(tabA?.items).toHaveLength(2);
    expect(tabC?.items).toHaveLength(1);
  });

  it('routes I-539 and I-539A forms to Tab J, not Tab A', () => {
    const memory = memoryFrom([
      uscisFormEntry('i-129.pdf', 'I-129'),
      uscisFormEntry('i-539.pdf', 'I-539'),
      uscisFormEntry('i-539a.pdf', 'I-539A'),
    ]);
    const list = buildExhibitList({ memory });
    const tabA = list.tabs.find((t) => t.tab === 'A');
    const tabJ = list.tabs.find((t) => t.tab === 'J');
    expect(tabA?.items).toHaveLength(1);
    expect(tabA?.items[0].filename).toBe('i-129.pdf');
    expect(tabJ?.items).toHaveLength(2);
  });

  it('routes vital_record to Tab L', () => {
    const memory = memoryFrom([vitalRecordEntry('marriage-cert.pdf')]);
    const list = buildExhibitList({ memory });
    expect(list.tabs.find((t) => t.tab === 'L')?.items).toHaveLength(1);
  });

  it("drops 'other' into 'unassigned' tab", () => {
    const memory = memoryFrom([otherEntry('mystery.pdf', 'Unidentified document')]);
    const list = buildExhibitList({ memory });
    const tab = list.tabs.find((t) => t.tab === 'unassigned');
    expect(tab?.items).toHaveLength(1);
    expect(tab?.items[0].one_line_summary).toBe('Unidentified document');
  });

  it('display_name prefers alias over suggested_filename over raw', () => {
    const memory = memoryFrom([
      passportEntry('raw-name.pdf', 'classifier-suggested.pdf'),
      passportEntry('only-raw.pdf'),
    ]);
    const list = buildExhibitList({
      memory,
      aliases: { 'raw-name.pdf': 'attorney-applied-alias.pdf' },
    });
    const items = list.tabs.find((t) => t.tab === 'C')?.items ?? [];
    const aliased = items.find((i) => i.filename === 'raw-name.pdf');
    const fallthrough = items.find((i) => i.filename === 'only-raw.pdf');
    expect(aliased?.display_name).toBe('attorney-applied-alias.pdf');
    expect(fallthrough?.display_name).toBe('only-raw.pdf');
  });

  it('totals page counts per tab and overall', () => {
    const memory = memoryFrom([
      passportEntry('p1.pdf'), // 2 pp
      passportEntry('p2.pdf'), // 2 pp
      uscisFormEntry('i-129.pdf', 'I-129', 8), // 8 pp
    ]);
    const list = buildExhibitList({ memory });
    expect(list.total_pages).toBe(12);
    expect(list.total_documents).toBe(3);
    expect(list.tabs.find((t) => t.tab === 'C')?.total_pages).toBe(4);
    expect(list.tabs.find((t) => t.tab === 'A')?.total_pages).toBe(8);
  });

  it('omits empty tabs from the output', () => {
    const memory = memoryFrom([passportEntry('p.pdf')]);
    const list = buildExhibitList({ memory });
    expect(list.tabs).toHaveLength(1);
    expect(list.tabs[0].tab).toBe('C');
  });

  it('sorts items within a tab by display_name', () => {
    const memory = memoryFrom([
      passportEntry('z-passport.pdf'),
      passportEntry('a-passport.pdf'),
      passportEntry('m-passport.pdf'),
    ]);
    const list = buildExhibitList({ memory });
    const names =
      list.tabs.find((t) => t.tab === 'C')?.items.map((i) => i.display_name) ?? [];
    expect(names).toEqual([
      'a-passport.pdf',
      'm-passport.pdf',
      'z-passport.pdf',
    ]);
  });

  it('skips entries with errors', () => {
    const memory: TypedMemory = {
      passport: [
        {
          filename: 'busted.pdf',
          pageCount: 0,
          error: { code: 'pdf_parse_failed', message: 'corrupt' },
        },
        passportEntry('good.pdf'),
      ],
    };
    const list = buildExhibitList({ memory });
    const tabC = list.tabs.find((t) => t.tab === 'C');
    expect(tabC?.items).toHaveLength(1);
    expect(tabC?.items[0].filename).toBe('good.pdf');
  });
});

describe('renderExhibitListMarkdown', () => {
  it('returns a placeholder when the list is empty', () => {
    const list = buildExhibitList({ memory: {} });
    const md = renderExhibitListMarkdown(list);
    expect(md).toContain('No exhibits indexed yet');
  });

  it('emits a heading per tab and lists each item with page count', () => {
    const memory = memoryFrom([
      passportEntry('p.pdf'),
      uscisFormEntry('i-129.pdf', 'I-129', 8),
    ]);
    const list = buildExhibitList({ memory });
    const md = renderExhibitListMarkdown(list);
    expect(md).toContain('Tab A');
    expect(md).toContain('Tab C');
    expect(md).toContain('Forms (Procedural)');
    expect(md).toContain('Qualification Under a Treaty');
    expect(md).toMatch(/\*\*p\.pdf\*\* \(2 pp\.\)/);
    expect(md).toMatch(/\*\*i-129\.pdf\*\* \(8 pp\.\)/);
  });

  it('includes one-line summaries when present', () => {
    const memory = memoryFrom([otherEntry('mystery.pdf', 'Could not classify')]);
    const list = buildExhibitList({ memory });
    const md = renderExhibitListMarkdown(list);
    expect(md).toContain('Could not classify');
  });
});

describe('renderExhibitListCompact', () => {
  it('returns one line per tab in the format "Tab X · Heading · names · pages"', () => {
    const memory = memoryFrom([
      uscisFormEntry('i-129.pdf', 'I-129', 8),
      uscisFormEntry('g-28.pdf', 'G-28', 2),
    ]);
    const list = buildExhibitList({ memory });
    const compact = renderExhibitListCompact(list);
    expect(compact).toMatch(
      /^Tab A · Forms \(Procedural\) · g-28\.pdf, i-129\.pdf · 10 pages$/m,
    );
  });

  it('returns empty string when the list is empty', () => {
    const list = buildExhibitList({ memory: {} });
    expect(renderExhibitListCompact(list)).toBe('');
  });
});
