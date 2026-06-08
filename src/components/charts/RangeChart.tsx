import type { ReactElement } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Customized,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RagStatus } from '@/lib/benchmark';
import { formatValue } from '@/lib/format';
import type { Unit } from '@/domain/components';
import { RAG_HEX } from '@/components/ui/RagBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { axisTickFormatter, CHART, paddedDomain } from './chartTheme';

export interface RangePoint {
  name: string;
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
  firm: number | null;
  tmp: number | null;
  rag: RagStatus | null;
}

interface RangeChartProps {
  data: RangePoint[];
  unit: Unit;
  height?: number;
  targetLabel?: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type AxisScale = ((v: string | number) => number) & { bandwidth?: () => number };
interface CustomizedLayerProps {
  xAxisMap?: Record<string, { scale?: AxisScale }>;
  yAxisMap?: Record<string, { scale?: (v: number) => number }>;
  offset?: { left: number; top: number; width: number; height: number };
}

export function RangeChart({ data, unit, height = 360, targetLabel = 'target' }: RangeChartProps) {
  const hasData = data.some(
    (d) => isNum(d.min) || isNum(d.max) || isNum(d.median) || isNum(d.firm) || isNum(d.tmp),
  );
  if (!hasData) {
    return <EmptyState compact message="No values to plot for this selection." />;
  }

  const allValues = data.flatMap((d) => [d.min, d.q1, d.median, d.q3, d.max, d.firm, d.tmp]);
  const domain = paddedDomain(allValues, { padFraction: 0.1 });
  const rotate = data.length > 8;

  // Draws market box / whisker / median, aligned to Recharts' own x scale.
  const MarketRangeLayer = (props: CustomizedLayerProps): ReactElement => {
    const xScale = props.xAxisMap ? Object.values(props.xAxisMap)[0]?.scale : undefined;
    const yScale = props.yAxisMap ? Object.values(props.yAxisMap)[0]?.scale : undefined;
    const offset = props.offset;
    if (!xScale || !yScale || !offset || data.length === 0) return <g />;

    const band = typeof xScale.bandwidth === 'function' ? xScale.bandwidth() : 0;
    const step = band > 0 ? band : offset.width / data.length;
    const boxW = Math.min(step * 0.5, 30);

    return (
      <g>
        {data.map((d) => {
          const cx = xScale(d.name) + band / 2;
          if (!Number.isFinite(cx)) return null;
          const yOf = (v: number | null): number | null => (isNum(v) ? yScale(v) : null);
          const yMin = yOf(d.min);
          const yMax = yOf(d.max);
          const yQ1 = yOf(d.q1);
          const yQ3 = yOf(d.q3);
          const yMed = yOf(d.median);
          const capW = boxW * 0.32;
          return (
            <g key={d.name}>
              {yMin != null && yMax != null && (
                <>
                  <line x1={cx} x2={cx} y1={yMax} y2={yMin} stroke={CHART.bandDark} strokeWidth={1.25} />
                  <line x1={cx - capW} x2={cx + capW} y1={yMax} y2={yMax} stroke={CHART.bandDark} strokeWidth={1.25} />
                  <line x1={cx - capW} x2={cx + capW} y1={yMin} y2={yMin} stroke={CHART.bandDark} strokeWidth={1.25} />
                </>
              )}
              {yQ1 != null && yQ3 != null && (
                <rect
                  x={cx - boxW / 2}
                  y={Math.min(yQ1, yQ3)}
                  width={boxW}
                  height={Math.max(Math.abs(yQ1 - yQ3), 0.5)}
                  fill={CHART.bandLight}
                  stroke={CHART.bandDark}
                  strokeWidth={1}
                  rx={1.5}
                />
              )}
              {yMed != null && (
                <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMed} y2={yMed} stroke={CHART.navy700} strokeWidth={2} />
              )}
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: rotate ? 28 : 8, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: rotate ? 10 : 11, fill: CHART.axis }}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              padding={{ left: 22, right: 22 }}
              interval={0}
              angle={rotate ? -35 : 0}
              textAnchor={rotate ? 'end' : 'middle'}
              height={rotate ? 48 : 24}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 11, fill: CHART.axis }}
              tickLine={false}
              axisLine={false}
              width={46}
              tickFormatter={axisTickFormatter(unit)}
            />
            <Tooltip
              cursor={{ stroke: CHART.bandDark, strokeDasharray: '3 3' }}
              content={<RangeTooltip unit={unit} targetLabel={targetLabel} />}
            />
            <Customized component={MarketRangeLayer} />
            <Line
              type="linear"
              dataKey="tmp"
              stroke={CHART.tmp}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
              name={`Target (${targetLabel})`}
            />
            <Line
              type="linear"
              dataKey="firm"
              stroke={CHART.firm}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
              name="Your Firm median"
              dot={(p: { cx?: number; cy?: number; index?: number; payload?: RangePoint }) => {
                const { cx, cy, payload, index } = p;
                if (cx == null || cy == null || !payload || !isNum(payload.firm)) {
                  return <g key={`fd-${index ?? 0}`} />;
                }
                const color = payload.rag ? RAG_HEX[payload.rag] : CHART.firm;
                return (
                  <circle
                    key={`fd-${index ?? 0}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <RangeLegend unit={unit} targetLabel={targetLabel} />
    </div>
  );
}

function RangeLegend({ unit, targetLabel }: { unit: Unit; targetLabel: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[0.72rem] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 rounded-[2px] border" style={{ background: CHART.bandLight, borderColor: CHART.bandDark }} />
        Market 25th–75th
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-[2px]" style={{ background: CHART.bandDark }} />
        Min–Max range
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: CHART.navy700 }} />
        Market median
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: CHART.firm }} />
        <span className="inline-block -ml-3 h-2 w-2 rounded-full" style={{ background: CHART.firm }} />
        Your Firm median
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: CHART.tmp }} />
        Target ({targetLabel})
      </span>
      <span className="ml-auto font-medium text-muted/80">Units: {unit === 'RATIO' ? '%' : 'GND k'}</span>
    </div>
  );
}

interface TooltipPayloadItem {
  payload?: RangePoint;
}
function RangeTooltip({
  active,
  payload,
  label,
  unit,
  targetLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  unit: Unit;
  targetLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const row = (k: string, v: number | null, color?: string) => (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-1.5 text-muted">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
        {k}
      </span>
      <span className="font-semibold tabular-nums text-ink">{formatValue(v, unit)}</span>
    </div>
  );
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      <div className="space-y-0.5">
        {row('Market max (95th)', p.max)}
        {row('Market median', p.median, CHART.navy700)}
        {row('Market min (5th)', p.min)}
        {row('Your Firm', p.firm, CHART.firm)}
        {row(`Target (${targetLabel})`, p.tmp, CHART.tmp)}
      </div>
    </div>
  );
}
