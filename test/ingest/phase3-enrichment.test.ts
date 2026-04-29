/**
 * Phase-3 enrichment tests — pure logic, no Anthropic / disk.
 *
 * Each helper exported from ingest/typed-aggregate.ts gets at least one
 * "populates" test and one "graceful null" test. The orchestrator
 * `enrichPhase3Fields` is exercised once end-to-end. Idempotence
 * (never overwrites a populated field) is asserted explicitly.
 */

import { describe, expect, it } from 'vitest';
import {
  deriveCoPetitioners,
  deriveOwnershipHistory,
  deriveFiledDateI129,
  deriveRfes,
  deriveClaimedAmountUsd,
  deriveCurrentStatus,
  derivePriorStatusExpirationDate,
  enrichSourceOfFundsChains,
  enrichPhase3Fields,
} from '@/ingest/typed-aggregate';
import type { PerPdfResult, TypedMemory } from '@/ingest/typed-memory';
import type { E2Facts } from '@/ingest/schema';

function f<T>(value: T) {
  return {
    value,
    source_page: 1 as number | null,
    source_quote: 'q' as string | null,
    confidence: 1 as number | null,
  };
}
const fNull = { value: null, source_page: null, source_quote: null, confidence: null };

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

function passport(name: string, filename = 'passport.pdf'): PerPdfResult {
  return {
    filename,
    pageCount: 2,
    facts: {
      doc_type: 'passport',
      suggested_filename: fNull,
      display_name: fNull,
      full_name: f(name),
      dob: fNull,
      nationality: fNull,
      passport_number: fNull,
      passport_expiry: fNull,
      place_of_birth: fNull,
      issue_date: fNull,
    } as unknown as PerPdfResult['facts'],
  };
}

function articlesOfOrg(
  filename: string,
  members: { name: string; pct: number }[],
  filingDate: string,
  entity = 'Akalan LLC',
): PerPdfResult {
  return {
    filename,
    pageCount: 3,
    facts: {
      doc_type: 'formation_doc',
      suggested_filename: fNull,
      display_name: fNull,
      kind: f('articles_of_organization'),
      entity_legal_name: f(entity),
      entity_type: fNull,
      formation_date: fNull,
      state_of_formation: fNull,
      ein: fNull,
    } as unknown as PerPdfResult['facts'],
    corporateFormation: {
      formation_doc_subtype: 'articles_of_organization',
      entity_legal_name: f(entity),
      entity_state_or_country: f('FL'),
      entity_type: f('LLC'),
      filing_date_or_effective_date: f(filingDate),
      registered_agent_name: fNull,
      registrant_name: fNull,
      members_or_shareholders: members.map((m) => ({
        name: f(m.name),
        ownership_percent: f(m.pct),
        role: f('Member'),
      })),
      organizer_or_incorporator_name: fNull,
      signed_date: fNull,
    } as unknown as PerPdfResult['corporateFormation'],
  };
}

function operatingAgreementAmendment(
  filename: string,
  newMembers: { name: string; pct: number }[],
  effective: string,
  entity = 'Akalan LLC',
): PerPdfResult {
  return {
    filename,
    pageCount: 2,
    facts: {
      doc_type: 'formation_doc',
      suggested_filename: fNull,
      display_name: fNull,
      kind: f('amendment'),
      entity_legal_name: f(entity),
      entity_type: fNull,
      formation_date: fNull,
      state_of_formation: fNull,
      ein: fNull,
    } as unknown as PerPdfResult['facts'],
    corporateFormation: {
      formation_doc_subtype: 'operating_agreement_amendment',
      entity_legal_name: f(entity),
      entity_state_or_country: f('FL'),
      entity_type: f('LLC'),
      filing_date_or_effective_date: f(effective),
      registered_agent_name: fNull,
      amendment_number: f('1'),
      effective_date: f(effective),
      prior_member_list: [],
      new_member_list: newMembers.map((m) => ({
        name: f(m.name),
        ownership_percent: f(m.pct),
      })),
      capital_contribution_changes_summary: fNull,
    } as unknown as PerPdfResult['corporateFormation'],
  };
}

function i129eForm(filename: string, amountUsd: number, signatureDate: string): PerPdfResult {
  return {
    filename,
    pageCount: 4,
    facts: {
      doc_type: 'uscis_or_dos_form',
      suggested_filename: fNull,
      display_name: fNull,
      form_id: f('I-129E'),
      form_edition: fNull,
      beneficiary_name: fNull,
      petitioner_name: fNull,
      signature_present: f(true),
      signature_date: f(signatureDate),
      attorney_g28_present: fNull,
      investment_amount_usd: f(amountUsd),
    } as unknown as PerPdfResult['facts'],
  };
}

function i129Form(filename: string, signatureDate: string): PerPdfResult {
  return {
    filename,
    pageCount: 6,
    facts: {
      doc_type: 'uscis_or_dos_form',
      suggested_filename: fNull,
      display_name: fNull,
      form_id: f('I-129'),
      form_edition: fNull,
      beneficiary_name: fNull,
      petitioner_name: fNull,
      signature_present: f(true),
      signature_date: f(signatureDate),
      attorney_g28_present: fNull,
      investment_amount_usd: fNull,
    } as unknown as PerPdfResult['facts'],
  };
}

function i94(filename: string, classOfAdmission: string, admitUntil: string): PerPdfResult {
  return {
    filename,
    pageCount: 1,
    facts: {
      doc_type: 'i94',
      suggested_filename: fNull,
      display_name: fNull,
      full_name: fNull,
      admission_number: fNull,
      class_of_admission: f(classOfAdmission),
      admission_date: fNull,
      admit_until_date: f(admitUntil),
      port_of_entry: fNull,
    } as unknown as PerPdfResult['facts'],
    i94: {
      full_name_ascii: fNull,
      admission_number: fNull,
      class_of_admission: f(classOfAdmission),
      admission_date: fNull,
      admit_until_date: f(admitUntil),
      port_of_entry: fNull,
      duration_of_status_marker: f(false),
      cbp_record_number: fNull,
    } as unknown as PerPdfResult['i94'],
  };
}

function statusDoc(filename: string, statusClass: string, authUntil: string): PerPdfResult {
  return {
    filename,
    pageCount: 1,
    facts: {
      doc_type: 'status_doc',
      suggested_filename: fNull,
      display_name: fNull,
      full_name: fNull,
      status_class: f(statusClass),
      i94_admission_number: fNull,
      admission_date: fNull,
      authorized_until: f(authUntil),
      issuing_office: fNull,
    } as unknown as PerPdfResult['facts'],
  };
}

function rfeOther(filename: string, summary: string): PerPdfResult {
  return {
    filename,
    pageCount: 5,
    facts: {
      doc_type: 'other',
      suggested_filename: fNull,
      display_name: fNull,
      one_line_summary: f(summary),
      key_facts: [],
    } as unknown as PerPdfResult['facts'],
  };
}

function mita(
  filename: string,
  amountUsd: number,
  effective: string,
  transferor: string,
  transferee: string,
): PerPdfResult {
  return {
    filename,
    pageCount: 4,
    facts: {
      doc_type: 'business_contract',
      suggested_filename: fNull,
      display_name: fNull,
      counterparty_name: fNull,
      role: fNull,
      contract_value_usd: f(amountUsd),
      term_summary: fNull,
      signed_date: f(effective),
    } as unknown as PerPdfResult['facts'],
    contract: {
      contract_subtype: 'membership_interest_transfer_agreement',
      effective_date: f(effective),
      petitioner_legal_name: f('Akalan LLC'),
      transferor: {
        name: f(transferor),
        ownership_before: f(100),
        ownership_after: f(0),
      },
      transferee: {
        name: f(transferee),
        ownership_before: f(0),
        ownership_after: f(100),
      },
      interest_transferred_percent: f(100),
      total_consideration_amount: f(amountUsd),
      total_consideration_currency: f('USD'),
      payment_terms: {
        upfront_amount: fNull,
        upfront_currency: fNull,
        deferred_amount: fNull,
        deferred_currency: fNull,
        schedule: fNull,
        promissory_note_present: fNull,
      },
      executive_role_granted: fNull,
      effective_date_role: fNull,
      notarization_present: fNull,
    } as unknown as PerPdfResult['contract'],
  };
}

function sofDoc(
  filename: string,
  donor: string,
  amountUsd: number,
): PerPdfResult {
  return {
    filename,
    pageCount: 1,
    facts: {
      doc_type: 'source_of_funds',
      suggested_filename: fNull,
      display_name: fNull,
      category: f('gift_letter'),
      amount_usd: f(amountUsd),
      date: fNull,
      donor_or_seller: f(donor),
      recipient: fNull,
      notarized_or_apostilled: fNull,
      notes: fNull,
    } as unknown as PerPdfResult['facts'],
  };
}

/* ====================================================================== */
/* deriveCoPetitioners                                                    */
/* ====================================================================== */

describe('deriveCoPetitioners', () => {
  it('emits non-investor members from articles of organization', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesOfOrg('articles.pdf', [
        { name: 'Salih Kacar', pct: 60 },
        { name: 'Mehmet Tarlaci', pct: 40 },
      ], '2024-01-01'),
    ]);
    const out = deriveCoPetitioners(memory);
    expect(out).toHaveLength(1);
    expect(out[0].full_name.value).toBe('Mehmet Tarlaci');
  });

  it('returns [] when investor is the sole member', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesOfOrg('articles.pdf', [{ name: 'Salih Kacar', pct: 100 }], '2024-01-01'),
    ]);
    expect(deriveCoPetitioners(memory)).toHaveLength(0);
  });

  it('includes MITA transferor/transferee when not investor', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      mita('mita.pdf', 100_000, '2024-06-01', 'Ayse Yilmaz', 'Salih Kacar'),
    ]);
    const out = deriveCoPetitioners(memory);
    expect(out.map((c) => c.full_name.value)).toEqual(['Ayse Yilmaz']);
  });
});

/* ====================================================================== */
/* deriveOwnershipHistory                                                  */
/* ====================================================================== */

describe('deriveOwnershipHistory', () => {
  it('orders entries chronologically across articles + amendments', () => {
    const memory = memoryFrom([
      passport('Alice'),
      operatingAgreementAmendment('amend2.pdf', [
        { name: 'Alice', pct: 50 },
        { name: 'Bob', pct: 50 },
      ], '2024-06-01'),
      articlesOfOrg('articles.pdf', [{ name: 'Alice', pct: 100 }], '2023-01-01'),
    ]);
    const out = deriveOwnershipHistory(memory);
    expect(out).toHaveLength(2);
    expect(out[0].effective_date.value).toBe('2023-01-01');
    expect(out[1].effective_date.value).toBe('2024-06-01');
    expect(out[1].owner_names.map((o) => o.value)).toEqual(['Alice', 'Bob']);
  });

  it('returns [] when no formation docs are present', () => {
    const memory = memoryFrom([passport('Alice')]);
    expect(deriveOwnershipHistory(memory)).toHaveLength(0);
  });
});

/* ====================================================================== */
/* deriveFiledDateI129                                                     */
/* ====================================================================== */

describe('deriveFiledDateI129', () => {
  it('prefers I-129 over I-129E when both present', () => {
    const memory = memoryFrom([
      i129eForm('i129e.pdf', 200_000, '2025-08-30'),
      i129Form('i129.pdf', '2025-09-01'),
    ]);
    const out = deriveFiledDateI129(memory);
    expect(out?.value).toBe('2025-09-01');
  });

  it('falls back to I-129E when no base I-129 present', () => {
    const memory = memoryFrom([i129eForm('i129e.pdf', 200_000, '2025-08-30')]);
    expect(deriveFiledDateI129(memory)?.value).toBe('2025-08-30');
  });

  it('returns null when no I-129 form exists', () => {
    const memory = memoryFrom([passport('Alice')]);
    expect(deriveFiledDateI129(memory)).toBeNull();
  });
});

/* ====================================================================== */
/* deriveRfes                                                              */
/* ====================================================================== */

describe('deriveRfes', () => {
  it('detects RFE markers in `other` doc summary', () => {
    const memory = memoryFrom([
      rfeOther('uscis-rfe-2025.pdf', 'Request for Evidence dated 2025-03-01 on bona fide enterprise.'),
    ]);
    const out = deriveRfes(memory);
    expect(out).toHaveLength(1);
    expect(out[0].subject_category.value).toBe('other');
    expect(out[0].notes.value).toContain('Request for Evidence');
  });

  it('returns [] when no RFE-like docs present', () => {
    const memory = memoryFrom([passport('Alice')]);
    expect(deriveRfes(memory)).toHaveLength(0);
  });
});

/* ====================================================================== */
/* deriveClaimedAmountUsd                                                  */
/* ====================================================================== */

describe('deriveClaimedAmountUsd', () => {
  it('reads investment_amount_usd from I-129E', () => {
    const memory = memoryFrom([i129eForm('i129e.pdf', 250_000, '2025-08-30')]);
    expect(deriveClaimedAmountUsd(memory)?.value).toBe(250_000);
  });

  it('returns null when I-129E absent', () => {
    const memory = memoryFrom([passport('Alice')]);
    expect(deriveClaimedAmountUsd(memory)).toBeNull();
  });
});

/* ====================================================================== */
/* deriveCurrentStatus                                                     */
/* ====================================================================== */

describe('deriveCurrentStatus', () => {
  it('prefers rich i94 class_of_admission', () => {
    const memory = memoryFrom([
      i94('i94.pdf', 'B-2', '2023-03-22'),
      statusDoc('status.pdf', 'F-1', '2024-12-31'),
    ]);
    expect(deriveCurrentStatus(memory)?.value).toBe('B-2');
  });

  it('falls back to status_doc.status_class when no i94', () => {
    const memory = memoryFrom([statusDoc('status.pdf', 'F-1', '2024-12-31')]);
    expect(deriveCurrentStatus(memory)?.value).toBe('F-1');
  });

  it('returns null when neither i94 nor status_doc present', () => {
    const memory = memoryFrom([passport('Alice')]);
    expect(deriveCurrentStatus(memory)).toBeNull();
  });
});

/* ====================================================================== */
/* derivePriorStatusExpirationDate                                         */
/* ====================================================================== */

describe('derivePriorStatusExpirationDate', () => {
  it('reads admit_until_date from rich i94', () => {
    const memory = memoryFrom([i94('i94.pdf', 'B-2', '2023-03-22')]);
    expect(derivePriorStatusExpirationDate(memory)?.value).toBe('2023-03-22');
  });

  it('returns null when i94 has D/S marker set', () => {
    const entries: PerPdfResult[] = [
      {
        filename: 'i94-ds.pdf',
        pageCount: 1,
        facts: {
          doc_type: 'i94',
          suggested_filename: fNull,
          display_name: fNull,
          full_name: fNull,
          admission_number: fNull,
          class_of_admission: f('F-1'),
          admission_date: fNull,
          admit_until_date: f('D/S'),
          port_of_entry: fNull,
        } as unknown as PerPdfResult['facts'],
        i94: {
          full_name_ascii: fNull,
          admission_number: fNull,
          class_of_admission: f('F-1'),
          admission_date: fNull,
          admit_until_date: f('D/S'),
          port_of_entry: fNull,
          duration_of_status_marker: f(true),
          cbp_record_number: fNull,
        } as unknown as PerPdfResult['i94'],
      },
    ];
    const memory = memoryFrom(entries);
    expect(derivePriorStatusExpirationDate(memory)).toBeNull();
  });
});

/* ====================================================================== */
/* enrichSourceOfFundsChains                                               */
/* ====================================================================== */

describe('enrichSourceOfFundsChains', () => {
  it('falls back documented_amount_usd to origin_amount_usd when missing', () => {
    const memory = memoryFrom([passport('Alice')]);
    const chains = [
      {
        origin_category: f('property_sale'),
        origin_amount_usd: f(150_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    const out = enrichSourceOfFundsChains(memory, chains);
    expect(out[0].documented_amount_usd?.value).toBe(150_000);
  });

  it('binds source_person from a SOF doc whose donor matches notes', () => {
    const memory = memoryFrom([
      passport('Alice'),
      sofDoc('gift-letter.pdf', 'Mehmet Tarlaci', 50_000),
    ]);
    const chains = [
      {
        origin_category: f('gift'),
        origin_amount_usd: f(50_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: f('Gift from Mehmet Tarlaci to investor'),
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    const out = enrichSourceOfFundsChains(memory, chains);
    expect(out[0].source_person?.full_name.value).toBe('Mehmet Tarlaci');
  });

  it('does not overwrite a populated documented_amount_usd', () => {
    const memory = memoryFrom([passport('Alice')]);
    const chains = [
      {
        origin_category: f('property_sale'),
        origin_amount_usd: f(150_000),
        origin_evidence: fNull,
        final_destination: fNull,
        notes: fNull,
        documented_amount_usd: f(140_000),
      } as unknown as E2Facts['source_of_funds'][number],
    ];
    const out = enrichSourceOfFundsChains(memory, chains);
    expect(out[0].documented_amount_usd?.value).toBe(140_000);
  });
});

/* ====================================================================== */
/* enrichPhase3Fields orchestrator                                         */
/* ====================================================================== */

function emptyFacts(): E2Facts {
  return {
    investor: {
      full_name: f('Salih Kacar'),
    } as unknown as E2Facts['investor'],
    enterprise: {} as E2Facts['enterprise'],
    ownership_chain: [],
    investment: { items: [] } as unknown as E2Facts['investment'],
    source_of_funds: [],
    elements_evidence: {} as E2Facts['elements_evidence'],
    conflict_register: [],
  } as E2Facts;
}

describe('enrichPhase3Fields', () => {
  it('populates all derivable Phase-1/2 fields end-to-end', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      articlesOfOrg('articles.pdf', [
        { name: 'Salih Kacar', pct: 60 },
        { name: 'Mehmet Tarlaci', pct: 40 },
      ], '2024-01-01'),
      i129eForm('i129e.pdf', 200_000, '2025-08-30'),
      i94('i94.pdf', 'B-2', '2023-03-22'),
      rfeOther('rfe.pdf', 'Notice of Intent to Deny — substantial investment.'),
    ]);
    const facts = emptyFacts();
    enrichPhase3Fields(facts, memory);

    expect(facts.matter?.co_petitioners?.[0].full_name.value).toBe('Mehmet Tarlaci');
    expect(facts.ownership_history?.[0].effective_date.value).toBe('2024-01-01');
    expect(facts.filed_date_i129?.value).toBe('2025-08-30');
    expect(facts.rfes?.[0].notes.value).toContain('Notice of Intent');
    expect(facts.investment.claimed_amount_usd?.value).toBe(200_000);
    expect(facts.investor.current_status?.value).toBe('B-2');
    expect(facts.investor.prior_status_expiration_date?.value).toBe('2023-03-22');
  });

  it('does not overwrite already-populated fields (idempotence)', () => {
    const memory = memoryFrom([
      passport('Salih Kacar'),
      i129eForm('i129e.pdf', 200_000, '2025-08-30'),
    ]);
    const facts = emptyFacts();
    facts.investment = {
      ...facts.investment,
      claimed_amount_usd: f(99_999),
    } as unknown as E2Facts['investment'];
    facts.filed_date_i129 = f('2099-12-31');

    enrichPhase3Fields(facts, memory);

    expect(facts.investment.claimed_amount_usd?.value).toBe(99_999);
    expect(facts.filed_date_i129?.value).toBe('2099-12-31');
  });

  it('leaves Phase-4 fields null (work_authorization_date, fully_operational_since_date, observed_business_model)', () => {
    const memory = memoryFrom([passport('Salih Kacar'), i94('i94.pdf', 'B-2', '2023-03-22')]);
    const facts = emptyFacts();
    enrichPhase3Fields(facts, memory);
    expect(facts.investor.work_authorization_date?.value ?? null).toBeNull();
    expect(facts.enterprise.fully_operational_since_date?.value ?? null).toBeNull();
    expect(facts.enterprise.observed_business_model?.value ?? null).toBeNull();
  });
});
