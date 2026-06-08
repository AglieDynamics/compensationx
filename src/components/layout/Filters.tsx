/**
 * Filter controls bound to the global store. Modules compose the subset they need.
 */

import { Segmented } from '@/components/ui/Segmented';
import { MultiSelectChips } from '@/components/ui/MultiSelectChips';
import { PercentileSlider } from '@/components/ui/PercentileSlider';
import {
  COMPONENT_LABELS,
  PERIOD_LABELS,
  PRIMARY_COMPONENTS,
  type Component,
  type Period,
  type Weighting,
} from '@/domain/components';
import { LEVEL_LABELS, LEVELS, type Level } from '@/domain/levels';
import { useAppStore, useAvailableComponents } from '@/store/useAppStore';

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

export function WeightingToggle() {
  const value = useAppStore((s) => s.weighting);
  const setWeighting = useAppStore((s) => s.setWeighting);
  return (
    <FilterField label="Weighting">
      <Segmented<Weighting>
        ariaLabel="Weighting"
        value={value}
        onChange={setWeighting}
        options={[
          { value: 'FIRM', label: 'Firm' },
          { value: 'INCUMBENT', label: 'Incumbent' },
        ]}
      />
    </FilterField>
  );
}

export function PeriodToggle() {
  const value = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  return (
    <FilterField label="Year / status">
      <Segmented<Period>
        ariaLabel="Year / status"
        value={value}
        onChange={setPeriod}
        options={(['TARGET', 'ACTUAL'] as Period[]).map((p) => ({
          value: p,
          label: `${PERIOD_LABELS[p]}`,
        }))}
      />
    </FilterField>
  );
}

export function ComponentSegmented() {
  const value = useAppStore((s) => s.component);
  const setComponent = useAppStore((s) => s.setComponent);
  const available = useAvailableComponents();
  return (
    <FilterField label="Component">
      <Segmented<Component>
        ariaLabel="Component"
        value={value}
        onChange={setComponent}
        options={PRIMARY_COMPONENTS.map((c) => ({
          value: c,
          label: COMPONENT_LABELS[c],
          disabled: !available.has(c),
        }))}
      />
    </FilterField>
  );
}

export function LevelChips() {
  const levels = useAppStore((s) => s.levels);
  const toggleLevel = useAppStore((s) => s.toggleLevel);
  return (
    <FilterField label="Career levels">
      <MultiSelectChips<Level>
        ariaLabel="Career levels"
        options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
        selected={levels}
        onToggle={toggleLevel}
      />
    </FilterField>
  );
}

export function TargetPercentileControl() {
  const value = useAppStore((s) => s.targetPercentile);
  const setTargetPercentile = useAppStore((s) => s.setTargetPercentile);
  return (
    <FilterField label="Target percentile">
      <PercentileSlider label="" value={value} onChange={setTargetPercentile} />
    </FilterField>
  );
}
