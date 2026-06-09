/**
 * C4 — Workforce Economics. Surfaces the v2 capital lenses by career level
 * (the survey segment dimension) WITHOUT reimplementing them: it consumes
 * computeConvexity / computeValueDensity / computeCostOfInaction / computeTotalCost
 * over buildSegmentBases (via useCapitalContext) and shows compact summaries with
 * links to the full /capital/* lenses. Value-dependent lenses (density / frontier)
 * show an assumption note until value-per-head is supplied in Inputs.
 */

import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { ProvenanceChip, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  computeConvexity,
  computeCostOfInaction,
  computeTotalCost,
  computeValueDensity,
  QUADRANT_META,
  type ConvexityRow,
  type CostStackRow,
} from '@/lib/capital';
import { useCapitalContext } from '@/lib/capitalContext';
import { useHasValueData } from '@/store/inputsStore';
import { formatGndK, formatPct, formatSignedGndK } from '@/lib/format';
import { isNum } from './cockpitShared';

export function CockpitEconomics() {
  const cap = useCapitalContext();
  const hasValueData = useHasValueData();

  const costRows = useMemo(
    () => computeTotalCost(cap.baseline, cap.inputs, cap.assumptions),
    [cap.baseline, cap.inputs, cap.assumptions],
  );
  const convexity = useMemo(
    () => computeConvexity(cap.baseline, cap.inputs, cap.assumptions),
    [cap.baseline, cap.inputs, cap.assumptions],
  );
  const valueDensity = useMemo(
    () => computeValueDensity(cap.baseline, cap.inputs, costRows),
    [cap.baseline, cap.inputs, costRows],
  );
  const coi = useMemo(
    () => computeCostOfInaction(cap.baseline, cap.inputs, cap.assumptions, cap.coiOpts),
    [cap.baseline, cap.inputs, cap.assumptions, cap.coiOpts],
  );

  const totalTwc = costRows.reduce((a, c) => a + (isNum(c.twc) ? c.twc * c.headcount : 0), 0);
  const falseSavings = costRows.filter((c) => c.falseSavingsFlag).length;
  const topConvexity = [...convexity]
    .filter((r) => isNum(r.coi))
    .sort((a, b) => (b.coi ?? 0) - (a.coi ?? 0))[0];

  const kpis: KpiItem[] = [
    { label: 'Loaded workforce cost', value: formatGndK(totalTwc, 0, true), sub: 'GND k · survey segments', accent: 'navy' },
    {
      label: 'Cost of inaction (net)',
      value: formatGndK(coi.net, 0, true),
      sub: coi.net < 0 ? 'GND k · value destruction' : 'GND k · net saving',
      accent: coi.net < 0 ? 'red' : 'green',
    },
    {
      label: 'Top convexity segment',
      value: topConvexity ? topConvexity.label : '—',
      sub: topConvexity && isNum(topConvexity.coi) ? `COI ${Math.round(topConvexity.coi)}/100` : 'add value data',
      accent: 'amber',
    },
    {
      label: 'False-savings flags',
      value: String(falseSavings),
      sub: 'under-market + high flex load',
      accent: falseSavings ? 'red' : 'green',
    },
  ];

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      {!hasValueData && (
        <ModeledBanner message="Value-density and productivity lenses need value-per-head. Add it in Inputs & Assumptions, or load the illustrative set, to populate them. Cost and convexity lenses run on survey + assumptions." />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Human Capital Convexity"
          subtitle="Where a marginal pay move buys the most retention (dR/dp × value-at-risk)."
          right={<LensLink to="/capital/convexity" />}
        >
          <ConvexityTable rows={convexity} />
        </Card>

        <Card
          title="Total Workforce Cost Truth"
          subtitle="Loaded cost per segment; flags under-market segments leaking into overtime / contingent spend."
          right={<LensLink to="/capital/total-cost" />}
        >
          <CostTable rows={costRows} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Workforce Value Density"
          subtitle="Value created per unit of workforce cost, classified into action quadrants."
          right={<LensLink to="/capital/value-density" />}
        >
          {valueDensity.hasValue ? (
            <div className="space-y-2.5">
              {valueDensity.rows.map((r) => (
                <div key={r.level} className="flex items-center justify-between gap-3 text-[0.82rem]">
                  <span className="font-medium text-ink">{r.label}</span>
                  <span className="flex items-center gap-2">
                    {r.quadrant && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.64rem] font-semibold"
                        style={{ background: `${QUADRANT_META[r.quadrant].color}1A`, color: QUADRANT_META[r.quadrant].color }}
                      >
                        {QUADRANT_META[r.quadrant].label}
                      </span>
                    )}
                    <span className="w-12 text-right tabular-nums text-ink-soft">
                      {isNum(r.valueDensity) ? `${r.valueDensity.toFixed(2)}×` : '—'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              title="No value data"
              message={
                <span>
                  Add value-per-head in{' '}
                  <Link to="/capital/inputs" className="font-semibold text-navy-500 hover:text-navy-700">
                    Inputs & Assumptions
                  </Link>{' '}
                  to populate this lens.
                </span>
              }
            />
          )}
        </Card>

        <Card
          title="Cost of Inaction"
          subtitle={`Multi-period leakage from staying under market (${cap.assumptions.coiHorizon}-yr horizon).`}
          right={<LensLink to="/capital/cost-of-inaction" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <CoiStat label="Apparent saving" value={formatGndK(coi.totalPresentSaving, 0, true)} tone="green" />
              <CoiStat label="Total leakage" value={formatGndK(coi.totalLeakage, 0, true)} tone="red" />
              <CoiStat label="Net" value={formatSignedGndK(coi.net, 0, true)} tone={coi.net < 0 ? 'red' : 'green'} />
            </div>
            <p className="text-[0.7rem] leading-relaxed text-muted">
              A negative net means apparent under-market savings are outweighed by attrition, productivity and
              catch-up leakage. Full breakdown in the Cost of Inaction lens.
            </p>
            <ProvenanceChip provenance={coi.segments[0]?.provenance ?? 'ASSUMED'} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function LensLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[0.74rem] font-semibold text-navy-500 hover:text-navy-700">
      Open lens <ArrowRight size={12} />
    </Link>
  );
}

function ConvexityTable({ rows }: { rows: ConvexityRow[] }) {
  const columns: Column<ConvexityRow>[] = [
    { key: 'seg', header: 'Segment', align: 'left', render: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { key: 'pos', header: 'Pay pctile', align: 'right', render: (r) => <span className="tabular-nums text-muted">{isNum(r.position) ? formatPct(r.position, 0) : '—'}</span> },
    { key: 'attr', header: 'Attrition', align: 'right', render: (r) => <span className="tabular-nums">{formatPct(r.attrition, 1)}</span> },
    { key: 'coi', header: 'Convexity (0–100)', align: 'right', render: (r) => (
      <span className="inline-flex items-center justify-end gap-2">
        {isNum(r.coi) && <span className="h-1.5 w-12 overflow-hidden rounded-full bg-bg"><span className="block h-full rounded-full bg-navy-500" style={{ width: `${Math.max(0, Math.min(100, r.coi))}%` }} /></span>}
        <span className="w-7 text-right tabular-nums font-medium">{isNum(r.coi) ? Math.round(r.coi) : '—'}</span>
      </span>
    ) },
    { key: 'flag', header: '', align: 'center', render: (r) => (r.belowInflection ? <Badge variant="amber">Below inflection</Badge> : <span className="text-muted">—</span>) },
  ];
  return <DataTable columns={columns} data={rows} rowKey={(r) => r.level} />;
}

function CostTable({ rows }: { rows: CostStackRow[] }) {
  const columns: Column<CostStackRow>[] = [
    { key: 'seg', header: 'Segment', align: 'left', render: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { key: 'tcc', header: 'TCC', align: 'right', render: (r) => <span className="tabular-nums text-muted">{formatGndK(r.tcc, 0)}</span> },
    { key: 'twc', header: 'TWC / head', align: 'right', render: (r) => <span className="tabular-nums font-medium">{formatGndK(r.twc, 0)}</span> },
    { key: 'flex', header: 'Flex load', align: 'right', render: (r) => <span className="tabular-nums">{formatPct(r.flexibleLoad, 0)}</span> },
    { key: 'flag', header: '', align: 'center', render: (r) => (r.falseSavingsFlag ? <Badge variant="red">False saving</Badge> : r.underMarket ? <Badge variant="amber">Under market</Badge> : <span className="text-muted">—</span>) },
  ];
  return <DataTable columns={columns} data={rows} rowKey={(r) => r.level} />;
}

function CoiStat({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' }) {
  return (
    <div className="rounded-card border border-border bg-card px-3 py-2.5">
      <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === 'red' ? 'text-brand-red' : 'text-brand-green'}`}>{value}</div>
    </div>
  );
}
