'use client';

/**
 * LoadingProgress — long-running ingest visualizer.
 *
 * Reduces the NDJSON event stream produced by /api/ingest-path into a
 * single derived state, then renders the v3 luxury-techy progress shell:
 *
 *   • a 88–128px italic display percent (top-left) and stage label (top-right)
 *   • a 6px hairline jet progress bar with concrete track
 *   • a 0% — meta — 100% row showing elapsed and ETA
 *   • a seven-cell stage strip (scan / subtype / classify / aggregate /
 *     draft / review / assemble) — completed cells inverse-jet, current cell
 *     2px ink border on paper, future cells graphite-soft
 *   • a "BUILDING THE DASHBOARD" typewriter table — nine rows that fill in
 *     as facts land in the typed memory; unfilled rows show ASCII dashes,
 *     the active row carries a 0.5em jet cursor that blinks via a 6-frame
 *     CSS keyframe (no animation library)
 *
 * Integration: the parent owns the fetch lifecycle, accumulates events
 * into an array, and passes them via the `events` prop along with
 * `startedAt` (ms epoch). Refresh resets — this component is intentionally
 * not persisted.
 *
 * Drafter / reviewer streams are mapped into rows 8 (sections drafted) and
 * indirectly into row 7 (conflicts) when the final result lands. A separate
 * "drafter preview" view that swaps in once drafting begins is left for the
 * next iteration per the spec's out-of-scope note.
 */

import { useEffect, useMemo, useState } from 'react';
import type { IngestResult, E2CaseSubtype } from '@/ingest';

/* ────────────────────────── stream event union ──────────────────────────── */

export type ProgressStage =
  | 'subtype_detecting'
  | 'classifying'
  | 'aggregating'
  | 'drafting'
  | 'reviewing';

export type LoadingStreamEvent =
  | { type: 'start'; total: number; matter: string }
  | { type: 'progress'; stage: ProgressStage; label: string; total: number }
  | {
      type: 'subtype_result';
      principal_subtype: E2CaseSubtype['principal_subtype'];
      procedural_posture: E2CaseSubtype['procedural_posture'];
      has_dependents: boolean;
      detection_confidence: E2CaseSubtype['detection_confidence'];
      sample_files: string[];
    }
  | { type: 'subtype_error'; message: string }
  | {
      type: 'pdf_result';
      index: number;
      total: number;
      filename: string;
      doc_type: string | null;
      error: { code: string; message: string } | null;
      facts: Record<string, unknown> | null;
      pageCount: number;
    }
  | { type: 'draft_delta'; delta: string }
  | { type: 'draft_done' }
  | { type: 'draft_error'; message: string }
  | { type: 'result'; result: IngestResult }
  | { type: 'done'; total: number };

/* ────────────────────────── stage strip mapping ─────────────────────────── */

const STAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'scan', label: 'Scan' },
  { id: 'subtype', label: 'Subtype' },
  { id: 'classify', label: 'Classify' },
  { id: 'aggregate', label: 'Aggregate' },
  { id: 'draft', label: 'Draft' },
  { id: 'review', label: 'Review' },
  { id: 'assemble', label: 'Assemble' },
];

const STAGE_INDEX: Partial<Record<ProgressStage, number>> = {
  subtype_detecting: 1,
  classifying: 2,
  aggregating: 3,
  drafting: 4,
  reviewing: 5,
};

/* ────────────────────────── small helpers ───────────────────────────────── */

interface FieldLeaf<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

function pluck<T>(record: Record<string, unknown> | null, keys: string[]): T | null {
  if (!record) return null;
  for (const key of keys) {
    const v = record[key];
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && 'value' in (v as object)) {
      const inner = (v as FieldLeaf<unknown>).value;
      if (inner !== null && inner !== undefined) return inner as T;
    } else {
      return v as T;
    }
  }
  return null;
}

const fmtUSD = (n: number | null): string => {
  if (n === null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

const SUBTYPE_LABEL: Record<E2CaseSubtype['principal_subtype'], string> = {
  individual_investor: 'Individual investor',
  corporate_owned_investor: 'Corporate-owned investor',
  executive_supervisory_employee: 'Executive / supervisory',
  essential_skills_employee: 'Essential skills',
};

const POSTURE_LABEL: Record<E2CaseSubtype['procedural_posture'], string> = {
  consular_new: 'Consular new',
  uscis_cos_new: 'USCIS change of status',
  uscis_extension: 'USCIS extension',
  consular_renewal: 'Consular renewal',
};

const DRAFT_SECTION_REGEX = /(^|\n)\s*(I{1,3}|IV|VI{0,3})\.\s+\S/g;

/* ────────────────────────── reduction ───────────────────────────────────── */

interface RowState {
  label: string;
  value: string | null;
}

interface DerivedState {
  matter: string | null;
  totalPdfs: number;
  completedPdfs: number;
  currentStage: number;
  currentLabel: string | null;
  rows: RowState[];
  activeRowIndex: number;
  filledRows: number;
  draftLength: number;
  draftSectionCount: number;
  done: boolean;
}

function deriveState(events: ReadonlyArray<LoadingStreamEvent>): DerivedState {
  let matter: string | null = null;
  let totalPdfs = 0;
  let completedPdfs = 0;
  let currentStageMax = 0;
  let currentLabel: string | null = null;
  let done = false;
  let draftText = '';

  let beneficiary: string | null = null;
  let enterprise: string | null = null;
  let subtype: string | null = null;
  let investment: string | null = null;
  let treaty: string | null = null;
  let sofChain: string | null = null;
  let conflicts: string | null = null;
  let dependents: string | null = null;

  for (const evt of events) {
    if (evt.type === 'start') {
      matter = evt.matter;
      totalPdfs = evt.total;
    } else if (evt.type === 'progress') {
      const idx = STAGE_INDEX[evt.stage];
      if (typeof idx === 'number' && idx > currentStageMax) currentStageMax = idx;
      currentLabel = evt.label;
    } else if (evt.type === 'pdf_result') {
      if (!evt.error) completedPdfs += 1;
      if (evt.doc_type === 'passport' && !beneficiary) {
        const name = pluck<string>(evt.facts, [
          'full_name_ascii',
          'full_name',
          'name',
          'surname_given_names',
        ]);
        const nationality = pluck<string>(evt.facts, [
          'nationality',
          'country_of_nationality',
        ]);
        if (name) beneficiary = name;
        if (nationality && !treaty) treaty = nationality;
      } else if (evt.doc_type === 'formation_doc' && !enterprise) {
        const entity = pluck<string>(evt.facts, [
          'entity_legal_name',
          'legal_name',
          'company_name',
        ]);
        const state = pluck<string>(evt.facts, ['state_of_formation', 'state']);
        if (entity) enterprise = state ? `${entity} (${state})` : entity;
      }
    } else if (evt.type === 'subtype_result') {
      subtype = `${SUBTYPE_LABEL[evt.principal_subtype]} · ${POSTURE_LABEL[evt.procedural_posture]}`;
      dependents = evt.has_dependents ? 'yes — pending breakdown' : 'none';
    } else if (evt.type === 'draft_delta') {
      draftText += evt.delta;
    } else if (evt.type === 'result') {
      const result = evt.result;
      if ('caseFacts' in result) {
        if (result.caseFacts.case_type === 'E2') {
          const f = result.caseFacts.facts;
          if (f.investor.full_name.value) beneficiary = f.investor.full_name.value;
          if (f.enterprise.legal_name.value) {
            const st = f.enterprise.state_of_formation.value;
            enterprise = st
              ? `${f.enterprise.legal_name.value} (${st})`
              : f.enterprise.legal_name.value;
          }
          const committed = f.investment.total_committed_usd.value;
          if (committed !== null) {
            investment = `${fmtUSD(committed)} · committed · at-risk`;
          }
          const nat = f.investor.nationality.value;
          const ownPct = f.ownership_chain.reduce<number>((acc, o) => {
            const oNat = o.nationality.value;
            const pct = o.ownership_percent.value ?? 0;
            return oNat === nat && nat !== null ? acc + pct : acc;
          }, 0);
          if (nat) {
            treaty =
              ownPct >= 50
                ? `${nat} · ${ownPct}% · 9 FAM 402.9`
                : `${nat} · ${ownPct}%`;
          }
          const sofs = f.source_of_funds
            .map((s) => s.origin_category.value)
            .filter((x): x is string => !!x);
          if (sofs.length > 0) sofChain = sofs.join(', ');
          const sev = { critical: 0, major: 0, minor: 0 };
          for (const c of f.conflict_register) {
            const s = c.severity.value ?? 0;
            if (s >= 5) sev.critical += 1;
            else if (s === 4) sev.major += 1;
            else if (s > 0) sev.minor += 1;
          }
          const parts: string[] = [];
          if (sev.critical) parts.push(`${sev.critical} critical`);
          if (sev.major) parts.push(`${sev.major} major`);
          if (sev.minor) parts.push(`${sev.minor} minor`);
          conflicts = parts.length > 0 ? parts.join(' · ') : 'none';
        }
        const subtypeData = result.e2_subtype;
        if (subtypeData) {
          const ds = subtypeData.dependent_breakdown;
          if (ds && subtypeData.has_dependents) {
            const dp: string[] = [];
            if (ds.spouse) dp.push('spouse');
            if (ds.children > 0) {
              dp.push(`${ds.children} ${ds.children === 1 ? 'child' : 'children'}`);
            }
            dependents = dp.length > 0 ? dp.join(' + ') : 'yes';
          } else if (!subtypeData.has_dependents) {
            dependents = 'none';
          }
        }
        if ('draft' in result && result.draft) {
          draftText = result.draft;
        }
      }
    } else if (evt.type === 'done') {
      done = true;
      currentStageMax = STAGES.length - 1;
    }
  }

  const sectionMatches = draftText.match(DRAFT_SECTION_REGEX);
  const sectionCount = Math.min(7, sectionMatches?.length ?? 0);
  const sections = sectionCount > 0 ? `${sectionCount} / 7 drafted` : null;

  const rows: RowState[] = [
    { label: 'Beneficiary', value: beneficiary },
    { label: 'Enterprise', value: enterprise },
    { label: 'Subtype · posture', value: subtype },
    { label: 'Investment', value: investment },
    { label: 'Treaty country', value: treaty },
    { label: 'SOF chain', value: sofChain },
    { label: 'Conflicts', value: conflicts },
    { label: 'Sections', value: sections },
    { label: 'Dependents', value: dependents },
  ];

  const firstUnfilled = rows.findIndex((r) => r.value === null);
  const filledRows = rows.filter((r) => r.value !== null).length;

  return {
    matter,
    totalPdfs,
    completedPdfs,
    currentStage: currentStageMax,
    currentLabel,
    rows,
    activeRowIndex: firstUnfilled === -1 ? rows.length - 1 : firstUnfilled,
    filledRows,
    draftLength: draftText.length,
    draftSectionCount: sectionCount,
    done,
  };
}

/* ────────────────────────── progress percent ────────────────────────────── */

function computeProgressPercent(state: DerivedState): number {
  if (state.done) return 100;
  const stageWidth = 1 / STAGES.length;
  let sub = 0.5;
  if (state.currentStage === 2 && state.totalPdfs > 0) {
    sub = Math.min(1, state.completedPdfs / state.totalPdfs);
  } else if (state.currentStage === 4) {
    sub = Math.min(0.95, state.draftSectionCount / 7);
  }
  const pct = (state.currentStage / STAGES.length + sub * stageWidth) * 100;
  return Math.max(0, Math.min(99, pct));
}

/* ────────────────────────── time formatting ─────────────────────────────── */

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec}s`;
}

function fmtRemaining(elapsedMs: number, percent: number): string {
  if (percent <= 1) return '~ —';
  const totalMs = elapsedMs / (percent / 100);
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const min = Math.round(remainingMs / 60_000);
  if (min === 0) return '< 1m remaining';
  return `~ ${min}m remaining`;
}

/* ────────────────────────── component ───────────────────────────────────── */

interface Props {
  events: ReadonlyArray<LoadingStreamEvent>;
  startedAt: number;
}

export function LoadingProgress({ events, startedAt }: Props) {
  const state = useMemo(() => deriveState(events), [events]);
  const percent = useMemo(() => computeProgressPercent(state), [state]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Typewriter — reveal each row's value char-by-char in row order. When the
  // active row's target is null we wait (cursor blinks on the underscore
  // placeholder); when the target lands we type it out at ~22ms / character;
  // once a row is fully typed the cursor jumps to the next incomplete row.
  // typedLengths is fixed-length 9 (matches rows.length), reset only on full
  // page refresh per spec.
  const [typedLengths, setTypedLengths] = useState<number[]>(() =>
    Array(state.rows.length).fill(0),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTypedLengths((prev) => {
        for (let i = 0; i < state.rows.length; i += 1) {
          const target = state.rows[i].value;
          if (target === null) return prev; // blocked: data for this row not landed yet
          const cur = prev[i] ?? 0;
          if (cur < target.length) {
            const next = [...prev];
            next[i] = cur + 1;
            return next;
          }
        }
        return prev; // all rows fully typed
      });
    }, 22);
    return () => clearInterval(id);
  }, [state.rows]);

  // First row whose typing is incomplete — cursor lives here.
  const typingActiveRow = (() => {
    for (let i = 0; i < state.rows.length; i += 1) {
      const target = state.rows[i].value;
      if (target === null) return i;
      if ((typedLengths[i] ?? 0) < target.length) return i;
    }
    return -1;
  })();

  const elapsedMs = Math.max(0, now - startedAt);
  const activeRowLabel =
    !state.done && typingActiveRow >= 0 && typingActiveRow < state.rows.length
      ? state.rows[typingActiveRow].label.toLowerCase()
      : null;

  return (
    <div className="grid gap-10 fade-up">
      <style>{`
        @keyframes typewriter-cursor-blink {
          0%   { opacity: 1; }
          18%  { opacity: 1; }
          19%  { opacity: 0; }
          54%  { opacity: 0; }
          55%  { opacity: 1; }
          100% { opacity: 1; }
        }
        .typewriter-cursor {
          display: inline-block;
          width: 0.5em;
          height: 1em;
          background: var(--color-ink);
          vertical-align: -0.12em;
          margin-left: 0.06em;
          animation: typewriter-cursor-blink 1s steps(1, end) infinite;
        }
        /* While actively typing characters the cursor is solid — typewriters */
        /* don't blink while the carriage is moving. Blink only when waiting. */
        .typewriter-cursor.is-solid {
          animation: none;
          opacity: 1;
        }
      `}</style>

      {/* ── TOP : percent + stage label ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-10">
        <div
          className="italic font-semibold text-ink leading-[0.88] tracking-[-0.04em] tabular-nums"
          style={{
            fontFamily:
              '"Iowan Old Style","Hoefler Text","Apple Garamond",Georgia,"Times New Roman",serif',
            fontSize: 'clamp(88px, 12vw, 128px)',
          }}
        >
          {Math.floor(percent)}%
        </div>
        <div className="text-right max-w-[26rem] pt-3">
          <div className="smcp text-graphite mb-3">
            Stage {state.currentStage + 1} of {STAGES.length}
          </div>
          <div className="text-title font-medium text-ink leading-snug">
            {state.currentLabel ??
              (state.matter
                ? `Reading ${state.matter}…`
                : 'Preparing the matter…')}
          </div>
          {state.totalPdfs > 0 && (
            <div className="mt-2 font-mono text-meta tabular-nums text-graphite">
              <span className="text-ink-2 font-semibold">{state.completedPdfs}</span>
              <span className="text-graphite-soft"> / </span>
              <span>{state.totalPdfs}</span>
              <span className="text-graphite-soft">
                {' '}
                pdf{state.totalPdfs === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── PROGRESS BAR + meta ─────────────────────────────────────────── */}
      <div className="grid gap-2.5">
        <div
          className="h-[6px] w-full"
          style={{ background: 'rgba(10, 10, 10, 0.08)' }}
        >
          <div
            className="h-full bg-ink transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between smcp">
          <span className="text-graphite">0%</span>
          <span className="text-graphite-soft normal-case tracking-normal font-mono text-meta">
            started {fmtElapsed(elapsedMs)} ago
            {state.totalPdfs > 0 && (
              <>
                <span className="px-2 text-graphite-soft/60">·</span>
                <span className="text-graphite tabular-nums">
                  {state.completedPdfs}/{state.totalPdfs} pdf
                  {state.totalPdfs === 1 ? '' : 's'}
                </span>
              </>
            )}
            <span className="px-2 text-graphite-soft/60">·</span>
            {fmtRemaining(elapsedMs, percent)}
          </span>
          <span className="text-graphite">100%</span>
        </div>
      </div>

      {/* ── STAGE STRIP : 7 cells, full-width ───────────────────────────── */}
      <div className="grid grid-cols-7 gap-px bg-rule">
        {STAGES.map((stage, i) => {
          const isCompleted = state.done || i < state.currentStage;
          const isCurrent = !state.done && i === state.currentStage;
          const cellTone = isCompleted
            ? 'bg-ink text-paper'
            : isCurrent
              ? 'bg-paper text-ink border-y-[2px] border-ink'
              : 'bg-paper text-graphite-soft';
          const counterTone = isCompleted
            ? 'text-paper/60'
            : isCurrent
              ? 'text-graphite'
              : 'text-graphite-soft';
          return (
            <div
              key={stage.id}
              className={`px-3.5 py-3 flex flex-col items-start justify-between gap-2 min-h-[4.4rem] ${cellTone}`}
            >
              <span
                className={`font-mono text-label tabular-nums tracking-[0.10em] uppercase font-semibold ${counterTone}`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-meta uppercase tracking-[0.10em] font-semibold">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── BUILDING THE DASHBOARD : typewriter table ───────────────────── */}
      <section className="grid gap-4">
        <header className="flex items-baseline justify-between border-b border-ink pb-2">
          <div className="smcp text-ink">Building the dashboard</div>
          <div className="font-mono text-meta text-graphite tabular-nums">
            {state.filledRows} / {state.rows.length} rows
          </div>
        </header>

        <dl className="grid grid-cols-[14rem_1fr] gap-x-7">
          {state.rows.map((row, i) => {
            const target = row.value;
            const typed = typedLengths[i] ?? 0;
            const isActive = !state.done && i === typingActiveRow;
            const isTyping = isActive && target !== null;
            const safeTyped = target === null ? 0 : Math.min(typed, target.length);
            return (
              <div key={row.label} className="contents">
                <dt className="border-b border-rule py-2.5 smcp text-graphite">
                  {row.label}
                </dt>
                <dd className="border-b border-rule py-2.5 text-title leading-snug font-semibold text-ink">
                  {target === null ? (
                    <span
                      className="font-mono text-graphite-soft font-medium"
                      style={{ letterSpacing: '0.04em' }}
                    >
                      {'_ '.repeat(24).trimEnd()}
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap break-words">
                      {target.slice(0, safeTyped)}
                    </span>
                  )}
                  {isActive && (
                    <span
                      className={
                        'typewriter-cursor' + (isTyping ? ' is-solid' : '')
                      }
                      aria-hidden
                    />
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        <footer className="smcp text-graphite pt-1">
          {state.done
            ? `Complete — ${state.filledRows} of ${state.rows.length} rows committed`
            : activeRowLabel
              ? `Currently typing — ${activeRowLabel} · ${state.filledRows} of ${state.rows.length} rows complete`
              : 'Standing by'}
        </footer>
      </section>
    </div>
  );
}
