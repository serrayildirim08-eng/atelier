'use client';

/**
 * Pre-generation approval modal. Workflow:
 *
 *   1. Open → POST /api/matter/[id]/preview { generator } → render the
 *      decision summary, risk register, structural outline, citations,
 *      and implications. The 87-field source table is collapsed behind
 *      "show all source fields" so the default surface is plain English.
 *   2. Attorney can expand the advanced view and inline-edit any fact.
 *   3. Footer: attorney initials (required) + [reject] / [approve & generate].
 *   4. Submit → POST /api/matter/[id]/approve.
 */

import { useEffect, useMemo, useState } from 'react';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewGenerator,
  PreviewRecord,
} from '@/lib/preview-store';
import { globalGenerationQueue } from '@/lib/generation-queue';

interface ApprovalModalProps {
  open: boolean;
  matterId: string;
  generator: PreviewGenerator;
  args?: Record<string, unknown>;
  caseFacts?: unknown;
  typedMemory?: unknown;
  onClose: () => void;
  onApproved?: (result: ApprovalResult) => void;
  onRejected?: () => void;
  /**
   * Phase 11 — when true, "approve & generate" enqueues the
   * `/api/matter/[id]/approve` POST as a background job and closes the
   * modal immediately. The completion fires onApproved through the queue
   * subscription. Defaults to true.
   */
  backgroundGenerate?: boolean;
}

export interface ApprovalResult {
  output_path: string | null;
  output_inline: string | null;
  preview: PreviewRecord;
}

interface PendingEdit {
  field_path: string;
  new_value: string;
}

// Severity carried by weight + glyph + position, not chromatic accent —
// strict monochrome doctrine.
const SEVERITY_RANK: Record<number, { glyph: string; weight: string }> = {
  1: { glyph: '·', weight: 'font-normal text-graphite' },
  2: { glyph: '·', weight: 'font-normal text-graphite' },
  3: { glyph: '‡', weight: 'font-medium text-ink-2' },
  4: { glyph: '‡', weight: 'font-semibold text-ink' },
  5: { glyph: '‡', weight: 'font-bold text-ink' },
};

export function PreGenerationApprovalModal(props: ApprovalModalProps) {
  const { open, matterId, generator, args, onClose, onApproved, onRejected } = props;
  const backgroundGenerate = props.backgroundGenerate !== false;
  const [preview, setPreview] = useState<PreviewRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [initials, setInitials] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setEdits({});
    setError(null);
    setInitials('');

    let cancelled = false;
    setLoading(true);
    fetch(`/api/matter/${encodeURIComponent(matterId)}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generator,
        args,
        case_facts: props.caseFacts,
        typed_memory: props.typedMemory,
      }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        if (!cancelled) setPreview(body as PreviewRecord);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, matterId, generator, args]);

  const editArray: PendingEdit[] = useMemo(
    () =>
      Object.entries(edits).map(([field_path, new_value]) => ({
        field_path,
        new_value,
      })),
    [edits],
  );

  async function submit(approved: boolean) {
    if (!preview) return;
    if (!initials.trim()) {
      setError('Attorney initials are required');
      return;
    }

    // Rejection path stays synchronous — it's a fast filesystem write
    // (no Anthropic call), so blocking the modal for the round-trip is
    // fine and the attorney expects the rejection state immediately.
    if (!approved) {
      setSubmitting(true);
      setError(null);
      try {
        const r = await fetch(`/api/matter/${encodeURIComponent(matterId)}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preview_id: preview.preview_id,
            approved: false,
            attorney_initials: initials.trim(),
            edits: [],
            case_facts: props.caseFacts,
            typed_memory: props.typedMemory,
          }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        onRejected?.();
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Approval — Phase 11: hand the slow generator fetch off to the
    // background queue and close the modal so the attorney can keep
    // browsing other matters / files while the artifact is drafted.
    const previewId = preview.preview_id;
    const initialsTrim = initials.trim();
    const editsForBody = editArray;
    const caseFactsForBody = props.caseFacts;
    const typedMemoryForBody = props.typedMemory;

    if (backgroundGenerate) {
      globalGenerationQueue.enqueue(matterId, generator, async () => {
        const r = await fetch(`/api/matter/${encodeURIComponent(matterId)}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preview_id: previewId,
            approved: true,
            attorney_initials: initialsTrim,
            edits: editsForBody,
            case_facts: caseFactsForBody,
            typed_memory: typedMemoryForBody,
          }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        const result: ApprovalResult = {
          output_path: body.output_path ?? null,
          output_inline: body.output_inline ?? null,
          preview: body.preview as PreviewRecord,
        };
        onApproved?.(result);
        return result;
      });
      onClose();
      return;
    }

    // Synchronous fallback (kept for callers that explicitly opt out).
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/matter/${encodeURIComponent(matterId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_id: previewId,
          approved: true,
          attorney_initials: initialsTrim,
          edits: editsForBody,
          case_facts: caseFactsForBody,
          typed_memory: typedMemoryForBody,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      onApproved?.({
        output_path: body.output_path ?? null,
        output_inline: body.output_inline ?? null,
        preview: body.preview as PreviewRecord,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const generatorTitle = formatGeneratorTitle(generator);
  const decisionLines = preview ? deriveDecisionSummary(generator, preview.facts_used) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="bg-paper max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-rule-strong"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-9 py-6 border-b border-rule">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="smcp text-graphite-soft mb-1">approval</div>
              <h2 className="text-title leading-tight break-words">{generatorTitle}</h2>
              <div className="font-mono text-meta text-graphite mt-1.5 truncate">
                matter <span className="text-ink-2">{matterId}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              aria-label="Close approval modal"
              className="smcp px-3 py-2 border border-ink-2 hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 shrink-0"
            >
              cancel · esc
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-9 py-7 grid gap-9">
          {loading && <div className="text-body text-graphite">Building preview…</div>}
          {error && (
            <div className="border border-ink-2 paper-recess px-4 py-3 font-mono text-meta text-ink">
              <span className="smcp text-ink mr-2">error</span>
              {error}
            </div>
          )}

          {preview && (
            <>
              {decisionLines.length > 0 && (
                <ApprovalSection title="decision">
                  <ul className="grid gap-1.5">
                    {decisionLines.map((line, i) => (
                      <li key={i} className="text-body text-ink-2 leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                </ApprovalSection>
              )}

              {preview.conflicts_to_flag_in_output.length > 0 && (
                <ApprovalSection
                  title="risk register"
                  count={preview.conflicts_to_flag_in_output.length}
                  countLabel={
                    preview.conflicts_to_flag_in_output.length === 1 ? 'flag' : 'flags'
                  }
                >
                  <ConflictList items={preview.conflicts_to_flag_in_output} />
                </ApprovalSection>
              )}

              {preview.structural_outline.length > 0 && (
                <ApprovalSection title="structural outline">
                  <ol className="grid gap-2.5">
                    {preview.structural_outline.map((s) => (
                      <li
                        key={s.roman}
                        className="grid grid-cols-[2.6rem_1fr] items-baseline gap-x-3"
                      >
                        <span className="font-mono text-meta text-graphite tabular-nums">
                          {s.roman}.
                        </span>
                        <div>
                          <div className="text-body text-ink-2">{s.heading}</div>
                          {s.one_line_summary && (
                            <div className="text-meta text-graphite mt-0.5">
                              {s.one_line_summary}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </ApprovalSection>
              )}

              {preview.defensive_paragraphs_required.length > 0 && (
                <ApprovalSection
                  title="defensive paragraphs"
                  count={preview.defensive_paragraphs_required.length}
                >
                  <ul className="grid gap-1">
                    {preview.defensive_paragraphs_required.map((d) => (
                      <li key={d} className="font-mono text-meta text-ink-2">
                        {d}
                      </li>
                    ))}
                  </ul>
                </ApprovalSection>
              )}

              {preview.authorities_to_cite.length > 0 && (
                <ApprovalSection
                  title="authorities cited"
                  count={preview.authorities_to_cite.length}
                >
                  <ul className="grid gap-1 font-mono text-meta text-ink-2">
                    {preview.authorities_to_cite.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </ApprovalSection>
              )}

              <ApprovalSection title="implications">
                <dl className="grid grid-cols-[8rem_1fr] gap-y-1 gap-x-4">
                  <dt className="text-meta text-graphite">cost</dt>
                  <dd className="font-mono text-meta text-ink-2 tabular-nums">
                    ≈ ${preview.estimated_cost_usd.toFixed(3)}
                  </dd>
                  <dt className="text-meta text-graphite">tokens</dt>
                  <dd className="font-mono text-meta text-ink-2 tabular-nums">
                    ≈ {preview.estimated_output_length_tokens.toLocaleString()}
                  </dd>
                  <dt className="text-meta text-graphite">facts used</dt>
                  <dd className="font-mono text-meta text-ink-2 tabular-nums">
                    {preview.facts_used.length}
                  </dd>
                </dl>
              </ApprovalSection>

              {preview.facts_used.length > 0 && (
                <details className="border-t border-rule pt-4">
                  <summary className="cursor-pointer smcp text-graphite hover:text-ink select-none">
                    show all {preview.facts_used.length} source fields
                  </summary>
                  <div className="mt-4">
                    <FactsTable
                      facts={preview.facts_used}
                      edits={edits}
                      onEdit={(path, value) =>
                        setEdits((prev) => ({ ...prev, [path]: value }))
                      }
                    />
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-9 py-5 border-t border-rule flex items-center justify-between gap-4">
          <input
            type="text"
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
            placeholder="attorney initials"
            className="border border-rule-strong px-3 py-2 font-mono text-meta flex-1 max-w-[14rem] focus:outline-none focus:border-ink"
            disabled={submitting}
            maxLength={12}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => submit(false)}
              disabled={!preview || submitting}
              className="smcp px-4 py-2 border border-rule-strong text-graphite hover:border-ink hover:text-ink transition-colors disabled:opacity-40"
            >
              reject
            </button>
            <button
              onClick={() => submit(true)}
              disabled={!preview || submitting}
              className="smcp px-4 py-2 bg-ink text-paper border border-ink hover:bg-ink-2 transition-colors disabled:opacity-40"
            >
              approve &amp; generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatGeneratorTitle(generator: string): string {
  return generator
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Plain-English summary of what the generator will produce, derived from
 * facts_used. Cover-letter-aware today; falls back to a generic line for
 * other generators until per-generator templating lands.
 */
function deriveDecisionSummary(
  generator: string,
  facts: PreviewFactRow[],
): string[] {
  const get = (path: string) => {
    const row = facts.find((f) => f.field_path === path);
    return row?.value == null ? null : String(row.value);
  };
  const fmtUSD = (s: string | null): string | null => {
    if (s === null) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  };

  if (generator === 'cover_letter') {
    const name = get('$.investor.full_name');
    const nat = get('$.investor.nationality');
    const passport = get('$.investor.passport_number');
    const entity = get('$.enterprise.legal_name');
    const state = get('$.enterprise.state_of_formation');
    const formed = get('$.enterprise.formation_date');
    const committed = fmtUSD(get('$.investment.total_committed_usd'));
    const spent = fmtUSD(get('$.investment.total_spent_usd'));
    const sofRows = facts.filter((f) =>
      f.field_path.startsWith('$.source_of_funds['),
    ).length;
    // each SOF chain has ~5 leaf fields in the schema
    const sofChains = sofRows > 0 ? Math.ceil(sofRows / 5) : 0;

    const lines: string[] = [];
    if (name && nat) {
      lines.push(
        `${name}, ${nat} national${passport ? ` (passport ${passport})` : ''}, qualifies as a treaty investor.`,
      );
    }
    if (entity) {
      const entityBits = [entity];
      if (state) entityBits.push(state);
      if (formed) entityBits.push(`formed ${formed}`);
      lines.push(`Enterprise: ${entityBits.join(' · ')}.`);
    }
    if (committed) {
      const investBits = [`Total committed ${committed}`];
      if (spent) investBits.push(`spent ${spent}`);
      lines.push(`${investBits.join(', ')}.`);
    }
    if (sofChains > 0) {
      lines.push(
        `Source of funds traced through ${sofChains} chain${sofChains > 1 ? 's' : ''}.`,
      );
    }
    return lines;
  }

  return [
    `The ${formatGeneratorTitle(generator).toLowerCase()} will be drafted from the facts on file.`,
  ];
}

function ApprovalSection({
  title,
  count,
  countLabel,
  children,
}: {
  title: string;
  count?: number;
  countLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-baseline gap-3 mb-3">
        <span className="smcp text-graphite">{title}</span>
        {typeof count === 'number' && (
          <span className="font-mono text-meta text-graphite-soft tabular-nums">
            {count}
            {countLabel ? ` ${countLabel}` : ''}
          </span>
        )}
        <span className="flex-1 border-b border-rule translate-y-[-0.3em]" />
      </header>
      {children}
    </section>
  );
}

function FactsTable(props: {
  facts: PreviewFactRow[];
  edits: Record<string, string>;
  onEdit: (path: string, value: string) => void;
}) {
  if (props.facts.length === 0) {
    return <div className="text-meta text-graphite-soft">No facts will be consumed.</div>;
  }
  return (
    <table className="w-full font-mono text-meta">
      <thead>
        <tr className="border-b border-rule-strong">
          <th className="text-left py-2 pr-3 text-graphite font-medium w-1/3">field_path</th>
          <th className="text-left py-2 pr-3 text-graphite font-medium">value</th>
          <th className="text-left py-2 text-graphite font-medium w-32">source</th>
        </tr>
      </thead>
      <tbody>
        {props.facts.map((f) => (
          <FactRow
            key={f.field_path}
            fact={f}
            edited={props.edits[f.field_path]}
            onEdit={(v) => props.onEdit(f.field_path, v)}
          />
        ))}
      </tbody>
    </table>
  );
}

function FactRow(props: {
  fact: PreviewFactRow;
  edited: string | undefined;
  onEdit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const display =
    props.edited !== undefined
      ? props.edited
      : props.fact.value === null || props.fact.value === undefined
        ? '—'
        : String(props.fact.value);
  return (
    <tr className="border-b border-rule align-top">
      <td className="py-2 pr-3 text-graphite">{props.fact.field_path}</td>
      <td className="py-2 pr-3">
        {editing ? (
          <input
            autoFocus
            defaultValue={display === '—' ? '' : display}
            onBlur={(e) => {
              props.onEdit(e.currentTarget.value);
              setEditing(false);
            }}
            className="border border-rule-strong px-2 py-1 w-full focus:outline-none focus:border-ink"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className={`cursor-pointer text-ink-2 ${
              props.edited !== undefined ? 'underline underline-offset-2' : ''
            }`}
          >
            {display}
          </span>
        )}
      </td>
      <td className="py-2 text-graphite-soft tabular-nums">
        {props.fact.source_doc ?? ''}
        {props.fact.source_page != null && ` p.${props.fact.source_page}`}
      </td>
    </tr>
  );
}

function ConflictList(props: { items: PreviewConflictEntry[] }) {
  const sorted = [...props.items].sort((a, b) => b.severity - a.severity);
  return (
    <ul className="grid gap-2">
      {sorted.map((c, i) => {
        const rank = SEVERITY_RANK[c.severity] ?? SEVERITY_RANK[3];
        return (
          <li
            key={`${c.conflict_type}-${i}`}
            className="grid grid-cols-[1.4rem_1fr_auto] items-baseline gap-x-3"
          >
            <span className={`font-mono text-meta ${rank.weight}`}>{rank.glyph}</span>
            <div className="min-w-0">
              <div className={`text-body ${rank.weight}`}>{c.description}</div>
              <div className="font-mono text-meta text-graphite-soft mt-0.5">
                {c.conflict_type}
              </div>
            </div>
            <span className="font-mono text-meta text-graphite tabular-nums shrink-0">
              sev {c.severity}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
