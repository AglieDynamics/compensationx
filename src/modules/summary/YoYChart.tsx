/**
 * YoY median comparison: prior-year (ACTUAL) vs current-year (TARGET) grouped
 * bars per level, with the per-level % change surfaced beneath. Values are
 * pre-computed in summaryModel via yoyMedianChange(); this only renders.
 */

import type { Unit } from '@/domain/components';
import { GroupedBars, type BarSeries, type GroupedBarsRow } from '@/components/charts/GroupedBars';
import { CHART } from '@/components/charts/chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatSignedPct } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { YoYSection } from './summaryModel';

interface YoYChartProps {
  section: YoYSection;
  unit: Unit;
}

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

function changeTone(pct: number | null): string {
  if (!isNum(pct)) return 'text-muted';
  if (pct > 0) return 'text-brand-green';
  if (pct < 0) return 'text-brand-red';
  return 'text-ink-soft';
}

export function YoYChart({ section, unit }: YoYChartProps) {
  if (!section.present) {
    return <EmptyState compact message="No prior-year and current-year medians for this selection." />;
  }

  // Reference fallback carries no bar values — show the % change strip only.
  const hasBars = section.rows.some((r) => isNum(r.prev) || isNum(r.current));

  const data: GroupedBarsRow[] = section.rows.map((r) => ({
    name: r.label,
    prev: r.prev,
    current: r.current,
  }));

  const series: BarSeries[] = [
    { key: 'prev', label: `${section.prevYear} actual`, color: CHART.bandDark },
    { key: 'current', label: `${section.currentYear} target`, color: CHART.firm },
  ];

  return (
    <div>
      {hasBars && <GroupedBars data={data} series={series} unit={unit} height={260} />}
      <div className={cn('grid grid-cols-5 gap-2', hasBars ? 'mt-4' : 'mt-1')}>
        {section.rows.map((r) => (
          <div
            key={r.level}
            className="rounded-lg border border-border bg-bg/50 px-2 py-2 text-center"
          >
            <div className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted">{r.label}</div>
            <div className={cn('mt-0.5 text-sm font-semibold tabular-nums', changeTone(r.pct))}>
              {formatSignedPct(r.pct)}
            </div>
            <div className="mt-0.5 text-[0.6rem] uppercase tracking-wide text-muted/80">YoY</div>
          </div>
        ))}
      </div>
    </div>
  );
}
