import type { GradeRange } from '@/lib/comp';
import { formatGndK } from '@/lib/format';
import { CHART } from '@/components/charts/chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

interface MidpointLadderProps {
  grades: GradeRange[];
  /** Optional employee base-pay markers per grade (for positioning context). */
  markers?: Record<string, number[]>;
}

/**
 * Visual midpoint ladder: each grade's min–max band on a shared pay scale with the
 * midpoint tick. Deterministic CSS geometry — no NaN bars.
 */
export function MidpointLadder({ grades, markers }: MidpointLadderProps) {
  const mins = grades.map((g) => g.min).filter(isNum);
  const maxes = grades.map((g) => g.max).filter(isNum);
  if (mins.length === 0 || maxes.length === 0) {
    return <EmptyState compact message="No structure to plot." />;
  }
  const lo = Math.min(...mins) * 0.96;
  const hi = Math.max(...maxes) * 1.04;
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="space-y-2.5">
      {[...grades].reverse().map((g) => {
        const hasRange = isNum(g.min) && isNum(g.max);
        const left = hasRange ? pct(g.min!) : 0;
        const width = hasRange ? Math.max(pct(g.max!) - left, 1) : 0;
        const midLeft = isNum(g.midpoint) ? pct(g.midpoint) : null;
        const pts = markers?.[g.grade] ?? [];
        return (
          <div key={g.grade} className="grid grid-cols-[5.5rem_1fr_7rem] items-center gap-3">
            <span className="text-xs font-medium text-ink-soft">
              {g.grade} <span className="text-muted">· {g.level}</span>
            </span>
            <div className="relative h-6">
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
              {hasRange && (
                <div
                  className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm"
                  style={{ left: `${left}%`, width: `${width}%`, background: CHART.bandLight, border: `1px solid ${CHART.bandDark}` }}
                />
              )}
              {pts.map((p, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${pct(p)}%`, background: 'rgba(46,92,154,0.45)' }}
                />
              ))}
              {midLeft !== null && (
                <span className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${midLeft}%`, background: CHART.navy700 }} />
              )}
            </div>
            <span className="text-right text-[0.72rem] tabular-nums text-muted">
              {formatGndK(g.min, 0)}–{formatGndK(g.max, 0)}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-1 text-[0.7rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-[2px] border" style={{ background: CHART.bandLight, borderColor: CHART.bandDark }} /> Min–Max
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-[2px]" style={{ background: CHART.navy700 }} /> Midpoint
        </span>
        {markers && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'rgba(46,92,154,0.45)' }} /> Employees
          </span>
        )}
      </div>
    </div>
  );
}
