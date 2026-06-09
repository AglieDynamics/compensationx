import type { Unit } from '@/domain/components';
import { formatGndK, formatPct } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHART } from './chartTheme';

const fmt = (v: number, unit: Unit): string => (unit === 'RATIO' ? formatPct(v) : formatGndK(v, 0, true));

export interface TornadoBar {
  label: string;
  low: number;
  high: number;
  delta: number;
}

interface TornadoProps {
  rows: TornadoBar[];
  baseline: number;
  unit: Unit;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Sensitivity tornado: each driver's leakage range [low, high] on a shared scale,
 * with the baseline marked. Rows are pre-sorted by delta (largest swing on top).
 */
export function Tornado({ rows, baseline, unit }: TornadoProps) {
  const valid = rows.filter((r) => isNum(r.low) && isNum(r.high));
  if (valid.length === 0) return <EmptyState compact message="No sensitivity to plot." />;

  const lo = Math.min(baseline, ...valid.map((r) => Math.min(r.low, r.high)));
  const hi = Math.max(baseline, ...valid.map((r) => Math.max(r.low, r.high)));
  const span = hi - lo || 1;
  const pct = (v: number): number => ((v - lo) / span) * 100;

  return (
    <div className="space-y-2">
      {valid.map((r) => {
        const left = pct(Math.min(r.low, r.high));
        const width = Math.max(pct(Math.max(r.low, r.high)) - left, 1);
        return (
          <div key={r.label} className="grid grid-cols-[10rem_1fr] items-center gap-3">
            <span className="truncate text-xs font-medium text-ink-soft" title={r.label}>
              {r.label}
            </span>
            <div className="relative h-6">
              <div
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm"
                style={{ left: `${left}%`, width: `${width}%`, background: CHART.firm, opacity: 0.85 }}
              />
              {/* baseline marker */}
              <div
                className="absolute top-0 h-full w-px bg-[#15233F]"
                style={{ left: `${pct(baseline)}%` }}
                title={`Baseline ${fmt(baseline, unit)}`}
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1 text-[0.7rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-px bg-[#15233F]" /> Baseline {fmt(baseline, unit)}
        </span>
        <span>Bar = leakage range under ±25% swing of each driver · {unit === 'RATIO' ? '%' : 'GND k'}</span>
      </div>
    </div>
  );
}
