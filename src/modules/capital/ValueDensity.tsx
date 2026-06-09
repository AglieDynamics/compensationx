import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Sparkles } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProvenanceChip, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { CapitalControls } from '@/components/capital/CapitalControls';
import { QuadrantScatter, type ScatterPoint } from '@/components/charts/QuadrantScatter';
import { CHART } from '@/components/charts/chartTheme';
import {
  computeTotalCost,
  computeValueDensity,
  type Quadrant,
  QUADRANT_META,
} from '@/lib/capital';
import { useCapitalContext } from '@/lib/capitalContext';
import { useHasValueData, useInputsStore } from '@/store/inputsStore';
import { formatCount, formatGndK, formatMultiplier, formatSignedPct } from '@/lib/format';
import { weakest } from '@/lib/provenance';
import { cn } from '@/lib/cn';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Badge variant aligned to each quadrant's standing. */
const QUADRANT_VARIANT: Record<Quadrant, 'green' | 'red' | 'navy' | 'neutral'> = {
  PROTECT_INVEST: 'green',
  OPTIMIZE: 'red',
  SUSTAIN: 'navy',
  MONITOR: 'neutral',
};

const QUADRANT_ORDER: Quadrant[] = ['PROTECT_INVEST', 'SUSTAIN', 'OPTIMIZE', 'MONITOR'];

export function ValueDensity() {
  const ctx = useCapitalContext();
  const bases = ctx.scenarioBases ?? ctx.baseline;
  const hasValueData = useHasValueData();
  const loadIllustrativeValueData = useInputsStore((s) => s.loadIllustrativeValueData);

  const cost = useMemo(
    () => computeTotalCost(bases, ctx.inputs, ctx.assumptions),
    [bases, ctx.inputs, ctx.assumptions],
  );
  const vd = useMemo(
    () => computeValueDensity(bases, ctx.inputs, cost),
    [bases, ctx.inputs, cost],
  );

  // Value-per-head has no default — Lens 2 is empty until it is provided.
  if (!hasValueData || !vd.hasValue) {
    return (
      <ModuleShell
        title="Workforce Value Density"
        subtitle="Value created per unit of fully-loaded workforce cost — and where each segment lands on the pay-vs-value map."
        controls={<CapitalControls showComponent={false} />}
      >
        <Card title="Value density needs value-per-head" flush>
          <div className="px-5 py-6">
            <EmptyState
              icon={<LayoutGrid size={24} strokeWidth={1.5} />}
              title="Provide value-per-head to unlock this lens"
              message={
                <>
                  The salary survey carries pay and cost, but not the value each segment creates.
                  Value density divides value created by fully-loaded workforce cost, then maps every
                  level against its position vs market. Load an illustrative set to explore the lens,
                  or enter your own figures in Inputs &amp; Assumptions.
                </>
              }
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={loadIllustrativeValueData}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-700 px-3.5 text-[0.82rem] font-semibold text-white transition-colors hover:bg-navy-900"
              >
                <Sparkles size={14} /> Load illustrative value data
              </button>
              <Link
                to="/capital/inputs"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[0.82rem] font-medium text-ink-soft transition-colors hover:border-navy-500/40 hover:text-navy-700"
              >
                Inputs &amp; Assumptions <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Card>
      </ModuleShell>
    );
  }

  const rows = vd.rows;
  const provenance = weakest(...rows.map((r) => r.provenance));
  const allModeled = provenance === 'ASSUMED';

  // Portfolio totals — guard each term; blended density divides totals (never per-row averages).
  const totalValue = rows.reduce((a, r) => a + (isNum(r.valueCreated) ? r.valueCreated : 0), 0);
  const totalCost = rows.reduce((a, r) => a + (isNum(r.workforceCost) ? r.workforceCost : 0), 0);
  const blendedVD = totalCost > 0 ? totalValue / totalCost : null;
  const protectCount = rows.filter((r) => r.quadrant === 'PROTECT_INVEST').length;

  const kpis: KpiItem[] = [
    { label: 'Value created', value: formatGndK(totalValue, 0, true), sub: 'GND k / yr (Σ segments)', accent: 'navy' },
    { label: 'Workforce cost', value: formatGndK(totalCost, 0, true), sub: 'GND k / yr (loaded TWC)', accent: 'navy' },
    {
      label: 'Blended value density',
      value: blendedVD != null ? formatMultiplier(blendedVD, 2) : 'n/a',
      sub: 'value ÷ cost, portfolio',
      accent: 'green',
    },
    {
      label: 'Protect & Invest',
      value: formatCount(protectCount),
      sub: 'under-market, high density',
      accent: protectCount > 0 ? 'green' : 'default',
    },
  ];

  // Ranked density bars (descending). Nulls sink to the bottom.
  const ranked = [...rows].sort((a, b) => (b.valueDensity ?? -Infinity) - (a.valueDensity ?? -Infinity));
  const maxVD = Math.max(0, ...rows.map((r) => (isNum(r.valueDensity) ? r.valueDensity : 0)));

  // 2×2: x = deviation vs market (negative = under), y = value density, z = workforce cost.
  const scatterPoints: ScatterPoint[] = rows
    .filter((r) => isNum(r.deviationPct) && isNum(r.valueDensity) && r.quadrant != null)
    .map((r) => ({
      x: r.deviationPct as number,
      y: r.valueDensity as number,
      z: isNum(r.workforceCost) ? r.workforceCost : undefined,
      label: r.label,
      color: QUADRANT_META[r.quadrant as Quadrant].color,
    }));

  const ordered = QUADRANT_ORDER.flatMap((q) => {
    const seg = rows.filter((r) => r.quadrant === q);
    return seg;
  });
  const placed = new Set(ordered.map((r) => r.level));
  const unplaced = rows.filter((r) => !placed.has(r.level));
  const tableRows = [...ordered, ...unplaced];

  return (
    <ModuleShell
      title="Workforce Value Density"
      subtitle="Value created per unit of fully-loaded workforce cost — and where each segment lands on the pay-vs-value map."
      controls={<CapitalControls showComponent={false} />}
    >
      {allModeled && (
        <ModeledBanner message="Value-per-head is illustrative and cost uses default employer-contribution. Enter measured value data in Inputs & Assumptions to sharpen." />
      )}

      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Value density by level"
          subtitle="Value created per GND k of loaded cost. Higher bars return more value per pay dollar."
          right={<ProvenanceChip provenance={provenance} />}
        >
          <div className="space-y-2.5">
            {ranked.map((r) => (
              <div key={r.level} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3">
                <span className="truncate text-xs font-medium text-ink-soft">{r.label}</span>
                <div className="h-5 overflow-hidden rounded-[3px] bg-bg">
                  {isNum(r.valueDensity) && maxVD > 0 && (
                    <div
                      className="h-full rounded-[3px]"
                      style={{
                        width: `${Math.max(2, (r.valueDensity / maxVD) * 100)}%`,
                        background: r.quadrant ? QUADRANT_META[r.quadrant].color : CHART.navy700,
                      }}
                    />
                  )}
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-ink">
                  {isNum(r.valueDensity) ? formatMultiplier(r.valueDensity, 2) : 'n/a'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Strategic value map"
          subtitle="Pay position vs value density. The dashed cross splits market parity and the median density — read each quadrant as a distinct action."
          right={<ProvenanceChip provenance={provenance} />}
        >
          <QuadrantScatter
            points={scatterPoints}
            xLabel="Pay vs market (negative = under)"
            yLabel="Value density (×)"
            refX={0}
            refY={vd.medianVD ?? undefined}
            xTickFormatter={(v) => formatSignedPct(v, 0)}
            yTickFormatter={(v) => formatMultiplier(v, 1)}
            tooltip={(p) => {
              const row = rows.find((r) => r.label === p.label);
              const q = row?.quadrant ?? null;
              return (
                <div className="space-y-0.5 text-muted">
                  <div>
                    Value density: <span className="font-semibold text-ink">{formatMultiplier(p.y, 2)}</span>
                  </div>
                  <div>
                    Pay vs market: <span className="font-semibold text-ink">{formatSignedPct(p.x, 1)}</span>
                  </div>
                  {isNum(p.z) && (
                    <div>
                      Workforce cost: <span className="font-semibold text-ink">{formatGndK(p.z, 0, true)} GND k</span>
                    </div>
                  )}
                  {q && (
                    <div className="mt-1 border-t border-border/60 pt-1">
                      <span className="font-semibold" style={{ color: QUADRANT_META[q].color }}>
                        {QUADRANT_META[q].label}
                      </span>
                      <span className="text-muted"> — {QUADRANT_META[q].action}</span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <QuadrantLegend />
        </Card>
      </div>

      <Card title="Value density by segment" subtitle="Pay position, density, cost and value created, with the quadrant action for each level." flush>
        <TableScroll>
          <Table caption="Workforce value density by career level">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">Level</TH>
                <TH align="right" className="border-l border-border">Pay vs market</TH>
                <TH align="right">Value density</TH>
                <TH align="right">Workforce cost</TH>
                <TH align="right">Value created</TH>
                <TH align="left" className="border-l border-border">Quadrant</TH>
              </TR>
            </THead>
            <TBody>
              {tableRows.map((r) => {
                const isProtect = r.quadrant === 'PROTECT_INVEST';
                return (
                  <TR key={r.level} highlight={isProtect}>
                    <TD className="whitespace-nowrap font-medium text-ink">{r.label}</TD>
                    <TD
                      align="right"
                      className={cn(
                        'border-l border-border/60 tabular-nums',
                        isNum(r.deviationPct) && r.deviationPct < 0 ? 'text-brand-red' : 'text-ink',
                      )}
                    >
                      {isNum(r.deviationPct) ? formatSignedPct(r.deviationPct, 1) : 'n/a'}
                    </TD>
                    <TD align="right" className="font-semibold tabular-nums text-ink">
                      {isNum(r.valueDensity) ? formatMultiplier(r.valueDensity, 2) : 'n/a'}
                    </TD>
                    <TD align="right" className="tabular-nums">{formatGndK(r.workforceCost, 0, true)}</TD>
                    <TD align="right" className="tabular-nums">{formatGndK(r.valueCreated, 0, true)}</TD>
                    <TD align="left" className="border-l border-border/60">
                      {r.quadrant ? (
                        <Badge variant={QUADRANT_VARIANT[r.quadrant]} title={QUADRANT_META[r.quadrant].action}>
                          {QUADRANT_META[r.quadrant].label}
                        </Badge>
                      ) : (
                        <span className="text-[0.7rem] text-muted">n/a</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableScroll>
      </Card>
    </ModuleShell>
  );
}

function QuadrantLegend() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3">
      {QUADRANT_ORDER.map((q) => {
        const meta = QUADRANT_META[q];
        return (
          <div key={q} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
            <span className="text-[0.72rem] leading-snug">
              <span className="font-semibold text-ink-soft">{meta.label}</span>
              <span className="text-muted"> — {meta.action}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
