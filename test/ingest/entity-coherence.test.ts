/**
 * reconcileEntityCoherence tests — pure logic, no Anthropic / disk.
 *
 * Pinned behavior:
 *   - single entity across many docs → 'single_entity'
 *   - foreign parent + US sub with board_resolution → 'parent_subsidiary'
 *   - two unrelated names → 'name_drift'
 *   - Levenshtein ≤ 2 (apostrophe / typo) → merged, no drift
 *   - LLC / Inc / Corp / Co. suffix variations don't cause drift
 *   - Turkish chars (ç ğ ı ö ş ü) ASCII-fold consistently
 */

import { describe, expect, it } from 'vitest';
import { reconcileEntityCoherence } from '@/ingest/typed-aggregate';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: null as string | null,
    confidence: 1 as number | null,
  };
}

function entry(
  filename: string,
  pageCount: number,
  facts: Record<string, unknown>,
  rich: Partial<{
    corporateFormation: Record<string, unknown>;
    foreignCorporate: Record<string, unknown>;
  }> = {},
): PerPdfResult {
  const out: PerPdfResult = {
    filename,
    pageCount,
    facts: facts as unknown as PerPdfResult['facts'],
  };
  if (rich.corporateFormation) {
    out.corporateFormation = rich.corporateFormation as unknown as PerPdfResult['corporateFormation'];
  }
  if (rich.foreignCorporate) {
    out.foreignCorporate = rich.foreignCorporate as unknown as PerPdfResult['foreignCorporate'];
  }
  return out;
}

function articlesOfOrg(filename: string, entityName: string): PerPdfResult {
  return entry(
    filename,
    3,
    {
      doc_type: 'formation_doc',
      suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    },
    {
      corporateFormation: {
        formation_subtype: 'articles_of_organization',
        entity_legal_name: f(entityName),
      },
    },
  );
}

function uscisForm(filename: string, formId: string, petitionerName: string): PerPdfResult {
  return entry(filename, 8, {
    doc_type: 'uscis_or_dos_form',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    form_id: f(formId),
    petitioner_name: f(petitionerName),
  });
}

function lease(filename: string, lessee: string): PerPdfResult {
  return entry(filename, 5, {
    doc_type: 'lease_or_property',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    lessee: f(lessee),
  });
}

function payroll(filename: string, employer: string): PerPdfResult {
  return entry(filename, 2, {
    doc_type: 'payroll_doc',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    employer_name: f(employer),
  });
}

function financialStatement(filename: string, entityName: string): PerPdfResult {
  return entry(filename, 4, {
    doc_type: 'financial_statement',
    suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
    entity_name: f(entityName),
  });
}

function boardResolution(
  filename: string,
  foreignName: string,
  authorizes: boolean,
): PerPdfResult {
  return entry(
    filename,
    3,
    {
      doc_type: 'other',
      suggested_filename: { value: null, source_page: null, source_quote: null, confidence: null },
      one_line_summary: f('foreign board resolution'),
      key_facts: [],
    },
    {
      foreignCorporate: {
        foreign_doc_subtype: 'board_resolution',
        entity_legal_name_ascii: f(foreignName),
        authorizes_us_investment: f(authorizes),
      },
    },
  );
}

function memoryFrom(entries: PerPdfResult[]): TypedMemory {
  const memory: TypedMemory = {};
  for (const e of entries) {
    if (!e.facts) continue;
    const bucket = e.facts.doc_type;
    const list = memory[bucket] ?? [];
    list.push(e);
    memory[bucket] = list;
  }
  return memory;
}

describe('reconcileEntityCoherence', () => {
  it("verdict 'single_entity' when one canonical name covers all docs", () => {
    const memory = memoryFrom([
      articlesOfOrg('articles.pdf', 'Aegean Atelier Coffee LLC'),
      uscisForm('i-129.pdf', 'I-129', 'Aegean Atelier Coffee, LLC'),
      lease('lease.pdf', 'Aegean Atelier Coffee LLC'),
      payroll('payroll.pdf', 'Aegean Atelier Coffee, L.L.C.'),
      financialStatement('balance-sheet.pdf', 'Aegean Atelier Coffee LLC'),
    ]);
    const result = reconcileEntityCoherence(memory);
    expect(result.verdict).toBe('single_entity');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].occurrences).toHaveLength(5);
  });

  it("verdict 'parent_subsidiary' when foreign board_resolution authorizes US investment", () => {
    const memory = memoryFrom([
      articlesOfOrg('articles.pdf', 'Aegean Atelier Coffee LLC'),
      uscisForm('i-129.pdf', 'I-129', 'Aegean Atelier Coffee LLC'),
      boardResolution('board-resolution.pdf', 'Demir Holding A.Ş.', true),
    ]);
    // The foreign board_resolution doesn't itself add an
    // EntityNameOccurrence (it lives on a doc_type='other' entry that
    // doesn't appear in the collector). To test the parent/sub pattern,
    // surface the foreign name through a regular source — financial
    // statement of the parent entity.
    memory.financial_statement = [financialStatement('parent-fs.pdf', 'Demir Holding A.Ş.')];
    const result = reconcileEntityCoherence(memory);
    expect(result.verdict).toBe('parent_subsidiary');
    expect(result.foreign_parent_name).toContain('demir holding');
    expect(result.us_subsidiary_name).toContain('aegean atelier coffee');
  });

  it("verdict 'name_drift' when two unrelated entities appear with no parent/sub link", () => {
    const memory = memoryFrom([
      articlesOfOrg('articles.pdf', 'Aegean Atelier Coffee LLC'),
      uscisForm('i-129.pdf', 'I-129', 'Wise Guys Deli LLC'),
      lease('lease.pdf', 'Wise Guys Deli LLC'),
    ]);
    const result = reconcileEntityCoherence(memory);
    expect(result.verdict).toBe('name_drift');
    expect(result.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("Levenshtein ≤ 2 merges near-duplicates ('wise guys' vs \"wise guy's\")", () => {
    const memory = memoryFrom([
      articlesOfOrg('articles.pdf', 'Wise Guys Deli LLC'),
      uscisForm('i-129.pdf', 'I-129', "Wise Guy's Deli LLC"),
    ]);
    const result = reconcileEntityCoherence(memory);
    expect(result.verdict).toBe('single_entity');
    expect(result.groups).toHaveLength(1);
  });

  it('strips entity suffixes (LLC, L.L.C., Inc, Corporation) before compare', () => {
    const memory = memoryFrom([
      articlesOfOrg('articles.pdf', 'Aegean Atelier Coffee LLC'),
      uscisForm('i-129.pdf', 'I-129', 'Aegean Atelier Coffee Inc.'),
      lease('lease.pdf', 'Aegean Atelier Coffee Corporation'),
      payroll('payroll.pdf', 'Aegean Atelier Coffee Co.'),
    ]);
    const result = reconcileEntityCoherence(memory);
    expect(result.verdict).toBe('single_entity');
    expect(result.groups).toHaveLength(1);
  });

  it('Turkish ASCII-fold maps ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u', () => {
    const memory = memoryFrom([
      articlesOfOrg('articles-tr.pdf', 'Çağrı Şirketi'),
      uscisForm('i-129.pdf', 'I-129', 'Cagri Sirketi'),
    ]);
    const result = reconcileEntityCoherence(memory);
    expect(result.verdict).toBe('single_entity');
    expect(result.groups).toHaveLength(1);
  });
});
