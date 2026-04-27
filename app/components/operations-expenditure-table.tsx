import type { E2Facts } from '@/ingest';

interface FieldLeaf<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

const fmtUSD = (n: number | null): string => {
  if (n === null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

const v = <T,>(f: unknown): T | null => {
  if (!f || typeof f !== 'object' || !('value' in (f as object))) return null;
  return ((f as FieldLeaf<T>).value ?? null) as T | null;
};

/**
 * Heading-bucket mapping. The aggregator emits free-form `category` strings
 * (e.g., "Build-out & equipment", "Inventory — green coffee"); we route
 * each to one of seven buckets that mirror the §VI cover-letter narrative.
 * Anything we can't route lands under "Other operating outlay" so the
 * total still reconciles to the investment ledger.
 */
const BUCKETS: { key: string; label: string; match: RegExp }[] = [
  { key: 'lease', label: 'Lease & occupancy', match: /lease|rent|occupancy|property/i },
  { key: 'buildout', label: 'Build-out & equipment', match: /build|equip|fixtur|construct/i },
  { key: 'inventory', label: 'Inventory & supplies', match: /invent|suppl|raw|stock/i },
  { key: 'payroll', label: 'Payroll & benefits', match: /payroll|salary|salar|wage|benefit/i },
  { key: 'marketing', label: 'Marketing & launch', match: /market|advert|launch|brand|pr\b/i },
  { key: 'professional', label: 'Professional & licensing', match: /legal|licens|accoun|insur|profession/i },
];

interface Props {
  items: E2Facts['investment']['items'];
}

export function OperationsExpenditureTable({ items }: Props) {
  const totals = new Map<string, { label: string; total: number; lines: number }>();
  for (const b of BUCKETS) totals.set(b.key, { label: b.label, total: 0, lines: 0 });
  totals.set('other', { label: 'Other operating outlay', total: 0, lines: 0 });

  for (const item of items) {
    const cat = v<string>(item.category) ?? '';
    const amt = v<number>(item.amount_usd) ?? 0;
    const matched = BUCKETS.find((b) => b.match.test(cat));
    const key = matched?.key ?? 'other';
    const cur = totals.get(key);
    if (cur) {
      cur.total += amt;
      cur.lines += 1;
    }
  }

  const grand = Array.from(totals.values()).reduce((acc, b) => acc + b.total, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[0.86rem]">
        <thead>
          <tr className="border-b border-ink-2">
            <th className="pb-2 text-left smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium">
              Heading bucket
            </th>
            <th className="pb-2 text-right smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium w-24">
              Lines
            </th>
            <th className="pb-2 text-right smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium w-40">
              Total (USD)
            </th>
            <th className="pb-2 text-right smcp text-[0.62rem] text-graphite tracking-[0.2em] font-medium w-24">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from(totals.values()).map((b) => (
            <tr
              key={b.label}
              className={
                'border-b border-rule ' +
                (b.lines === 0 ? 'text-graphite-soft' : 'text-ink')
              }
            >
              <td className="py-2.5 font-display text-[0.95rem]">{b.label}</td>
              <td className="py-2.5 text-right font-mono tabular-nums text-[0.82rem]">
                {b.lines === 0 ? '—' : b.lines}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums text-[0.92rem]">
                {b.lines === 0 ? '—' : fmtUSD(b.total)}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums text-[0.78rem] text-graphite">
                {b.lines === 0 || grand === 0
                  ? '—'
                  : `${((b.total / grand) * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink-2">
            <td className="pt-3 smcp text-[0.66rem] text-graphite tracking-[0.2em]">
              Σ operating outlay
            </td>
            <td />
            <td className="pt-3 text-right font-mono text-[0.95rem] tabular-nums text-ink">
              {fmtUSD(grand)}
            </td>
            <td className="pt-3 text-right font-mono text-[0.78rem] text-graphite">100%</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 text-[0.72rem] text-graphite italic font-display max-w-[68ch]">
        Buckets mirror the §VI cover-letter headings. Marginality and real-and-operating
        arguments cite this table; anything labelled “Other operating outlay” should be
        re-categorised before filing.
      </p>
    </div>
  );
}
