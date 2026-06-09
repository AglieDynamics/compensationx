import { useMemo } from 'react';
import type { EmployeeMapping } from '@/lib/comp';
import { QuadrantScatter, type ScatterPoint } from '@/components/charts/QuadrantScatter';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHART } from '@/components/charts/chartTheme';
import { formatPct } from '@/lib/format';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Employee positioning heatmap: range penetration × compa-ratio, green/red-circle clusters. */
export function PositioningGrid({ mappings, height = 360 }: { mappings: EmployeeMapping[]; height?: number }) {
  const points = useMemo<ScatterPoint[]>(
    () =>
      mappings
        .filter((m) => isNum(m.rangePenetration) && isNum(m.compaRatio))
        .map((m) => ({
          x: m.rangePenetration as number,
          y: m.compaRatio as number,
          label: m.employee.displayName,
          color: m.belowMin ? '#2E8B57' : m.aboveMax ? '#C0392B' : CHART.firm,
        })),
    [mappings],
  );

  if (points.length === 0) return <EmptyState compact message="No mapped employees to plot." />;

  const below = mappings.filter((m) => m.belowMin).length;
  const above = mappings.filter((m) => m.aboveMax).length;
  const inRange = mappings.length - below - above;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2E8B57' }} /> Below min (green-circle) <span className="font-semibold text-ink">{below}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.firm }} /> In range <span className="font-semibold text-ink">{inRange}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#C0392B' }} /> Above max (red-circle) <span className="font-semibold text-ink">{above}</span></span>
      </div>
      <QuadrantScatter
        points={points}
        xLabel="Range penetration"
        yLabel="Compa-ratio"
        refX={0.5}
        refY={1.0}
        xTickFormatter={(v) => formatPct(v, 0)}
        yTickFormatter={(v) => v.toFixed(2)}
        height={height}
        tooltip={(p) => (
          <div className="space-y-0.5 text-muted">
            <div>Compa-ratio: <span className="font-semibold text-ink">{p.y.toFixed(2)}</span></div>
            <div>Penetration: <span className="font-semibold text-ink">{formatPct(p.x, 0)}</span></div>
          </div>
        )}
      />
    </div>
  );
}
