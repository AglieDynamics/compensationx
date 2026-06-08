/**
 * Core typed domain model (§4.1).
 *
 * The whole app reads from a single active `Dataset`. All numbers live here;
 * components render, `lib/benchmark.ts` computes — nothing is duplicated.
 */

import type { Component, Period, Unit, Weighting } from './components';
import type { Level, SubLevel } from './levels';

/** The 19 reported percentiles: 5th -> 95th in 5% steps (§3.4). */
export const PERCENTILES: readonly number[] = [
  0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85,
  0.9, 0.95,
];

/** Canonical string key for a percentile value (always two decimals: 0.1 -> "0.10"). */
export function percentileKey(p: number): string {
  return p.toFixed(2);
}

/** The 19 percentile keys, "0.05" .. "0.95". */
export const PERCENTILE_KEYS: readonly string[] = PERCENTILES.map(percentileKey);

export const NAMED_PERCENTILES = {
  min: 0.05,
  lowerQuartile: 0.25,
  median: 0.5,
  upperQuartile: 0.75,
  max: 0.95,
} as const;

/** A condensed percentile set for compact tables (5 / 25 / 50 / 75 / 95). */
export const CONDENSED_PERCENTILES: readonly number[] = [0.05, 0.25, 0.5, 0.75, 0.95];

/** Your-Firm statistics for a sublevel (§3.5). `incumbents` only on aggregates. */
export interface FirmStats {
  incumbents?: number | null;
  max: number | null;
  mean: number | null;
  midpoint: number | null;
  median: number | null;
  min: number | null;
}

/** Market statistics for a sublevel (§3.5). `incumbents` only on aggregates. */
export interface MarketStats {
  firms: number | null;
  incumbents?: number | null;
  max: number | null; // = 95th
  mean: number | null;
  midpoint: number | null;
  median: number | null; // = 50th
  min: number | null; // = 5th
}

export interface SubLevelData {
  subLevel: SubLevel;
  firm: FirmStats;
  market: MarketStats;
  /** Market value at each of the 19 percentiles. Keys "0.05".."0.95". */
  percentiles: Record<string, number | null>;
}

export interface ComponentTable {
  weighting: Weighting;
  period: Period;
  component: Component;
  unit: Unit;
  rows: Partial<Record<SubLevel, SubLevelData>>;
  /** True when the table was synthesised (e.g. derived from published YoY medians). */
  derived?: boolean;
  /** Human-readable provenance note shown in the UI when `derived` is true. */
  note?: string;
}

/** Report scope constants (§3.7). */
export interface ReportScope {
  country: string;
  currency: string;
  reportYear: number;
  participatingFirms: number;
  marketIncumbents: number;
  yourFirmIncumbents: number;
  targetMarketPercentile: number;
  dataGatheredUpTo: string;
  fxRateDate: string;
  salaryForecastPct: number;
  costOfLivingVsReference: number;
  easeOfDoingBusinessRank: string;
  yourFirmName: string;
}

/** Headcount distribution by level (§ Module 1 incumbent distribution). */
export interface IncumbentDistribution {
  firm: Record<Level, number>;
  market: Record<Level, number>;
}

/** Published YoY median % change per component, per level (§ Module 3). */
export interface YoYReference {
  illustrative: boolean;
  byComponent: Partial<Record<Component, Record<Level, number>>>;
}

/** Published growth factors per component (§ Module 3). */
export interface GrowthFactorRef {
  value: number;
  illustrative: boolean;
}

export interface GrowthReference {
  /** keyed by `${weighting}:${period}:${component}` */
  byKey: Record<string, GrowthFactorRef>;
}

// --- Module 5 — Additional Career Issues (§6 Module 5, Appendix B) ---

export interface CareerProgression {
  illustrative: boolean;
  averages: { typical: number; fast: number; slow: number };
  yourFirm: { typical: number; fast: number; slow: number };
  perLevelTypical: Record<Level, number>;
}

export interface StartingSalaries {
  illustrative: boolean;
  rows: { label: string; market: number; yourFirm: number }[];
}

export interface UtilisationTarget {
  level: Level;
  marketMin: number;
  marketMax: number;
  yourFirm: number;
}

export interface RangeVsFirm {
  label: string;
  marketMin: number;
  marketMax: number;
  yourFirm: number | null;
}

export interface ExpectedSalaryChange {
  level: Level;
  marketMin: number;
  marketMax: number;
  yourFirm: number;
}

export interface OvertimeCell {
  group: 'Non-managerial' | 'Managerial';
  kind: 'Overtime pay' | 'Time off in lieu';
  yourFirm: string;
}

export interface CareerIssues {
  illustrative: boolean;
  progression: CareerProgression;
  startingSalaries: StartingSalaries;
  signOnNote: string;
  internshipNote: string;
  utilisation: UtilisationTarget[];
  salesTargets: RangeVsFirm[];
  projectRevenueTargets: RangeVsFirm[];
  expectedSalaryChange: ExpectedSalaryChange[];
  overtime: OvertimeCell[];
}

// --- Module 7 — Pulse Survey (§6 Module 7) ---

export interface PulseResponse {
  area: 'GCC' | 'NON_GCC';
  section: string;
  questionId: string;
  question: string;
  item?: string;
  responseType: 'SINGLE' | 'MULTI';
  response: string;
  comment?: string;
}

export interface PulseDataset {
  sections: string[];
  responses: PulseResponse[];
}

export interface Dataset {
  meta: ReportScope;
  tables: ComponentTable[];
  distribution: IncumbentDistribution;
  yoy?: YoYReference;
  growth?: GrowthReference;
  careerIssues?: CareerIssues;
  pulse?: PulseDataset;
}

/** Build the lookup key used in `GrowthReference.byKey`. */
export function tableKey(weighting: Weighting, period: Period, component: Component): string {
  return `${weighting}:${period}:${component}`;
}

/** Select a single table for a (weighting × period × component) combo, or undefined. */
export function selectTable(
  ds: Dataset,
  weighting: Weighting,
  period: Period,
  component: Component,
): ComponentTable | undefined {
  return ds.tables.find(
    (t) => t.weighting === weighting && t.period === period && t.component === component,
  );
}

/** The set of components present for a given weighting × period combo. */
export function availableComponents(
  ds: Dataset,
  weighting: Weighting,
  period: Period,
): Set<Component> {
  const set = new Set<Component>();
  for (const t of ds.tables) {
    if (t.weighting === weighting && t.period === period) set.add(t.component);
  }
  return set;
}

/** Every component present in the dataset across any weighting/period. */
export function allPresentComponents(ds: Dataset): Set<Component> {
  return new Set(ds.tables.map((t) => t.component));
}
