import type { ReactNode } from 'react';

interface Props {
  numeral: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionAccordion({
  numeral,
  title,
  subtitle,
  rightSlot,
  defaultOpen = false,
  children,
}: Props) {
  return (
    <details className="group border-b border-rule" open={defaultOpen}>
      <summary className="flex items-baseline gap-3 cursor-pointer select-none py-4 px-7 hover:bg-paper-2/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-label text-ink  w-8 shrink-0">
          {numeral}
        </span>
        <h2 className="font-display text-title tracking-[-0.005em] text-ink leading-none">
          {title}
        </h2>
        {subtitle && (
          <span className="font-semibold text-meta text-graphite-soft leading-none">
            — {subtitle}
          </span>
        )}
        <span className="ml-auto flex items-baseline gap-4">
          {rightSlot}
          <span className="font-mono text-meta text-graphite-soft transition-transform duration-200 group-open:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <div className="px-7 pb-7 pt-2">{children}</div>
    </details>
  );
}
