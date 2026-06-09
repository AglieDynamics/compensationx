import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { ProvenanceChip, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { CapitalControls } from '@/components/capital/CapitalControls';
import { QuadrantScatter, type ScatterPoint } from '@/components/charts/QuadrantScatter';
import { CHART } from '@/components/charts/chartTheme';
import {
  attrition,
  computeConvexity,
  retentionCurve,
  retentionParams,
  type SegmentBase,
  valueAtRisk,
} from '@/lib/capital';
import { marketValueAtPercentile } from '@/lib/benchmark';
import type { ResolvedInputsByLevel } from '@/lib/assumptions';
import type { GlobalAssumptions } from '@/lib/assumptions';
import { useCapitalContext } from '@/lib/capitalContext';
import { formatCount, formatGndK, formatPercentileLabel, formatPct } from '@/lib/format';
import { weakest } from '@/lib/provenance';
import { cn } from '@/lib/cn';

interface ActionRow {
  level: string;
  label: string;
  payCost: number | null;
  valueProtected: number | null;
  roi: number | null;
  headcount: number;
  color: string;
}

function buildActions(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
  targetPercentile: number,
): ActionRow[] {
  const rp = retentionParams(assumptions);
  return bases.map((b) => {
    const inp = inputs[b.level];
    const tmp = b.percentiles ? marketValueAtPercentile(b.percentiles, targetPercentile) : null;
    const var_ = valueAtRisk(b.costPerHead, inp);
    const aNow = b.position != null ? attrition(b.position, inp.baselineAttritionPct.value, rp) : null;
    const aTarget = attrition(targetPercentile, inp.baselineAttritionPct.value, rp);
    const payCost = tmp != null && b.firmMedian != null ? (tmp - b.firmMedian) * b.incumbents : null;
    const valueProtected =
      aNow != null && aTarget != null && var_.value != null
        ? Math.max(0, aNow - aTarget) * b.incumbents * var_.value
        : null;
    const roi = payCost != null && payCost > 0 && valueProtected != null ? valueProtected / payCost : null;
    return {
      level: b.level,
      label: b.label,
      payCost,
      valueProtected,
      roi,
      headcount: b.incumbents,
      color: b.position != null && b.position < assumptions.retentionP0 ? CHART.firm : CHART.bandDark,
    };
  });
}

export function Convexity() {
  const ctx = useCapitalContext();
  const bases = ctx.scenarioBases ?? ctx.baseline;
  const rows = useMemo(
    () => computeConvexity(bases, ctx.inputs, ctx.assumptions),
    [bases, ctx.inputs, ctx.assumptions],
  );
  const actions = useMemo(
    () => buildActions(bases, ctx.inputs, ctx.assumptions, ctx.targetPercentile),
    [bases, ctx.inputs, ctx.assumptions, ctx.targetPercentile],
  );

  const curve = useMemo(() => retentionCurve(ctx.assumptions).map((d) => ({ p: d.p, r: d.r })), [ctx.assumptions]);
  const markers = rows
    .filter((r) => r.position != null && r.retention != null)
    .map((r) => ({ p: r.position as number, r: r.retention as number, label: r.label, below: r.belowInflection }));

  const ranked = [...rows].sort((a, b) => (b.coi ?? 0) - (a.coi ?? 0));
  const top = ranked.find((r) => r.coi != null) ?? null;
  const provenance = weakest(...rows.map((r) => r.provenance));
  const maxCoi = Math.max(1, ...rows.map((r) => r.coi ?? 0));

  const scatterPoints: ScatterPoint[] = actions
    .filter((a) => a.payCost != null && a.valueProtected != null)
    .map((a) => ({ x: a.payCost as number, y: a.valueProtected as number, z: a.headcount, label: a.label, color: a.color }));

  return (
    <ModuleShell
      title="Human Capital Convexity"
      subtitle="Where small pay moves unlock outsized retention value — sequence investment by marginal ROI."
      controls={<CapitalControls showTargetPercentile />}
    >
      {provenance === 'ASSUMED' && <ModeledBanner message="Retention, attrition and value-at-risk use Appendix-A defaults. Enter attrition / value-per-head to sharpen." />}

      {top && (
        <Card title="Next best pay dollar" subtitle="Highest marginal return on pay across the workforce.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-500/10 text-navy-700">
                <TrendingUp size={18} />
              </span>
              <div>
                <div className="text-lg font-semibold text-ink">{top.label}</div>
                <div className="text-xs text-muted">
                  {top.belowInflection ? 'Below the inflection — accelerating returns' : 'Above the inflection'} · COI{' '}
                  <span className="font-semibold text-navy-700">{Math.round(top.coi ?? 0)}</span>/100
                </div>
              </div>
            </div>
            {(() => {
              const a = actions.find((x) => x.level === top.level);
              if (!a) return null;
              return (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <Stat label="Pay to target" value={`${formatGndK(a.payCost, 0, true)} GND k`} />
                  <Stat label="Value protected" value={`${formatGndK(a.valueProtected, 0, true)} GND k`} tone="green" />
                  <Stat label="Protection ROI" value={a.roi != null ? `${formatGndK(a.roi, 1)}×` : '—'} tone="green" />
                </div>
              );
            })()}
            <ProvenanceChip provenance={top.provenance} className="ml-auto" />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Retention vs pay percentile" subtitle="Logistic response with the inflection band; each level marked at its current position.">
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curve} margin={{ top: 12, right: 16, bottom: 18, left: 4 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis type="number" dataKey="p" domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}`} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} label={{ value: 'Pay percentile', position: 'insideBottom', offset: -10, fontSize: 11, fill: CHART.axis }} />
                <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={42} />
                <ReferenceLine x={ctx.assumptions.retentionP0} stroke={CHART.amber} strokeDasharray="4 3" label={{ value: 'inflection', position: 'top', fontSize: 10, fill: '#9A7212' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const pt = payload[0]?.payload as { p: number; r: number; label?: string } | undefined;
                    if (!pt) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
                        {pt.label && <div className="mb-0.5 font-semibold text-ink">{pt.label}</div>}
                        <div className="text-muted">Pay {formatPercentileLabel(pt.p)} · retention <span className="font-semibold text-ink">{formatPct(pt.r, 0)}</span></div>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="r" stroke={CHART.firm} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Scatter
                  data={markers}
                  dataKey="r"
                  isAnimationActive={false}
                  shape={(props: { cx?: number; cy?: number; payload?: { below?: boolean } }) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null) return <g />;
                    return <circle cx={cx} cy={cy} r={5} fill={payload?.below ? CHART.firm : CHART.bandDark} stroke="#fff" strokeWidth={1.5} />;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Convexity Opportunity Index" subtitle="Marginal retention return × value-at-risk × headcount, boosted below the inflection. Ranked 0–100." right={<ProvenanceChip provenance={provenance} />}>
          <div className="space-y-2">
            {ranked.map((r) => (
              <div key={r.level} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                  {r.label}
                  {r.belowInflection && <span className="h-1.5 w-1.5 rounded-full bg-navy-500" title="Below inflection" />}
                </span>
                <div className="h-5 overflow-hidden rounded-[3px] bg-bg">
                  <div className="h-full rounded-[3px]" style={{ width: `${((r.coi ?? 0) / maxCoi) * 100}%`, background: r.belowInflection ? CHART.firm : CHART.bandDark }} />
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-ink">{r.coi != null ? Math.round(r.coi) : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Protection ROI" subtitle="Pay investment to reach the target percentile vs value-at-risk protected. Bubble = headcount.">
        <QuadrantScatter
          points={scatterPoints}
          xLabel="Pay investment to target (GND k)"
          yLabel="Value-at-risk protected (GND k)"
          refX={0}
          xTickFormatter={(v) => formatGndK(v, 0, true)}
          yTickFormatter={(v) => formatGndK(v, 0, true)}
          tooltip={(p) => (
            <div className="space-y-0.5 text-muted">
              <div>Pay to target: <span className="font-semibold text-ink">{formatGndK(p.x, 0, true)} GND k</span></div>
              <div>Value protected: <span className="font-semibold text-ink">{formatGndK(p.y, 0, true)} GND k</span></div>
              <div>Headcount: <span className="font-semibold text-ink">{formatCount(p.z ?? 0)}</span></div>
            </div>
          )}
        />
      </Card>
    </ModuleShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <div>
      <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums', tone === 'green' ? 'text-brand-green' : 'text-ink')}>{value}</div>
    </div>
  );
}
