import Link from 'next/link';
import { getMockMatter } from '@/app/api/matter/[id]/mock-data';
import { SofChainTable } from '@/app/components/sof-chain-table';
import { OperationsExpenditureTable } from '@/app/components/operations-expenditure-table';
import { ConflictRegister } from '@/app/components/conflict-register';
import { AuthorityCiteCheck } from '@/app/components/authority-cite-check';
import { DocumentInventory } from '@/app/components/document-inventory';
import { GeneratePanel } from '@/app/components/generate-panel';
import type { IngestSuccess, E2Facts, E2CaseSubtype } from '@/ingest';
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
const leaf = (f: unknown): FieldLeaf<unknown> | null => {
  if (!f || typeof f !== 'object' || !('value' in (f as object))) return null;
  return f as FieldLeaf<unknown>;
};
type Prov = { label: string; leaf: FieldLeaf<unknown> | null; format?: (x: unknown) => string };

const dash = '—';

const SUBTYPE_LABEL: Record<E2CaseSubtype['principal_subtype'], string> = {
  individual_investor: 'Individual investor',
  corporate_owned_investor: 'Corporate-owned investor',
  executive_supervisory_employee: 'Executive · supervisory',
  essential_skills_employee: 'Essential skills',
};
const POSTURE_LABEL: Record<E2CaseSubtype['procedural_posture'], string> = {
  consular_new: 'Consular · new',
  uscis_cos_new: 'USCIS · change of status',
  uscis_extension: 'USCIS · extension',
  consular_renewal: 'Consular · renewal',
};

const fmtUSD = (n: number | null): string => {
  if (n === null || Number.isNaN(n)) return dash;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};
const fmtPct = (n: number | null): string =>
  n === null || Number.isNaN(n) ? dash : `${n.toFixed(1)}%`;
const maskLast4 = (s: string | null): string => {
  if (!s) return dash;
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'facts', label: 'Facts' },
  { id: 'money', label: 'Money' },
  { id: 'documents', label: 'Documents' },
  { id: 'citations', label: 'Citations' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'generate', label: 'Generate' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function mockCiteCheck(): CitationVerifyResult {
  return {
    case_type: 'E2',
    total_citations: 9,
    on_allowlist: 7,
    off_allowlist: 1,
    aao_routed: 1,
    unparseable: 0,
    findings: [
      { citation: { kind: 'ina', raw: 'INA § 101(a)(15)(E)(ii)', normalized: 'INA § 101(a)(15)(E)(ii)', start: 0, end: 0 }, status: 'on_allowlist', message: 'Statute on allowlist for E-2.' },
      { citation: { kind: 'cfr', raw: '8 CFR § 214.2(e)(12)', normalized: '8 CFR § 214.2(e)(12)', start: 0, end: 0 }, status: 'on_allowlist', message: 'Regulation on allowlist (stem-match 8 CFR § 214.2(e)).' },
      { citation: { kind: 'fam', raw: '9 FAM 402.9-4(B)(1)', normalized: '9 FAM 402.9-4(B)(1)', start: 0, end: 0 }, status: 'on_allowlist', message: 'FAM section on allowlist.' },
      { citation: { kind: 'fam', raw: '9 FAM 402.9-6(B)', normalized: '9 FAM 402.9-6(B)', start: 0, end: 0 }, status: 'on_allowlist', message: 'FAM section on allowlist.' },
      { citation: { kind: 'case_name', raw: 'Matter of Walsh and Pollard', normalized: 'Matter of Walsh and Pollard', start: 0, end: 0 }, status: 'on_allowlist', message: 'Precedent on allowlist (20 I&N Dec. 60).' },
      { citation: { kind: 'reporter_in_dec', raw: '20 I&N Dec. 60', normalized: '20 I&N Dec. 60', start: 0, end: 0 }, status: 'on_allowlist', message: 'Reporter on allowlist.' },
      { citation: { kind: 'uscis_pm', raw: 'USCIS PM Vol. 2 Pt. L Ch. 4', normalized: 'USCIS PM Vol. 2 Pt. L Ch. 4', start: 0, end: 0 }, status: 'on_allowlist', message: 'Policy manual citation on allowlist.' },
      { citation: { kind: 'case_name', raw: 'Matter of X-Y-Z-', normalized: 'Matter of X-Y-Z-', start: 0, end: 0 }, status: 'aao_route_to_human', message: 'AAO non-precedent — uncheckable; routed to human review per ccc-doctrine attorney-supremacy rule.' },
      { citation: { kind: 'cfr', raw: '8 CFR § 204.5(j)(2)', normalized: '8 CFR § 204.5(j)(2)', start: 0, end: 0 }, status: 'off_allowlist', message: 'EB-1C regulation cited in an E-2 letter — likely a copy-paste from another matter.' },
    ],
  };
}

export default async function MatterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const active: TabId = (TABS.find((t) => t.id === sp.tab)?.id ?? 'overview') as TabId;
  const matter = getMockMatter(id);
  const facts =
    matter.caseFacts?.case_type === 'E2'
      ? (matter.caseFacts.facts as E2Facts)
      : null;
  const subtype = matter.e2_subtype ?? null;
  const conflictCount = facts?.conflict_register.length ?? 0;
  const cite = mockCiteCheck();

  return (
    <div className="h-screen overflow-y-auto paper-grain">
      <TopNav id={id} />
      <Masthead matter={matter} facts={facts} subtype={subtype} />
      <TabStrip
        id={id}
        active={active}
        counts={{
          conflicts: conflictCount,
          citations: cite.off_allowlist + cite.aao_routed,
        }}
      />
      <main className="px-12 pb-24 pt-10 max-w-[1400px]">
        {active === 'overview' && <OverviewPane id={id} matter={matter} facts={facts} subtype={subtype} />}
        {active === 'facts' && <FactsPane facts={facts} subtype={subtype} />}
        {active === 'money' && <MoneyPane id={id} facts={facts} />}
        {active === 'documents' && <DocumentsPane />}
        {active === 'citations' && <CitationsPane cite={cite} />}
        {active === 'conflicts' && <ConflictsPane facts={facts} />}
        {active === 'generate' && <GeneratePane id={id} />}
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── chrome ── */

function TopNav({ id }: { id: string }) {
  return (
    <header className="border-b border-rule px-12 h-12 flex items-center justify-between">
      <Link href="/" className="flex items-baseline gap-2 text-meta text-graphite hover:text-ink transition-colors">
        <span className="font-mono">←</span>
        <span className="smcp">return to the binder</span>
      </Link>
      <div className="flex items-baseline gap-3">
        <span className="smcp text-graphite-soft">matter</span>
        <span className="font-mono text-meta text-ink-2">{id}</span>
      </div>
    </header>
  );
}

function Masthead({
  matter,
  facts,
  subtype,
}: {
  matter: IngestSuccess;
  facts: E2Facts | null;
  subtype: E2CaseSubtype | null;
}) {
  const investorName = v<string>(facts?.investor.full_name) ?? matter.filename;
  const nationality = v<string>(facts?.investor.nationality);
  const enterpriseName = v<string>(facts?.enterprise.legal_name);
  const stateOfFormation = v<string>(facts?.enterprise.state_of_formation);
  const industry = v<string>(facts?.enterprise.industry);

  const initials = investorName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const lede = [
    nationality && `${nationality} → United States`,
    enterpriseName,
    stateOfFormation,
    industry,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="px-12 pt-14 pb-10">
      <div className="sigil mb-8" style={{ width: '3rem', height: '3rem', fontSize: '1rem' }}>
        {initials || 'E2'}
      </div>

      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <span className="smcp text-graphite-soft">E-2</span>
        <span className="text-rule-strong">·</span>
        <span className="smcp text-graphite">
          {subtype ? SUBTYPE_LABEL[subtype.principal_subtype] : 'unspecified subtype'}
        </span>
        <span className="text-rule-strong">·</span>
        <span className="smcp text-graphite">
          {subtype ? POSTURE_LABEL[subtype.procedural_posture] : 'posture pending'}
        </span>
        {subtype?.has_dependents && (
          <>
            <span className="text-rule-strong">·</span>
            <span className="smcp text-graphite">+ {subtype.dependent_count} dep</span>
          </>
        )}
        {matter.detection_confidence != null && (
          <>
            <span className="text-rule-strong">·</span>
            <span className="font-mono text-label text-graphite-soft tabular-nums">
              detect {(matter.detection_confidence * 100).toFixed(0)}%
            </span>
          </>
        )}
      </div>

      <h1 className="text-display font-bold tracking-[-0.025em] leading-[1.02] text-ink">
        {investorName}
      </h1>
      {lede && (
        <p className="text-lede text-graphite mt-4 max-w-3xl">{lede}</p>
      )}
    </section>
  );
}

function TabStrip({
  id,
  active,
  counts,
}: {
  id: string;
  active: TabId;
  counts: { conflicts: number; citations: number };
}) {
  return (
    <nav className="border-y border-rule px-12 py-2.5">
      <ul className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => {
          const isActive = t.id === active;
          const badge =
            t.id === 'conflicts' && counts.conflicts > 0
              ? counts.conflicts
              : t.id === 'citations' && counts.citations > 0
                ? counts.citations
                : null;
          return (
            <li key={t.id}>
              <Link
                href={`/matter/${id}?tab=${t.id}`}
                className={
                  'inline-flex items-center gap-2 px-3.5 py-2 text-body transition-colors rounded-full ' +
                  (isActive
                    ? 'bg-ink text-paper font-semibold'
                    : 'text-graphite hover:text-ink hover:bg-paper-deep/30')
                }
              >
                <span
                  aria-hidden
                  className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (isActive ? 'bg-paper' : 'border border-graphite')
                  }
                />
                {t.label}
                {badge !== null && (
                  <span
                    className={
                      'font-mono text-meta tabular-nums ' +
                      (isActive ? 'text-paper-deep' : 'text-graphite-soft')
                    }
                  >
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────── panes ── */

function OverviewPane({
  id,
  matter,
  facts,
  subtype,
}: {
  id: string;
  matter: IngestSuccess;
  facts: E2Facts | null;
  subtype: E2CaseSubtype | null;
}) {
  const passport = v<string>(facts?.investor.passport_number);
  const passportExpiry = v<string>(facts?.investor.passport_expiry);
  const dob = v<string>(facts?.investor.dob);
  const usStatus = v<string>(facts?.investor.current_us_status);
  const placeOfBirth = v<string>(facts?.investor.place_of_birth);

  const enterpriseName = v<string>(facts?.enterprise.legal_name);
  const entityType = v<string>(facts?.enterprise.entity_type);
  const stateOfFormation = v<string>(facts?.enterprise.state_of_formation);
  const ein = v<string>(facts?.enterprise.ein);
  const formationDate = v<string>(facts?.enterprise.formation_date);
  const industry = v<string>(facts?.enterprise.industry);
  const naics = v<string>(facts?.enterprise.naics_code);

  const committed = v<number>(facts?.investment.total_committed_usd);
  const spent = v<number>(facts?.investment.total_spent_usd);
  const proportionality = v<number>(facts?.investment.proportionality_percent);
  const cost = v<number>(facts?.investment.total_cost_of_enterprise_usd);

  const conflictCount = facts?.conflict_register.length ?? 0;
  const sofCount = facts?.source_of_funds.length ?? 0;

  return (
    <div className="grid gap-12">
      <SectionHeader title="At a glance" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card
          label="Investor"
          tag="identity"
          provenance={
            facts
              ? [
                  { label: 'Full name', leaf: leaf(facts.investor.full_name) },
                  { label: 'Nationality', leaf: leaf(facts.investor.nationality) },
                  { label: 'Place of birth', leaf: leaf(facts.investor.place_of_birth) },
                  { label: 'Date of birth', leaf: leaf(facts.investor.dob) },
                  { label: 'Passport', leaf: leaf(facts.investor.passport_number) },
                  { label: 'Passport expiry', leaf: leaf(facts.investor.passport_expiry) },
                  { label: 'U.S. status', leaf: leaf(facts.investor.current_us_status) },
                ]
              : []
          }
        >
          <CardTitle>{v<string>(facts?.investor.full_name) ?? matter.filename}</CardTitle>
          <CardMetaLine>
            {[v<string>(facts?.investor.nationality), placeOfBirth, dob && `b. ${dob}`]
              .filter(Boolean)
              .join(' · ')}
          </CardMetaLine>
          <CardKV k="Passport" v={maskLast4(passport)} tail={passportExpiry ? `exp. ${passportExpiry}` : undefined} mono />
          <CardKV k="U.S. status" v={usStatus ?? dash} />
          <CardKV k="Phone" missing />
          <CardKV k="Email" missing />
          <CardKV k="U.S. address" missing />
        </Card>

        <Card
          label="Enterprise"
          tag="petitioner"
          provenance={
            facts
              ? [
                  { label: 'Legal name', leaf: leaf(facts.enterprise.legal_name) },
                  { label: 'Entity type', leaf: leaf(facts.enterprise.entity_type) },
                  { label: 'State of formation', leaf: leaf(facts.enterprise.state_of_formation) },
                  { label: 'Formation date', leaf: leaf(facts.enterprise.formation_date) },
                  { label: 'EIN', leaf: leaf(facts.enterprise.ein) },
                  { label: 'Industry', leaf: leaf(facts.enterprise.industry) },
                  { label: 'NAICS', leaf: leaf(facts.enterprise.naics_code) },
                  { label: 'Address', leaf: leaf(facts.enterprise.physical_address) },
                ]
              : []
          }
        >
          <CardTitle>{enterpriseName ?? dash}</CardTitle>
          <CardMetaLine>
            {[entityType, stateOfFormation, industry].filter(Boolean).join(' · ')}
          </CardMetaLine>
          <CardKV k="EIN" v={maskLast4(ein)} tail={formationDate ? `formed ${formationDate}` : undefined} mono />
          <CardKV k="NAICS" v={naics ?? dash} mono />
          <CardKV k="Address" v={v<string>(facts?.enterprise.physical_address) ?? dash} />
          <CardKV k="Phone" missing />
        </Card>

        <Card label="Posture" tag={subtype ? POSTURE_LABEL[subtype.procedural_posture] : 'posture'}>
          <CardTitle>{subtype ? SUBTYPE_LABEL[subtype.principal_subtype] : 'unspecified'}</CardTitle>
          <CardMetaLine>
            {[
              subtype?.has_dependents ? `+${subtype.dependent_count} dep` : 'no dependents',
              `${matter.pageCount} pages`,
              matter.detection_confidence != null
                ? `detect ${(matter.detection_confidence * 100).toFixed(0)}%`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </CardMetaLine>
          <CardKV k="Forms" v={subtype?.has_dependents ? 'I-129E · I-539 · I-539A' : 'I-129E'} mono />
          <CardKV k="Calibration" v={subtype?.detection_confidence ?? 'uncal'} />
        </Card>
      </div>

      <SectionHeader
        title="Investment"
        right={
          <Link
            href={`/matter/${id}?tab=money`}
            className="text-body smcp text-graphite hover:text-ink transition-colors inline-flex items-baseline gap-1.5"
          >
            See SOF chain <span className="font-mono">→</span>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Committed"
          value={fmtUSD(committed)}
          tail="capital pledged"
        />
        <StatCard
          label="Irrevocably spent"
          value={fmtUSD(spent)}
          tail={committed && spent ? `${Math.round((spent / committed) * 100)}% of committed` : undefined}
        />
        <StatCard
          label="Cost of enterprise"
          value={fmtUSD(cost)}
          tail="proportionality denominator"
        />
        <StatCard
          label="Proportionality"
          value={fmtPct(proportionality)}
          tail={proportionality !== null && proportionality >= 100 ? 'meets substantiality' : 'review §V'}
          heavy={proportionality !== null && proportionality < 80}
        />
      </div>

      {facts && <SpendBreakdown items={facts.investment.items} totalSpent={spent ?? 0} />}
      {facts && <SofPreview rows={facts.source_of_funds} />}

      <SectionHeader title="Audit trail" right={<NextLink id={id} />} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AuditCard
          label="SOF chain"
          count={sofCount}
          unit={sofCount === 1 ? 'leg' : 'legs'}
          href={`/matter/${id}?tab=money`}
          tail="origin → enterprise"
        />
        <AuditCard
          label="Conflicts"
          count={conflictCount}
          unit={conflictCount === 1 ? 'flag' : 'flags'}
          href={`/matter/${id}?tab=conflicts`}
          tail="severity-sorted"
          urgent={conflictCount > 0}
        />
        <AuditCard
          label="Documents"
          count={matter.pageCount}
          unit="pages"
          href={`/matter/${id}?tab=documents`}
          tail="Tabs A — L"
        />
      </div>
    </div>
  );
}

function NextLink({ id }: { id: string }) {
  return (
    <Link
      href={`/matter/${id}?tab=generate`}
      className="inline-flex items-baseline gap-2 text-body smcp text-ink hover:text-graphite transition-colors"
    >
      Continue to generate
      <span className="font-mono">→</span>
    </Link>
  );
}

function FactsPane({
  facts,
  subtype,
}: {
  facts: E2Facts | null;
  subtype: E2CaseSubtype | null;
}) {
  if (!facts) return <Empty>Facts not extracted for this case type.</Empty>;
  const equity =
    facts.ownership_chain.reduce(
      (acc, o) =>
        acc +
        (v<string>(o.nationality) === 'Türkiye'
          ? (v<number>(o.ownership_percent) ?? 0)
          : 0),
      0,
    );

  return (
    <div className="grid gap-12">
      <SectionHeader title="Eligibility elements" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card
          label="Treaty qualification"
          tag="§ I"
          provenance={[
            { label: 'Nationality', leaf: leaf(facts.investor.nationality) },
            { label: 'Place of birth', leaf: leaf(facts.investor.place_of_birth) },
            { label: 'Treaty basis', leaf: leaf(facts.elements_evidence.treaty_country_basis) },
          ]}
        >
          <CardKV k="Nationality" v={v<string>(facts.investor.nationality) ?? dash} />
          <CardKV k="Place of birth" v={v<string>(facts.investor.place_of_birth) ?? dash} />
          <CardKV k="Treaty-national equity" v={`${equity}% (must be ≥ 50%)`} mono />
          <CardLongText label="Treaty basis">
            {v<string>(facts.elements_evidence.treaty_country_basis) ?? dash}
          </CardLongText>
        </Card>

        <Card
          label="Develop & direct"
          tag="§ II"
          provenance={[
            { label: 'Develop-and-direct basis', leaf: leaf(facts.elements_evidence.develop_and_direct_basis) },
          ]}
        >
          <CardKV
            k="Equity & control"
            v={`${v<number>(facts.ownership_chain[0]?.ownership_percent) ?? dash}% direct, sole signing`}
          />
          <CardLongText label="Develop-and-direct basis">
            {v<string>(facts.elements_evidence.develop_and_direct_basis) ?? dash}
          </CardLongText>
        </Card>

        <Card
          label="Substantiality"
          tag="§ III"
          provenance={[
            { label: 'Substantiality basis', leaf: leaf(facts.elements_evidence.substantial_investment_basis) },
          ]}
        >
          <CardKV
            k="Proportionality"
            v={fmtPct(v<number>(facts.investment.proportionality_percent))}
            mono
          />
          <CardLongText label="Substantiality basis">
            {v<string>(facts.elements_evidence.substantial_investment_basis) ?? dash}
          </CardLongText>
        </Card>

        <Card
          label="Marginality · real & operating"
          tag="§ IV"
          provenance={[
            { label: 'Real & operating basis', leaf: leaf(facts.elements_evidence.real_and_operating_basis) },
            { label: 'More-than-marginal basis', leaf: leaf(facts.elements_evidence.more_than_marginal_basis) },
          ]}
        >
          <CardLongText label="Real & operating">
            {v<string>(facts.elements_evidence.real_and_operating_basis) ?? dash}
          </CardLongText>
          <CardLongText label="More-than-marginal">
            {v<string>(facts.elements_evidence.more_than_marginal_basis) ?? dash}
          </CardLongText>
        </Card>
      </div>

      <SectionHeader
        title="Ownership chain"
        right={
          <span className="font-mono text-meta text-graphite tabular-nums">
            {facts.ownership_chain.length}{' '}
            {facts.ownership_chain.length === 1 ? 'owner' : 'owners'} · {equity}% treaty-national
          </span>
        }
      />
      <Section label="Ownership chain">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ink-2 text-left">
              <th className="pb-2.5 smcp text-graphite font-medium">Owner</th>
              <th className="pb-2.5 smcp text-graphite font-medium">Nationality</th>
              <th className="pb-2.5 smcp text-graphite font-medium">Direct / indirect</th>
              <th className="pb-2.5 smcp text-graphite font-medium text-right w-28">Equity</th>
            </tr>
          </thead>
          <tbody>
            {facts.ownership_chain.map((o, i) => (
              <tr key={i} className="border-b border-rule last:border-b-0">
                <td className="py-3 text-body text-ink font-medium">{v<string>(o.owner_name) ?? dash}</td>
                <td className="py-3 text-body text-ink-2">{v<string>(o.nationality) ?? dash}</td>
                <td className="py-3 text-body text-graphite">{v<string>(o.direct_or_indirect) ?? dash}</td>
                <td className="py-3 text-right font-mono tabular-nums text-body text-ink">
                  {v<number>(o.ownership_percent) !== null ? `${v<number>(o.ownership_percent)}%` : dash}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <SectionHeader title="Dependents" />
      <Section
        label="Dependents"
        right={
          subtype?.has_dependents ? (
            <span className="font-mono text-meta text-graphite tabular-nums">
              {subtype.dependent_count} on file
            </span>
          ) : null
        }
      >
        {subtype?.has_dependents && subtype.dependent_breakdown ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
            <CardKV
              k="Spouse (I-539)"
              v={subtype.dependent_breakdown.spouse ? 'yes — biographics Tab L' : 'none'}
            />
            <CardKV
              k="Children (I-539A)"
              v={`${subtype.dependent_breakdown.children} child(ren) — Tab L`}
            />
            <CardKV k="Forms tab" v="J — Forms for Dependents" mono />
          </div>
        ) : (
          <p className="text-body text-graphite">
            No dependents on file. Skip Tabs J / K / L unless this changes.
          </p>
        )}
      </Section>
    </div>
  );
}

function MoneyPane({ id, facts }: { id: string; facts: E2Facts | null }) {
  if (!facts) return <Empty>No investment facts extracted.</Empty>;
  const totalSpent = v<number>(facts.investment.total_spent_usd) ?? 0;
  return (
    <div className="grid gap-12">
      <SectionHeader
        title="Source-of-funds chain"
        right={
          <span className="font-mono text-meta text-graphite tabular-nums">
            {fmtUSD(totalSpent)} spent · {facts.source_of_funds.length} legs
          </span>
        }
      />
      <Section label="SOF chain · origin → enterprise">
        <SofChainTable matterId={id} rows={facts.source_of_funds} />
      </Section>

      <SectionHeader
        title="Operations expenditure"
        right={
          <span className="font-mono text-meta text-graphite tabular-nums">
            {facts.investment.items.length} ledger lines
          </span>
        }
      />
      <Section label="Spend ledger">
        <OperationsExpenditureTable items={facts.investment.items} />
      </Section>
    </div>
  );
}

function DocumentsPane() {
  return (
    <div className="grid gap-12">
      <SectionHeader title="Document inventory" right={<span className="font-mono text-meta text-graphite tabular-nums">Tabs A — L</span>} />
      <Section label="Inventory">
        <DocumentInventory />
      </Section>
    </div>
  );
}

function CitationsPane({ cite }: { cite: CitationVerifyResult }) {
  const flagged = cite.off_allowlist + cite.aao_routed;
  return (
    <div className="grid gap-12">
      <SectionHeader
        title="Authority cite check"
        right={
          <span className="font-mono text-meta text-graphite tabular-nums">
            {cite.on_allowlist}/{cite.total_citations} on allowlist
            {flagged > 0 && (
              <>
                <span className="text-rule-strong mx-1.5">·</span>
                <span className="text-ink font-semibold">{flagged} flagged</span>
              </>
            )}
          </span>
        }
      />
      <Section label="Allowlist verification">
        <AuthorityCiteCheck result={cite} />
      </Section>
    </div>
  );
}

function ConflictsPane({ facts }: { facts: E2Facts | null }) {
  if (!facts) return <Empty>No conflict register for this case type.</Empty>;
  const count = facts.conflict_register.length;
  return (
    <div className="grid gap-12">
      <SectionHeader
        title="Conflict register"
        right={
          <span className="font-mono text-meta text-graphite tabular-nums">
            {count} {count === 1 ? 'flag' : 'flags'} · severity-sorted
          </span>
        }
      />
      <Section label="Reviewer flags">
        <ConflictRegister conflicts={facts.conflict_register} />
      </Section>
    </div>
  );
}

function GeneratePane({ id }: { id: string }) {
  return (
    <div className="grid gap-6">
      <SectionHeader
        title="Generators"
        right={
          <span className="text-meta text-graphite-soft italic">
            every output ships only after attorney sign-off
          </span>
        }
      />
      <GeneratePanel matterId={id} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── primitives ── */

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <h2 className="text-title font-bold tracking-tight text-ink">{title}</h2>
      {right}
    </header>
  );
}

function Card({
  label,
  tag,
  provenance,
  children,
}: {
  label: string;
  tag?: string;
  provenance?: Prov[];
  children: React.ReactNode;
}) {
  const hasProv = provenance && provenance.length > 0;
  if (!hasProv) {
    return (
      <article className="border border-rule bg-paper flex flex-col">
        <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule paper-recess">
          <span className="smcp text-graphite">{label}</span>
          {tag && <span className="font-mono text-label text-graphite-soft tracking-tight">{tag}</span>}
        </header>
        <div className="px-5 py-5 grid gap-3">{children}</div>
      </article>
    );
  }
  return (
    <details className="group border border-rule bg-paper hover:border-ink transition-colors open:border-ink open:shadow-[0_0_0_1px_var(--color-ink)]">
      <summary className="cursor-pointer list-none flex flex-col [&::-webkit-details-marker]:hidden">
        <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule paper-recess">
          <span className="smcp text-graphite">{label}</span>
          <span className="flex items-baseline gap-2">
            {tag && <span className="font-mono text-label text-graphite-soft tracking-tight">{tag}</span>}
            <span
              aria-hidden
              className="font-mono text-label text-graphite-soft group-open:text-ink"
            >
              <span className="group-open:hidden">▾</span>
              <span className="hidden group-open:inline">▴</span>
            </span>
          </span>
        </header>
        <div className="px-5 py-5 grid gap-3">{children}</div>
      </summary>
      <ProvenanceBlock rows={provenance} />
    </details>
  );
}

function ProvenanceBlock({ rows }: { rows: Prov[] }) {
  return (
    <div className="border-t border-rule paper-recess px-5 py-5">
      <div className="smcp text-graphite mb-4">provenance</div>
      <ul className="grid gap-4">
        {rows.map((r, i) => {
          const lf = r.leaf;
          const value =
            lf && lf.value !== null
              ? r.format
                ? r.format(lf.value)
                : String(lf.value)
              : dash;
          return (
            <li key={i} className="grid grid-cols-[10rem_1fr] gap-x-5 items-baseline">
              <span className="smcp text-graphite-soft pt-1">{r.label}</span>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-ink">{value}</span>
                  {lf && (lf.source_page !== null || lf.confidence !== null) && (
                    <span className="font-mono text-label text-graphite-soft tabular-nums shrink-0">
                      {lf.source_page !== null && <>p.{lf.source_page}</>}
                      {lf.source_page !== null && lf.confidence !== null && ' · '}
                      {lf.confidence !== null && <>{Math.round((lf.confidence as number) * 100)}%</>}
                    </span>
                  )}
                </div>
                {lf?.source_quote && (
                  <p className="text-meta text-graphite leading-snug border-l border-rule-strong pl-3 italic">
                    &ldquo;{lf.source_quote}&rdquo;
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-title font-semibold tracking-[-0.01em] text-ink leading-tight">
      {children}
    </h3>
  );
}

function CardMetaLine({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-graphite leading-snug">{children}</p>;
}

function CardLongText({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 pt-2 border-t border-rule">
      <span className="smcp text-graphite-soft">{label}</span>
      <p className="text-body text-ink leading-relaxed">{children}</p>
    </div>
  );
}

function Section({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="border border-rule bg-paper">
      <header className="flex items-baseline justify-between gap-4 px-5 py-3 border-b border-rule paper-recess">
        <span className="smcp text-graphite">{label}</span>
        {right}
      </header>
      <div className="px-5 py-5">{children}</div>
    </article>
  );
}

function CardKV({
  k,
  v: value,
  tail,
  mono,
  missing,
}: {
  k: string;
  v?: string;
  tail?: string;
  mono?: boolean;
  missing?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-rule">
      <span className="smcp text-graphite-soft">{k}</span>
      {missing ? (
        <span className="text-body text-graphite-soft italic">
          —{' '}
          <a href="#intake" className="underline underline-offset-2 decoration-rule-strong hover:decoration-ink hover:text-ink not-italic">
            intake&rsquo;te doldur
          </a>
        </span>
      ) : (
        <span className="text-body text-ink-2 text-right">
          <span className={mono ? 'font-mono tabular-nums' : ''}>{value ?? dash}</span>
          {tail && <span className="text-meta text-graphite-soft ml-2">{tail}</span>}
        </span>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tail,
  heavy,
}: {
  label: string;
  value: string;
  tail?: string;
  heavy?: boolean;
}) {
  return (
    <article className="border border-rule bg-paper px-5 py-5">
      <div className="smcp text-graphite-soft mb-3">{label}</div>
      <div
        className={
          'font-mono tabular-nums leading-tight ' +
          (heavy ? 'font-bold text-ink' : 'font-semibold text-ink')
        }
        style={{ fontSize: '1.75rem' }}
      >
        {value}
      </div>
      {tail && <div className="text-body text-graphite mt-2">{tail}</div>}
    </article>
  );
}

function SpendBreakdown({
  items,
  totalSpent,
}: {
  items: E2Facts['investment']['items'];
  totalSpent: number;
}) {
  if (items.length === 0) return null;
  const rows = items
    .map((it) => ({
      category: v<string>(it.category) ?? dash,
      amount: v<number>(it.amount_usd) ?? 0,
      date: v<string>(it.date),
      evidence: v<string>(it.evidence_doc),
      hasEvidence: !!leaf(it.evidence_doc)?.source_quote,
    }))
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((acc, r) => acc + r.amount, 0) || totalSpent || 1;
  const missingEvidence = rows.filter((r) => !r.evidence).length;

  return (
    <article className="border border-rule bg-paper">
      <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule paper-recess">
        <span className="smcp text-graphite">Spend composition</span>
        <span className="font-mono text-meta text-graphite-soft tabular-nums">
          {rows.length} ledger lines
          {missingEvidence > 0 && (
            <>
              <span className="text-rule-strong mx-1.5">·</span>
              <span className="text-ink font-semibold">
                {missingEvidence} missing evidence
              </span>
            </>
          )}
        </span>
      </header>

      <div className="px-5 pt-5">
        <div className="flex h-2 w-full bg-paper-deep/40 overflow-hidden">
          {rows.map((r, i) => (
            <div
              key={i}
              className="h-full border-r border-paper last:border-r-0"
              style={{
                width: `${(r.amount / total) * 100}%`,
                background:
                  i % 2 === 0 ? 'var(--color-ink)' : 'var(--color-graphite)',
              }}
              title={`${r.category} · ${fmtUSD(r.amount)}`}
            />
          ))}
        </div>
      </div>

      <ul className="px-5 py-5 grid gap-3">
        {rows.map((r, i) => {
          const pct = (r.amount / total) * 100;
          return (
            <li
              key={i}
              className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-baseline border-b border-rule pb-2.5 last:border-b-0 last:pb-0"
            >
              <span
                aria-hidden
                className={
                  'w-2 h-2 mt-1 ' +
                  (i % 2 === 0 ? 'bg-ink' : 'bg-graphite')
                }
              />
              <div className="min-w-0">
                <div className="text-body text-ink truncate">{r.category}</div>
                <div className="text-meta text-graphite-soft truncate">
                  {[r.date, r.evidence ?? 'no evidence on file']
                    .filter(Boolean)
                    .join(' · ')}
                  {!r.evidence && (
                    <span className="text-ink font-semibold ml-2">
                      · evidence missing
                    </span>
                  )}
                </div>
              </div>
              <span className="font-mono text-body text-ink tabular-nums whitespace-nowrap">
                {fmtUSD(r.amount)}
              </span>
              <span className="font-mono text-meta text-graphite-soft tabular-nums w-12 text-right">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function SofPreview({ rows }: { rows: E2Facts['source_of_funds'] }) {
  if (rows.length === 0) return null;
  const previews = rows.slice(0, 3).map((r) => ({
    origin: v<string>(r.origin_category) ?? dash,
    amount: v<number>(r.origin_amount_usd) ?? 0,
    destination: v<string>(r.final_destination) ?? dash,
    notes: v<string>(r.notes),
  }));
  return (
    <article className="border border-rule bg-paper">
      <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule paper-recess">
        <span className="smcp text-graphite">Source-of-funds chain</span>
        <span className="font-mono text-meta text-graphite-soft tabular-nums">
          {rows.length} {rows.length === 1 ? 'leg' : 'legs'} · origin → enterprise
        </span>
      </header>
      <ol className="px-5 py-5 grid gap-4">
        {previews.map((p, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-baseline">
            <span className="font-mono text-meta text-graphite-soft tabular-nums w-7">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <div className="text-body text-ink leading-snug">{p.origin}</div>
              <div className="text-meta text-graphite mt-0.5 leading-snug">
                <span className="font-mono">→</span> {p.destination}
                {p.notes && (
                  <>
                    {' '}
                    <span className="text-graphite-soft">· {p.notes}</span>
                  </>
                )}
              </div>
            </div>
            <span className="font-mono text-body text-ink tabular-nums whitespace-nowrap">
              {fmtUSD(p.amount)}
            </span>
          </li>
        ))}
        {rows.length > previews.length && (
          <li className="text-meta text-graphite-soft">
            + {rows.length - previews.length} more leg{rows.length - previews.length === 1 ? '' : 's'} on the Money tab.
          </li>
        )}
      </ol>
    </article>
  );
}

function AuditCard({
  label,
  count,
  unit,
  href,
  tail,
  urgent,
}: {
  label: string;
  count: number;
  unit: string;
  href: string;
  tail?: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'group border bg-paper px-5 py-5 transition-colors flex flex-col gap-3 ' +
        (urgent ? 'border-ink' : 'border-rule hover:border-ink')
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="smcp text-graphite">{label}</span>
        <span className="font-mono text-label text-graphite-soft group-hover:text-ink">→</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={
            'font-mono tabular-nums leading-none ' +
            (urgent ? 'font-bold text-ink' : 'font-semibold text-ink')
          }
          style={{ fontSize: '2rem' }}
        >
          {count}
        </span>
        <span className="text-meta text-graphite">{unit}</span>
      </div>
      {tail && <div className="text-meta text-graphite-soft">{tail}</div>}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-rule bg-paper grid place-items-center py-20 px-6 text-center">
      <div className="grid gap-3 max-w-md">
        <div className="sigil mx-auto" style={{ width: '2.4rem', height: '2.4rem', fontSize: '0.85rem' }}>
          —
        </div>
        <p className="text-body text-graphite leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
