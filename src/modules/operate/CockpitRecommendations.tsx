/**
 * C5 — Recommendation Engine (rules-based, explainable, NOT ML). Builds a weighted
 * scorecard over family×level segments (recommendations.ts using RECO_WEIGHTS),
 * renders the ranked, explainable queue via the shared <ActionQueue> (every item
 * exposes its drivers + provenance), surfaces segment attrition risk (the v2
 * logistic via heuristics.segmentAttritionRisk), and a greedy budget allocator
 * (heuristics.greedyAllocate) over the cost-to-market of each recommended segment.
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ActionQueue } from '@/components/operate/ActionQueue';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CompContext } from '@/lib/compContext';
import type { Structure } from '@/lib/comp';
import { recommendActions, type SegmentRecommendation } from '@/lib/recommendations';
import { greedyAllocate, segmentAttritionRisk } from '@/lib/heuristics';
import { aggregateOf, LEVEL_LABELS_SHORT } from '@/domain/levels';
import { selectTable } from '@/domain/types';
import { JOB_FAMILIES } from '@/lib/assumptions';
import { LEVELS } from '@/domain/levels';
import { formatCount, formatGndK, formatPct } from '@/lib/format';
import { HEURISTIC_LABEL, isNum } from './cockpitShared';

interface Props {
  ctx: CompContext;
  structure: Structure;
}

export function CockpitRecommendations({ ctx, structure }: Props) {
  const [budget, setBudget] = useState<number | null>(null);

  const { recommendations, items } = useMemo(
    () => recommendActions(ctx.mappings, structure, ctx.surveyDataset, ctx.assumptions, JOB_FAMILIES, LEVELS),
    [ctx.mappings, structure, ctx.surveyDataset, ctx.assumptions],
  );

  // Greedy allocation over the cost-to-market of each scored segment.
  const allocation = useMemo(() => {
    const actions = recommendations
      .filter((r) => isNum(r.segment.costToMarket) && r.segment.costToMarket > 0)
      .map((r) => ({ id: `${r.segment.family}-${r.segment.level}`, score: r.score, cost: r.segment.costToMarket as number }));
    return greedyAllocate(actions, isNum(budget) ? budget : 0);
  }, [recommendations, budget]);
  const chosenIds = useMemo(() => new Set(allocation.chosen.map((a) => a.id)), [allocation]);

  // Attrition risk for the top recommendations (v2 logistic + tenure/perf modifiers).
  const riskRows = useMemo(() => {
    return recommendations.slice(0, 8).map((r) => {
      const row = selectTable(ctx.surveyDataset, 'FIRM', 'TARGET', 'BASIC_SALARY')?.rows[aggregateOf(r.segment.level)];
      const percentiles = row?.percentiles ?? null;
      const risk = segmentAttritionRisk(r.segment.avgPay, percentiles, r.segment.level, ctx.assumptions, {
        avgTenureYears: r.segment.avgTenureYears,
        avgPerformance: r.segment.avgPerformance,
      });
      return { rec: r, risk };
    });
  }, [recommendations, ctx.surveyDataset, ctx.assumptions]);

  const riskColumns: Column<{ rec: SegmentRecommendation; risk: ReturnType<typeof segmentAttritionRisk> }>[] = [
    { key: 'seg', header: 'Segment', align: 'left', render: ({ rec }) => (
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        {chosenIds.has(`${rec.segment.family}-${rec.segment.level}`) && <span className="h-1.5 w-1.5 rounded-full bg-brand-green" title="selected by allocator" />}
        {rec.segment.family} · {LEVEL_LABELS_SHORT[rec.segment.level]}
      </span>
    ) },
    { key: 'hc', header: 'Heads', align: 'right', render: ({ rec }) => <span className="tabular-nums">{formatCount(rec.segment.headcount)}</span> },
    { key: 'pos', header: 'Pay pctile', align: 'right', render: ({ rec }) => <span className="tabular-nums text-muted">{isNum(rec.segment.position) ? formatPct(rec.segment.position, 0) : '—'}</span> },
    { key: 'attr', header: 'Attrition risk', align: 'right', render: ({ risk }) => (
      <span className="inline-flex items-center justify-end gap-2">
        {risk && (
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-bg">
            <span className="block h-full rounded-full" style={{ width: `${Math.round(risk.value * 100)}%`, background: risk.value > 0.18 ? '#C0392B' : risk.value > 0.1 ? '#E0A93B' : '#2E8B57' }} />
          </span>
        )}
        <span className="w-12 text-right tabular-nums font-medium">{risk ? formatPct(risk.value, 1) : '—'}</span>
      </span>
    ) },
    { key: 'score', header: 'Score', align: 'right', render: ({ rec }) => <span className="tabular-nums font-semibold text-navy-700">{Math.round(rec.score)}</span> },
  ];

  if (items.length === 0) {
    return (
      <EmptyState
        title="No segments to score"
        message="Load employees mapped to job families and levels to generate recommendations."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title="Recommended actions"
        subtitle="Weighted scorecard over family×level segments. Expand a row to see the driver breakdown."
        right={<ProvenanceChip provenance="ASSUMED" />}
      >
        <ActionQueue items={items} />
        <p className="mt-3 text-[0.68rem] text-muted">
          Score = Σ (normalized sub-score × RECO_WEIGHTS) × 100. {HEURISTIC_LABEL}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Segment attrition risk"
          subtitle="v2 retention logistic at the segment's pay-percentile position, modified by avg tenure and performance."
          right={<ProvenanceChip provenance="ASSUMED" />}
          flush
        >
          <div className="px-1 py-1">
            <DataTable columns={riskColumns} data={riskRows} rowKey={({ rec }) => `${rec.segment.family}-${rec.segment.level}`} />
          </div>
          <p className="px-5 pb-3 pt-1 text-[0.68rem] text-muted">{HEURISTIC_LABEL}</p>
        </Card>

        <Card
          title="Budget allocator"
          subtitle="Greedy allocation: take the highest-scoring segments whose cost-to-market fits the budget."
        >
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Correction budget</span>
            <span className="inline-flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={budget === null ? '' : budget}
                placeholder="e.g. 2000"
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  setBudget(e.target.value === '' || !Number.isFinite(v) ? null : v);
                }}
                className="h-8 w-44 rounded-lg border border-border bg-card px-2.5 text-right text-[0.82rem] tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
              />
              <span className="text-[0.72rem] text-muted">GND k</span>
            </span>
          </label>

          {isNum(budget) && budget > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-[0.8rem]">
                <span className="text-muted">Selected <span className="font-semibold text-ink">{formatCount(allocation.chosen.length)}</span> segments</span>
                <span className="text-muted">Spent <span className="font-semibold tabular-nums text-navy-700">{formatGndK(allocation.spent, 0, true)}</span> GND k</span>
                <span className="text-muted">Remaining <span className="font-semibold tabular-nums text-brand-green">{formatGndK(allocation.remaining, 0, true)}</span> GND k</span>
              </div>
              {allocation.chosen.length > 0 ? (
                <ul className="space-y-1.5">
                  {allocation.chosen.map((a) => {
                    const rec = recommendations.find((r) => `${r.segment.family}-${r.segment.level}` === a.id);
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 text-[0.8rem]">
                        <span className="font-medium text-ink">{rec ? `${rec.segment.family} · ${LEVEL_LABELS_SHORT[rec.segment.level]}` : a.id}</span>
                        <span className="tabular-nums text-ink-soft">{formatGndK(a.cost, 0, true)} GND k</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[0.8rem] text-muted">Budget too small for the cheapest recommended correction.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-[0.8rem] text-muted">Enter a budget to greedily select the highest-value corrections.</p>
          )}
          <p className="mt-3 text-[0.68rem] text-muted">{HEURISTIC_LABEL}</p>
        </Card>
      </div>
    </div>
  );
}
