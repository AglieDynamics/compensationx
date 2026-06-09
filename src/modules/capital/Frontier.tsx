import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProvenanceChip, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { CapitalControls } from '@/components/capital/CapitalControls';
import { QuadrantScatter, type ScatterPoint } from '@/components/charts/QuadrantScatter';
import { computeFrontier, type FrontierPoint, ZONE_META, type FrontierZone } from '@/lib/capital';
import { useCapitalContext } from '@/lib/capitalContext';
import { useInputsStore } from '@/store/inputsStore';
import { formatCompaRatio, formatCount, formatGndK, formatSignedGndK } from '@/lib/format';
import { weakest, type Provenance } from '@/lib/provenance';
import { LEVELS } from '@/domain/levels';

const ZONE_BADGE: Record<FrontierZone, 'green' | 'neutral' | 'red'> = {
  PRODUCTIVITY_AHEAD: 'green',
  ALIGNED: 'neutral',
  PAY_AHEAD: 'red',
};

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

export function Frontier() {
  const ctx = useCapitalContext();
  const bases = ctx.scenarioBases ?? ctx.baseline;
  const loadIllustrativeValueData = useInputsStore((s) => s.loadIllustrativeValueData);

  const fr = useMemo(() => computeFrontier(bases, ctx.inputs), [bases, ctx.inputs]);

  // Provenance inherited from the productivity signal feeding the fit (the cards'
  // headline figures). Falls back to the weakest value-input provenance present.
  const provenance: Provenance = useMemo(() => {
    const ps = LEVELS.map((lvl) => {
      const inp = ctx.inputs[lvl];
      return inp.productivityIndex?.provenance ?? inp.valuePerHead?.provenance ?? null;
    });
    return weakest(...ps);
  }, [ctx.inputs]);

  const controls = <CapitalControls showComponent={false} />;

  // --- Empty state: no value / productivity data at all -----------------------
  if (!fr.hasValue) {
    return (
      <ModuleShell
        title="Pay-Productivity Frontier"
        subtitle="Is pay ahead of, behind, or aligned with output — fit a frontier and read each segment's gap."
        controls={controls}
      >
        <EmptyState
          title="No productivity signal yet"
          message={
            <span>
              The frontier needs value-per-head (or a productivity index) to regress pay against output.
              Load an illustrative set to explore the lens, or enter your own in{' '}
              <Link to="/capital/inputs" className="font-medium text-navy-700 underline-offset-2 hover:underline">
                Inputs &amp; Assumptions
              </Link>
              .
            </span>
          }
        />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadIllustrativeValueData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-500/30 bg-navy-500/5 px-3.5 py-2 text-sm font-medium text-navy-700 transition-colors hover:border-navy-500/50 hover:bg-navy-500/10"
          >
            <Sparkles size={14} /> Load illustrative value data
          </button>
        </div>
      </ModuleShell>
    );
  }

  // --- KPI buckets ------------------------------------------------------------
  const ahead = fr.points.filter((p) => p.zone === 'PRODUCTIVITY_AHEAD');
  const aligned = fr.points.filter((p) => p.zone === 'ALIGNED');
  const payAhead = fr.points.filter((p) => p.zone === 'PAY_AHEAD');

  const kpis: KpiItem[] = [
    {
      label: 'Productivity ahead',
      value: formatCount(ahead.length),
      sub: 'under-rewarded · flight risk',
      accent: ahead.length > 0 ? 'green' : 'default',
    },
    {
      label: 'Aligned',
      value: formatCount(aligned.length),
      sub: 'pay tracks output',
      accent: 'navy',
    },
    {
      label: 'Pay ahead',
      value: formatCount(payAhead.length),
      sub: 'spend beyond output',
      accent: payAhead.length > 0 ? 'red' : 'default',
    },
    {
      label: 'Frontier slope',
      value: isNum(fr.slope) ? formatGndK(fr.slope, 0, true) : 'n/a',
      sub: 'GND k of output per 1.00 compa',
      accent: 'navy',
    },
  ];

  // --- Fitted line + parallel band segments (only when fit is confident) ------
  const xs = fr.points.map((p) => p.x);
  const xMin = xs.length > 0 ? Math.min(...xs) : null;
  const xMax = xs.length > 0 ? Math.max(...xs) : null;
  const lineAt = (x: number): number | null =>
    isNum(fr.intercept) && isNum(fr.slope) ? fr.intercept + fr.slope * x : null;

  const y0 = isNum(xMin) ? lineAt(xMin) : null;
  const y1 = isNum(xMax) ? lineAt(xMax) : null;
  const fitLine =
    fr.fitOk && isNum(xMin) && isNum(xMax) && isNum(y0) && isNum(y1)
      ? { x0: xMin, y0, x1: xMax, y1 }
      : undefined;
  const bandLines =
    fitLine && isNum(fr.band)
      ? [
          { x0: fitLine.x0, y0: fitLine.y0 + fr.band, x1: fitLine.x1, y1: fitLine.y1 + fr.band },
          { x0: fitLine.x0, y0: fitLine.y0 - fr.band, x1: fitLine.x1, y1: fitLine.y1 - fr.band },
        ]
      : undefined;

  const scatterPoints: ScatterPoint[] = fr.points.map((p) => ({
    x: p.x,
    y: p.y,
    label: p.label,
    color: ZONE_META[p.zone].color,
  }));

  return (
    <ModuleShell
      title="Pay-Productivity Frontier"
      subtitle="Is pay ahead of, behind, or aligned with output — fit a frontier and read each segment's gap."
      controls={controls}
    >
      {provenance === 'ASSUMED' && (
        <ModeledBanner message="Productivity uses illustrative value-per-head. Enter measured value or a productivity index in Inputs & Assumptions to sharpen the fit." />
      )}

      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      <Card
        title="The frontier"
        subtitle="Pay (compa-ratio) vs productivity (value per head). The fitted line is the expected output for a given pay position; the dashed band is ±½σ of the residuals."
        right={<ProvenanceChip provenance={provenance} />}
      >
        {!fr.fitOk && (
          <p className="mb-3 rounded-lg border border-dashed border-brand-amber/50 bg-brand-amber/5 px-3 py-2 text-[0.78rem] text-[#9A7212]">
            Showing positions only — need ≥3 segments with productivity data for a confident fit and zone band.
          </p>
        )}
        <QuadrantScatter
          points={scatterPoints}
          xLabel="Pay (firm ÷ market median)"
          yLabel="Productivity (value/head, GND k)"
          fitLine={fitLine}
          bandLines={bandLines}
          xTickFormatter={(v) => formatCompaRatio(v)}
          yTickFormatter={(v) => formatGndK(v, 0, true)}
          tooltip={(p) => {
            const pt = fr.points.find((q) => q.label === p.label);
            if (!pt) return null;
            return (
              <div className="space-y-0.5 text-muted">
                <div>
                  Pay: <span className="font-semibold text-ink">{formatCompaRatio(pt.x)}× compa</span>
                </div>
                <div>
                  Productivity: <span className="font-semibold text-ink">{formatGndK(pt.y, 0, true)} GND k</span>
                </div>
                <div>
                  Expected: <span className="font-semibold text-ink">{formatGndK(pt.yhat, 0, true)} GND k</span>
                </div>
                <div>
                  Gap:{' '}
                  <span className="font-semibold" style={{ color: ZONE_META[pt.zone].color }}>
                    {formatSignedGndK(pt.gap, 0, true)} GND k
                  </span>
                </div>
                <div className="pt-0.5 text-[0.7rem]" style={{ color: ZONE_META[pt.zone].color }}>
                  {ZONE_META[pt.zone].label} — {ZONE_META[pt.zone].note}
                </div>
              </div>
            );
          }}
        />
        <ZoneLegend />
      </Card>

      <Card
        title="Gap to the frontier per segment"
        subtitle="Productivity minus expected output at each segment's pay position — coloured by zone."
      >
        {fr.fitOk ? (
          <GapBars points={fr.points} />
        ) : (
          <p className="rounded-lg border border-dashed border-brand-amber/50 bg-brand-amber/5 px-3 py-2 text-[0.78rem] text-[#9A7212]">
            Need ≥3 segments with productivity data before per-segment gaps are meaningful against the fit.
          </p>
        )}
        <p className="mt-3 text-[0.78rem] leading-relaxed text-muted">
          Bars right of centre (green) = productivity ahead of pay (under-rewarded, a flight risk). Bars
          left (red) = pay ahead of productivity (spend unsupported by output). Under-rewarded segments are
          the same ones flagged for retention investment in the{' '}
          <Link to="/capital/convexity" className="font-medium text-navy-700 underline-offset-2 hover:underline">
            Convexity
          </Link>{' '}
          and{' '}
          <Link to="/capital/cost-of-inaction" className="font-medium text-navy-700 underline-offset-2 hover:underline">
            Cost of Inaction
          </Link>{' '}
          lenses.
        </p>
      </Card>

      <Card title="Per-segment detail" subtitle="Pay position, productivity, the frontier's expected output, and the resulting gap." flush>
        <TableScroll>
          <Table caption="Pay-productivity frontier by segment">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">Level</TH>
                <TH align="right" className="border-l border-border">Compa-ratio</TH>
                <TH align="right">Productivity</TH>
                <TH align="right">Expected</TH>
                <TH align="right" className="border-l border-border">Gap</TH>
                <TH align="left" className="border-l border-border">Zone</TH>
              </TR>
            </THead>
            <TBody>
              {[...fr.points]
                .sort((a, b) => b.gap - a.gap)
                .map((p) => (
                  <TR key={p.level}>
                    <TD className="whitespace-nowrap font-medium text-ink">{p.label}</TD>
                    <TD align="right" className="border-l border-border/60 tabular-nums">{formatCompaRatio(p.x)}</TD>
                    <TD align="right" className="tabular-nums">{formatGndK(p.y, 0, true)}</TD>
                    <TD align="right" className="tabular-nums text-muted">
                      {fr.fitOk ? formatGndK(p.yhat, 0, true) : 'n/a'}
                    </TD>
                    <TD
                      align="right"
                      className="border-l border-border/60 font-semibold tabular-nums"
                      style={{ color: p.gap > 0 ? ZONE_META.PRODUCTIVITY_AHEAD.color : p.gap < 0 ? ZONE_META.PAY_AHEAD.color : undefined }}
                    >
                      {fr.fitOk ? formatSignedGndK(p.gap, 0, true) : 'n/a'}
                    </TD>
                    <TD align="left" className="border-l border-border/60">
                      {fr.fitOk ? (
                        <Badge variant={ZONE_BADGE[p.zone]} title={ZONE_META[p.zone].note}>
                          {ZONE_META[p.zone].label}
                        </Badge>
                      ) : (
                        <span className="text-[0.7rem] text-muted">—</span>
                      )}
                    </TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>

      {ahead.length > 0 && (
        <Card title="Under-rewarded segments" subtitle="Productivity ahead of pay — the flight-risk shortlist.">
          <ul className="space-y-2">
            {[...ahead]
              .sort((a, b) => b.gap - a.gap)
              .map((p) => (
                <li
                  key={p.level}
                  className="flex items-start gap-2.5 rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2"
                >
                  <ArrowRight size={15} className="mt-0.5 shrink-0 text-brand-green" />
                  <span className="text-sm text-ink-soft">
                    <span className="font-semibold text-ink">{p.label}</span> delivers{' '}
                    <span className="font-semibold text-brand-green">{formatSignedGndK(p.gap, 0, true)} GND k</span>{' '}
                    of output above what its {formatCompaRatio(p.x)}× compa-ratio pay predicts. Under-rewarded
                    relative to the frontier — a retention priority.
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </ModuleShell>
  );
}

function GapBars({ points }: { points: FrontierPoint[] }) {
  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p.gap)));
  return (
    <div className="space-y-1.5">
      {[...points]
        .sort((a, b) => b.gap - a.gap)
        .map((p) => {
          const half = (Math.abs(p.gap) / maxAbs) * 50;
          const color = ZONE_META[p.zone].color;
          const positive = p.gap >= 0;
          return (
            <div key={p.level} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3">
              <span className="truncate text-xs font-medium text-ink-soft" title={p.label}>
                {p.label}
              </span>
              <div className="relative h-5">
                <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                <div
                  className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm"
                  style={{
                    left: positive ? '50%' : `${50 - half}%`,
                    width: `${Math.max(half, 0.5)}%`,
                    background: color,
                  }}
                />
              </div>
              <span className="text-right text-xs font-semibold tabular-nums" style={{ color }}>
                {formatSignedGndK(p.gap, 0, true)}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function ZoneLegend() {
  const zones: FrontierZone[] = ['PRODUCTIVITY_AHEAD', 'ALIGNED', 'PAY_AHEAD'];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.72rem] text-muted">
      {zones.map((z) => (
        <span key={z} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ZONE_META[z].color }} />
          <span className="font-medium text-ink-soft">{ZONE_META[z].label}</span>
          <span className="text-muted/80">— {ZONE_META[z].note}</span>
        </span>
      ))}
    </div>
  );
}
