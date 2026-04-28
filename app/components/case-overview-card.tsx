import type { IngestSuccess, E2Facts, E2CaseSubtype } from '@/ingest';

const SUBTYPE_LABEL: Record<E2CaseSubtype['principal_subtype'], string> = {
  individual_investor: 'Individual investor',
  corporate_owned_investor: 'Corporate-owned investor',
  executive_supervisory_employee: 'Executive / supervisory',
  essential_skills_employee: 'Essential skills',
};

const POSTURE_LABEL: Record<E2CaseSubtype['procedural_posture'], string> = {
  consular_new: 'Consular — new',
  uscis_cos_new: 'USCIS — change of status',
  uscis_extension: 'USCIS — extension',
  consular_renewal: 'Consular — renewal',
};

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

const dash = '—';

function maskLast4(s: string | null): string {
  if (!s) return dash;
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
}

function fmtUSD(n: number | null): string {
  if (n === null || Number.isNaN(n)) return dash;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return dash;
  return `${n.toFixed(1)}%`;
}

interface Props {
  matter: IngestSuccess;
}

export function CaseOverviewCard({ matter }: Props) {
  const facts = matter.caseFacts?.case_type === 'E2'
    ? (matter.caseFacts.facts as E2Facts)
    : null;
  const subtype = matter.e2_subtype ?? null;

  const investorName = v<string>(facts?.investor.full_name);
  const passport = v<string>(facts?.investor.passport_number);
  const passportExpiry = v<string>(facts?.investor.passport_expiry);
  const nationality = v<string>(facts?.investor.nationality);
  const usStatus = v<string>(facts?.investor.current_us_status);

  const enterpriseName = v<string>(facts?.enterprise.legal_name);
  const ein = v<string>(facts?.enterprise.ein);
  const formationDate = v<string>(facts?.enterprise.formation_date);
  const industry = v<string>(facts?.enterprise.industry);

  const committed = v<number>(facts?.investment.total_committed_usd);
  const spent = v<number>(facts?.investment.total_spent_usd);
  const proportionality = v<number>(facts?.investment.proportionality_percent);

  return (
    <article className="border border-rule-strong paper-recess">
      <header className="flex items-baseline justify-between gap-6 px-7 pt-6 pb-3 border-b border-rule">
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="smcp text-label text-graphite ">
            ⁂  the matter
          </span>
          <h1 className="font-display text-title font-bold leading-[1.05] tracking-[-0.012em] text-ink truncate">
            {investorName ?? matter.filename}
          </h1>
          <span className="font-semibold text-body text-ink whitespace-nowrap">
            E-2 · {subtype ? SUBTYPE_LABEL[subtype.principal_subtype] : 'unspecified subtype'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {subtype && (
            <span className="border border-ink-2 px-2.5 py-0.5 text-label smcp text-ink-2 ">
              {POSTURE_LABEL[subtype.procedural_posture]}
            </span>
          )}
          {subtype?.has_dependents && (
            <span className="border border-rule px-2.5 py-0.5 text-label smcp text-graphite ">
              + {subtype.dependent_count} dep
            </span>
          )}
          <span className="border border-ink/60 text-ink px-2.5 py-0.5 text-label smcp ">
            {subtype?.detection_confidence ?? 'UNCAL'}
          </span>
        </div>
      </header>

      <dl className="grid grid-cols-4 gap-x-8 gap-y-5 px-7 py-6 text-meta">
        <PinnedField
          eyebrow="Nationality"
          value={nationality ?? dash}
          tail={usStatus ?? undefined}
        />
        <PinnedField
          eyebrow="Passport"
          value={maskLast4(passport)}
          tail={passportExpiry ? `exp. ${passportExpiry}` : undefined}
          mono
        />
        <PinnedField
          eyebrow="Enterprise"
          value={enterpriseName ?? dash}
          tail={industry ?? undefined}
        />
        <PinnedField
          eyebrow="EIN · formed"
          value={maskLast4(ein)}
          tail={formationDate ?? undefined}
          mono
        />
        <PinnedField
          eyebrow="Committed"
          value={fmtUSD(committed)}
          tail="capital pledged"
          mono
        />
        <PinnedField
          eyebrow="Irrevocably spent"
          value={fmtUSD(spent)}
          tail={
            committed && spent
              ? `${Math.round((spent / committed) * 100)}% of committed`
              : undefined
          }
          mono
        />
        <PinnedField
          eyebrow="Proportionality"
          value={fmtPct(proportionality)}
          tail={
            proportionality !== null && proportionality >= 100
              ? 'meets substantiality'
              : 'review §V'
          }
          mono
          accent={
            proportionality !== null && proportionality < 80 ? 'warn' : undefined
          }
        />
        <PinnedField
          eyebrow="Pages on record"
          value={`${matter.pageCount}`}
          tail={
            matter.detection_confidence
              ? `detect ${(matter.detection_confidence * 100).toFixed(0)}%`
              : undefined
          }
          mono
        />
      </dl>
    </article>
  );
}

interface PinnedFieldProps {
  eyebrow: string;
  value: string;
  tail?: string;
  mono?: boolean;
  accent?: 'warn';
}

function PinnedField({ eyebrow, value, tail, mono, accent }: PinnedFieldProps) {
  return (
    <div className="border-l border-rule pl-3 min-w-0">
      <dt className="smcp text-label text-graphite-soft  mb-1">
        {eyebrow}
      </dt>
      <dd
        className={
          (mono ? 'font-mono text-body' : 'font-display text-[1.04rem]') +
          ' text-ink leading-tight truncate ' +
          (accent === 'warn' ? 'text-ink-2' : '')
        }
        title={value}
      >
        {value}
      </dd>
      {tail && (
        <div className="mt-1 text-label text-graphite truncate" title={tail}>
          {tail}
        </div>
      )}
    </div>
  );
}
