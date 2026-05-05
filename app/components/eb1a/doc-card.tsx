/**
 * Editorial document card used inside an EB-1A criterion section. Hairline
 * border, no drop shadow, no chip-fills. Confidence is rendered as a
 * mono-tabular number with a horizontal hairline under it (no progress
 * bar widget — Atelier renders metrics, not gauges).
 *
 * Design fidelity reference: team/design/_DNA.md §§ 3.4, 7, 8.
 */

import type { CriterionId } from './criteria-meta';
import { getCriterion } from './criteria-meta';

export interface DocCardDoc {
  id: string;
  filename: string;
  doc_type: string;
  variant_id: string;
  variant_label: string;
  criterion: CriterionId;
  secondary_criteria?: CriterionId[];
  confidence: number;
  uploaded_at: string;
}

interface DocCardProps {
  doc: DocCardDoc;
  /** Whether the parent criterion is the primary surface (suppresses re-listing). */
  primaryCriterion: CriterionId;
}

const dash = '—';

function formatDocType(t: string): string {
  // award_certificate → Award certificate
  const spaced = t.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatUploaded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dash;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function confidenceTier(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.85) return 'high';
  if (c >= 0.7) return 'medium';
  return 'low';
}

export function DocCard({ doc, primaryCriterion }: DocCardProps) {
  const tier = confidenceTier(doc.confidence);
  const secondaries = (doc.secondary_criteria ?? []).filter(
    (c) => c !== primaryCriterion,
  );

  return (
    <article
      className="border border-rule bg-paper p-5 hover:border-ink transition-colors flex flex-col gap-4"
      aria-label={`${doc.filename} — ${formatDocType(doc.doc_type)}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="text-body font-semibold text-ink leading-snug truncate" title={doc.filename}>
            {doc.filename}
          </h4>
          <p className="text-meta text-graphite mt-1 leading-snug">
            {formatDocType(doc.doc_type)}
            <span className="text-rule-strong mx-1.5">·</span>
            <span className="font-mono text-graphite-soft">{doc.variant_id}</span>
            <span className="text-graphite-soft"> {doc.variant_label}</span>
          </p>
        </div>
        <span className="font-mono text-label text-graphite-soft tabular-nums shrink-0">
          {formatUploaded(doc.uploaded_at)}
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto] gap-4 items-end pt-3 border-t border-rule">
        <div className="min-w-0">
          <div className="smcp text-graphite-soft">classifier</div>
          <div className="text-meta text-graphite mt-1.5 leading-snug">
            {secondaries.length > 0 ? (
              <>
                also surfaces in{' '}
                {secondaries.map((s, i) => (
                  <span key={s}>
                    {i > 0 && <span className="text-rule-strong mx-1">·</span>}
                    <span className="text-ink-2">{getCriterion(s).label}</span>
                  </span>
                ))}
              </>
            ) : (
              <span className="text-graphite-soft">single-criterion anchor</span>
            )}
          </div>
        </div>

        <ConfidencePill value={doc.confidence} tier={tier} />
      </div>
    </article>
  );
}

function ConfidencePill({ value, tier }: { value: number; tier: 'high' | 'medium' | 'low' }) {
  const pct = Math.round(value * 100);
  return (
    <div className="text-right">
      <div className="smcp text-graphite-soft mb-1.5">conf.</div>
      <div className="font-mono tabular-nums text-body text-ink leading-none">
        {pct}
        <span className="text-graphite-soft text-meta">%</span>
      </div>
      <div
        aria-hidden
        className={
          'mt-1.5 h-px w-12 ml-auto ' +
          (tier === 'high'
            ? 'bg-ink'
            : tier === 'medium'
              ? 'bg-graphite'
              : 'bg-rule-strong')
        }
      />
    </div>
  );
}

