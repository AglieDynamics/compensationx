import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Unit } from '@/domain/components';
import { formatValue } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { axisTickFormatter, CHART, paddedDomain } from './chartTheme';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export interface GroupedBarsRow {
  name: string;
  [key: string]: string | number | null;
}

interface GroupedBarsProps {
  data: GroupedBarsRow[];
  series: BarSeries[];
  unit?: Unit;
  height?: number;
  includeZero?: boolean;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function GroupedBars({ data, series, unit = 'GND_K', height = 300, includeZero = true }: GroupedBarsProps) {
  const values = data.flatMap((d) => series.map((s) => d[s.key]));
  const hasData = values.some(isNum);
  if (!hasData) return <EmptyState compact message="No values to plot for this selection." />;

  const domain = paddedDomain(values as (number | null)[], { includeZero });

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barGap={3} barCategoryGap="22%">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
            <YAxis domain={domain} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={46} tickFormatter={axisTickFormatter(unit)} />
            <Tooltip cursor={{ fill: 'rgba(46,92,154,0.06)' }} content={<BarsTooltip unit={unit} series={series} />} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={46} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend series={series} />
    </div>
  );
}

export function ChartLegend({ series, className }: { series: BarSeries[]; className?: string }) {
  return (
    <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.72rem] text-muted ${className ?? ''}`}>
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string | null;
}
function BarsTooltip({
  active,
  payload,
  label,
  unit,
  series,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit: Unit;
  series: BarSeries[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      <div className="space-y-0.5">
        {payload.map((entry) => {
          const s = series.find((x) => x.key === entry.dataKey);
          const v = typeof entry.value === 'number' ? entry.value : null;
          return (
            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s?.color }} />
                {s?.label ?? entry.dataKey}
              </span>
              <span className="font-semibold tabular-nums text-ink">{formatValue(v, unit)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
