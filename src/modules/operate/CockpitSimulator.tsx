/**
 * C3 — Adjustment Simulator (cohort). Method picker + cohort scope (family /
 * level / BU) → cohort.runCohortAdjustment over the EMPLOYEE population. Outputs
 * total + recurring annualized cost, # / % affected, the compa-ratio distribution
 * shift, a modeled retention effect (v2 logistic), and a greedy budget allocator
 * (heuristics.greedyAllocate) that picks the by-family moves that fit a budget.
 *
 * This reuses comp/economics math for employee cohorts — it is NOT the v1 survey
 * Budget simulator. Label: rule/statistics-based; ML upgrade is platform-track.
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { GroupedBars, type GroupedBarsRow } from '@/components/charts/GroupedBars';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { CHART } from '@/components/charts/chartTheme';
import type { CompContext } from '@/lib/compContext';
import {
  ADJUSTMENT_METHODS,
  type AdjustmentMethod,
  type CohortGroupResult,
  type CohortScope,
  runCohortAdjustment,
} from '@/lib/cohort';
import { greedyAllocate } from '@/lib/heuristics';
import { JOB_FAMILIES } from '@/lib/assumptions';
import { LEVELS, type Level, LEVEL_LABELS } from '@/domain/levels';
import { formatCompaRatio, formatCount, formatGndK, formatPct } from '@/lib/format';
import { HEURISTIC_LABEL, isNum } from './cockpitShared';

interface Props {
  ctx: CompContext;
}

export function CockpitSimulator({ ctx }: Props) {
  const [method, setMethod] = useState<AdjustmentMethod>('to-policy-corridor');
  const [family, setFamily] = useState<string | 'all'>('all');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [bu, setBu] = useState<string | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'family' | 'bu'>('family');
  const [budget, setBudget] = useState<number | null>(null);

  const businessUnits = useMemo(
    () => Array.from(new Set(ctx.employees.map((e) => e.businessUnit))).sort(),
    [ctx.employees],
  );

  const scope = useMemo<CohortScope>(() => ({ family, level, businessUnit: bu }), [family, level, bu]);

  const result = useMemo(
    () => runCohortAdjustment(method, ctx.mappings, scope, ctx.surveyDataset, ctx.assumptions),
    [method, ctx.mappings, ctx.surveyDataset, ctx.assumptions, scope],
  );

  const groups = groupBy === 'family' ? result.byFamily : result.byBusinessUnit;

  // Greedy allocation: treat each group's correction as one action (score by
  // value density — more affected per GND k — then take those that fit the budget).
  const allocation = useMemo(() => {
    const actions = groups
      .filter((g) => g.totalCost > 0)
      .map((g) => ({
        id: g.key,
        // Score: affected-headcount intensity (proxy for retention value), 0..100.
        score: Math.min(100, (g.affected / Math.max(1, g.headcount)) * 100 + g.affected),
        cost: g.totalCost,
        label: g.label,
      }));
    return greedyAllocate(actions, isNum(budget) ? budget : 0);
  }, [groups, budget]);
  const chosenIds = useMemo(() => new Set(allocation.chosen.map((a) => a.id)), [allocation]);

  const re = result.retentionEffect;

  const kpis: KpiItem[] = [
    { label: 'Total cost', value: formatGndK(result.totalCost, 0, true), sub: 'GND k · annualized recurring', accent: 'navy' },
    { label: 'Affected', value: formatCount(result.affected), sub: `${formatPct(result.affectedPct, 0)} of ${formatCount(result.cohortSize)}`, accent: result.affected ? 'amber' : 'green' },
    { label: 'Avg compa before', value: formatCompaRatio(result.avgCompaBefore), sub: 'cohort', accent: 'navy' },
    { label: 'Avg compa after', value: formatCompaRatio(result.avgCompaAfter), sub: 'cohort', accent: 'green' },
    {
      label: 'Exits avoided / yr',
      value: re && isNum(re.exitsAvoided) ? formatGndK(re.exitsAvoided, 1) : '—',
      sub: 'modeled (v2 retention)',
      accent: 'green',
    },
  ];

  const compaRows: GroupedBarsRow[] = result.compaShift.map((b) => ({
    name: b.label,
    Before: b.before,
    After: b.after,
  }));

  const groupColumns: Column<CohortGroupResult>[] = [
    { key: 'g', header: groupBy === 'family' ? 'Family' : 'Business unit', align: 'left', render: (g) => (
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        {chosenIds.has(g.key) && <span className="h-1.5 w-1.5 rounded-full bg-brand-green" title="selected by allocator" />}
        {g.label}
      </span>
    ) },
    { key: 'hc', header: 'Heads', align: 'right', render: (g) => <span className="tabular-nums">{formatCount(g.headcount)}</span> },
    { key: 'aff', header: 'Affected', align: 'right', render: (g) => <span className="tabular-nums">{formatCount(g.affected)}</span> },
    { key: 'cost', header: 'Cost (GND k)', align: 'right', render: (g) => <span className="tabular-nums font-medium">{formatGndK(g.totalCost, 0, true)}</span> },
  ];

  return (
    <div className="space-y-5">
      <Card title="Adjustment method & cohort" subtitle={ADJUSTMENT_METHODS.find((m) => m.value === method)?.note}>
        <div className="flex flex-wrap items-end gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Method</span>
            <Select<AdjustmentMethod>
              ariaLabel="Adjustment method"
              value={method}
              onChange={setMethod}
              options={ADJUSTMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Family</span>
            <Select
              ariaLabel="Family scope"
              value={family}
              onChange={setFamily}
              options={[{ value: 'all', label: 'All families' }, ...JOB_FAMILIES.map((f) => ({ value: f, label: f }))]}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Level</span>
            <Select
              ariaLabel="Level scope"
              value={level}
              onChange={(v) => setLevel(v as Level | 'all')}
              options={[{ value: 'all', label: 'All levels' }, ...LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))]}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Business unit</span>
            <Select
              ariaLabel="Business unit scope"
              value={bu}
              onChange={setBu}
              options={[{ value: 'all', label: 'All BUs' }, ...businessUnits.map((b) => ({ value: b, label: b }))]}
            />
          </div>
        </div>
        <p className="mt-3 text-[0.68rem] text-muted">
          Operates on the employee population (not the survey Budget simulator). {HEURISTIC_LABEL}
        </p>
      </Card>

      <KpiStrip items={kpis} className="xl:grid-cols-5" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Compa-ratio distribution shift" subtitle="Headcount per compa-ratio band, before vs after the move.">
          <GroupedBars
            data={compaRows}
            series={[
              { key: 'Before', label: 'Before', color: CHART.bandDark },
              { key: 'After', label: 'After', color: CHART.firm },
            ]}
            unit="GND_K"
            height={260}
          />
        </Card>

        <Card
          title="Modeled retention effect"
          subtitle="Avg attrition before/after via the v2 retention logistic on the survey pay-percentile curve."
          right={<ProvenanceChip provenance="ASSUMED" />}
        >
          {re ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Attrition before" value={formatPct(re.attritionBefore, 1)} />
                <Stat label="Attrition after" value={formatPct(re.attritionAfter, 1)} tone="green" />
                <Stat label="Exits avoided / yr" value={isNum(re.exitsAvoided) ? formatGndK(re.exitsAvoided, 1) : '—'} tone="green" />
              </div>
              <p className="text-[0.7rem] leading-relaxed text-muted">{re.note}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Retention effect unavailable for this cohort.</p>
          )}
        </Card>
      </div>

      <Card
        title="Cost by group & budget allocator"
        subtitle="Greedy allocation ranks groups by value-per-dollar (affected ÷ cost) and selects those that fit the budget."
        right={
          <Segmented<'family' | 'bu'>
            ariaLabel="Group by"
            size="sm"
            value={groupBy}
            onChange={setGroupBy}
            options={[{ value: 'family', label: 'By family' }, { value: 'bu', label: 'By BU' }]}
          />
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Allocation budget</span>
            <span className="inline-flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={budget === null ? '' : budget}
                placeholder="e.g. 1500"
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  setBudget(e.target.value === '' || !Number.isFinite(v) ? null : v);
                }}
                className="h-8 w-40 rounded-lg border border-border bg-card px-2.5 text-right text-[0.82rem] tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
              />
              <span className="text-[0.72rem] text-muted">GND k</span>
            </span>
          </label>
          {isNum(budget) && budget > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-[0.78rem]">
              <span className="text-muted">Selected <span className="font-semibold text-ink">{formatCount(allocation.chosen.length)}</span> of {formatCount(groups.filter((g) => g.totalCost > 0).length)}</span>
              <span className="text-muted">Spent <span className="font-semibold tabular-nums text-navy-700">{formatGndK(allocation.spent, 0, true)}</span> GND k</span>
              <span className="text-muted">Remaining <span className="font-semibold tabular-nums text-brand-green">{formatGndK(allocation.remaining, 0, true)}</span> GND k</span>
            </div>
          )}
        </div>

        <DataTable
          columns={groupColumns}
          data={groups}
          rowKey={(g) => g.key}
          highlightRow={(g) => chosenIds.has(g.key)}
        />
        <p className="mt-3 text-[0.68rem] text-muted">{HEURISTIC_LABEL}</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone = 'navy' }: { label: string; value: string; tone?: 'navy' | 'green' }) {
  return (
    <div className="rounded-card border border-border bg-card px-3 py-2.5">
      <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === 'green' ? 'text-brand-green' : 'text-navy-700'}`}>{value}</div>
    </div>
  );
}
