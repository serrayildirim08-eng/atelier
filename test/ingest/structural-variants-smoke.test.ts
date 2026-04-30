import { describe, it, expect } from 'vitest';
import { classifyByTier0 } from '@/ingest/classify-fallback';

function classify(filename: string, firstPageText = '', formFields: string[] = []) {
  return classifyByTier0({
    filename,
    first_page_text: firstPageText,
    pdf_form_field_names: formFields,
  });
}

describe('Structural-variant smoke: bank_statement (4 variants)', () => {
  it('FX-account statement is detected from multi-currency content', () => {
    const r = classify('account_092024.pdf', 'Currency Sub-Ledger USD EUR TRY FX rate Conversion Rate');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_fx_multicurrency');
  });

  it('Brokerage statement is detected from holdings + tickers', () => {
    const r = classify('Schwab_2024-Q4.pdf', 'Portfolio Summary CUSIP Ticker Bought Sold Cost Basis Unrealized Gain');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_brokerage');
  });

  it('Business statement is detected from entity suffix + payroll provider', () => {
    const r = classify('Chase_03_2025.pdf', 'Acme LLC Operating Account ADP Gusto Merchant Services');
    expect(r.candidates[0]?.doc_type_id).toBe('bank_statement_business');
  });
});

describe('Structural-variant smoke: source_of_funds (6 variants)', () => {
  it('Share-purchase agreement is detected from reps & warranties', () => {
    const r = classify('exit_agreement.pdf', 'Share Purchase Agreement Representations and Warranties Closing Conditions');
    expect(r.candidates[0]?.doc_type_id).toBe('share_purchase_agreement');
  });

  it('Salary savings declaration is detected from affidavit framing', () => {
    const r = classify('birikim_beyani.pdf', 'Declaration accumulated savings I hereby affirm under penalty of perjury');
    expect(r.candidates[0]?.doc_type_id).toBe('salary_savings_declaration');
  });
});

describe('Structural-variant smoke: vital_record (4 variants)', () => {
  it('Divorce decree is detected from court letterhead', () => {
    const r = classify('bosanma_karari.pdf', 'Boşanma Kararı Aile Mahkemesi Esas No Karar No Petitioner Respondent');
    expect(r.candidates[0]?.doc_type_id).toBe('divorce_decree');
  });

  it('Death certificate is detected from decedent block', () => {
    const r = classify('vefat_belgesi.pdf', 'Ölüm Belgesi Müteveffa Vefat Date of Death Place of Death Civil Registry');
    expect(r.candidates[0]?.doc_type_id).toBe('death_certificate');
  });
});

describe('Structural-variant smoke: government_id (3 variants)', () => {
  it('National ID detected from TR Kimlik signals', () => {
    const r = classify('kimlik.pdf', 'T.C. Kimlik Kartı Türkiye Cumhuriyeti Identity Card');
    expect(r.candidates[0]?.doc_type_id).toBe('national_id_card');
  });

  it('Driver license detected from license-class field', () => {
    const r = classify('surucu_belgesi.pdf', 'Sürücü Belgesi License Class Class B Date of Issue Date of Expiry');
    expect(r.candidates[0]?.doc_type_id).toBe('drivers_license');
  });

  it('Residency card detected from immigration-authority emblem', () => {
    const r = classify('green_card.pdf', 'Permanent Resident Card USCIS I-551 Department of Homeland Security');
    expect(r.candidates[0]?.doc_type_id).toBe('residency_immigrant_id');
  });
});

describe('Structural-variant smoke: business_contract (5 variants)', () => {
  it('Incentive grant detected from PTC + government letterhead', () => {
    const r = classify('IRA_award_letter.pdf', 'Production Tax Credit Performance Conditions Recipient Recapture Award Notice State of California Economic Development');
    expect(r.candidates[0]?.doc_type_id).toBe('incentive_grant_taxcredit');
  });

  it('JV / partnership detected from multi-party + capital contribution', () => {
    const r = classify('alliance_agreement.pdf', 'Joint Venture Agreement Capital Contribution Profit Sharing Loss Allocation Management Committee');
    expect(r.candidates[0]?.doc_type_id).toBe('partnership_jv_alliance');
  });
});

describe('Structural-variant smoke: financial_statement (4 variants)', () => {
  it('Cash flow statement detected from three-activity sections', () => {
    const r = classify('nakit_akimi.pdf', 'Cash Flow Operating Activities Investing Activities Financing Activities Beginning Cash Ending Cash');
    expect(r.candidates[0]?.doc_type_id).toBe('cash_flow_statement');
  });
});

describe('Structural-variant smoke: credential (4 variants)', () => {
  it('Academic transcript detected from per-course tabular signals', () => {
    const r = classify('not_dokumu.pdf', 'Transcript Course Credits Grade GPA Cumulative Term');
    expect(r.candidates[0]?.doc_type_id).toBe('academic_transcript');
  });
});

describe('Structural-variant smoke: payroll_doc (4 variants)', () => {
  it('Form 941 detected from quarter checkbox grid', () => {
    const r = classify('941_Q1_2024.pdf', "Form 941 Employer's QUARTERLY Federal Tax Return Quarter Q1");
    expect(r.candidates[0]?.doc_type_id).toBe('form_941_quarterly');
  });

  it('Employee roster detected from no-dollar tabular', () => {
    const r = classify('personel_listesi.pdf', 'Roster Headcount Name Title Start Date Status Full-Time Hours per Week');
    expect(r.candidates[0]?.doc_type_id).toBe('employee_roster');
  });
});

describe('Structural-variant smoke: i94 (2 variants)', () => {
  it('I-94 paper card detected from legacy signals', () => {
    const r = classify('legacy_i94.pdf', 'Arrival/Departure Record Departure Number Family Name Country of Citizenship');
    expect(r.candidates[0]?.doc_type_id).toBe('i94_paper_card');
  });
});

describe('Structural-variant smoke: status_doc (4 variants)', () => {
  it('CBP admission stamp detected from D/S + Port of Entry', () => {
    const r = classify('admission_stamp.jpeg', 'Admitted Admit Until Class of Admission D/S Port of Entry CBP');
    expect(r.candidates[0]?.doc_type_id).toBe('cbp_admission_stamp');
  });
});

describe('Structural-variant smoke: business_plan (3 variants)', () => {
  it('Pitch deck detected from slide-deck section heads', () => {
    const r = classify('pitch_deck.pdf', 'Pitch Deck The Problem The Solution Market Size The Team The Ask');
    expect(r.candidates[0]?.doc_type_id).toBe('business_plan_pitch_deck');
  });

  it('Financial model detected from line-item lexicon', () => {
    const r = classify('pro_forma.pdf', 'Pro Forma Revenue COGS Operating Expenses EBITDA Net Income Year 1 Year 2 Year 3 Year 4 Year 5');
    expect(r.candidates[0]?.doc_type_id).toBe('financial_model_spreadsheet');
  });
});

describe('Structural-variant smoke: lease_or_property (3 variants)', () => {
  it('Real-estate purchase detected from HUD-1 / ALTA', () => {
    const r = classify('closing_statement.pdf', 'Real Estate Purchase Agreement HUD-1 ALTA Settlement Statement Buyer Seller Closing Date Earnest Money');
    expect(r.candidates[0]?.doc_type_id).toBe('real_estate_purchase_closing');
  });
});

describe('Structural-variant smoke: money_movement (4 variants)', () => {
  it('Inter-account transfer detected from book-transfer signals', () => {
    const r = classify('virman.pdf', 'Internal Transfer Book Transfer Virman From Account To Account Same-Bank');
    expect(r.candidates[0]?.doc_type_id).toBe('inter_account_transfer');
  });
});

describe('Structural-variant smoke: title_deed (2 variants)', () => {
  it('Encumbrance extract detected from lien framing', () => {
    const r = classify('takyidat.pdf', 'Encumbrance Lien Search Takyidat İpotek Şerh Status of Title');
    expect(r.candidates[0]?.doc_type_id).toBe('property_encumbrance_extract');
  });
});

describe('Structural-variant smoke: translation_certification (2 variants)', () => {
  it('Sworn translation detected from notarial seal + sworn-translator', () => {
    const r = classify('yeminli_tercume.pdf', 'Yeminli Tercüme Yeminli Tercüman Notary Public Acknowledged before me Sworn-Translator Number Apostille');
    expect(r.candidates[0]?.doc_type_id).toBe('sworn_translation');
  });
});

describe('Structural-variant smoke: uscis_or_dos_form (5 variants)', () => {
  it('RFE notice detected from evidence-request bullet list', () => {
    const r = classify('rfe_response_due.pdf', 'Request for Evidence Department of Homeland Security U.S. Citizenship and Immigration Services Response Due In order to establish You have not established failure to respond within 87 days');
    expect(r.candidates[0]?.doc_type_id).toBe('rfe_noid_notice');
  });
});

describe('Structural-variant smoke: cover_letter (2 variants)', () => {
  it('Cover-letter transmittal detected from short letter signals', () => {
    const r = classify('letter_of_transmittal.pdf', 'Letter of Transmittal Enclosed please find Filing');
    expect(r.candidates[0]?.doc_type_id).toBe('cover_letter_transmittal');
  });
});

describe('Structural-variant smoke: cv_or_resume (2 variants)', () => {
  it('Academic CV detected from publications + grants', () => {
    const r = classify('faculty_cv.pdf', 'Curriculum Vitae Publications Selected Publications Peer-Reviewed Grants Funding Teaching Experience Editorial Service');
    expect(r.candidates[0]?.doc_type_id).toBe('cv_academic');
  });
});

describe('Structural-variant smoke: expert_letter (2 variants)', () => {
  it('Industry expert detected from market subject', () => {
    const r = classify('industry_expert_letter.pdf', 'Expert Letter Industry Expert Market Size Market Demand Industry Outlook University Department of Economics Professor');
    expect(r.candidates[0]?.doc_type_id).toBe('expert_letter_industry');
  });

  it('Technical letter detected from license + technical opinion', () => {
    const r = classify('PE_letter.pdf', 'Technical Opinion Professional Engineer P.E. License Number building code in conformance with in my professional opinion');
    expect(r.candidates[0]?.doc_type_id).toBe('expert_letter_technical');
  });
});

describe('Structural-variant smoke: other (3 variants)', () => {
  it('Internal memo detected from firm-template + Working/Draft labels', () => {
    const r = classify('sof_memo_draft.pdf', 'Memorandum Working Draft Source-of-Funds Memo Internal Proportionality Worksheet');
    expect(r.candidates[0]?.doc_type_id).toBe('internal_memo_worksheet');
  });
});
