import Link from 'next/link';
import { getMockMatter } from '@/app/api/matter/[id]/mock-data';
import { CaseOverviewCard } from '@/app/components/case-overview-card';
import { SectionAccordion } from '@/app/components/section-accordion';
import { SofChainTable } from '@/app/components/sof-chain-table';
import { OperationsExpenditureTable } from '@/app/components/operations-expenditure-table';
import { ConflictRegister } from '@/app/components/conflict-register';
import { AuthorityCiteCheck } from '@/app/components/authority-cite-check';
import { DocumentInventory } from '@/app/components/document-inventory';
import type { E2Facts } from '@/ingest';
import type { CitationVerifyResult } from '@/lib/verify/types';

interface FieldLeaf<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}
const v = <T,>(f: unknown): T | null => {
  if (!f || typeof f !== 'object' || !('value' in (f as object))) return null;
  return ((f as FieldLeaf<T>).value ?? null) as T | null;
};

const fmtUSD = (n: number | null): string => {
  if (n === null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

/**
 * Mock cite-check result. Once the drafter writes the cover letter and
 * verifyCitations runs against it, swap this for the real
 * CitationVerifyResult returned alongside IngestSuccess.verify_report.
 */
function mockCiteCheck(): CitationVerifyResult {
  return {
    case_type: 'E2',
    total_citations: 9,
    on_allowlist: 7,
    off_allowlist: 1,
    aao_routed: 1,
    unparseable: 0,
    findings: [
      {
        citation: { kind: 'ina', raw: 'INA § 101(a)(15)(E)(ii)', normalized: 'INA § 101(a)(15)(E)(ii)', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'Statute on allowlist for E-2.',
      },
      {
        citation: { kind: 'cfr', raw: '8 CFR § 214.2(e)(12)', normalized: '8 CFR § 214.2(e)(12)', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'Regulation on allowlist (stem-match 8 CFR § 214.2(e)).',
      },
      {
        citation: { kind: 'fam', raw: '9 FAM 402.9-4(B)(1)', normalized: '9 FAM 402.9-4(B)(1)', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'FAM section on allowlist.',
      },
      {
        citation: { kind: 'fam', raw: '9 FAM 402.9-6(B)', normalized: '9 FAM 402.9-6(B)', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'FAM section on allowlist.',
      },
      {
        citation: { kind: 'case_name', raw: 'Matter of Walsh and Pollard', normalized: 'Matter of Walsh and Pollard', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'Precedent on allowlist (20 I&N Dec. 60).',
      },
      {
        citation: { kind: 'reporter_in_dec', raw: '20 I&N Dec. 60', normalized: '20 I&N Dec. 60', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'Reporter on allowlist.',
      },
      {
        citation: { kind: 'uscis_pm', raw: 'USCIS PM Vol. 2 Pt. L Ch. 4', normalized: 'USCIS PM Vol. 2 Pt. L Ch. 4', start: 0, end: 0 },
        status: 'on_allowlist',
        message: 'Policy manual citation on allowlist.',
      },
      {
        citation: { kind: 'case_name', raw: 'Matter of X-Y-Z-', normalized: 'Matter of X-Y-Z-', start: 0, end: 0 },
        status: 'aao_route_to_human',
        message:
          'AAO non-precedent — uncheckable; routed to human review per ccc-doctrine attorney-supremacy rule.',
      },
      {
        citation: { kind: 'cfr', raw: '8 CFR § 204.5(j)(2)', normalized: '8 CFR § 204.5(j)(2)', start: 0, end: 0 },
        status: 'off_allowlist',
        message:
          'EB-1C regulation cited in an E-2 letter — likely a copy-paste from another matter.',
      },
    ],
  };
}

export default async function MatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = getMockMatter(id);
  const facts =
    matter.caseFacts?.case_type === 'E2'
      ? (matter.caseFacts.facts as E2Facts)
      : null;
  const subtype = matter.e2_subtype ?? null;

  const totalSpent = v<number>(facts?.investment.total_spent_usd) ?? 0;
  const operatingItems = facts?.investment.items ?? [];

  return (
    <div className="h-screen overflow-y-auto paper-grain">
      <header className="border-b border-rule px-8 py-3 flex items-baseline justify-between gap-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 text-[0.78rem] text-graphite hover:text-ink-2 transition-colors"
        >
          <span className="font-mono text-[0.7rem] tracking-widest">←</span>
          <span className="smcp tracking-[0.2em]">return to the binder</span>
        </Link>
        <div className="flex items-baseline gap-3 text-[0.72rem] text-graphite-soft font-mono tracking-wider">
          <span>matter</span>
          <span className="text-rule-strong">·</span>
          <span className="text-ink-2">{id}</span>
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-paper">
        <div className="px-8 py-5">
          <CaseOverviewCard matter={matter} />
        </div>
        <div className="brass-rule mx-8" />
      </div>

      <main className="px-8 pb-16 pt-2 grid gap-10">
        <section className="border border-rule paper-recess">
          <header className="px-7 py-3 flex items-baseline justify-between border-b border-rule-strong">
            <div className="flex items-baseline gap-3">
              <span className="smcp text-[0.66rem] text-rubric tracking-[0.22em]">
                ⁂  the dossier
              </span>
              <span className="display-italic text-[0.95rem] text-graphite">
                Sections II — VIII, in cover-letter order
              </span>
            </div>
            <span className="font-mono text-[0.7rem] text-graphite-soft tabular-nums tracking-wider">
              7 sections
            </span>
          </header>

          <SectionAccordion
            numeral="II"
            title="Treaty Qualification"
            subtitle="nationality"
            defaultOpen
            rightSlot={
              <span className="font-mono text-[0.7rem] text-graphite tabular-nums">
                TR · {v<number>(facts?.ownership_chain[0]?.ownership_percent) ?? '—'}%
              </span>
            }
          >
            <dl className="grid grid-cols-[12rem_1fr] gap-x-6 gap-y-3 text-[0.88rem]">
              <Row label="Investor nationality" value={v<string>(facts?.investor.nationality) ?? '—'} />
              <Row label="Place of birth" value={v<string>(facts?.investor.place_of_birth) ?? '—'} />
              <Row label="Treaty basis" value={v<string>(facts?.elements_evidence.treaty_country_basis) ?? '—'} editorial />
              <Row
                label="Equity owned by treaty nationals"
                value={`${facts?.ownership_chain.reduce((acc, o) => acc + (v<string>(o.nationality) === 'Türkiye' ? (v<number>(o.ownership_percent) ?? 0) : 0), 0) ?? 0}% (must be ≥ 50%)`}
              />
            </dl>
          </SectionAccordion>

          <SectionAccordion
            numeral="III"
            title="Ownership Structure"
            subtitle="corporate history"
          >
            <dl className="grid grid-cols-[12rem_1fr] gap-x-6 gap-y-3 text-[0.88rem] mb-5">
              <Row label="Legal entity" value={v<string>(facts?.enterprise.legal_name) ?? '—'} />
              <Row label="Entity type" value={v<string>(facts?.enterprise.entity_type) ?? '—'} />
              <Row label="State of formation" value={v<string>(facts?.enterprise.state_of_formation) ?? '—'} />
              <Row label="Formation date" value={v<string>(facts?.enterprise.formation_date) ?? '—'} mono />
              <Row label="EIN" value={v<string>(facts?.enterprise.ein) ?? '—'} mono />
              <Row label="Industry · NAICS" value={`${v<string>(facts?.enterprise.industry) ?? '—'} · ${v<string>(facts?.enterprise.naics_code) ?? '—'}`} />
              <Row label="Physical address" value={v<string>(facts?.enterprise.physical_address) ?? '—'} />
            </dl>

            <div className="smcp text-[0.62rem] text-graphite tracking-[0.2em] mb-2">
              ownership chain
            </div>
            <table className="w-full border-collapse text-[0.86rem]">
              <thead>
                <tr className="border-b border-ink-2">
                  <th className="pb-2 text-left smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium">Owner</th>
                  <th className="pb-2 text-left smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium">Nationality</th>
                  <th className="pb-2 text-left smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium">Direct / indirect</th>
                  <th className="pb-2 text-right smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium w-24">Equity</th>
                </tr>
              </thead>
              <tbody>
                {(facts?.ownership_chain ?? []).map((o, i) => (
                  <tr key={i} className="border-b border-rule">
                    <td className="py-2 font-display text-[0.95rem] text-ink">{v<string>(o.owner_name) ?? '—'}</td>
                    <td className="py-2 text-ink-2">{v<string>(o.nationality) ?? '—'}</td>
                    <td className="py-2 text-graphite font-mono text-[0.78rem]">{v<string>(o.direct_or_indirect) ?? '—'}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-ink">
                      {v<number>(o.ownership_percent) !== null ? `${v<number>(o.ownership_percent)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionAccordion>

          <SectionAccordion
            numeral="IV"
            title="Investment · SOF · At-Risk"
            subtitle="source-of-funds chain"
            defaultOpen
            rightSlot={
              <span className="font-mono text-[0.7rem] text-graphite tabular-nums">
                {fmtUSD(totalSpent)} spent
              </span>
            }
          >
            {facts && (
              <SofChainTable matterId={id} rows={facts.source_of_funds} />
            )}
          </SectionAccordion>

          <SectionAccordion
            numeral="V"
            title="Substantiality"
            subtitle="proportionality"
            rightSlot={
              <span className="font-mono text-[0.7rem] text-graphite tabular-nums">
                {v<number>(facts?.investment.proportionality_percent)?.toFixed(1) ?? '—'}%
              </span>
            }
          >
            <dl className="grid grid-cols-[14rem_1fr] gap-x-6 gap-y-3 text-[0.88rem]">
              <Row
                label="Total committed"
                value={fmtUSD(v<number>(facts?.investment.total_committed_usd))}
                mono
              />
              <Row
                label="Total irrevocably spent"
                value={fmtUSD(v<number>(facts?.investment.total_spent_usd))}
                mono
              />
              <Row
                label="Total cost of enterprise"
                value={fmtUSD(v<number>(facts?.investment.total_cost_of_enterprise_usd))}
                mono
              />
              <Row
                label="Proportionality (committed ÷ cost)"
                value={`${v<number>(facts?.investment.proportionality_percent)?.toFixed(1) ?? '—'}%`}
                mono
              />
              <Row
                label="Substantiality basis"
                value={v<string>(facts?.elements_evidence.substantial_investment_basis) ?? '—'}
                editorial
              />
            </dl>
          </SectionAccordion>

          <SectionAccordion
            numeral="VI"
            title="Marginality + Real & Operating"
            subtitle="operations expenditure"
            rightSlot={
              <span className="font-mono text-[0.7rem] text-graphite tabular-nums">
                {operatingItems.length} ledger lines
              </span>
            }
          >
            <OperationsExpenditureTable items={operatingItems} />
            <dl className="grid grid-cols-[14rem_1fr] gap-x-6 gap-y-3 text-[0.88rem] mt-6 border-t border-rule pt-5">
              <Row
                label="Real & operating basis"
                value={v<string>(facts?.elements_evidence.real_and_operating_basis) ?? '—'}
                editorial
              />
              <Row
                label="More-than-marginal basis"
                value={v<string>(facts?.elements_evidence.more_than_marginal_basis) ?? '—'}
                editorial
              />
            </dl>
          </SectionAccordion>

          <SectionAccordion
            numeral="VII"
            title="Develop & Direct"
            subtitle="day-to-day control"
          >
            <dl className="grid grid-cols-[14rem_1fr] gap-x-6 gap-y-3 text-[0.88rem]">
              <Row
                label="Equity & control"
                value={`${v<number>(facts?.ownership_chain[0]?.ownership_percent) ?? '—'}% direct membership; sole signing authority.`}
              />
              <Row
                label="Develop-and-direct basis"
                value={v<string>(facts?.elements_evidence.develop_and_direct_basis) ?? '—'}
                editorial
              />
            </dl>
          </SectionAccordion>

          <SectionAccordion
            numeral="VIII"
            title="Dependents"
            subtitle={subtype?.has_dependents ? 'I-539 / I-539A required' : 'none'}
            rightSlot={
              <span className="font-mono text-[0.7rem] text-graphite tabular-nums">
                {subtype?.dependent_count ?? 0}
              </span>
            }
          >
            {subtype?.has_dependents && subtype.dependent_breakdown ? (
              <dl className="grid grid-cols-[14rem_1fr] gap-x-6 gap-y-3 text-[0.88rem]">
                <Row
                  label="Spouse (I-539)"
                  value={subtype.dependent_breakdown.spouse ? 'yes — biographics under Tab L' : '—'}
                />
                <Row
                  label="Children (I-539A)"
                  value={`${subtype.dependent_breakdown.children} child(ren) — biographics under Tab L`}
                />
                <Row
                  label="Forms tab"
                  value="J — Forms for Dependents"
                  mono
                />
              </dl>
            ) : (
              <p className="font-display italic text-[0.95rem] text-graphite">
                No dependents on file. Skip Tabs J / K / L unless this changes.
              </p>
            )}
          </SectionAccordion>
        </section>

        <section className="border border-rule paper-recess px-7 py-6">
          <Eyebrow numeral="ⓧ" title="Conflict register" subtitle="severity-sorted" />
          {facts && <ConflictRegister conflicts={facts.conflict_register} />}
        </section>

        <section className="border border-rule paper-recess px-7 py-6">
          <Eyebrow
            numeral="§"
            title="Authority cite check"
            subtitle="allowlist verification"
          />
          <AuthorityCiteCheck result={mockCiteCheck()} />
        </section>

        <section className="border border-rule paper-recess px-7 py-6">
          <Eyebrow numeral="⁋" title="Document inventory" subtitle="Tabs A — L" />
          <DocumentInventory />
        </section>

        <p className="dinkus my-4">⁂  ⁂  ⁂</p>
      </main>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  editorial?: boolean;
}
function Row({ label, value, mono, editorial }: RowProps) {
  return (
    <>
      <dt className="smcp text-[0.62rem] text-graphite tracking-[0.2em] pt-1">
        {label}
      </dt>
      <dd
        className={
          editorial
            ? 'font-display italic text-[0.98rem] text-ink-2 leading-relaxed'
            : mono
              ? 'font-mono tabular-nums text-[0.92rem] text-ink'
              : 'text-ink'
        }
      >
        {value}
      </dd>
    </>
  );
}

function Eyebrow({
  numeral,
  title,
  subtitle,
}: {
  numeral: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="flex items-baseline gap-3 mb-5">
      <span className="font-display italic text-[1.5rem] leading-none text-rubric w-7">
        {numeral}
      </span>
      <h2 className="font-display text-[1.15rem] tracking-[-0.005em] text-ink leading-none">
        {title}
      </h2>
      <span className="display-italic text-[0.85rem] text-graphite-soft leading-none">
        — {subtitle}
      </span>
    </header>
  );
}
