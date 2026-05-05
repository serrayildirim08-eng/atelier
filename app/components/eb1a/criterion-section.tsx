/**
 * Single criterion section. Renders:
 *   - Editorial header: ordinal · label · regulatory cite · count
 *   - Sub-precis (one line, framework § 4 anchor)
 *   - Either the doc grid OR an empty-state evidence-quality-bar microcopy
 *
 * No accordion: every section opens by default. The attorney scans for
 * thinness; collapsing would hide the very signal we want surfaced.
 */

import type { CriterionMeta } from './criteria-meta';
import { DocCard, type DocCardDoc } from './doc-card';

interface CriterionSectionProps {
  meta: CriterionMeta;
  docs: DocCardDoc[];
  /** True when this section was conditionally activated (Display / Commercial Success). */
  activatedReason?: string;
}

export function CriterionSection({ meta, docs, activatedReason }: CriterionSectionProps) {
  const count = docs.length;
  const ordinal = String(meta.order).padStart(2, '0');

  return (
    <section
      id={`criterion-${meta.id}`}
      className="grid gap-6 scroll-mt-24"
      aria-labelledby={`criterion-${meta.id}-title`}
    >
      <header className="grid grid-cols-[auto_1fr_auto] gap-x-6 items-baseline border-t border-ink-2 pt-6">
        <span className="font-mono text-label text-graphite-soft tabular-nums">{ordinal}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3
              id={`criterion-${meta.id}-title`}
              className="text-section font-semibold tracking-[-0.015em] text-ink"
            >
              {meta.label}
            </h3>
            <span className="font-mono text-meta text-graphite-soft tracking-tight">
              {meta.cite}
            </span>
          </div>
          <p className="text-body text-graphite mt-1.5 leading-snug max-w-3xl">
            {meta.precis}
          </p>
          {activatedReason && (
            <p className="text-meta text-graphite-soft mt-2 italic max-w-3xl">
              activated · {activatedReason}
            </p>
          )}
        </div>
        <CountBadge count={count} />
      </header>

      {count === 0 ? (
        <EmptyState qualityBar={meta.qualityBar} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => (
            <DocCard key={doc.id} doc={doc} primaryCriterion={meta.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <div className="text-right">
      <div className="font-mono tabular-nums leading-none text-ink font-semibold" style={{ fontSize: '1.5rem' }}>
        {count}
      </div>
      <div className="text-meta text-graphite-soft mt-1">
        {count === 1 ? 'doc on file' : 'docs on file'}
      </div>
    </div>
  );
}

function EmptyState({ qualityBar }: { qualityBar: string }) {
  return (
    <div className="border border-rule paper-recess px-6 py-7 max-w-3xl">
      <div className="smcp text-graphite-soft mb-3">evidence quality bar</div>
      <p className="text-body text-ink leading-relaxed">{qualityBar}</p>
      <p className="text-meta text-graphite-soft mt-4 italic">
        the binder is bare under this criterion.
      </p>
    </div>
  );
}
