/**
 * Mock matter loader. Returns an IngestSuccess + e2_subtype shape so the
 * dashboard can render before the live ingest pipeline is wired through.
 * Replace `getMockMatter` with a real loader (DB / file store) once the
 * skill batches land. Keep the return shape stable — components import
 * from `@/ingest` types and the page is type-checked end-to-end.
 */

import type { IngestSuccess } from '@/ingest';
import type { TypedMemory } from '@/ingest/typed-memory';

type Provenance<T> = {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
};

const f = <T,>(
  value: T,
  source_page: number | null = null,
  source_quote: string | null = null,
  confidence: number | null = 0.92,
): Provenance<T> => ({ value, source_page, source_quote, confidence });

const fNull = <T,>(): Provenance<T> => ({
  value: null,
  source_page: null,
  source_quote: null,
  confidence: null,
});

export function getMockMatter(id: string): IngestSuccess {
  return {
    filename: `Matter ${id}`,
    pageCount: 487,
    detection_confidence: 0.97,
    detection_reasoning:
      'Treaty country (TR) + substantial cash investment + applicant retained equity → E-2 with corporate-owned-investor signals.',
    caseFacts: {
      case_type: 'E2',
      facts: {
        investor: {
          full_name: f('Mehmet Demir', 14, 'Mehmet Demir, born Istanbul', 0.99),
          dob: f('1979-04-12', 14, 'date of birth: 12 April 1979', 0.97),
          place_of_birth: f('Istanbul, Türkiye', 14, 'place of birth Istanbul', 0.96),
          nationality: f('Türkiye', 14, 'Republic of Türkiye', 0.99),
          passport_number: f('U12345678', 14, 'passport no. U12345678', 0.99),
          passport_expiry: f('2031-08-30', 14, 'expires 30 August 2031', 0.95),
          current_us_status: f('B-1/B-2 visitor (active)', 22, 'I-94 admitted B-2', 0.9),
        },
        enterprise: {
          legal_name: f('Aegean Atelier Coffee LLC', 41, 'organized under the laws of FL', 0.98),
          ein: f('87-1234567', 42, 'EIN 87-1234567', 0.97),
          formation_date: f('2024-11-04', 41, 'effective 4 November 2024', 0.97),
          state_of_formation: f('Florida', 41, 'State of Florida', 0.98),
          entity_type: f('LLC', 41, 'limited liability company', 0.99),
          industry: f('Specialty coffee retail', 55, 'specialty coffee shop', 0.9),
          naics_code: f('722515', 55, 'NAICS 722515', 0.92),
          physical_address: f('212 Brickell Ave, Miami, FL 33131', 56, '212 Brickell Ave', 0.94),
        },
        ownership_chain: [
          {
            owner_name: f('Mehmet Demir', 41, 'sole member', 0.99),
            ownership_percent: f(100, 41, '100% membership interest', 0.99),
            nationality: f('Türkiye', 14, 'Republic of Türkiye', 0.99),
            direct_or_indirect: f('direct', 41, 'direct ownership', 0.99),
          },
        ],
        investment: {
          total_committed_usd: f(425_000, 71, 'committed capital $425,000', 0.96),
          total_spent_usd: f(312_400, 71, 'expended through Q1: $312,400', 0.94),
          total_cost_of_enterprise_usd: f(420_000, 73, 'total enterprise cost ~$420k', 0.86),
          proportionality_percent: f(101.2, 73, 'computed', 0.86),
          items: [
            {
              category: f('Build-out & equipment', 88, 'GC contract — Atelier Build LLC'),
              amount_usd: f(168_500, 88, 'final invoice $168,500'),
              date: f('2025-02-14', 88, '14 Feb 2025'),
              evidence_doc: f('Tab E.4 — Atelier Build invoice', 88, 'invoice no. 2025-014'),
            },
            {
              category: f('Inventory — green coffee', 92, 'three lot purchase from Onyx Coffee'),
              amount_usd: f(54_900, 92, '$54,900'),
              date: f('2025-03-02', 92, '2 March 2025'),
              evidence_doc: f('Tab E.7 — Onyx Coffee invoice', 92, 'PO 4412'),
            },
            {
              category: f('Lease — first year', 97, '12-month commercial lease'),
              amount_usd: f(72_000, 97, '$6,000/mo × 12'),
              date: f('2025-01-10', 97, 'commencement 10 Jan 2025'),
              evidence_doc: f('Tab E.2 — Brickell lease', 97, 'executed lease'),
            },
            {
              category: f('Pre-opening salaries', 101, 'three FT employees, 90 days'),
              amount_usd: f(17_000, 101, 'gross payroll $17,000'),
              date: f('2025-03-31', 101, 'Q1 payroll'),
              evidence_doc: f('Tab E.9 — ADP register', 101, 'ADP run 03-31'),
            },
          ],
        },
        source_of_funds: [
          {
            origin_category: f('Sale of personal residence (Bebek, Istanbul)', 121, 'Tapu sicil — sale 2024-08-19'),
            origin_amount_usd: f(290_000, 121, '8,500,000 TRY @ 0.0341'),
            origin_evidence: f('Tab E.SOF-1 — Tapu deed + escrow', 121, 'Tapu Sicil Müdürlüğü'),
            final_destination: f('Garanti BBVA → Wells Fargo personal', 122, 'wire ref 8819'),
            notes: f('Currency conversion at Garanti spot rate 0.0341', 121, 'see FX confirmation'),
          },
          {
            origin_category: f('Liquidation of TR brokerage portfolio', 130, 'İş Yatırım statement'),
            origin_amount_usd: f(95_000, 130, 'net proceeds $95,000'),
            origin_evidence: f('Tab E.SOF-2 — İş Yatırım closing', 130, 'closing statement 2024-09-04'),
            final_destination: f('Wells Fargo personal → Aegean Atelier op.', 131, 'wire ref 8902'),
            notes: f('Two-step transfer; intermediate hold 9 days', 131, ''),
          },
          {
            origin_category: f('Gift from parents (notarized)', 138, 'Beyoğlu noteri 14 Eylül'),
            origin_amount_usd: f(40_000, 138, 'declared 1,170,000 TRY'),
            origin_evidence: f('Tab E.SOF-3 — Notarized gift letter', 138, 'noter onaylı'),
            final_destination: f('Wells Fargo personal → Aegean Atelier op.', 139, 'wire ref 9015'),
            notes: f('Donor capacity letter attached; FBAR addressed', 139, ''),
          },
        ],
        elements_evidence: {
          treaty_country_basis: f(
            'Investor holds sole TR nationality; enterprise owned 100% by TR national.',
            14,
            'Republic of Türkiye treaty E-2',
            0.97,
          ),
          substantial_investment_basis: f(
            'Total committed $425k against enterprise cost of ~$420k → proportionality 101%; $312k irrevocably spent.',
            71,
          ),
          real_and_operating_basis: f(
            'Storefront opened 2025-03-15; W-2 payroll, daily POS, vendor relationships.',
            155,
          ),
          more_than_marginal_basis: f(
            'Year-2 pro forma: 4.2 FTE non-investor jobs; positive operating cash flow forecast Q3 2026.',
            201,
          ),
          develop_and_direct_basis: f(
            '100% sole member with day-to-day operational control; signs vendor contracts and payroll.',
            41,
          ),
        },
        conflict_register: [
          {
            description: f(
              'Investor passport address (Istanbul) differs from Wells Fargo W-9 address (Miami).',
              28,
            ),
            conflict_type: f('address_mismatch'),
            severity: f(2),
            fact_a_doc: f('Tab C.1 — Passport bio page'),
            fact_a_page: f(14),
            fact_b_doc: f('Tab E.SOF-1 — Wells Fargo W-9'),
            fact_b_page: f(124),
          },
          {
            description: f(
              'Total committed of $425,000 (cover letter) vs. $410,000 (escrow ledger summary).',
              3,
            ),
            conflict_type: f('amount_mismatch'),
            severity: f(4),
            fact_a_doc: f('Cover letter §IV.A'),
            fact_a_page: f(3),
            fact_b_doc: f('Tab E.5 — Escrow ledger'),
            fact_b_page: f(94),
          },
          {
            description: f(
              'Lease commencement (10 Jan 2025) precedes formation date (4 Nov 2024) signing chain by an unusual gap; verify intent to bind.',
              97,
            ),
            conflict_type: f('timeline_anomaly'),
            severity: f(3),
            fact_a_doc: f('Tab E.2 — Lease'),
            fact_a_page: f(97),
            fact_b_doc: f('Tab D.1 — Articles of Organization'),
            fact_b_page: f(41),
          },
          {
            description: f(
              'NAICS 722515 (snack & nonalcoholic) reported on lease but the cover letter argues sit-down service (722511).',
              55,
            ),
            conflict_type: f('classification_mismatch'),
            severity: f(2),
            fact_a_doc: f('Tab D.4 — Form filings'),
            fact_a_page: f(55),
            fact_b_doc: f('Cover letter §VI'),
            fact_b_page: f(8),
          },
        ],
      },
    },
    e2_subtype: {
      principal_subtype: 'individual_investor',
      procedural_posture: 'consular_new',
      has_dependents: true,
      dependent_count: 2,
      dependent_breakdown: { spouse: true, children: 1 },
      detection_signals: [
        '100% sole member with TR nationality',
        'consulate appointment scheduled at U.S. Embassy Ankara',
        'no prior E-2 filings on record',
      ],
      detection_confidence: 'HIGH',
      reasoning:
        'Single TR national investing personally; no prior US visa status; consular new filing posture.',
    },
  };
}

/**
 * Mock typed memory for the dashboard's exhibit-list view. Six sample
 * PerPdfResults across enough doc_types to exercise the A-L tab map.
 * Replace with the real per-matter typed-memory store once persisted.
 *
 * Facts shapes here are partial — only the fields the exhibit-list
 * generator actually reads (doc_type + suggested_filename + form_id
 * for uscis_or_dos_form). The cast via `unknown` is intentional:
 * exhaustive-shape fixtures live in the per-extractor mocks.
 */
export function getMockTypedMemory(_id: string): TypedMemory {
  const tinyField = <T,>(value: T) => ({
    value,
    source_page: 1 as number | null,
    source_quote: null as string | null,
    confidence: 0.95 as number | null,
  });

  const partial = (facts: Record<string, unknown>) =>
    facts as unknown as import('@/ingest/typed-memory').PerPdfFacts;

  return {
    uscis_or_dos_form: [
      {
        filename: 'A. Forms/I-129.pdf',
        pageCount: 8,
        facts: partial({
          doc_type: 'uscis_or_dos_form',
          suggested_filename: tinyField('aegean-atelier-i-129-petition.pdf'),
          form_id: tinyField('I-129'),
        }),
      },
      {
        filename: 'A. Forms/I-129E.pdf',
        pageCount: 4,
        facts: partial({
          doc_type: 'uscis_or_dos_form',
          suggested_filename: tinyField('aegean-atelier-i-129e-supplement.pdf'),
          form_id: tinyField('I-129E'),
        }),
      },
    ],
    passport: [
      {
        filename: 'C. Treaty Country/Beneficiary-Passport.pdf',
        pageCount: 2,
        facts: partial({
          doc_type: 'passport',
          suggested_filename: tinyField('demir-mehmet-tr-passport-bio-page.pdf'),
        }),
      },
    ],
    formation_doc: [
      {
        filename: 'D. Ownership/Articles-of-Organization.pdf',
        pageCount: 3,
        facts: partial({
          doc_type: 'formation_doc',
          suggested_filename: tinyField(
            'aegean-atelier-articles-of-organization.pdf',
          ),
        }),
      },
    ],
    money_movement: [
      {
        filename: 'E. Investment/Wire-Confirmation-2024-12-18.pdf',
        pageCount: 1,
        facts: partial({
          doc_type: 'money_movement',
          suggested_filename: tinyField(
            'demir-to-aegean-atelier-wire-2024-12-18.pdf',
          ),
        }),
      },
    ],
    cover_letter: [
      {
        filename: 'B. Cover Letter/Akalan-Cover-Letter-2026-01-04.pdf',
        pageCount: 12,
        facts: partial({
          doc_type: 'cover_letter',
          suggested_filename: tinyField(
            'akalan-cover-letter-aegean-atelier-2026-01-04.pdf',
          ),
        }),
      },
    ],
  };
}
