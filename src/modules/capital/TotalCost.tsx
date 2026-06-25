import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ProvenanceChip, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { CapitalControls } from '@/components/capital/CapitalControls';
import { CostStackBar, type CostStackRowData } from '@/components/charts/CostStackBar';
import type { BarSeries } from '@/components/charts/GroupedBars';
import { CHART } from '@/components/charts/chartTheme';
import { computeTotalCost } from '@/lib/capital';
import { useCapitalContext } from '@/lib/capitalContext';
import { formatCount, formatGndK, formatPct, formatSignedGndK } from '@/lib/format';
import { weakest } from '@/lib/provenance';

const LAYERS: BarSeries[] = [
  { key: 'base', label: 'Base', color: CHART.navy700 },
  { key: 'allowances', label: 'Allowances', color: CHART.blue400 },
  { key: 'bonus', label: 'Bonus', color: CHART.firm },
  { key: 'employerContribution', label: 'Employer contribution', color: CHART.bandDark },
  { key: 'overtime', label: 'Overtime', color: CHART.amber },
  { key: 'contingent', label: 'Contingent', color: CHART.red },
  { key: 'equity', label: 'Equity / token', color: CHART.green },
];

const n = (v: number | null): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function TotalCost() {
  const ctx = useCapitalContext();
  const bases = ctx.scenarioBases ?? ctx.baseline;
  const rows = useMemo(() => computeTotalCost(bases, ctx.inputs, ctx.assumptions), [bases, ctx.inputs, ctx.assumptions]);

  const stackData: CostStackRowData[] = rows.map((r) => ({
    name: r.label,
    base: n(r.base),
    allowances: n(r.allowances),
    bonus: n(r.bonus),
    employerContribution: n(r.employerContribution),
    overtime: n(r.overtimePerHead),
    contingent: n(r.contingentPerHead),
    equity: n(r.equityPerHead),
  }));

  const totalTwc = rows.reduce((a, r) => a + n(r.twc) * r.headcount, 0);
  const baseOnly = rows.reduce((a, r) => a + n(r.base) * r.headcount, 0);
  const understated = totalTwc - baseOnly;
  const flags = rows.filter((r) => r.falseSavingsFlag);
  const provenance = weakest(...rows.map((r) => r.provenance));

  const kpis: KpiItem[] = [
    { label: 'Total workforce cost', value: `${formatGndK(totalTwc, 0, true)}`, sub: 'GND k / yr (loaded)', accent: 'navy' },
    { label: 'Base-only spend', value: `${formatGndK(baseOnly, 0, true)}`, sub: 'GND k / yr', accent: 'navy' },
    { label: 'Understated by', value: `${formatGndK(understated, 0, true)}`, sub: 'true cost beyond base', accent: 'amber' },
    { label: 'False-savings flags', value: formatCount(flags.length), sub: 'under-market + high flex load', accent: flags.length > 0 ? 'red' : 'green' },
  ];

  const allModeled = provenance === 'ASSUMED';

  return (
    <ModuleShell
      title="Total Workforce Cost"
      subtitle="Base → TCC → t-CTC → Total Workforce Cost, with the false-savings detector."
      controls={<CapitalControls showComponent={false} />}
    >
      {allModeled && <ModeledBanner message="Cost stack uses default employer-contribution and zero overtime/contingent. Add flexible-cost data to assess false savings." />}

      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      <Card
        title="Loaded cost stack per level (per head)"
        subtitle="Each tier of the true cost — Base, Allowances, Bonus, Employer contribution, Overtime, Contingent, Equity / token."
        right={<ProvenanceChip provenance={provenance} />}
      >
        <CostStackBar data={stackData} layers={LAYERS} unit="GND_K" />
      </Card>

      <Card title="Cost detail & false-savings" subtitle="t-CTC = TCC × (1 + employer contribution). TWC adds overtime + contingent + equity/token per head." flush>
        <TableScroll>
          <Table caption="Total workforce cost stack by level">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">Level</TH>
                <TH align="right" className="border-l border-border">Base</TH>
                <TH align="right">TCC</TH>
                <TH align="right">t-CTC</TH>
                <TH align="right">Overtime</TH>
                <TH align="right">Contingent /hd</TH>
                <TH align="right">Equity /hd</TH>
                <TH align="right" className="border-l border-border">TWC</TH>
                <TH align="right">Flex load</TH>
                <TH align="center" className="border-l border-border">Flag</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.level}>
                  <TD className="whitespace-nowrap font-medium text-ink">{r.label}</TD>
                  <TD align="right" className="border-l border-border/60 tabular-nums">{formatGndK(r.base)}</TD>
                  <TD align="right" className="tabular-nums">{formatGndK(r.tcc)}</TD>
                  <TD align="right" className="tabular-nums">{formatGndK(r.tCtc)}</TD>
                  <TD align="right" className="tabular-nums">{formatGndK(r.overtimePerHead)}</TD>
                  <TD align="right" className="tabular-nums">{formatGndK(r.contingentPerHead)}</TD>
                  <TD align="right" className="tabular-nums">{formatGndK(r.equityPerHead)}</TD>
                  <TD align="right" className="border-l border-border/60 font-semibold tabular-nums text-ink">{formatGndK(r.twc)}</TD>
                  <TD align="right" className="tabular-nums">{formatPct(r.flexibleLoad, 0)}</TD>
                  <TD align="center" className="border-l border-border/60">
                    {r.falseSavingsFlag ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[0.68rem] font-semibold text-brand-red">
                        <AlertTriangle size={11} /> False saving
                      </span>
                    ) : r.underMarket ? (
                      <span className="text-[0.68rem] text-muted">under-market</span>
                    ) : (
                      <span className="text-[0.68rem] text-muted">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>

      {flags.length > 0 && (
        <Card title="False-savings detected" subtitle="Under-market base pay where cost has reappeared as overtime / contractors.">
          <ul className="space-y-2">
            {flags.map((r) => (
              <li key={r.level} className="flex items-start gap-2.5 rounded-lg border border-brand-red/30 bg-brand-red/5 px-3 py-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-brand-red" />
                <span className="text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{r.label}</span> sits below market on base pay yet carries{' '}
                  <span className="font-semibold text-brand-red">{formatPct(r.flexibleLoad, 0)}</span> of its{' '}
                  {formatGndK(r.twc)} GND k loaded cost as overtime + contingent. Underinvested base, cost reappearing as flexible spend.{' '}
                  <span className="text-muted">Closing the base gap could net {formatSignedGndK(-(n(r.overtimePerHead) + n(r.contingentPerHead)), 0)} GND k/head of flexible spend.</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ModuleShell>
  );
}
