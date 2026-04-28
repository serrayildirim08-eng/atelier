'use client';

/**
 * Pre-generation approval modal. Drops on top of the dashboard when an
 * attorney clicks any "Generate" button. Workflow:
 *
 *   1. Open modal → POST /api/matter/[id]/preview { generator } → render
 *      facts_used + defensives + authorities + outline + cost.
 *   2. Attorney inline-edits any fact value (click → editable input →
 *      blur to commit).
 *   3. Footer: attorney initials (required) + [Reject] / [Approve].
 *   4. Submit → POST /api/matter/[id]/approve { preview_id, approved,
 *      attorney_initials, edits } → on approval, surface output_path
 *      and (optionally) output_inline.
 */

import { useEffect, useMemo, useState } from 'react';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewGenerator,
  PreviewRecord,
} from '@/lib/preview-store';

interface ApprovalModalProps {
  open: boolean;
  matterId: string;
  generator: PreviewGenerator;
  /** Optional generator-specific args forwarded to the preview endpoint. */
  args?: Record<string, unknown>;
  /**
   * Live case facts. When supplied, the modal posts them in the body of
   * /preview and /approve so the server uses the freshly-ingested matter
   * instead of falling back to getMockMatter / getMockTypedMemory.
   */
  caseFacts?: unknown;
  typedMemory?: unknown;
  onClose: () => void;
  onApproved?: (result: ApprovalResult) => void;
  onRejected?: () => void;
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
  const [preview, setPreview] = useState<PreviewRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [initials, setInitials] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdits({});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/matter/${encodeURIComponent(matterId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_id: preview.preview_id,
          approved,
          attorney_initials: initials.trim(),
          edits: approved ? editArray : [],
          case_facts: props.caseFacts,
          typed_memory: props.typedMemory,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      if (approved) {
        onApproved?.({
          output_path: body.output_path ?? null,
          output_inline: body.output_inline ?? null,
          preview: body.preview as PreviewRecord,
        });
      } else {
        onRejected?.();
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Escape closes; clicking the backdrop also closes (unless submitting).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="bg-paper max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-graphite/30 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-9 py-7 border-b border-graphite/20">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <div className="smcp text-[0.65rem] text-graphite">¶ pre-generation approval</div>
              <div className="font-display italic text-[1.4rem] text-ink-2">
                {generator.replace(/_/g, ' ')}
              </div>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-[0.85rem] text-ink-2 px-3 py-1 border border-graphite/40 hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
              disabled={submitting}
              aria-label="Close approval modal"
            >
              ✕ close (Esc)
            </button>
          </div>
          <div className="font-mono text-[0.7rem] text-graphite">
            matter: {matterId}{' '}
            {preview && (
              <>
                · est. {preview.estimated_output_length_tokens.toLocaleString()} tokens · est. $
                {preview.estimated_cost_usd.toFixed(3)}
              </>
            )}
          </div>
        </div>

        <div className="px-9 py-6 space-y-7">
          {loading && <div className="font-display italic text-graphite">Building preview…</div>}
          {error && (
            <div className="border border-rose-300 bg-rose-50 text-rose-900 px-4 py-3 font-mono text-[0.75rem]">
              {error}
            </div>
          )}

          {preview && (
            <>
              <FactsTable
                facts={preview.facts_used}
                edits={edits}
                onEdit={(path, value) =>
                  setEdits((prev) => ({ ...prev, [path]: value }))
                }
              />

              {preview.defensive_paragraphs_required.length > 0 && (
                <Section title="Defensive paragraphs required">
                  <div className="flex flex-wrap gap-2">
                    {preview.defensive_paragraphs_required.map((d) => (
                      <span
                        key={d}
                        title={d}
                        className="inline-block border border-graphite/40 px-2 py-1 font-mono text-[0.7rem]"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {preview.authorities_to_cite.length > 0 && (
                <Section title="Authorities to cite">
                  <ul className="font-mono text-[0.75rem] space-y-1">
                    {preview.authorities_to_cite.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {preview.conflicts_to_flag_in_output.length > 0 && (
                <Section title="Conflicts to flag in output">
                  <ConflictList items={preview.conflicts_to_flag_in_output} />
                </Section>
              )}

              {preview.structural_outline.length > 0 && (
                <Section title="Structural outline">
                  <ol className="space-y-2">
                    {preview.structural_outline.map((s) => (
                      <li key={s.roman}>
                        <details>
                          <summary className="cursor-pointer font-mono text-[0.75rem]">
                            <span className="font-bold mr-2">{s.roman}.</span>
                            {s.heading}
                          </summary>
                          <div className="ml-6 mt-1 font-display italic text-[0.85rem] text-ink-2">
                            {s.one_line_summary}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </>
          )}
        </div>

        <div className="px-9 py-5 border-t border-graphite/20 flex items-center justify-between gap-4">
          <input
            type="text"
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
            placeholder="Attorney initials (e.g., S.Y.)"
            className="border border-graphite/40 px-3 py-2 font-mono text-[0.8rem] flex-1"
            disabled={submitting}
            maxLength={12}
          />
          <button
            onClick={() => submit(false)}
            disabled={!preview || submitting}
            className="border border-rose-300 bg-rose-50 text-rose-900 px-4 py-2 font-mono text-[0.75rem] disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => submit(true)}
            disabled={!preview || submitting}
            className="border border-graphite/40 bg-ink-2 text-paper px-4 py-2 font-mono text-[0.75rem] disabled:opacity-50"
          >
            Approve and generate
          </button>
        </div>
      </div>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="smcp text-[0.65rem] text-graphite mb-3">¶ {props.title}</div>
      {props.children}
    </div>
  );
}

function FactsTable(props: {
  facts: PreviewFactRow[];
  edits: Record<string, string>;
  onEdit: (path: string, value: string) => void;
}) {
  if (props.facts.length === 0) {
    return (
      <div className="font-display italic text-graphite">No facts will be consumed.</div>
    );
  }
  return (
    <div>
      <div className="smcp text-[0.65rem] text-graphite mb-3">
        ¶ facts the generator will use ({props.facts.length})
      </div>
      <table className="w-full font-mono text-[0.7rem]">
        <thead>
          <tr className="border-b border-graphite/20 text-graphite">
            <th className="text-left py-2 w-1/3">field_path</th>
            <th className="text-left py-2">value</th>
            <th className="text-left py-2 w-32">source</th>
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
    </div>
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
        ? '[null]'
        : String(props.fact.value);
  return (
    <tr className="border-b border-graphite/10 align-top">
      <td className="py-2 pr-3 text-graphite">{props.fact.field_path}</td>
      <td className="py-2 pr-3">
        {editing ? (
          <input
            autoFocus
            defaultValue={display === '[null]' ? '' : display}
            onBlur={(e) => {
              props.onEdit(e.currentTarget.value);
              setEditing(false);
            }}
            className="border border-graphite/40 px-2 py-1 w-full"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className={`cursor-pointer ${props.edited !== undefined ? 'underline decoration-amber-500' : ''}`}
          >
            {display}
          </span>
        )}
      </td>
      <td className="py-2 text-graphite text-[0.65rem]">
        {props.fact.source_doc ?? ''}
        {props.fact.source_page != null && ` p.${props.fact.source_page}`}
      </td>
    </tr>
  );
}

function ConflictList(props: { items: PreviewConflictEntry[] }) {
  return (
    <ul className="space-y-2">
      {props.items.map((c, i) => {
        const rank = SEVERITY_RANK[c.severity];
        return (
          <li
            key={`${c.conflict_type}-${i}`}
            className="border border-graphite/30 px-3 py-2"
          >
            <div className={`font-mono text-[0.7rem] mb-1 ${rank?.weight ?? ''}`}>
              {rank?.glyph ?? '·'} severity {c.severity} · {c.conflict_type}
            </div>
            <div className="font-display italic text-[0.85rem]">{c.description}</div>
          </li>
        );
      })}
    </ul>
  );
}
