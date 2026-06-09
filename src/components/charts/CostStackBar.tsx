import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Unit } from '@/domain/components';
import { formatValue } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartLegend, type BarSeries } from './GroupedBars';
import { axisTickFormatter, CHART, paddedDomain } from './chartTheme';

export interface CostStackRowData {
  name: string;
  [key: string]: string | number | null;
}

interface CostStackBarProps {
  data: CostStackRowData[];
  layers: BarSeries[];
  unit: Unit;
  height?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Stacked cost-stack bar per segment (Base → … → Total Workforce Cost). */
export function CostStackBar({ data, layers, unit, height = 320 }: CostStackBarProps) {
  const totals = data.map((d) => layers.reduce((a, l) => a + (isNum(d[l.key]) ? (d[l.key] as number) : 0), 0));
  if (!totals.some((t) => t > 0)) return <EmptyState compact message="No cost data to plot." />;

  const domain = paddedDomain([...totals, 0], { includeZero: true });

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 6 }} barCategoryGap="26%">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
            <YAxis domain={domain} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={50} tickFormatter={axisTickFormatter(unit)} />
            <Tooltip
              cursor={{ fill: 'rgba(46,92,154,0.05)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                let total = 0;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
                    <div className="mb-1 font-semibold text-ink">{label}</div>
                    <div className="space-y-0.5">
                      {payload
                        .slice()
                        .reverse()
                        .map((entry) => {
                          const l = layers.find((x) => x.key === entry.dataKey);
                          const val = typeof entry.value === 'number' ? entry.value : 0;
                          total += val;
                          if (val === 0) return null;
                          return (
                            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-6">
                              <span className="flex items-center gap-1.5 text-muted">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ background: l?.color }} />
                                {l?.label ?? entry.dataKey}
                              </span>
                              <span className="font-semibold tabular-nums text-ink">{formatValue(val, unit)}</span>
                            </div>
                          );
                        })}
                      <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1">
                        <span className="font-semibold text-ink">Total</span>
                        <span className="font-semibold tabular-nums text-ink">{formatValue(total, unit)}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {layers.map((l, i) => (
              <Bar
                key={l.key}
                dataKey={l.key}
                name={l.label}
                stackId="cost"
                fill={l.color}
                isAnimationActive={false}
                maxBarSize={58}
                radius={i === layers.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend series={layers} />
    </div>
  );
}
