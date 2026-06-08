import { useMemo } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import {
  ComponentSegmented,
  PeriodToggle,
  TargetPercentileControl,
  WeightingToggle,
} from '@/components/layout/Filters';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DerivedTag } from '@/components/ui/Badge';
import { RagLegend } from '@/components/ui/RagBadge';
import { DivergingBars, type DivergingRow } from '@/components/charts/DivergingBars';
import { LEVEL_LABELS_SHORT, LEVELS } from '@/domain/levels';
import { COMPONENT_LABELS } from '@/domain/components';
import { budgetSimulation } from '@/lib/benchmark';
import { formatPercentileLabel } from '@/lib/format';
import { useActiveTable, useAppStore } from '@/store/useAppStore';
import { BudgetHeadline } from './BudgetHeadline';
import { BudgetTable } from './BudgetTable';

export function BudgetSimulator() {
  const meta = useAppStore((s) => s.dataset.meta);
  const weighting = useAppStore((s) => s.weighting);
  const period = useAppStore((s) => s.period);
  const component = useAppStore((s) => s.component);
  const tmp = useAppStore((s) => s.targetPercentile);
  const table = useActiveTable();

  // Budget only makes sense for cash (GND k); a % budget (Bonus %) is nonsensical.
  const isCash = table != null && table.unit === 'GND_K';

  // Single source of truth for every figure on the page (§5 — components only render).
  const sim = useMemo(
    () => (table && isCash ? budgetSimulation(table, tmp) : null),
    [table, isCash, tmp],
  );
  const hasBudget = sim != null && sim.totalIncumbents > 0;

  const barData = useMemo<DivergingRow[]>(
    () =>
      sim
        ? LEVELS.map((l) => ({ name: LEVEL_LABELS_SHORT[l], value: sim.perLevel[l] }))
        : [],
    [sim],
  );

  const componentLabel = COMPONENT_LABELS[component];
  const targetLabel = formatPercentileLabel(tmp);
  const subtitle = `${componentLabel} · ${weighting === 'FIRM' ? 'Firm-weighted' : 'Incumbent-weighted'} · ${period === 'TARGET' ? `${meta.reportYear} target` : `${meta.reportYear - 1} actual`}`;

  return (
    <ModuleShell
      title="Budget Simulator"
      subtitle={subtitle}
      module={4}
      controls={
        <>
          <WeightingToggle />
          <PeriodToggle />
          <ComponentSegmented />
          <TargetPercentileControl />
        </>
      }
    >
      {table && sim && hasBudget ? (
        <>
          <BudgetHeadline
            sim={sim}
            unit={table.unit}
            targetLabel={targetLabel}
            firmName={meta.yourFirmName}
            componentLabel={componentLabel}
          />

          <Card
            title={`Cost-to-target by career level — ${componentLabel}`}
            subtitle={`Move Your Firm's per-level median to the ${targetLabel} market percentile. Level budget = (target − firm median) × incumbents.`}
            right={
              <div className="flex items-center gap-2">
                {table.derived ? <DerivedTag title={table.note} /> : null}
              </div>
            }
            flush
          >
            <BudgetTable sim={sim} unit={table.unit} />
            <div className="border-t border-border px-5 py-3">
              <RagLegend />
            </div>
          </Card>

          <Card
            title="Level budget deltas"
            subtitle="Positive bars raise pay toward target (cost); negative bars sit above target (saving headroom)."
          >
            <DivergingBars data={barData} unit={table.unit} />
          </Card>
        </>
      ) : (
        <Card
          title={`Budget simulation — ${componentLabel}`}
          subtitle="Cost to align Your Firm with the target market percentile."
        >
          <EmptyState
            message={
              table && !isCash
                ? `Budget simulation applies to cash components (GND k). ${componentLabel} is a ratio (% of basic) — switch to Basic Salary, Bonus or TCC to plan a budget.`
                : `No ${componentLabel} data for ${weighting === 'FIRM' ? 'firm' : 'incumbent'}-weighted ${period.toLowerCase()}. Ingest the source workbook to populate this combination, or switch to a combination present in the Greenland sample.`
            }
          />
        </Card>
      )}
    </ModuleShell>
  );
}
