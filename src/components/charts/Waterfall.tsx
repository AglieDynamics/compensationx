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
import { formatSignedValue, formatValue } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { axisTickFormatter, CHART, paddedDomain } from './chartTheme';

export interface WaterfallStep {
  label: string;
  value: number;
  kind?: 'delta' | 'total';
}

interface WaterfallProps {
  steps: WaterfallStep[];
  unit: Unit;
  height?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

interface Row {
  name: string;
  range: [number, number];
  value: number;
  kind: 'delta' | 'total';
  fill: string;
}

function colorFor(step: WaterfallStep): string {
  if (step.kind === 'total') return step.value < 0 ? CHART.negative : CHART.navy700;
  return step.value >= 0 ? CHART.positive : CHART.negative;
}

export function Waterfall({ steps, unit, height = 300 }: WaterfallProps) {
  if (steps.length === 0 || !steps.some((s) => isNum(s.value))) {
    return <EmptyState compact message="No values to plot." />;
  }

  let running = 0;
  const rows: Row[] = steps.map((s) => {
    const v = isNum(s.value) ? s.value : 0;
    if (s.kind === 'total') {
      return { name: s.label, range: [Math.min(0, v), Math.max(0, v)], value: v, kind: 'total', fill: colorFor(s) };
    }
    const start = running;
    const end = running + v;
    running = end;
    return { name: s.label, range: [Math.min(start, end), Math.max(start, end)], value: v, kind: 'delta', fill: colorFor(s) };
  });

  const domain = paddedDomain(rows.flatMap((r) => [r.range[0], r.range[1], 0]), { padFraction: 0.12 });

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 12, bottom: 4, left: 6 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />
          <YAxis domain={domain} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={54} tickFormatter={axisTickFormatter(unit)} />
          <ReferenceLine y={0} stroke={CHART.bandDark} />
          <Tooltip
            cursor={{ fill: 'rgba(46,92,154,0.05)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0]?.payload as Row | undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
                  <div className="mb-0.5 font-semibold text-ink">{label}</div>
                  <div className="tabular-nums font-semibold" style={{ color: row.fill }}>
                    {row.kind === 'total' ? formatValue(row.value, unit) : formatSignedValue(row.value, unit)}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="range" radius={[2, 2, 0, 0]} isAnimationActive={false} maxBarSize={64}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.fill} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number | string | null | undefined) =>
                typeof v === 'number' ? formatSignedValue(v, unit, { decimals: 0, group: true }) : ''
              }
              style={{ fontSize: 10, fill: CHART.axis, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
