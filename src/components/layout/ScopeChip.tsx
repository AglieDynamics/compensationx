import { useAppStore } from '@/store/useAppStore';
import { formatCount, formatPercentileLabel } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Compact "report scope" header chip: Country · Year · Currency · Firms · Incumbents · TMP. */
export function ScopeChip({ className }: { className?: string }) {
  const meta = useAppStore((s) => s.dataset.meta);
  const tmp = useAppStore((s) => s.targetPercentile);
  const source = useAppStore((s) => s.source);

  const items: { label: string; value: string }[] = [
    { label: 'Country', value: meta.country },
    { label: 'Year', value: String(meta.reportYear) },
    { label: 'Currency', value: meta.currency },
    { label: 'Firms', value: formatCount(meta.participatingFirms) },
    { label: 'Incumbents', value: formatCount(meta.marketIncumbents) },
    { label: 'TMP', value: formatPercentileLabel(tmp) },
  ];

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-card',
        className,
      )}
    >
      {items.map((it, i) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-border">·</span>}
          <span className="text-muted">{it.label}</span>
          <span className="font-semibold tabular-nums text-ink">{it.value}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="text-border">·</span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold',
            source === 'uploaded' ? 'bg-brand-green/10 text-brand-green' : 'bg-navy-500/10 text-navy-700',
          )}
        >
          {source === 'uploaded' ? 'Uploaded data' : 'Greenland sample'}
        </span>
      </span>
    </div>
  );
}
