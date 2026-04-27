/**
 * display-name tests — pure logic, no Anthropic / disk / network.
 *
 * Pinned behavior:
 *   - Slot composition with the U+00B7 separator
 *   - Native diacritics PRESERVED (display_name, not the kebab fallback)
 *   - Empty / null slots silently dropped (no "—" or "[unknown]")
 *   - 110-char cap with drop priority Detail → Identifier → Institution
 *   - Per-doc-type pattern coverage (passport, money_movement,
 *     uscis_or_dos_form, business_contract, title_deed,
 *     financial_statement)
 *   - Sort comparator extracts entity (slot 1) and period (last slot)
 */

import { describe, expect, it } from 'vitest';
import {
  buildDisplayName,
  compareDisplayNameInTab,
  DISPLAY_NAME_MAX_LEN,
  DISPLAY_NAME_SEPARATOR,
} from '@/ingest/display-name';

describe('buildDisplayName — per-doc-type patterns', () => {
  it('passport: preserves Turkish diacritics in entity and country slots', () => {
    const out = buildDisplayName({
      entity: 'Salih Kaçar',
      institution: 'Türkiye',
      doc_type_label: 'Passport bio page',
      period: 'expires 2032-04-11',
    });
    expect(out).toBe(
      'Salih Kaçar · Türkiye · Passport bio page · expires 2032-04-11.pdf',
    );
    // Sanity: ç and ü are intact bytes, not transliterated.
    expect(out).toContain('Kaçar');
    expect(out).toContain('Türkiye');
  });

  it('money_movement (FX wire): all six slots populated', () => {
    const out = buildDisplayName({
      entity: 'Salih Kaçar',
      institution: 'Akbank',
      identifier: '#4316',
      doc_type_label: 'Wire to USA',
      detail: 'USD 80,000',
      period: '2025-11-25',
    });
    expect(out).toBe(
      'Salih Kaçar · Akbank · #4316 · Wire to USA · USD 80,000 · 2025-11-25.pdf',
    );
    // Six parts joined by exactly five separators of length 3.
    const parts = out.replace(/\.pdf$/, '').split(DISPLAY_NAME_SEPARATOR);
    expect(parts).toHaveLength(6);
  });

  it('money_movement: missing identifier slot is dropped silently (no placeholder)', () => {
    const out = buildDisplayName({
      entity: 'Salih Kaçar',
      institution: 'Akbank',
      identifier: null,
      doc_type_label: 'Wire to USA',
      detail: 'USD 80,000',
      period: '2025-11-25',
    });
    expect(out).toBe(
      'Salih Kaçar · Akbank · Wire to USA · USD 80,000 · 2025-11-25.pdf',
    );
    expect(out).not.toContain('—');
    expect(out).not.toContain('[unknown]');
    expect(out).not.toContain('null');
  });

  it('uscis_or_dos_form: I-539A child variant carries the dependent label in doc_type slot', () => {
    const out = buildDisplayName({
      entity: 'Zeynep Kaçar',
      institution: 'USCIS',
      doc_type_label: 'Form I-539A (child)',
      period: 'signed 2026-01-07',
    });
    expect(out).toBe(
      'Zeynep Kaçar · USCIS · Form I-539A (child) · signed 2026-01-07.pdf',
    );
  });

  it('business_contract (MITA): joins multiple parties with " → " inside the institution slot', () => {
    // All six slots populated. Total length comes in just under the cap;
    // shortened doc-type label keeps every slot intact so the comparator
    // can still see the transferor → transferee chain.
    const out = buildDisplayName({
      entity: 'Wise Guys Deli LLC',
      institution: 'Maria Lopez → Salih Kaçar',
      identifier: '50%',
      doc_type_label: 'MITA',
      detail: 'USD 120,000',
      period: '2025-12-05',
    });
    expect(out).toBe(
      'Wise Guys Deli LLC · Maria Lopez → Salih Kaçar · 50% · MITA · USD 120,000 · 2025-12-05.pdf',
    );
    expect(out).toContain('Maria Lopez → Salih Kaçar');
  });

  it('title_deed (Tapu): preserves Turkish parcel/registry diacritics', () => {
    const out = buildDisplayName({
      entity: 'Salih Kaçar',
      institution: 'Tapu Müdürlüğü',
      identifier: 'Parsel 1024/7 Beşiktaş',
      doc_type_label: 'Title Deed',
      period: '2019-04-22',
    });
    expect(out).toBe(
      'Salih Kaçar · Tapu Müdürlüğü · Parsel 1024/7 Beşiktaş · Title Deed · 2019-04-22.pdf',
    );
    expect(out).toContain('Müdürlüğü');
    expect(out).toContain('Beşiktaş');
  });

  it('financial_statement (foreign audited): drops absent slots and keeps A.Ş. suffix', () => {
    const out = buildDisplayName({
      entity: 'Pomega Enerji A.Ş.',
      doc_type_label: 'Audited Financials (unqualified)',
      period: '2023',
    });
    expect(out).toBe(
      'Pomega Enerji A.Ş. · Audited Financials (unqualified) · 2023.pdf',
    );
  });
});

describe('buildDisplayName — 110-char cap and drop priority', () => {
  it('drops Detail first when total exceeds 110 chars', () => {
    // Engineered overflow: dropping Detail alone brings us under the cap.
    const slots = {
      entity: 'Pomega Enerji Yönetim A.Ş.',
      institution: 'İstanbul Ticaret Sicili',
      identifier: '#2472',
      doc_type_label: 'Esas Sözleşme',
      detail: 'authorizes USD 2,500,000 investment',
      period: '2024-01-12',
    };
    const out = buildDisplayName(slots);
    expect(out.length).toBeLessThanOrEqual(DISPLAY_NAME_MAX_LEN);
    // Detail was dropped; the other five slots survive.
    expect(out).not.toContain('authorizes USD');
    expect(out).toContain('Pomega Enerji Yönetim A.Ş.');
    expect(out).toContain('İstanbul Ticaret Sicili');
    expect(out).toContain('#2472');
    expect(out).toContain('Esas Sözleşme');
    expect(out).toContain('2024-01-12');
  });
});

describe('compareDisplayNameInTab — sort comparator', () => {
  it('groups by entity (slot 1) alphabetically, then by date desc within entity', () => {
    const a = 'Akbank · Wire to USA · 2024-01-15.pdf';
    const b = 'Salih Kaçar · Akbank · #4316 · Wire to USA · 2025-11-25.pdf';
    const c = 'Salih Kaçar · Akbank · #4316 · Wire to USA · 2025-08-10.pdf';
    const sorted = [b, a, c].sort(compareDisplayNameInTab);
    // Akbank entity sorts before Salih (alphabetical).
    expect(sorted[0]).toBe(a);
    // Within Salih Kaçar, 2025-11-25 (more recent) sorts before 2025-08-10.
    expect(sorted[1]).toBe(b);
    expect(sorted[2]).toBe(c);
  });
});
