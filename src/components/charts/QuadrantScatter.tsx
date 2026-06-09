import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHART, paddedDomain } from './chartTheme';

export interface ScatterPoint {
  x: number;
  y: number;
  z?: number;
  label: string;
  color: string;
  meta?: ReactNode;
}

interface QuadrantScatterProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  refX?: number;
  refY?: number;
  /** Fitted line drawn as a segment across the x-range. */
  fitLine?: { x0: number; y0: number; x1: number; y1: number };
  bandLines?: { x0: number; y0: number; x1: number; y1: number }[];
  xTickFormatter?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  tooltip?: (p: ScatterPoint) => ReactNode;
  height?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function QuadrantScatter({
  points,
  xLabel,
  yLabel,
  refX,
  refY,
  fitLine,
  bandLines,
  xTickFormatter,
  yTickFormatter,
  tooltip,
  height = 340,
}: QuadrantScatterProps) {
  const valid = points.filter((p) => isNum(p.x) && isNum(p.y));
  if (valid.length === 0) return <EmptyState compact message="No points to plot for this selection." />;

  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  if (isNum(refX)) xs.push(refX);
  if (isNum(refY)) ys.push(refY);
  const xDomain = paddedDomain(xs, { padFraction: 0.14 });
  const yDomain = paddedDomain(ys, { padFraction: 0.16 });
  const zs = valid.map((p) => p.z).filter(isNum);
  const hasZ = zs.length > 0;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 18, bottom: 22, left: 8 }}>
          <CartesianGrid stroke={CHART.grid} />
          <XAxis
            type="number"
            dataKey="x"
            domain={xDomain}
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            tickFormatter={xTickFormatter}
            label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11, fill: CHART.axis }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={yDomain}
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={yTickFormatter}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: CHART.axis, style: { textAnchor: 'middle' } }}
          />
          {hasZ && <ZAxis type="number" dataKey="z" range={[80, 620]} />}
          {isNum(refX) && <ReferenceLine x={refX} stroke={CHART.bandDark} strokeDasharray="4 3" />}
          {isNum(refY) && <ReferenceLine y={refY} stroke={CHART.bandDark} strokeDasharray="4 3" />}
          {bandLines?.map((b, i) => (
            <ReferenceLine
              key={`band-${i}`}
              segment={[{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y1 }]}
              stroke={CHART.bandDark}
              strokeDasharray="3 4"
              ifOverflow="extendDomain"
            />
          ))}
          {fitLine && (
            <ReferenceLine
              segment={[{ x: fitLine.x0, y: fitLine.y0 }, { x: fitLine.x1, y: fitLine.y1 }]}
              stroke={CHART.navy700}
              strokeWidth={1.75}
              ifOverflow="extendDomain"
            />
          )}
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: CHART.bandDark }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0]?.payload as ScatterPoint | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
                  <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-ink">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </div>
                  {tooltip ? tooltip(p) : <div className="text-muted">{p.meta}</div>}
                </div>
              );
            }}
          />
          <Scatter
            data={valid}
            isAnimationActive={false}
            shape={(props: { cx?: number; cy?: number; payload?: ScatterPoint; size?: number }) => {
              const { cx, cy, payload } = props;
              if (cx == null || cy == null || !payload) return <g />;
              const r = hasZ && isNum(payload.z) ? Math.max(5, Math.sqrt((props.size ?? 120) / Math.PI)) : 6;
              return <circle cx={cx} cy={cy} r={r} fill={payload.color} fillOpacity={0.78} stroke="#fff" strokeWidth={1.25} />;
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
