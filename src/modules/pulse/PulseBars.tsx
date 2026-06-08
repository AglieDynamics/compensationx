import { CHART } from '@/components/charts/chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';
import type { PulseTally } from './pulseModel';

interface PulseBarsProps {
  tallies: PulseTally[];
}

/**
 * Diverging GCC vs Non-GCC comparison: response label centred, GCC counts grow
 * left (navy), Non-GCC counts grow right (blue). Deterministic CSS geometry.
 */
export function PulseBars({ tallies }: PulseBarsProps) {
  if (tallies.length === 0) {
    return <EmptyState compact message="No responses recorded for this section." />;
  }
  const max = Math.max(1, ...tallies.flatMap((t) => [t.gcc, t.nonGcc]));

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_9rem_1fr] items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-wide text-muted">
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: CHART.firm }} />
          GCC
        </div>
        <div className="text-center">Response</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: CHART.blue400 }} />
          Non-GCC
        </div>
      </div>

      {tallies.map((t) => (
        <div key={t.label} className="grid grid-cols-[1fr_9rem_1fr] items-center gap-2">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[0.7rem] tabular-nums text-muted">{t.gcc}</span>
            <div
              className="h-3.5 rounded-l-sm"
              style={{ width: `${(t.gcc / max) * 100}%`, minWidth: t.gcc > 0 ? 3 : 0, background: CHART.firm }}
            />
          </div>
          <div className="truncate text-center text-[0.72rem] text-ink-soft" title={t.label}>
            {t.label}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-3.5 rounded-r-sm"
              style={{ width: `${(t.nonGcc / max) * 100}%`, minWidth: t.nonGcc > 0 ? 3 : 0, background: CHART.blue400 }}
            />
            <span className="text-[0.7rem] tabular-nums text-muted">{t.nonGcc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
