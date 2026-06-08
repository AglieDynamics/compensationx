import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Unit } from '@/domain/components';
import { formatSignedValue } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { axisTickFormatter, CHART, paddedDomain } from './chartTheme';

export interface DivergingRow {
  name: string;
  value: number | null;
}

interface DivergingBarsProps {
  data: DivergingRow[];
  unit: Unit;
  height?: number;
  showLabels?: boolean;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function DivergingBars({ data, unit, height = 300, showLabels = true }: DivergingBarsProps) {
  const values = data.map((d) => d.value);
  if (!values.some(isNum)) return <EmptyState compact message="No values to plot for this selection." />;

  const domain = paddedDomain(values, { includeZero: true, padFraction: 0.14 });

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
            <YAxis domain={domain} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={52} tickFormatter={axisTickFormatter(unit)} />
            <ReferenceLine y={0} stroke={CHART.bandDark} strokeWidth={1} />
            <Tooltip cursor={{ fill: 'rgba(46,92,154,0.06)' }} content={<DivergingTooltip unit={unit} />} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={56}>
              {data.map((d, i) => (
                // Negative = saving (green); positive = increase / cost (navy) — matches the budget headline + table.
                <Cell key={i} fill={isNum(d.value) && d.value < 0 ? CHART.positive : CHART.firm} />
              ))}
              {showLabels && (
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: number | string | null | undefined) =>
                    typeof v === 'number' ? formatSignedValue(v, unit, { decimals: 0 }) : ''
                  }
                  style={{ fontSize: 10, fill: CHART.axis, fontWeight: 600 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.72rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART.firm }} />
          Increase (raise to target)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART.positive }} />
          Saving (above target)
        </span>
        <span className="ml-auto font-medium text-muted/80">Units: {unit === 'RATIO' ? '%' : 'GND k'}</span>
      </div>
    </div>
  );
}

interface TooltipEntry {
  value?: number | string | null;
}
function DivergingTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit: Unit;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const v = typeof payload[0]?.value === 'number' ? (payload[0]?.value as number) : null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
      <div className="mb-0.5 font-semibold text-ink">{label}</div>
      <div className="tabular-nums font-semibold" style={{ color: v != null && v < 0 ? CHART.positive : CHART.firm }}>
        {formatSignedValue(v, unit)}
      </div>
    </div>
  );
}
