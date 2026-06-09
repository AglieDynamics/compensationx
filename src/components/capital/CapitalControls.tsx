import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Select } from '@/components/ui/Select';
import {
  ComponentSegmented,
  PeriodToggle,
  TargetPercentileControl,
  WeightingToggle,
} from '@/components/layout/Filters';
import { useScenarioStore } from '@/store/scenarioStore';
import { useInputsStore } from '@/store/inputsStore';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Baseline ↔ Scenario selector with a "new scenario" shortcut. */
export function ScenarioControl() {
  const scenarios = useScenarioStore((s) => s.scenarios);
  const activeId = useScenarioStore((s) => s.activeScenarioId);
  const setActive = useScenarioStore((s) => s.setActiveScenario);
  const createScenario = useScenarioStore((s) => s.createScenario);

  const options = [
    { value: 'baseline', label: 'Baseline' },
    ...scenarios.map((s) => ({ value: s.id, label: s.name })),
  ];
  // Guard a stale id (e.g. a deleted scenario persisted as active) → fall back to Baseline.
  const value = activeId && scenarios.some((s) => s.id === activeId) ? activeId : 'baseline';

  return (
    <Field label="Scenario">
      <div className="flex items-center gap-1.5">
        <Select
          ariaLabel="Scenario"
          options={options}
          value={value}
          onChange={(v) => setActive(v === 'baseline' ? null : v)}
        />
        <button
          type="button"
          onClick={() => createScenario()}
          title="New scenario"
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[0.78rem] font-medium text-ink-soft transition-colors hover:border-navy-500/40 hover:text-navy-700"
        >
          <Plus size={13} /> New
        </button>
      </div>
    </Field>
  );
}

/** Cost-of-inaction horizon (years), bound to the global assumptions. */
export function CoiHorizonControl() {
  const horizon = useInputsStore((s) => s.assumptions.coiHorizon);
  const setAssumption = useInputsStore((s) => s.setAssumption);
  return (
    <Field label="Horizon">
      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg p-0.5">
        {[1, 2, 3, 5].map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setAssumption('coiHorizon', y)}
            className={`rounded-[6px] px-2.5 py-1 text-[0.8rem] font-medium transition-colors ${
              horizon === y ? 'bg-card text-navy-700 shadow-sm' : 'text-ink-soft hover:text-navy-700'
            }`}
          >
            {y}y
          </button>
        ))}
      </div>
    </Field>
  );
}

/** The common capital control cluster: weighting · period · component · scenario. */
export function CapitalControls({
  showComponent = true,
  showTargetPercentile = false,
}: {
  showComponent?: boolean;
  showTargetPercentile?: boolean;
}) {
  return (
    <>
      <WeightingToggle />
      <PeriodToggle />
      {showComponent && <ComponentSegmented />}
      {showTargetPercentile && <TargetPercentileControl />}
      <ScenarioControl />
    </>
  );
}
