/**
 * Tier-0 classifier — accent fold + foreign-language coverage.
 *
 * Confirms the NFD diacritic-strip path lets ASCII regexes catch
 * accented filenames (French / German / Turkish) and that the
 * fine→coarse DocType map routes them into the right bucket.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyByTier0,
  coarseFromFineDocTypeId,
} from '@/ingest/classify-fallback';

function classifyFilename(filename: string) {
  return classifyByTier0({ filename, first_page_text: '' });
}

describe('Tier-0 — accent fold over filenames', () => {
  it('matches "Diplôme" against the diploma regex', () => {
    const r = classifyFilename('Diplôme original.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('diploma');
  });

  it('matches "Passeport" via passport_bio passeport regex', () => {
    const r = classifyFilename('Passeport.jpg');
    expect(r.candidates[0]?.doc_type_id).toBe('passport_bio');
  });

  it('matches "Reçu" against paid_invoice (recu after fold)', () => {
    const r = classifyFilename('Reçu de virement.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('paid_invoice');
  });

  it('matches "Relevé Bancaire" against bank_statement_personal', () => {
    const r = classifyFilename('Relevé Bancaire Mars 2026.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_personal');
  });

  it('matches "Bulletin de Paie" against salary_payslip_treaty_country', () => {
    const r = classifyFilename('Bulletin de Paie 2025-12.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('salary_payslip_treaty_country');
  });

  it('matches "Bail Commercial" against lease_commercial', () => {
    const r = classifyFilename('Bail Commercial signé.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('lease_commercial');
  });

  it('matches "Acte de Naissance" against birth_certificate', () => {
    const r = classifyFilename('Acte de Naissance original.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('birth_certificate');
  });

  it('matches German "Mietvertrag" against lease_residential', () => {
    const r = classifyFilename('Mietvertrag 2026.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('lease_residential');
  });

  it('matches generic "Certificate" against professional_license', () => {
    const r = classifyFilename('Adobe Photoshop Certificate.jpeg');
    expect(r.candidates[0]?.doc_type_id).toBe('professional_license');
  });

  it('matches Turkish "Diploma orijinal" against diploma', () => {
    const r = classifyFilename('Bachelor diploma orijinal.jpeg');
    expect(r.candidates[0]?.doc_type_id).toBe('diploma');
  });
});

describe('Tier-0 — US bank brand + invoice patterns', () => {
  it('matches BofA-only filename as bank_statement_personal', () => {
    const r = classifyFilename('BofA_2025-03.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_personal');
  });

  it('matches Chase-only filename as bank_statement_personal', () => {
    const r = classifyFilename('Chase_03_2025.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_personal');
  });

  it('matches eStmt filename pattern', () => {
    const r = classifyFilename('eStmt_2025_April.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_personal');
  });

  it('matches "Wells Fargo Business" as some bank_statement variant', () => {
    // Personal vs business is a content-driven distinction; for filename-
    // only Tier-0 either fine id is acceptable as long as the coarse
    // bucket is bank_statement.
    const r = classifyFilename('Wells Fargo Business 03 2025.pdf');
    expect(r.candidates[0]?.doc_type_id).toMatch(/^bank_statement_/);
    expect(coarseFromFineDocTypeId(r.candidates[0]?.doc_type_id ?? null)).toBe(
      'bank_statement',
    );
  });

  it('matches "INV-12345.pdf" as vendor_invoice', () => {
    const r = classifyFilename('INV-12345.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('vendor_invoice');
  });

  it('matches "Receipt March.pdf" as paid_invoice', () => {
    const r = classifyFilename('Receipt March.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('paid_invoice');
  });

  it('matches "Makbuz" (Turkish receipt) as paid_invoice', () => {
    const r = classifyFilename('Makbuz 2025-03.pdf');
    expect(r.candidates[0]?.doc_type_id).toBe('paid_invoice');
  });
});

describe('coarseFromFineDocTypeId', () => {
  it('maps foreign-language hits to coarse buckets', () => {
    expect(coarseFromFineDocTypeId('diploma')).toBe('credential');
    expect(coarseFromFineDocTypeId('passport_bio')).toBe('passport');
    expect(coarseFromFineDocTypeId('bank_statement_personal')).toBe(
      'bank_statement',
    );
    expect(coarseFromFineDocTypeId('paid_invoice')).toBe('invoice_or_receipt');
    expect(coarseFromFineDocTypeId('salary_payslip_treaty_country')).toBe(
      'payroll_doc',
    );
    expect(coarseFromFineDocTypeId('lease_commercial')).toBe('lease_or_property');
    expect(coarseFromFineDocTypeId('birth_certificate')).toBe('vital_record');
    expect(coarseFromFineDocTypeId('professional_license')).toBe('credential');
  });

  it('returns null for ids that intentionally have no coarse mapping', () => {
    expect(coarseFromFineDocTypeId('photo_2x2')).toBeNull();
    expect(coarseFromFineDocTypeId('photo_premises')).toBeNull();
    expect(coarseFromFineDocTypeId(null)).toBeNull();
  });
});
