/**
 * Cross-document inconsistency checker tests — pure logic, no Anthropic.
 *
 * Coverage:
 *   - beneficiary_name_drift (3-doc consensus, outlier flagged)
 *   - beneficiary_dob_drift (passport vs status_doc)
 *   - passport_number_drift (raw mismatch + renewal-footnote suppression)
 *   - ein_drift (full + last-4 cross-check)
 *   - enterprise_address_drift (loose zip + street-number compare)
 *   - formation_date_drift (±30d tolerance)
 *   - i94_number_drift
 *   - idempotency: dedupe by (conflict_type, fact_a_doc, fact_b_doc)
 *   - empty memory / single-source: no conflicts
 */

import { describe, expect, it } from 'vitest';
import {
  checkCrossDocumentInconsistencies,
  checkBeneficiaryNameConsistency,
  checkBeneficiaryDobConsistency,
  checkPassportNumberConsistency,
  checkEinConsistency,
  checkEnterpriseAddressConsistency,
  checkFormationDateConsistency,
  checkI94NumberConsistency,
} from '@/lib/e2/inconsistency-checker';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';
import type { E2Facts } from '@/ingest/schema';

function f<T>(value: T, page = 1) {
  return {
    value,
    source_page: page as number | null,
    source_quote: null as string | null,
    confidence: 1 as number | null,
  };
}

function nullF() {
  return { value: null, source_page: null, source_quote: null, confidence: null };
}

function entry(
  filename: string,
  facts: Record<string, unknown> | undefined,
  rich: Partial<{
    passport: Record<string, unknown>;
    i94: Record<string, unknown>;
    visaStamp: Record<string, unknown>;
    coverLetter: Record<string, unknown>;
    corporateFormation: Record<string, unknown>;
    contract: Record<string, unknown>;
    taxReturn: Record<string, unknown>;
  }> = {},
): PerPdfResult {
  const out: PerPdfResult = { filename, pageCount: 2 };
  if (facts) out.facts = facts as unknown as PerPdfResult['facts'];
  if (rich.passport) out.passport = rich.passport as unknown as PerPdfResult['passport'];
  if (rich.i94) out.i94 = rich.i94 as unknown as PerPdfResult['i94'];
  if (rich.visaStamp) out.visaStamp = rich.visaStamp as unknown as PerPdfResult['visaStamp'];
  if (rich.coverLetter)
    out.coverLetter = rich.coverLetter as unknown as PerPdfResult['coverLetter'];
  if (rich.corporateFormation)
    out.corporateFormation = rich.corporateFormation as unknown as PerPdfResult['corporateFormation'];
  if (rich.contract) out.contract = rich.contract as unknown as PerPdfResult['contract'];
  if (rich.taxReturn) out.taxReturn = rich.taxReturn as unknown as PerPdfResult['taxReturn'];
  return out;
}

function memoryFrom(entries: PerPdfResult[]): TypedMemory {
  const out: TypedMemory = {};
  for (const e of entries) {
    const facts = e.facts;
    const bucket = facts?.doc_type ?? 'other';
    const list = out[bucket] ?? [];
    list.push(e);
    out[bucket] = list;
  }
  return out;
}

const emptyFacts = {} as unknown as E2Facts;

/* ---------------------------------------------------------------------- */
/* Builders                                                                */
/* ---------------------------------------------------------------------- */

function passportEntry(filename: string, fullName: string, dob: string, num: string) {
  return entry(
    filename,
    {
      doc_type: 'passport',
      suggested_filename: nullF(),
      display_name: nullF(),
      full_name: f(fullName),
      dob: f(dob),
      passport_number: f(num),
      nationality: f('Türkiye'),
      passport_expiry: nullF(),
      place_of_birth: nullF(),
      issue_date: nullF(),
    },
    {
      passport: {
        full_name_native: f(fullName),
        full_name_ascii: f(fullName),
        sex: f('M'),
        date_of_birth: f(dob),
        place_of_birth: nullF(),
        nationality: f('Türkiye'),
        country_of_issue: nullF(),
        passport_number: f(num),
        date_of_issue: nullF(),
        date_of_expiration: nullF(),
        mrz_present: f(true),
      },
    },
  );
}

function i94Entry(
  filename: string,
  fullName: string,
  admissionNumber: string,
) {
  return entry(
    filename,
    {
      doc_type: 'i94',
      suggested_filename: nullF(),
      display_name: nullF(),
      full_name: f(fullName),
      admission_number: f(admissionNumber),
      class_of_admission: f('B-1'),
      admission_date: nullF(),
      admit_until_date: nullF(),
      port_of_entry: nullF(),
    },
    {
      i94: {
        full_name_ascii: f(fullName),
        admission_number: f(admissionNumber),
        class_of_admission: f('B-1'),
        admission_date: nullF(),
        admit_until_date: nullF(),
        port_of_entry: nullF(),
        duration_of_status_marker: f(false),
        cbp_record_number: nullF(),
      },
    },
  );
}

function statusDocEntry(filename: string, fullName: string, i94AdmNumber: string) {
  return entry(filename, {
    doc_type: 'status_doc',
    suggested_filename: nullF(),
    display_name: nullF(),
    full_name: f(fullName),
    status_class: f('E-2'),
    i94_admission_number: f(i94AdmNumber),
    admission_date: nullF(),
    authorized_until: nullF(),
    issuing_office: nullF(),
  });
}

function uscisFormEntry(
  filename: string,
  formId: string,
  beneficiaryName: string,
) {
  return entry(filename, {
    doc_type: 'uscis_or_dos_form',
    suggested_filename: nullF(),
    display_name: nullF(),
    form_id: f(formId),
    form_edition: nullF(),
    beneficiary_name: f(beneficiaryName),
    petitioner_name: nullF(),
    signature_present: f(true),
    signature_date: nullF(),
    attorney_g28_present: f(false),
    investment_amount_usd: nullF(),
  });
}

function formationDocEntry(
  filename: string,
  ein: string,
  formationDate: string,
) {
  return entry(filename, {
    doc_type: 'formation_doc',
    suggested_filename: nullF(),
    display_name: nullF(),
    kind: f('articles_of_organization'),
    entity_legal_name: f('Aegean Atelier LLC'),
    entity_type: f('LLC'),
    formation_date: f(formationDate),
    state_of_formation: f('FL'),
    ein: f(ein),
  });
}

function einLetterEntry(filename: string, einFull: string) {
  return entry(
    filename,
    {
      doc_type: 'formation_doc',
      suggested_filename: nullF(),
      display_name: nullF(),
      kind: f('ein_letter'),
      entity_legal_name: f('Aegean Atelier LLC'),
      entity_type: f('LLC'),
      formation_date: nullF(),
      state_of_formation: nullF(),
      ein: f(einFull),
    },
    {
      corporateFormation: {
        formation_doc_subtype: 'ein_assignment_letter',
        entity_legal_name: f('Aegean Atelier LLC'),
        entity_state_or_country: f('FL'),
        entity_type: f('LLC'),
        filing_date_or_effective_date: nullF(),
        registered_agent_name: nullF(),
        ein_full: f(einFull),
        assigned_date: f('2024-01-15'),
        irs_signature_present: f(true),
      },
    },
  );
}

function articlesEntry(filename: string, formationDate: string) {
  return entry(
    filename,
    {
      doc_type: 'formation_doc',
      suggested_filename: nullF(),
      display_name: nullF(),
      kind: f('articles_of_organization'),
      entity_legal_name: f('Aegean Atelier LLC'),
      entity_type: f('LLC'),
      formation_date: f(formationDate),
      state_of_formation: f('FL'),
      ein: nullF(),
    },
    {
      corporateFormation: {
        formation_doc_subtype: 'articles_of_organization',
        entity_legal_name: f('Aegean Atelier LLC'),
        entity_state_or_country: f('FL'),
        entity_type: f('LLC'),
        filing_date_or_effective_date: f(formationDate),
        registered_agent_name: nullF(),
        registrant_name: nullF(),
        members_or_shareholders: [],
        organizer_or_incorporator_name: nullF(),
        signed_date: nullF(),
      },
    },
  );
}

function commercialLeaseEntry(filename: string, address: string) {
  return entry(
    filename,
    {
      doc_type: 'lease_or_property',
      suggested_filename: nullF(),
      display_name: nullF(),
      address: f(address),
      lessor: nullF(),
      lessee: f('Aegean Atelier LLC'),
      term_start: nullF(),
      term_end: nullF(),
      monthly_rent_usd: nullF(),
      deposit_usd: nullF(),
      square_footage: nullF(),
    },
    {
      contract: {
        contract_subtype: 'commercial_lease',
        landlord: nullF(),
        tenant_legal_name: f('Aegean Atelier LLC'),
        premises_address: f(address),
        term_start: nullF(),
        term_end: nullF(),
        monthly_rent_amount: nullF(),
        monthly_rent_currency: nullF(),
        security_deposit_amount: nullF(),
        renewal_options: nullF(),
      },
    },
  );
}

function taxReturnEntry(filename: string, last4: string) {
  return entry(
    filename,
    {
      doc_type: 'tax_doc',
      suggested_filename: nullF(),
      display_name: nullF(),
      filer_name: f('Aegean Atelier LLC'),
      tax_year: f('2024'),
      form_type: f('1120'),
      total_income_usd: nullF(),
      jurisdiction: f('US'),
    },
    {
      taxReturn: {
        tax_return_subtype: 'form_1120',
        tax_year: f('2024'),
        ein_or_ssn_last4: f(last4),
        entity_legal_name: f('Aegean Atelier LLC'),
        gross_receipts_amount: nullF(),
        total_deductions_amount: nullF(),
        net_income_or_loss_amount: nullF(),
        currency: f('USD'),
        schedule_l_total_assets_beginning: nullF(),
        schedule_l_total_assets_end: nullF(),
      },
    },
  );
}

function coverLetterWithRenewalEntry(
  filename: string,
  priorPassport: string,
  currentPassport: string,
) {
  return entry(
    filename,
    {
      doc_type: 'cover_letter',
      suggested_filename: nullF(),
      display_name: nullF(),
      visa_type_argued: f('E-2'),
      addressee: f('USCIS'),
      attorney_name: f('Akalan'),
      attorney_signature_present: f(true),
      letter_date: nullF(),
      word_count_estimate: f(3000),
    },
    {
      coverLetter: {
        fully_operational_since_date: nullF(),
        claimed_business_model: nullF(),
        claimed_industry_naics: nullF(),
        principal_treaty_investor_identity: nullF(),
        co_petitioner_relationships: [],
        prior_passport_renewal_footnote: {
          paragraph_text: 'The Beneficiary renewed her passport...',
          prior_passport_number: priorPassport,
          current_passport_number: currentPassport,
        },
        five_year_business_horizon: null,
        develop_and_direct_role_grant: null,
      },
    },
  );
}

/* ---------------------------------------------------------------------- */
/* Tests                                                                   */
/* ---------------------------------------------------------------------- */

describe('checkBeneficiaryNameConsistency', () => {
  it('no conflict when 3 docs all carry the same name', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'AYŞE YILMAZ', '15 JAN 1985', 'U12345678'),
      i94Entry('i94.pdf', 'AYSE YILMAZ', 'A1B2C3D4'),
      uscisFormEntry('i-129.pdf', 'I-129', 'Ayşe Yılmaz'),
    ]);
    expect(checkBeneficiaryNameConsistency(memory)).toEqual([]);
  });

  it('flags an outlier when 2 docs say "John Smith" but 1 says "Jon Smith"', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'JOHN SMITH', '15 JAN 1985', 'U1'),
      i94Entry('i94.pdf', 'JOHN SMITH', 'A1'),
      uscisFormEntry('i-129.pdf', 'I-129', 'Jon Smith'),
    ]);
    const conflicts = checkBeneficiaryNameConsistency(memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflict_type.value).toBe('beneficiary_name_drift');
    expect(conflicts[0].severity.value).toBe(4);
    expect(conflicts[0].fact_a_doc.value).toBe('i-129.pdf');
    expect(conflicts[0].fact_b_doc.value).toBe('passport.pdf');
  });

  it('handles "Lastname, Firstname" reorder against "Firstname Lastname"', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'YILMAZ, AYŞE', '15 JAN 1985', 'U1'),
      i94Entry('i94.pdf', 'AYSE YILMAZ', 'A1'),
    ]);
    expect(checkBeneficiaryNameConsistency(memory)).toEqual([]);
  });

  it('returns empty when only one beneficiary-name source is present', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'AYŞE YILMAZ', '15 JAN 1985', 'U1'),
    ]);
    expect(checkBeneficiaryNameConsistency(memory)).toEqual([]);
  });
});

describe('checkBeneficiaryDobConsistency', () => {
  it('no conflict when DOBs match across formats', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'AYSE YILMAZ', '15 JAN 1985', 'U1'),
      passportEntry('passport-2.pdf', 'AYSE YILMAZ', '1985-01-15', 'U1'),
    ]);
    expect(checkBeneficiaryDobConsistency(memory)).toEqual([]);
  });

  it('flags when passport DOB and second-passport DOB diverge', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'AYSE YILMAZ', '15 JAN 1985', 'U1'),
      passportEntry('passport-bad.pdf', 'AYSE YILMAZ', '15 FEB 1985', 'U2'),
    ]);
    const conflicts = checkBeneficiaryDobConsistency(memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflict_type.value).toBe('beneficiary_dob_drift');
    expect(conflicts[0].severity.value).toBe(4);
  });
});

describe('checkPassportNumberConsistency', () => {
  it('flags when two passport docs cite different numbers and no renewal footnote', () => {
    const memory = memoryFrom([
      passportEntry('passport-old.pdf', 'AYSE YILMAZ', '1985-01-15', 'U12345678'),
      passportEntry('passport-new.pdf', 'AYSE YILMAZ', '1985-01-15', 'U99999999'),
    ]);
    const conflicts = checkPassportNumberConsistency(memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflict_type.value).toBe('passport_number_drift');
    expect(conflicts[0].severity.value).toBe(4);
  });

  it('suppresses conflict when cover-letter renewal footnote names both passports', () => {
    const memory = memoryFrom([
      passportEntry('passport-old.pdf', 'AYSE YILMAZ', '1985-01-15', 'U12345678'),
      passportEntry('passport-new.pdf', 'AYSE YILMAZ', '1985-01-15', 'U99999999'),
      coverLetterWithRenewalEntry('cover.pdf', 'U12345678', 'U99999999'),
    ]);
    expect(checkPassportNumberConsistency(memory)).toEqual([]);
  });

  it('does not flag when only one passport doc is present', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'AYSE YILMAZ', '1985-01-15', 'U1'),
    ]);
    expect(checkPassportNumberConsistency(memory)).toEqual([]);
  });
});

describe('checkEinConsistency', () => {
  it('no conflict when 2 formation docs cite the same EIN', () => {
    const memory = memoryFrom([
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      einLetterEntry('ein-cert.pdf', '12-3456789'),
    ]);
    expect(checkEinConsistency(memory)).toEqual([]);
  });

  it('flags severity-5 when articles and EIN letter disagree on EIN', () => {
    const memory = memoryFrom([
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      einLetterEntry('ein-cert.pdf', '99-9999999'),
    ]);
    const conflicts = checkEinConsistency(memory);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].conflict_type.value).toBe('ein_drift');
    expect(conflicts[0].severity.value).toBe(5);
  });

  it('flags when tax-return last-4 disagrees with formation full-EIN last-4', () => {
    const memory = memoryFrom([
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      einLetterEntry('ein-cert.pdf', '12-3456789'),
      taxReturnEntry('1120.pdf', '0000'),
    ]);
    const conflicts = checkEinConsistency(memory);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts.some((c) => c.fact_a_doc.value === '1120.pdf')).toBe(true);
  });

  it('no conflict when tax-return last-4 matches formation full-EIN last-4', () => {
    const memory = memoryFrom([
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      taxReturnEntry('1120.pdf', '6789'),
    ]);
    expect(checkEinConsistency(memory)).toEqual([]);
  });
});

describe('checkEnterpriseAddressConsistency', () => {
  it('no conflict when zip + street number agree, suite varies', () => {
    const memory = memoryFrom([
      commercialLeaseEntry('lease.pdf', '123 Ocean Dr Suite 100, Miami, FL 33139'),
      commercialLeaseEntry('lease-2.pdf', '123 Ocean Dr Ste 100, Miami, FL 33139'),
      commercialLeaseEntry('lease-3.pdf', '123 Ocean Dr #100, Miami, FL 33139'),
    ]);
    expect(checkEnterpriseAddressConsistency(memory)).toEqual([]);
  });

  it('flags when zip differs', () => {
    const memory = memoryFrom([
      commercialLeaseEntry('lease.pdf', '123 Ocean Dr Suite 100, Miami, FL 33139'),
      commercialLeaseEntry('lease-2.pdf', '123 Ocean Dr Suite 100, Miami, FL 33140'),
    ]);
    const conflicts = checkEnterpriseAddressConsistency(memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflict_type.value).toBe('enterprise_address_drift');
    expect(conflicts[0].severity.value).toBe(3);
  });

  it('flags when street number differs', () => {
    const memory = memoryFrom([
      commercialLeaseEntry('lease.pdf', '123 Ocean Dr, Miami, FL 33139'),
      commercialLeaseEntry('lease-2.pdf', '125 Ocean Dr, Miami, FL 33139'),
    ]);
    const conflicts = checkEnterpriseAddressConsistency(memory);
    expect(conflicts).toHaveLength(1);
  });
});

describe('checkFormationDateConsistency', () => {
  it('no conflict when ±15 days', () => {
    const memory = memoryFrom([
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      articlesEntry('articles-rich.pdf', '2024-01-25'),
    ]);
    expect(checkFormationDateConsistency(memory)).toEqual([]);
  });

  it('flags when ±60 days', () => {
    const memory = memoryFrom([
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      articlesEntry('articles-rich.pdf', '2024-03-15'),
    ]);
    const conflicts = checkFormationDateConsistency(memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflict_type.value).toBe('formation_date_drift');
    expect(conflicts[0].severity.value).toBe(3);
  });
});

describe('checkI94NumberConsistency', () => {
  it('flags when I-94 admission # and status_doc i94 # differ', () => {
    const memory = memoryFrom([
      i94Entry('i94.pdf', 'AYSE YILMAZ', 'A1B2C3D4'),
      statusDocEntry('i797.pdf', 'AYSE YILMAZ', 'X9Y8Z7W6'),
    ]);
    const conflicts = checkI94NumberConsistency(memory);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflict_type.value).toBe('i94_number_drift');
    expect(conflicts[0].severity.value).toBe(4);
  });

  it('no conflict when both cite the same admission number', () => {
    const memory = memoryFrom([
      i94Entry('i94.pdf', 'AYSE YILMAZ', 'A1B2C3D4'),
      statusDocEntry('i797.pdf', 'AYSE YILMAZ', 'A1B2C3D4'),
    ]);
    expect(checkI94NumberConsistency(memory)).toEqual([]);
  });

  it('whitespace strip: " A1 B2 " === "A1B2"', () => {
    const memory = memoryFrom([
      i94Entry('i94.pdf', 'AYSE YILMAZ', '  A1 B2 C3 D4  '),
      statusDocEntry('i797.pdf', 'AYSE YILMAZ', 'A1B2C3D4'),
    ]);
    expect(checkI94NumberConsistency(memory)).toEqual([]);
  });
});

describe('checkCrossDocumentInconsistencies — composite + idempotency', () => {
  it('idempotent: dedupes by (conflict_type, fact_a_doc, fact_b_doc)', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'JOHN SMITH', '15 JAN 1985', 'U1'),
      uscisFormEntry('i-129.pdf', 'I-129', 'Jon Smith'),
    ]);
    const r1 = checkCrossDocumentInconsistencies(memory, emptyFacts);
    expect(r1.conflicts.length).toBeGreaterThanOrEqual(1);
    // Run with the SAME memory through dedupe pipe twice → still one entry
    // per (type, a, b). The aggregator's caller does the deeper dedupe but
    // the checker itself MUST not internally double-emit.
    const types = r1.conflicts.map(
      (c) => `${c.conflict_type.value}|${c.fact_a_doc.value}|${c.fact_b_doc.value}`,
    );
    expect(new Set(types).size).toBe(types.length);
  });

  it('empty memory: no conflicts', () => {
    expect(
      checkCrossDocumentInconsistencies({}, emptyFacts).conflicts,
    ).toEqual([]);
  });

  it('single passport: no conflicts of any kind', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'AYSE YILMAZ', '15 JAN 1985', 'U1'),
    ]);
    const result = checkCrossDocumentInconsistencies(memory, emptyFacts);
    expect(result.conflicts).toEqual([]);
  });

  it('multi-axis: name + EIN drift surface as separate conflict_types', () => {
    const memory = memoryFrom([
      passportEntry('passport.pdf', 'JOHN SMITH', '15 JAN 1985', 'U1'),
      uscisFormEntry('i-129.pdf', 'I-129', 'Jon Smith'),
      formationDocEntry('articles.pdf', '12-3456789', '2024-01-10'),
      einLetterEntry('ein-cert.pdf', '99-9999999'),
    ]);
    const result = checkCrossDocumentInconsistencies(memory, emptyFacts);
    const types = new Set(result.conflicts.map((c) => c.conflict_type.value));
    expect(types.has('beneficiary_name_drift')).toBe(true);
    expect(types.has('ein_drift')).toBe(true);
  });
});
