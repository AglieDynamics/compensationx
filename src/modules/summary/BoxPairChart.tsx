/**
 * Compact paired box display: TARGET vs ACTUAL market five-number summary per
 * career level. Deterministic CSS/SVG geometry on a shared linear scale so the
 * two periods are visually comparable. No animation, no random, no time reads.
 *
 * Box = 25th–75th, whisker = 5th–95th, tick = median. Values come pre-computed
 * via quartileBox(); this component only positions and labels them.
 */

import type { ReactNode } from 'react';
import type { Unit } from '@/domain/components';
import { CHART } from '@/components/charts/chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatValue } from '@/lib/format';
import { PERIOD_YEARS } from '@/domain/components';
import type { BoxPairRow } from './summaryModel';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

interface BoxPairChartProps {
  rows: BoxPairRow[];
  unit: Unit;
}

const PERIOD_STYLE = {
  target: { fill: CHART.bandLight, stroke: CHART.bandDark, median: CHART.navy700, label: `${PERIOD_YEARS.TARGET} target` },
  actual: { fill: '#EAEDF2', stroke: '#B4BBC8', median: CHART.firm, label: `${PERIOD_YEARS.ACTUAL} actual` },
} as const;

/** A single horizontal box-and-whisker rendered as positioned SVG on [0,1]. */
function MiniBox({
  box,
  domain,
  variant,
}: {
  box: BoxPairRow['target'];
  domain: [number, number];
  variant: 'target' | 'actual';
}) {
  const style = PERIOD_STYLE[variant];
  const [lo, hi] = domain;
  const span = hi - lo;
  const pos = (v: number): number => (span > 0 ? ((v - lo) / span) * 100 : 50);

  const { min, q1, median, q3, max } = box;
  const whisker = isNum(min) && isNum(max) ? { x1: pos(min), x2: pos(max) } : null;
  const rect =
    isNum(q1) && isNum(q3)
      ? { x: Math.min(pos(q1), pos(q3)), width: Math.max(Math.abs(pos(q3) - pos(q1)), 0.4) }
      : null;
  const medianX = isNum(median) ? pos(median) : null;

  if (!whisker && !rect && medianX == null) {
    return <div className="h-7 w-full" aria-hidden />;
  }

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full overflow-visible">
      {whisker && (
        <>
          <line x1={whisker.x1} x2={whisker.x2} y1={14} y2={14} stroke={style.stroke} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          <line x1={whisker.x1} x2={whisker.x1} y1={8} y2={20} stroke={style.stroke} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          <line x1={whisker.x2} x2={whisker.x2} y1={8} y2={20} stroke={style.stroke} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        </>
      )}
      {rect && (
        <rect
          x={rect.x}
          y={5}
          width={rect.width}
          height={18}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {medianX != null && (
        <line x1={medianX} x2={medianX} y1={4} y2={24} stroke={style.median} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

export function BoxPairChart({ rows, unit }: BoxPairChartProps) {
  const all = rows.flatMap((r) => [
    r.target.min, r.target.q1, r.target.median, r.target.q3, r.target.max,
    r.actual.min, r.actual.q1, r.actual.median, r.actual.q3, r.actual.max,
  ]);
  const nums = all.filter(isNum);
  if (nums.length === 0) {
    return <EmptyState compact message="No values to plot for this selection." />;
  }
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  const domain: [number, number] = [lo, hi];

  return (
    <div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.level} className="grid grid-cols-[5rem_1fr] items-center gap-3">
            <span className="text-xs font-semibold text-ink-soft">{r.label}</span>
            <div className="space-y-1.5">
              <BoxRow label="Tgt" box={r.target} domain={domain} unit={unit} variant="target" />
              <BoxRow label="Act" box={r.actual} domain={domain} unit={unit} variant="actual" />
            </div>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}

function BoxRow({
  label,
  box,
  domain,
  unit,
  variant,
}: {
  label: string;
  box: BoxPairRow['target'];
  domain: [number, number];
  unit: Unit;
  variant: 'target' | 'actual';
}) {
  return (
    <div className="grid grid-cols-[2.2rem_1fr_4.5rem] items-center gap-2">
      <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <MiniBox box={box} domain={domain} variant={variant} />
      <span className="text-right text-[0.7rem] tabular-nums text-ink-soft">
        {formatValue(box.median, unit)}
      </span>
    </div>
  );
}

function LegendItem({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.7rem] text-muted">
      <LegendItem
        swatch={
          <span
            className="inline-block h-3 w-4 rounded-[2px] border"
            style={{ background: PERIOD_STYLE.target.fill, borderColor: PERIOD_STYLE.target.stroke }}
          />
        }
      >
        {PERIOD_STYLE.target.label}
      </LegendItem>
      <LegendItem
        swatch={
          <span
            className="inline-block h-3 w-4 rounded-[2px] border"
            style={{ background: PERIOD_STYLE.actual.fill, borderColor: PERIOD_STYLE.actual.stroke }}
          />
        }
      >
        {PERIOD_STYLE.actual.label}
      </LegendItem>
      <LegendItem swatch={<span className="inline-block h-3 w-[2px]" style={{ background: CHART.navy700 }} />}>
        Median
      </LegendItem>
      <LegendItem swatch={<span className="inline-block h-3 w-[2px]" style={{ background: CHART.bandDark }} />}>
        5th–95th range
      </LegendItem>
      <span className="ml-auto font-medium text-muted/80">Box: 25th–75th</span>
    </div>
  );
}
