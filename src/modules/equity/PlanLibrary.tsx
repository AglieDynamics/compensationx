/**
 * Plan Library (route /incentives/library).
 *
 * Lists saved incentive plans as cards with archetype/maturity badges and the
 * FAIR overall band, plus per-plan actions (edit, duplicate, delete, select for
 * comparison). New plans are authored in the Designer and persisted on save.
 */

import { Link, useNavigate } from 'react-router-dom';
import { Copy, GitCompare, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { FairScoreBadge, OverallQualityBadge } from '@/components/equity/FairScorecard';
import { humanizeEnum } from '@/components/equity/equityLabels';
import { FAIR_AXES } from '@/domain/equityPlan';
import { scorePlan } from '@/lib/equityScoring';
import { MAX_COMPARE, useEquityPlanStore } from '@/store/equityPlanStore';
import { cn } from '@/lib/cn';

export function PlanLibrary() {
  const plans = useEquityPlanStore((s) => s.plans);
  const compareIds = useEquityPlanStore((s) => s.compareIds);
  const duplicatePlan = useEquityPlanStore((s) => s.duplicatePlan);
  const deletePlan = useEquityPlanStore((s) => s.deletePlan);
  const toggleCompare = useEquityPlanStore((s) => s.toggleCompare);
  const clearCompare = useEquityPlanStore((s) => s.clearCompare);
  const resetToSeed = useEquityPlanStore((s) => s.resetToSeed);
  const navigate = useNavigate();

  const controls = (
    <div className="flex items-center gap-2">
      <Link
        to="/incentives/designer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-700 px-3 text-[0.8rem] font-semibold text-white hover:bg-navy-900"
      >
        <Plus size={14} /> New plan
      </Link>
      <button
        type="button"
        onClick={resetToSeed}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[0.8rem] font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700"
      >
        <RotateCcw size={13} /> Reset to seed
      </button>
    </div>
  );

  return (
    <ModuleShell
      title="Plan Library"
      subtitle="Saved synthetic-equity & incentive plans. Design, duplicate and select plans to compare."
      controls={controls}
    >
      {compareIds.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[0.82rem] text-ink-soft">
              <span className="font-semibold text-ink">{compareIds.length}</span> of {MAX_COMPARE} selected for comparison
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearCompare} className="text-[0.8rem] font-medium text-muted hover:text-ink">
                Clear
              </button>
              <button
                type="button"
                onClick={() => navigate('/incentives/compare')}
                disabled={compareIds.length < 2}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-700 px-3 text-[0.8rem] font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GitCompare size={14} /> Compare {compareIds.length < 2 ? '(pick ≥ 2)' : ''}
              </button>
            </div>
          </div>
        </Card>
      )}

      {plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          message="Design your first synthetic-equity or incentive plan, or restore the illustrative seed set."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const score = scorePlan(plan);
            const selected = compareIds.includes(plan.id);
            const atCap = compareIds.length >= MAX_COMPARE && !selected;
            return (
              <Card key={plan.id} className={cn(selected && 'ring-2 ring-navy-500/40')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[0.95rem] font-semibold text-ink" title={plan.name}>{plan.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="navy">{humanizeEnum(plan.archetype.planType)}</Badge>
                      <Badge variant="outline">{humanizeEnum(plan.archetype.planMaturityStage)}</Badge>
                    </div>
                  </div>
                  <ProvenanceChip provenance={plan.provenance} />
                </div>

                <p className="mt-2 text-[0.76rem] text-muted">
                  {humanizeEnum(plan.archetype.primaryStrategicObjective)} · {plan.archetype.participationScope.length} group(s)
                </p>

                <div className="mt-3">
                  <OverallQualityBadge band={score.overall.band} score={score.overall.score} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FAIR_AXES.map((axis) => (
                      <FairScoreBadge key={axis} band={score.fair[axis].band} score={score.fair[axis].score} label={axis.charAt(0).toUpperCase() + axis.slice(1)} />
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
                  <Link
                    to={`/incentives/designer?id=${plan.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.74rem] font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700"
                  >
                    <Pencil size={12} /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => duplicatePlan(plan.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.74rem] font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700"
                  >
                    <Copy size={12} /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePlan(plan.id)}
                    aria-label={`Delete ${plan.name}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.74rem] font-medium text-ink-soft hover:border-brand-red/40 hover:text-brand-red"
                  >
                    <Trash2 size={12} />
                  </button>
                  <label
                    className={cn(
                      'ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[0.74rem] font-medium',
                      atCap ? 'cursor-not-allowed text-muted/50' : 'text-ink-soft',
                    )}
                    title={atCap ? `At most ${MAX_COMPARE} plans` : 'Select for comparison'}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-navy-700"
                      checked={selected}
                      disabled={atCap}
                      onChange={() => toggleCompare(plan.id)}
                    />
                    Compare
                  </label>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </ModuleShell>
  );
}
