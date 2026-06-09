/**
 * Module C — Control Tower Cockpit (route /). Executive landing page that unifies
 * benchmarking, capital and operations over the EMPLOYEE population. Five tabs:
 *   C1 Control Tower · C2 Job-Family Positioning · C3 Adjustment Simulator
 *   C4 Workforce Economics · C5 Recommendation Engine
 *
 * COMPOSES existing compute (comp.ts / economics.ts / capital.ts / marketReference)
 * and the Module D heuristics (heuristics.ts / cohort.ts / recommendations.ts).
 * Renders only — no formula is recomputed here. Guards every index access; no NaN
 * reaches the DOM. Heuristic features carry a visible "rule/statistics-based; ML
 * upgrade is platform-track" label.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHasEmployees } from '@/store/employeeStore';
import { useCompContext } from '@/lib/compContext';
import { CockpitControlTower } from './CockpitControlTower';
import { CockpitPositioning } from './CockpitPositioning';
import { CockpitSimulator } from './CockpitSimulator';
import { CockpitEconomics } from './CockpitEconomics';
import { CockpitRecommendations } from './CockpitRecommendations';

export function Cockpit() {
  const hasEmployees = useHasEmployees();

  if (!hasEmployees) {
    return (
      <ModuleShell
        title="Compensation Control Tower"
        subtitle="Executive cockpit unifying benchmarking, capital and operations"
      >
        <EmptyState
          icon={<Users size={26} strokeWidth={1.5} />}
          title="No employee population loaded"
          message={
            <span>
              Load or upload employees to populate the cockpit. The survey-only benchmarking and capital
              modules keep working without them.{' '}
              <Link to="/employees" className="inline-flex items-center gap-1 font-semibold text-navy-500 hover:text-navy-700">
                Go to Employees <ArrowRight size={12} />
              </Link>
            </span>
          }
        />
      </ModuleShell>
    );
  }

  return <CockpitBody />;
}

function CockpitBody() {
  const ctx = useCompContext();
  // Reference structure: published when present, else the active design (always defined).
  const structure = ctx.publishedStructure ?? ctx.activeStructure;
  const hasPublished = ctx.publishedStructure !== null;

  // Local finance inputs (default null → revenue metrics show assumption/empty-state).
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [nonLaborOpex, setNonLaborOpex] = useState<number | null>(null);

  const items = useMemo(
    () => [
      {
        value: 'control-tower',
        label: 'Control Tower',
        content: (
          <CockpitControlTower
            ctx={ctx}
            hasPublished={hasPublished}
            totalRevenue={totalRevenue}
            nonLaborOpex={nonLaborOpex}
            onRevenue={setTotalRevenue}
            onOpex={setNonLaborOpex}
          />
        ),
      },
      {
        value: 'positioning',
        label: 'Job-Family Positioning',
        content: <CockpitPositioning ctx={ctx} structure={structure} />,
      },
      {
        value: 'simulator',
        label: 'Adjustment Simulator',
        content: <CockpitSimulator ctx={ctx} />,
      },
      {
        value: 'economics',
        label: 'Workforce Economics',
        content: <CockpitEconomics />,
      },
      {
        value: 'recommendations',
        label: 'Recommendation Engine',
        content: <CockpitRecommendations ctx={ctx} structure={structure} />,
      },
    ],
    [ctx, structure, hasPublished, totalRevenue, nonLaborOpex],
  );

  return (
    <ModuleShell
      title="Compensation Control Tower"
      subtitle="Executive cockpit unifying benchmarking, capital and operations across the employee population"
    >
      <Tabs items={items} ariaLabel="Cockpit sections" />
    </ModuleShell>
  );
}
