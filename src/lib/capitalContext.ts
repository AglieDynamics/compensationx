/**
 * Shared capital-allocation context hook. Centralises the v1 dataset + filters,
 * resolved inputs, active scenario, and the derived segment bases so every lens
 * reads from one place (and Baseline vs Scenario stays consistent).
 */

import { useMemo } from 'react';
import type { Component, Period, Weighting } from '@/domain/components';
import type { GlobalAssumptions, ResolvedInputsByLevel } from '@/lib/assumptions';
import {
  applyScenario,
  buildSegmentBases,
  type CoiOptions,
  type SegmentBase,
} from '@/lib/capital';
import { useAppStore } from '@/store/useAppStore';
import { useResolvedInputsByLevel } from '@/store/inputsStore';
import { useInputsStore } from '@/store/inputsStore';
import { type Scenario, useActiveScenario } from '@/store/scenarioStore';

export interface CapitalContext {
  weighting: Weighting;
  period: Period;
  component: Component;
  targetPercentile: number;
  assumptions: GlobalAssumptions;
  inputs: ResolvedInputsByLevel;
  scenario: Scenario | null;
  baseline: SegmentBase[];
  scenarioBases: SegmentBase[] | null;
  coiOpts: CoiOptions;
}

export function useCapitalContext(): CapitalContext {
  const dataset = useAppStore((s) => s.dataset);
  const weighting = useAppStore((s) => s.weighting);
  const period = useAppStore((s) => s.period);
  const component = useAppStore((s) => s.component);
  const targetPercentile = useAppStore((s) => s.targetPercentile);
  const assumptions = useInputsStore((s) => s.assumptions);
  const inputs = useResolvedInputsByLevel();
  const scenario = useActiveScenario();

  const baseline = useMemo(
    () => buildSegmentBases(dataset, weighting, period, component),
    [dataset, weighting, period, component],
  );
  const scenarioBases = useMemo(
    () => (scenario ? applyScenario(baseline, scenario.moves) : null),
    [baseline, scenario],
  );

  const coiOpts: CoiOptions = useMemo(
    () => ({ horizon: assumptions.coiHorizon, discountRate: assumptions.discountRate, targetPercentile }),
    [assumptions.coiHorizon, assumptions.discountRate, targetPercentile],
  );

  return {
    weighting,
    period,
    component,
    targetPercentile,
    assumptions,
    inputs,
    scenario,
    baseline,
    scenarioBases,
    coiOpts,
  };
}
