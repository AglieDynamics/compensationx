/**
 * Executive Summary — local view-model assembly (Module 3).
 *
 * Pure, deterministic shaping of the active dataset into the three section
 * models the page renders. ALL arithmetic delegates to @/lib/benchmark.ts;
 * nothing here recomputes a formula. Missing combinations resolve to `null`
 * fields / `present: false` so the view degrades to tidy empty-states.
 */

import {
  COMPONENT_LABELS,
  PERIOD_YEARS,
  type Component,
  type Weighting,
} from '@/domain/components';
import { aggregateOf, LEVEL_LABELS_SHORT, LEVELS, type Level } from '@/domain/levels';
import {
  growthFactor,
  quartileBox,
  type QuartileBox,
  yoyMedianChange,
} from '@/lib/benchmark';
import {
  type ComponentTable,
  type Dataset,
  selectTable,
  tableKey,
} from '@/domain/types';

/** Components surfaced in the target-vs-actual box section, in display order. */
export const SUMMARY_BOX_COMPONENTS: readonly Component[] = ['BASIC_SALARY', 'BONUS_PCT', 'TCC'];

/** A level's TARGET vs ACTUAL five-number summaries (market percentile curve). */
export interface BoxPairRow {
  level: Level;
  label: string;
  target: QuartileBox;
  actual: QuartileBox;
}

export interface BoxSection {
  component: Component;
  label: string;
  present: boolean;
  /** True when neither table is the directly-reported source (derived/illustrative). */
  derived: boolean;
  note: string | undefined;
  unit: ComponentTable['unit'] | null;
  rows: BoxPairRow[];
}

const EMPTY_BOX: QuartileBox = { min: null, q1: null, median: null, q3: null, max: null };

/** Build the target-vs-actual box model for one component. */
export function buildBoxSection(
  ds: Dataset,
  weighting: Weighting,
  component: Component,
): BoxSection {
  const target = selectTable(ds, weighting, 'TARGET', component);
  const actual = selectTable(ds, weighting, 'ACTUAL', component);
  const present = target != null || actual != null;
  const ref = target ?? actual;

  const rows: BoxPairRow[] = LEVELS.map((level) => {
    const agg = aggregateOf(level);
    return {
      level,
      label: LEVEL_LABELS_SHORT[level],
      target: target ? quartileBox(target.rows[agg]) : EMPTY_BOX,
      actual: actual ? quartileBox(actual.rows[agg]) : EMPTY_BOX,
    };
  });

  return {
    component,
    label: COMPONENT_LABELS[component],
    present,
    derived: Boolean(target?.derived || actual?.derived),
    note: target?.note ?? actual?.note,
    unit: ref?.unit ?? null,
    rows,
  };
}

/** YoY median change per level: prev-year (ACTUAL) vs current-year (TARGET). */
export interface YoYRow {
  level: Level;
  label: string;
  prev: number | null;
  current: number | null;
  pct: number | null;
  abs: number | null;
}

export interface YoYSection {
  component: Component;
  label: string;
  present: boolean;
  /** 'live' = both tables present; 'reference' = published YoY fallback; 'none'. */
  source: 'live' | 'reference' | 'none';
  illustrative: boolean;
  /** True when a contributing table is synthesised (e.g. derived prior-year). */
  derived: boolean;
  prevYear: number;
  currentYear: number;
  rows: YoYRow[];
}

/**
 * Build the YoY section for one component. When both TARGET and ACTUAL tables
 * exist the change is computed live; otherwise it falls back to the published
 * `dataset.yoy` reference (illustrative) with prev/current bars left null.
 */
export function buildYoYSection(
  ds: Dataset,
  weighting: Weighting,
  component: Component,
): YoYSection {
  const target = selectTable(ds, weighting, 'TARGET', component);
  const actual = selectTable(ds, weighting, 'ACTUAL', component);
  const prevYear = PERIOD_YEARS.ACTUAL;
  const currentYear = PERIOD_YEARS.TARGET;
  const base = {
    component,
    label: COMPONENT_LABELS[component],
    prevYear,
    currentYear,
  };

  if (target && actual) {
    const rows: YoYRow[] = LEVELS.map((level) => {
      const agg = aggregateOf(level);
      const change = yoyMedianChange(target, actual, level);
      return {
        level,
        label: LEVEL_LABELS_SHORT[level],
        prev: actual.rows[agg]?.market.median ?? null,
        current: target.rows[agg]?.market.median ?? null,
        pct: change.pct,
        abs: change.abs,
      };
    });
    const present = rows.some((r) => r.pct != null || r.prev != null || r.current != null);
    const derived = Boolean(target.derived || actual.derived);
    return { ...base, present, source: 'live', illustrative: false, derived, rows };
  }

  const reference = ds.yoy?.byComponent[component];
  if (reference) {
    const rows: YoYRow[] = LEVELS.map((level) => ({
      level,
      label: LEVEL_LABELS_SHORT[level],
      prev: null,
      current: null,
      pct: reference[level] ?? null,
      abs: null,
    }));
    return {
      ...base,
      present: rows.some((r) => r.pct != null),
      source: 'reference',
      illustrative: ds.yoy?.illustrative ?? true,
      derived: false,
      rows,
    };
  }

  return {
    ...base,
    present: false,
    source: 'none',
    illustrative: false,
    derived: false,
    rows: LEVELS.map((level) => ({
      level,
      label: LEVEL_LABELS_SHORT[level],
      prev: null,
      current: null,
      pct: null,
      abs: null,
    })),
  };
}

/** Methodology band for a growth multiplier (§5 thresholds). */
export type GrowthBand = 'limited' | 'solid' | 'strong';

export function growthBand(value: number | null): GrowthBand | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 8) return 'limited';
  if (value <= 11) return 'solid';
  return 'strong';
}

export const GROWTH_BAND_LABEL: Record<GrowthBand, string> = {
  limited: 'Limited (<8×)',
  solid: 'Solid (8–11×)',
  strong: 'Strong (>11×)',
};

export interface GrowthRow {
  component: Component;
  label: string;
  value: number | null;
  band: GrowthBand | null;
  illustrative: boolean;
}

/**
 * Growth-factor model across the box components for the TARGET period.
 * Live `growthFactor(table)` when the table is present; otherwise the published
 * `dataset.growth.byKey` reference (illustrative). Components with neither are
 * dropped from the chart.
 */
export function buildGrowthRows(ds: Dataset, weighting: Weighting): GrowthRow[] {
  const rows: GrowthRow[] = [];
  for (const component of SUMMARY_BOX_COMPONENTS) {
    const table = selectTable(ds, weighting, 'TARGET', component);
    if (table) {
      const value = growthFactor(table);
      if (value != null) {
        rows.push({
          component,
          label: COMPONENT_LABELS[component],
          value,
          band: growthBand(value),
          illustrative: false,
        });
        continue;
      }
    }
    const ref = ds.growth?.byKey[tableKey(weighting, 'TARGET', component)];
    if (ref) {
      rows.push({
        component,
        label: COMPONENT_LABELS[component],
        value: ref.value,
        band: growthBand(ref.value),
        illustrative: ref.illustrative,
      });
    }
  }
  return rows;
}
