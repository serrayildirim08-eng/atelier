'use client';

/**
 * Demo route — drives <LoadingProgress/> with synthetic stream events so the
 * v3 progress shell can be eyeballed without running a real Anthropic ingest.
 * Not committed; delete or hide behind dev-only when wiring is real.
 */

import { useEffect, useRef, useState } from 'react';
import {
  LoadingProgress,
  type LoadingStreamEvent,
} from '@/app/components/loading-progress';

interface ScriptedEvent {
  delay: number;
  event: LoadingStreamEvent;
}

const SCRIPT: ScriptedEvent[] = [
  { delay: 0, event: { type: 'start', total: 23, matter: 'Demir, Mehmet — Aegean Atelier Coffee LLC' } },
  {
    delay: 800,
    event: {
      type: 'progress',
      stage: 'subtype_detecting',
      label: 'Classifying E-2 sub-type from raw client documents',
      total: 23,
    },
  },
  {
    delay: 1500,
    event: {
      type: 'progress',
      stage: 'classifying',
      label: 'Reading 23 PDFs in parallel',
      total: 23,
    },
  },
  // Stream pdf_results — 23 of them, one every ~250ms
  ...Array.from({ length: 23 }, (_, i) => ({
    delay: 2000 + i * 240,
    event: {
      type: 'pdf_result' as const,
      index: i,
      total: 23,
      filename:
        i === 0
          ? 'tab-c1-passport-bio.pdf'
          : i === 5
            ? 'tab-d1-articles-of-organization.pdf'
            : `tab-e-${(i - 1).toString().padStart(2, '0')}.pdf`,
      doc_type:
        i === 0
          ? 'passport'
          : i === 5
            ? 'formation_doc'
            : i % 4 === 0
              ? 'bank_statement'
              : 'invoice_or_receipt',
      error: null,
      facts:
        i === 0
          ? {
              full_name_ascii: {
                value: 'Mehmet Demir',
                source_page: 14,
                source_quote: 'P<TURDEMIR<<MEHMET',
                confidence: 0.99,
              },
              nationality: {
                value: 'Türkiye',
                source_page: 14,
                source_quote: 'Republic of Türkiye',
                confidence: 0.99,
              },
            }
          : i === 5
            ? {
                entity_legal_name: {
                  value: 'Aegean Atelier Coffee LLC',
                  source_page: 41,
                  source_quote: 'organized under the laws of Florida',
                  confidence: 0.98,
                },
                state_of_formation: {
                  value: 'Florida',
                  source_page: 41,
                  source_quote: 'State of Florida',
                  confidence: 0.98,
                },
              }
            : {},
      pageCount: 1 + (i % 4),
    },
  })),
  {
    delay: 7800,
    event: {
      type: 'subtype_result',
      principal_subtype: 'individual_investor',
      procedural_posture: 'consular_new',
      has_dependents: true,
      detection_confidence: 'HIGH',
      sample_files: ['tab-c1-passport-bio.pdf', 'tab-d1-articles-of-organization.pdf'],
    },
  },
  {
    delay: 8200,
    event: {
      type: 'progress',
      stage: 'aggregating',
      label: 'Reconciling 23 per-document extractions into unified case facts',
      total: 23,
    },
  },
  {
    delay: 11500,
    event: {
      type: 'progress',
      stage: 'drafting',
      label: 'Drafting cover letter from unified facts',
      total: 23,
    },
  },
  // Simulate streaming draft deltas — section headers fire over time
  { delay: 12000, event: { type: 'draft_delta', delta: '\nII. Treaty Qualification\n\nThe applicant is a national of...\n' } },
  { delay: 13200, event: { type: 'draft_delta', delta: '\nIII. Ownership Structure\n\nAegean Atelier Coffee LLC is...\n' } },
  { delay: 14500, event: { type: 'draft_delta', delta: '\nIV. Investment, Source of Funds, and At-Risk Capital\n\n' } },
  { delay: 16100, event: { type: 'draft_delta', delta: '\nV. Substantiality\n\nProportionality is computed...\n' } },
  { delay: 17400, event: { type: 'draft_delta', delta: '\nVI. Marginality and Real & Operating Enterprise\n\n' } },
  {
    delay: 18800,
    event: {
      type: 'progress',
      stage: 'reviewing',
      label: 'Auditing the draft against the unified facts',
      total: 23,
    },
  },
  { delay: 19400, event: { type: 'draft_delta', delta: '\nVII. Develop and Direct\n\n' } },
  { delay: 19900, event: { type: 'draft_delta', delta: '\nVIII. Dependents\n\n' } },
  {
    delay: 21000,
    event: {
      type: 'result',
      result: {
        filename: 'Demir, Mehmet — Aegean Atelier Coffee LLC',
        pageCount: 487,
        detection_confidence: 0.97,
        detection_reasoning: 'demo',
        caseFacts: {
          case_type: 'E2',
          facts: {
            investor: {
              full_name: { value: 'Mehmet Demir', source_page: 14, source_quote: '', confidence: 0.99 },
              dob: { value: '1979-04-12', source_page: 14, source_quote: '', confidence: 0.97 },
              place_of_birth: { value: 'Istanbul, Türkiye', source_page: 14, source_quote: '', confidence: 0.96 },
              nationality: { value: 'Türkiye', source_page: 14, source_quote: '', confidence: 0.99 },
              passport_number: { value: 'U12345678', source_page: 14, source_quote: '', confidence: 0.99 },
              passport_expiry: { value: '2031-08-30', source_page: 14, source_quote: '', confidence: 0.95 },
              current_us_status: { value: 'B-1/B-2 visitor (active)', source_page: 22, source_quote: '', confidence: 0.9 },
            },
            enterprise: {
              legal_name: { value: 'Aegean Atelier Coffee LLC', source_page: 41, source_quote: '', confidence: 0.98 },
              ein: { value: '87-1234567', source_page: 42, source_quote: '', confidence: 0.97 },
              formation_date: { value: '2024-11-04', source_page: 41, source_quote: '', confidence: 0.97 },
              state_of_formation: { value: 'Florida', source_page: 41, source_quote: '', confidence: 0.98 },
              entity_type: { value: 'LLC', source_page: 41, source_quote: '', confidence: 0.99 },
              industry: { value: 'Specialty coffee retail', source_page: 55, source_quote: '', confidence: 0.9 },
              naics_code: { value: '722515', source_page: 55, source_quote: '', confidence: 0.92 },
              physical_address: { value: '212 Brickell Ave, Miami, FL', source_page: 56, source_quote: '', confidence: 0.94 },
            },
            ownership_chain: [
              {
                owner_name: { value: 'Mehmet Demir', source_page: 41, source_quote: '', confidence: 0.99 },
                ownership_percent: { value: 100, source_page: 41, source_quote: '', confidence: 0.99 },
                nationality: { value: 'Türkiye', source_page: 14, source_quote: '', confidence: 0.99 },
                direct_or_indirect: { value: 'direct', source_page: 41, source_quote: '', confidence: 0.99 },
              },
            ],
            investment: {
              total_committed_usd: { value: 425_000, source_page: 71, source_quote: '', confidence: 0.96 },
              total_spent_usd: { value: 312_400, source_page: 71, source_quote: '', confidence: 0.94 },
              total_cost_of_enterprise_usd: { value: 420_000, source_page: 73, source_quote: '', confidence: 0.86 },
              proportionality_percent: { value: 101.2, source_page: 73, source_quote: '', confidence: 0.86 },
              items: [],
            },
            source_of_funds: [
              {
                origin_category: { value: 'Sale of personal residence', source_page: 121, source_quote: '', confidence: 0.95 },
                origin_amount_usd: { value: 290_000, source_page: 121, source_quote: '', confidence: 0.95 },
                origin_evidence: { value: 'Tab E.SOF-1', source_page: 121, source_quote: '', confidence: 0.95 },
                final_destination: { value: 'Wells Fargo personal', source_page: 122, source_quote: '', confidence: 0.95 },
                notes: { value: '', source_page: null, source_quote: null, confidence: null },
              },
              {
                origin_category: { value: 'Brokerage liquidation', source_page: 130, source_quote: '', confidence: 0.95 },
                origin_amount_usd: { value: 95_000, source_page: 130, source_quote: '', confidence: 0.95 },
                origin_evidence: { value: 'Tab E.SOF-2', source_page: 130, source_quote: '', confidence: 0.95 },
                final_destination: { value: 'Aegean Atelier op.', source_page: 131, source_quote: '', confidence: 0.95 },
                notes: { value: '', source_page: null, source_quote: null, confidence: null },
              },
              {
                origin_category: { value: 'Notarized gift', source_page: 138, source_quote: '', confidence: 0.93 },
                origin_amount_usd: { value: 40_000, source_page: 138, source_quote: '', confidence: 0.93 },
                origin_evidence: { value: 'Tab E.SOF-3', source_page: 138, source_quote: '', confidence: 0.93 },
                final_destination: { value: 'Aegean Atelier op.', source_page: 139, source_quote: '', confidence: 0.93 },
                notes: { value: '', source_page: null, source_quote: null, confidence: null },
              },
            ],
            elements_evidence: {
              treaty_country_basis: { value: '', source_page: null, source_quote: null, confidence: null },
              substantial_investment_basis: { value: '', source_page: null, source_quote: null, confidence: null },
              real_and_operating_basis: { value: '', source_page: null, source_quote: null, confidence: null },
              more_than_marginal_basis: { value: '', source_page: null, source_quote: null, confidence: null },
              develop_and_direct_basis: { value: '', source_page: null, source_quote: null, confidence: null },
            },
            conflict_register: [
              {
                description: { value: 'Address mismatch (passport vs W-9)', source_page: 28, source_quote: '', confidence: 0.9 },
                conflict_type: { value: 'address_mismatch', source_page: null, source_quote: null, confidence: null },
                severity: { value: 2, source_page: null, source_quote: null, confidence: null },
                fact_a_doc: { value: 'Tab C.1', source_page: null, source_quote: null, confidence: null },
                fact_a_page: { value: 14, source_page: null, source_quote: null, confidence: null },
                fact_b_doc: { value: 'Tab E.SOF-1', source_page: null, source_quote: null, confidence: null },
                fact_b_page: { value: 124, source_page: null, source_quote: null, confidence: null },
              },
              {
                description: { value: 'Committed amount mismatch ($425k vs $410k)', source_page: 3, source_quote: '', confidence: 0.95 },
                conflict_type: { value: 'amount_mismatch', source_page: null, source_quote: null, confidence: null },
                severity: { value: 4, source_page: null, source_quote: null, confidence: null },
                fact_a_doc: { value: 'Cover §IV.A', source_page: null, source_quote: null, confidence: null },
                fact_a_page: { value: 3, source_page: null, source_quote: null, confidence: null },
                fact_b_doc: { value: 'Tab E.5', source_page: null, source_quote: null, confidence: null },
                fact_b_page: { value: 94, source_page: null, source_quote: null, confidence: null },
              },
              {
                description: { value: 'NAICS classification mismatch', source_page: 55, source_quote: '', confidence: 0.85 },
                conflict_type: { value: 'classification_mismatch', source_page: null, source_quote: null, confidence: null },
                severity: { value: 5, source_page: null, source_quote: null, confidence: null },
                fact_a_doc: { value: 'Tab D.4', source_page: null, source_quote: null, confidence: null },
                fact_a_page: { value: 55, source_page: null, source_quote: null, confidence: null },
                fact_b_doc: { value: 'Cover §VI', source_page: null, source_quote: null, confidence: null },
                fact_b_page: { value: 8, source_page: null, source_quote: null, confidence: null },
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
          detection_signals: [],
          detection_confidence: 'HIGH',
          reasoning: 'demo',
        },
      },
    },
  },
  { delay: 21500, event: { type: 'done', total: 23 } },
];

export default function LoadingDemoPage() {
  const [events, setEvents] = useState<LoadingStreamEvent[]>([]);
  const [startedAt] = useState<number>(() => Date.now());
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SCRIPT.forEach((step, i) => {
      const t = setTimeout(() => {
        if (fired.current.has(i)) return;
        fired.current.add(i);
        setEvents((prev) => [...prev, step.event]);
      }, step.delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const restart = () => {
    fired.current.clear();
    setEvents([]);
    window.location.reload();
  };

  return (
    <div className="min-h-screen paper-grain px-10 py-12 max-w-[80rem] mx-auto">
      <header className="flex items-baseline justify-between mb-10 border-b-[1.5px] border-ink pb-4">
        <span
          style={{ fontFamily: 'var(--font-display)' }}
          className="italic text-[28px] font-semibold tracking-[-0.025em] text-ink leading-none"
        >
          atelier.
        </span>
        <button
          onClick={restart}
          className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ink border border-ink px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors"
        >
          ↻ replay
        </button>
      </header>

      <LoadingProgress events={events} startedAt={startedAt} />
    </div>
  );
}
