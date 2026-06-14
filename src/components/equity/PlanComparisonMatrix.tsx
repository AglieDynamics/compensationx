/**
 * Side-by-side plan comparison: a per-dimension heatmap plus a FAIR radar
 * overlaying the selected plans against a "strong-design" reference ring — the
 * incentive-design analogue of the app's Your-Firm-vs-Market overlays.
 */

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { EquityPlanDefinition } from '@/domain/equityPlan';
import { comparePlans, fairRadarData } from '@/lib/equityScoring';
import { CHART } from '@/components/charts/chartTheme';
import { cn } from '@/lib/cn';

/** Distinct series colors for up to MAX_COMPARE plans. */
const SERIES = [CHART.firm, CHART.amber, CHART.green, CHART.navy900];

/** "Strong design" reference: every FAIR axis at 4/5, tagged Assumed in the UI. */
const REFERENCE_SCORE = 4;

function heatColor(normalized: number, direction: 'high' | 'context'): string {
  // 'high' = green ramp (more is better); 'context' = neutral navy ramp.
  const base = direction === 'high' ? '46, 139, 87' : '46, 92, 154';
  const alpha = 0.12 + 0.6 * Math.max(0, Math.min(1, normalized));
  return `rgba(${base}, ${alpha.toFixed(3)})`;
}

export function PlanComparisonMatrix({ plans }: { plans: EquityPlanDefinition[] }) {
  const comparison = comparePlans(plans);
  const radar = fairRadarData(plans);
  const planById = new Map(plans.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* Heatmap */}
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[0.78rem]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold text-muted">Dimension</th>
                {plans.map((p, i) => (
                  <th key={p.id} className="px-2 py-2 text-center font-semibold text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                      <span className="max-w-[7.5rem] truncate" title={p.name}>{p.name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.dimension.key}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium text-ink-soft">
                    {row.dimension.label}
                  </td>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.planId}
                      className="px-2 py-1.5 text-center tabular-nums text-ink"
                      style={{ background: heatColor(cell.normalized, row.dimension.direction) }}
                    >
                      {cell.raw}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[0.7rem] text-muted">
            Each cell is the dimension score on a 1–5 scale; greener = stronger design, navy = neutral context.
          </p>
        </div>

        {/* FAIR radar */}
        <div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                <PolarGrid stroke={CHART.grid} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: CHART.axis }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10, fill: CHART.axis }} tickCount={6} />
                {plans.map((p, i) => (
                  <Radar
                    key={p.id}
                    name={p.name}
                    dataKey={p.id}
                    stroke={SERIES[i % SERIES.length]}
                    fill={SERIES[i % SERIES.length]}
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                ))}
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.72rem] shadow-pop">
                        <div className="mb-1 font-semibold text-ink">{String(label)}</div>
                        {payload.map((entry) => {
                          const id = String(entry.dataKey);
                          return (
                            <div key={id} className="flex items-center gap-1.5 text-muted">
                              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                              <span className="text-ink-soft">{planById.get(id)?.name ?? id}</span>
                              <span className="ml-auto font-semibold tabular-nums text-ink">{String(entry.value)}/5</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[0.7rem] text-muted">
            FAIR axes, 0–5. A strong design clears {REFERENCE_SCORE}/5 on every axis.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Compact legend chip used above the matrix. */
export function SeriesLegend({ plans }: { plans: EquityPlanDefinition[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {plans.map((p, i) => (
        <span key={p.id} className={cn('inline-flex items-center gap-1.5 text-[0.76rem] text-ink-soft')}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
          {p.name}
        </span>
      ))}
    </div>
  );
}
