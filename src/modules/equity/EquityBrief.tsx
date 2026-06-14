/**
 * Incentive Plan Brief (route /incentives/brief).
 *
 * A printable one-pager summarising the plans selected for comparison: FAIR
 * scores, key design choices and the plain-language reads. Mirrors
 * /capital/brief's print approach (scoped print CSS, screen action bar).
 */

import { Link } from 'react-router-dom';
import { ClipboardList, Printer } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FairScoreBadge, OverallQualityBadge } from '@/components/equity/FairScorecard';
import { humanizeEnum } from '@/components/equity/equityLabels';
import { FAIR_AXES } from '@/domain/equityPlan';
import { scorePlan } from '@/lib/equityScoring';
import { useComparePlans } from '@/store/equityPlanStore';

const PRINT_CSS = `
@media print {
  aside { display: none !important; }
  .sticky.top-0.z-30 { display: none !important; }
  main { overflow: visible !important; height: auto !important; }
  html, body { background: #fff !important; }
  @page { margin: 14mm; }
}
`;

export function EquityBrief() {
  const plans = useComparePlans();

  if (plans.length === 0) {
    return (
      <ModuleShell title="Incentive Plan Brief" subtitle="A printable summary of the selected plans.">
        <EmptyState
          icon={<ClipboardList size={22} />}
          title="No plans selected"
          message={
            <>
              Select plans in the{' '}
              <Link to="/incentives/library" className="font-medium text-navy-700 hover:underline">
                Plan Library
              </Link>{' '}
              to build a brief.
            </>
          }
        />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      title="Incentive Plan Brief"
      subtitle="Selected synthetic-equity & incentive plans, one page."
      controls={
        <Link to="/incentives/compare" className="text-[0.8rem] font-medium text-navy-700 hover:underline">
          ← Comparison
        </Link>
      }
    >
      <style>{PRINT_CSS}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <span className="text-[0.8rem] text-muted">{plans.length} plan(s) in this brief.</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[0.8rem] font-medium text-ink-soft transition-colors hover:border-navy-500/40 hover:text-navy-700"
        >
          <Printer size={14} /> Export / Print
        </button>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold text-ink">Incentive Plan Brief</h1>
        <p className="mt-0.5 text-[0.8rem] text-muted">Synthetic Equity & Incentive Plan Benchmarking · illustrative (Assumed)</p>
      </div>

      {plans.map((plan) => {
        const score = scorePlan(plan);
        return (
          <Card key={plan.id} title={plan.name} right={<OverallQualityBadge band={score.overall.band} score={score.overall.score} />}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="navy">{humanizeEnum(plan.archetype.planType)}</Badge>
              <Badge variant="outline">{humanizeEnum(plan.archetype.primaryStrategicObjective)}</Badge>
              <Badge variant="outline">{humanizeEnum(plan.archetype.planMaturityStage)}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {FAIR_AXES.map((axis) => (
                <FairScoreBadge key={axis} band={score.fair[axis].band} score={score.fair[axis].score} label={axis.charAt(0).toUpperCase() + axis.slice(1)} />
              ))}
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-[0.8rem] sm:grid-cols-2">
              <BriefRow label="Value basis" value={`${humanizeEnum(plan.valueBasis.referenceValueType)} · ${humanizeEnum(plan.valueBasis.valuationMethod)} · ${humanizeEnum(plan.valueBasis.valuationCadence)}`} />
              <BriefRow label="Pool" value={`${Math.round(plan.pool.poolSizePercentEV * 100)}% of value · ${humanizeEnum(plan.pool.concentrationIndex)}`} />
              <BriefRow label="Vesting" value={`${humanizeEnum(plan.vesting.vestingModel)} · ${plan.vesting.vestingHorizonYears}y (${plan.vesting.cliffPeriodYears}y cliff)`} />
              <BriefRow label="Payout trigger" value={humanizeEnum(plan.vesting.primaryPayoutTrigger)} />
              <BriefRow label="Risk / elasticity" value={score.reads.downsideElasticity} />
              <BriefRow label="Settlement" value={`${humanizeEnum(plan.modality.settlementMediumPrimary)} · ${humanizeEnum(plan.modality.executionLayer)}`} />
              <BriefRow label="Concentration" value={score.reads.concentration} />
              <BriefRow label="Unallocated pool" value={`${Math.round(score.reads.unallocatedPoolPct * 100)}%`} />
            </dl>
          </Card>
        );
      })}
    </ModuleShell>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-ink-soft">{value}</dd>
    </div>
  );
}
