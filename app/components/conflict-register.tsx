import type { E2Facts } from '@/ingest';

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

const SEV_META: Record<number, { tag: string; weight: 'heavy' | 'med' | 'light' }> = {
  5: { tag: 'DISPOSITIVE', weight: 'heavy' },
  4: { tag: 'MATERIAL',    weight: 'heavy' },
  3: { tag: 'MINOR',       weight: 'med' },
  2: { tag: 'CLERICAL',    weight: 'light' },
  1: { tag: 'COSMETIC',    weight: 'light' },
};

interface Props {
  conflicts: E2Facts['conflict_register'];
}

export function ConflictRegister({ conflicts }: Props) {
  const sorted = [...conflicts].sort((a, b) => {
    const sa = v<number>(a.severity) ?? 0;
    const sb = v<number>(b.severity) ?? 0;
    return sb - sa;
  });

  if (sorted.length === 0) {
    return (
      <p className="text-body text-graphite leading-relaxed">
        No conflicts on register. Re-run the reviewer after every fact edit to refresh.
      </p>
    );
  }

  const counts = sorted.reduce<Record<number, number>>((acc, c) => {
    const s = v<number>(c.severity) ?? 0;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-5 flex-wrap">
        <span className="smcp text-graphite mr-2">severity</span>
        {[5, 4, 3, 2, 1].map((s) => {
          const n = counts[s] ?? 0;
          const meta = SEV_META[s];
          const weightClass =
            meta.weight === 'heavy'
              ? 'border-ink text-ink font-semibold'
              : meta.weight === 'med'
                ? 'border-rule-strong text-ink-2 font-medium'
                : 'border-rule text-graphite';
          return (
            <span
              key={s}
              className={
                'inline-flex items-baseline gap-1.5 border rounded-full px-2.5 py-0.5 text-meta ' +
                weightClass +
                ' ' +
                (n === 0 ? 'opacity-40' : '')
              }
            >
              <span>{meta.tag.toLowerCase()}</span>
              <span className="font-mono tabular-nums">{n}</span>
            </span>
          );
        })}
      </div>

      <ol className="grid gap-3">
        {sorted.map((c, i) => {
          const sev = v<number>(c.severity) ?? 0;
          const meta = SEV_META[sev] ?? SEV_META[1];
          const cardBorder =
            meta.weight === 'heavy'
              ? 'border-ink border-l-[3px]'
              : meta.weight === 'med'
                ? 'border-rule-strong border-l-[3px]'
                : 'border-rule border-l-[3px]';
          return (
            <li key={i} className={'bg-paper px-5 py-4 border ' + cardBorder}>
              <div className="flex items-baseline gap-3 mb-2">
                <span
                  className={
                    'smcp ' +
                    (meta.weight === 'heavy'
                      ? 'text-ink font-semibold'
                      : meta.weight === 'med'
                        ? 'text-ink-2'
                        : 'text-graphite')
                  }
                >
                  {meta.tag}
                </span>
                <span className="font-mono text-meta text-graphite-soft">
                  {v<string>(c.conflict_type) ?? 'unspecified'}
                </span>
              </div>
              <p className="text-body text-ink leading-relaxed mb-3">
                {v<string>(c.description) ?? '—'}
              </p>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 border-t border-rule pt-3">
                <div className="flex items-baseline gap-2">
                  <dt className="smcp text-graphite-soft">A</dt>
                  <dd className="text-meta text-ink-2 font-mono">
                    {v<string>(c.fact_a_doc) ?? '—'}
                    {c.fact_a_page.value !== null && (
                      <span className="text-graphite-soft"> · p.{c.fact_a_page.value}</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="smcp text-graphite-soft">B</dt>
                  <dd className="text-meta text-ink-2 font-mono">
                    {v<string>(c.fact_b_doc) ?? '—'}
                    {c.fact_b_page.value !== null && (
                      <span className="text-graphite-soft"> · p.{c.fact_b_page.value}</span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
