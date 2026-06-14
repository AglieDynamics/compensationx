/**
 * Plan Comparison (route /incentives/compare).
 *
 * Compares the plans selected in the Library: KPI summary, a per-dimension
 * heatmap and a FAIR radar (from @/lib/equityScoring), plus a per-plan FAIR
 * breakdown. Selection lives in the equity-plan store.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GitCompare } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlanComparisonMatrix, SeriesLegend } from '@/components/equity/PlanComparisonMatrix';
import { FairScorecard } from '@/components/equity/FairScorecard';
import { humanizeEnum } from '@/components/equity/equityLabels';
import { comparePlans, scorePlan } from '@/lib/equityScoring';
import { useComparePlans } from '@/store/equityPlanStore';

export function PlanComparison() {
  const plans = useComparePlans();

  const scores = useMemo(() => plans.map((p) => ({ plan: p, score: scorePlan(p) })), [plans]);
  const comparison = useMemo(() => comparePlans(plans), [plans]);

  if (plans.length < 2) {
    return (
      <ModuleShell title="Plan Comparison" subtitle="Compare selected incentive plans side by side.">
        <EmptyState
          icon={<GitCompare size={22} />}
          title="Select at least two plans"
          message={
            <>
              Pick plans to compare in the{' '}
              <Link to="/incentives/library" className="font-medium text-navy-700 hover:underline">
                Plan Library
              </Link>{' '}
              (use the “Compare” checkboxes), then return here.
            </>
          }
        />
      </ModuleShell>
    );
  }

  const best = scores.reduce((a, b) => (b.score.overall.score > a.score.overall.score ? b : a));
  const avgOverall = scores.reduce((a, s) => a + s.score.overall.score, 0) / scores.length;
  const mostDivergent = comparison.rows.reduce((a, b) => (b.spread > a.spread ? b : a));

  const kpis: KpiItem[] = [
    { label: 'Plans compared', value: String(plans.length), sub: 'side by side', accent: 'navy' },
    { label: 'Strongest design', value: `${best.score.overall.score}/5`, sub: best.plan.name, accent: 'green' },
    { label: 'Avg overall quality', value: `${Math.round(avgOverall * 10) / 10}/5`, sub: 'across selection', accent: 'navy' },
    { label: 'Biggest divergence', value: mostDivergent.dimension.label, sub: `${Math.round(mostDivergent.spread * 5)}/5 spread`, accent: 'amber' },
  ];

  return (
    <ModuleShell
      title="Plan Comparison"
      subtitle="Selected incentive plans across the FAIR design dimensions."
      controls={
        <Link to="/incentives/library" className="text-[0.8rem] font-medium text-navy-700 hover:underline">
          ← Plan Library
        </Link>
      }
    >
      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      <Card title="Design comparison" subtitle="Per-dimension heatmap (1–5) and FAIR radar across the selection." right={<SeriesLegend plans={plans} />}>
        <PlanComparisonMatrix plans={plans} />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {scores.map(({ plan, score }) => (
          <Card key={plan.id} title={plan.name} subtitle={`${humanizeEnum(plan.archetype.planType)} · ${score.overall.score}/5 overall`}>
            <FairScorecard score={score} showFactors={false} />
          </Card>
        ))}
      </div>
    </ModuleShell>
  );
}
