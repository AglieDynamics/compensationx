import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface KpiItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: 'navy' | 'green' | 'amber' | 'red' | 'default';
  hint?: string;
}

const ACCENT: Record<NonNullable<KpiItem['accent']>, string> = {
  navy: 'text-navy-700',
  green: 'text-brand-green',
  amber: 'text-[#9A7212]',
  red: 'text-brand-red',
  default: 'text-ink',
};

export function KpiCard({ label, value, sub, accent = 'default', hint }: KpiItem) {
  return (
    <div className="rounded-card border border-border bg-card px-4 py-3 shadow-card" title={hint}>
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold leading-none tabular-nums', ACCENT[accent])}>{value}</div>
      {sub != null && <div className="mt-1 text-[0.72rem] text-muted">{sub}</div>}
    </div>
  );
}

export function KpiStrip({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5', className)}>
      {items.map((it) => (
        <KpiCard key={it.label} {...it} />
      ))}
    </div>
  );
}
