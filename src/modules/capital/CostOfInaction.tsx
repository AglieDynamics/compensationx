import { useMemo, useState } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Select } from '@/components/ui/Select';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ProvenanceChip, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { CapitalControls, CoiHorizonControl } from '@/components/capital/CapitalControls';
import { Waterfall, type WaterfallStep } from '@/components/charts/Waterfall';
import { Tornado } from '@/components/charts/Tornado';
import { CHART } from '@/components/charts/chartTheme';
import { coiTornado, computeCostOfInaction } from '@/lib/capital';
import { marketValueAtPercentile } from '@/lib/benchmark';
import { useCapitalContext } from '@/lib/capitalContext';
import { formatGndK, formatPercentileLabel, formatSignedGndK } from '@/lib/format';
import { weakest } from '@/lib/provenance';

export function CostOfInaction() {
  const ctx = useCapitalContext();
  const bases = ctx.scenarioBases ?? ctx.baseline;
  const res = useMemo(
    () => computeCostOfInaction(bases, ctx.inputs, ctx.assumptions, ctx.coiOpts),
    [bases, ctx.inputs, ctx.assumptions, ctx.coiOpts],
  );
  const tornado = useMemo(
    () => coiTornado(bases, ctx.inputs, ctx.assumptions, ctx.coiOpts),
    [bases, ctx.inputs, ctx.assumptions, ctx.coiOpts],
  );

  const presentBudget = useMemo(
    () =>
      ctx.baseline.reduce((a, b) => {
        const tmp = b.percentiles ? marketValueAtPercentile(b.percentiles, ctx.targetPercentile) : null;
        return a + (tmp != null && b.firmMedian != null ? (tmp - b.firmMedian) * b.incumbents : 0);
      }, 0),
    [ctx.baseline, ctx.targetPercentile],
  );

  const under = res.segments.filter((s) => s.underMarket);
  const provenance = weakest(...under.map((s) => s.provenance));
  const H = ctx.assumptions.coiHorizon;

  const [sel, setSel] = useState<string>('');
  const defaultSel = useMemo(
    () => [...under].sort((a, b) => (b.totalLeakage ?? 0) - (a.totalLeakage ?? 0))[0]?.level ?? '',
    [under],
  );
  // Clamp to a currently-under-market option: a percentile/scenario change can
  // drop the previously-picked level out of the (under-market-only) options,
  // which would otherwise leave the selector pointing at a stale/blank value.
  const selectedLevel = under.some((s) => s.level === sel) ? sel : defaultSel;
  const selected = res.segments.find((s) => s.level === selectedLevel) ?? null;

  const steps: WaterfallStep[] = selected
    ? [
        { label: 'Saving', value: selected.presentSaving ?? 0, kind: 'delta' },
        { label: 'Attrition', value: -(selected.attritionLeakage ?? 0) },
        { label: 'Productivity', value: -(selected.productivityDrag ?? 0) },
        { label: 'Catch-up', value: -(selected.catchUpPremium ?? 0) },
        { label: 'Net', value: selected.net ?? 0, kind: 'total' },
      ]
    : [];

  const maxLeak = Math.max(1, ...under.map((s) => s.totalLeakage ?? 0));

  const kpis: KpiItem[] = [
    { label: 'Present budget', value: `${formatSignedGndK(presentBudget, 0, true)}`, sub: `GND k · vs ${formatPercentileLabel(ctx.targetPercentile)} (v1)`, accent: 'navy' },
    { label: `Under-market saving`, value: `${formatGndK(res.totalPresentSaving, 0, true)}`, sub: 'GND k not spent', accent: 'amber' },
    { label: `${H}-yr leakage`, value: `${formatGndK(res.totalLeakage, 0, true)}`, sub: 'attrition + drag + catch-up', accent: 'red' },
    { label: 'Net position', value: `${formatSignedGndK(res.net, 0, true)}`, sub: res.net < 0 ? 'value destruction' : 'net retained', accent: res.net < 0 ? 'red' : 'green' },
  ];

  return (
    <ModuleShell
      title="Cost of Inaction"
      subtitle="Under-market positioning reframed as compounding future leakage — the temporal counterpart to the Budget Simulator."
      controls={
        <>
          <CapitalControls showTargetPercentile />
          <CoiHorizonControl />
        </>
      }
    >
      {provenance === 'ASSUMED' && <ModeledBanner message="Leakage uses default attrition, replacement-cost and inflation assumptions. Add data in Inputs & Assumptions to sharpen." />}

      <Card title="The reframe" subtitle="What looks like a present saving leaks more over time.">
        <p className="text-sm leading-relaxed text-ink-soft">
          The present budget position is{' '}
          <span className="font-semibold text-navy-700">{formatSignedGndK(presentBudget, 0, true)} GND&nbsp;k</span> vs the{' '}
          {formatPercentileLabel(ctx.targetPercentile)} market. But under-market segments are quietly{' '}
          &ldquo;saving&rdquo; <span className="font-semibold text-[#9A7212]">{formatGndK(res.totalPresentSaving, 0, true)} GND&nbsp;k</span> that leaks{' '}
          <span className="font-semibold text-brand-red">{formatGndK(res.totalLeakage, 0, true)} GND&nbsp;k</span> over {H} year{H === 1 ? '' : 's'} —{' '}
          a net{' '}
          <span className={res.net < 0 ? 'font-semibold text-brand-red' : 'font-semibold text-brand-green'}>
            {res.net < 0 ? 'value destruction' : 'value retained'} of {formatSignedGndK(res.net, 0, true)} GND&nbsp;k
          </span>
          .
        </p>
      </Card>

      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Leakage waterfall"
          subtitle="Apparent saving eroded by attrition, productivity drag and the catch-up premium."
          right={
            <Select
              ariaLabel="Segment"
              options={under.map((s) => ({ value: s.level, label: s.label }))}
              value={selectedLevel}
              onChange={setSel}
            />
          }
        >
          {selected ? (
            <Waterfall steps={steps} unit="GND_K" />
          ) : (
            <p className="py-8 text-center text-sm text-muted">No under-market segments at this target — nothing leaking.</p>
          )}
        </Card>

        <Card title="Leakage by segment" subtitle={`Projected ${H}-year leakage from under-market positioning.`} right={<ProvenanceChip provenance={provenance} />}>
          {under.length > 0 ? (
            <div className="space-y-2">
              {[...under].sort((a, b) => (b.totalLeakage ?? 0) - (a.totalLeakage ?? 0)).map((s) => (
                <div key={s.level} className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3">
                  <span className="text-xs font-medium text-ink-soft">{s.label}</span>
                  <div className="h-5 overflow-hidden rounded-[3px] bg-bg">
                    <div className="h-full rounded-[3px]" style={{ width: `${((s.totalLeakage ?? 0) / maxLeak) * 100}%`, background: CHART.red }} />
                  </div>
                  <span className="text-right text-xs font-semibold tabular-nums text-brand-red">{formatGndK(s.totalLeakage, 0, true)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">No under-market segments at this target.</p>
          )}
        </Card>
      </div>

      <Card title="Sensitivity" subtitle="How portfolio leakage swings as each high-leverage assumption moves ±25%.">
        <Tornado rows={tornado} baseline={res.totalLeakage} unit="GND_K" />
      </Card>

      <Card title="Per-segment detail" flush>
        <TableScroll>
          <Table caption="Cost of inaction by segment">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">Level</TH>
                <TH align="right" className="border-l border-border">Apparent saving</TH>
                <TH align="right">Attrition leakage</TH>
                <TH align="right">Productivity drag</TH>
                <TH align="right">Catch-up premium</TH>
                <TH align="right" className="border-l border-border">Net</TH>
              </TR>
            </THead>
            <TBody>
              {res.segments.map((s) => (
                <TR key={s.level} className={s.underMarket ? undefined : 'opacity-60'}>
                  <TD className="whitespace-nowrap font-medium text-ink">{s.label}{!s.underMarket && <span className="ml-1.5 text-[0.66rem] text-muted">(at/above market)</span>}</TD>
                  <TD align="right" className="border-l border-border/60 tabular-nums">{formatGndK(s.presentSaving, 0, true)}</TD>
                  <TD align="right" className="tabular-nums text-brand-red">{s.attritionLeakage ? formatGndK(s.attritionLeakage, 0, true) : '—'}</TD>
                  <TD align="right" className="tabular-nums text-brand-red">{s.productivityDrag ? formatGndK(s.productivityDrag, 0, true) : '—'}</TD>
                  <TD align="right" className="tabular-nums text-brand-red">{s.catchUpPremium ? formatGndK(s.catchUpPremium, 0, true) : '—'}</TD>
                  <TD align="right" className={`border-l border-border/60 font-semibold tabular-nums ${(s.net ?? 0) < 0 ? 'text-brand-red' : 'text-ink'}`}>{formatSignedGndK(s.net, 0, true)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>
    </ModuleShell>
  );
}
