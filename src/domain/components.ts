/**
 * Remuneration components (§3.2) and the weighting/period dimensions (§3.3).
 */

export const COMPONENTS = [
  'BASIC_SALARY',
  'ALLOWANCES',
  'BASE_SALARY',
  'BONUS',
  'BONUS_PCT',
  'TCC',
] as const;
export type Component = (typeof COMPONENTS)[number];

export const COMPONENT_LABELS: Record<Component, string> = {
  BASIC_SALARY: 'Basic Salary',
  ALLOWANCES: 'Allowances',
  BASE_SALARY: 'Base Salary',
  BONUS: 'Bonus',
  BONUS_PCT: 'Bonus %',
  TCC: 'TCC',
};

export const COMPONENT_DESCRIPTIONS: Record<Component, string> = {
  BASIC_SALARY: 'Contractually guaranteed cash',
  ALLOWANCES: 'Housing / transport / healthcare / pension / holidays',
  BASE_SALARY: 'Basic Salary + Allowances',
  BONUS: 'Variable cash (absolute)',
  BONUS_PCT: 'Variable cash as % of Basic Salary',
  TCC: 'Total Cash Compensation = Base Salary + Bonus',
};

/** Components surfaced as primary segmented choices on filter bars. */
export const PRIMARY_COMPONENTS: readonly Component[] = [
  'BASIC_SALARY',
  'BONUS',
  'BONUS_PCT',
  'TCC',
];

export type Unit = 'GND_K' | 'RATIO';

/** A component's natural unit. BONUS_PCT is a ratio; everything else is GND thousands. */
export function unitOf(component: Component): Unit {
  return component === 'BONUS_PCT' ? 'RATIO' : 'GND_K';
}

export type Weighting = 'FIRM' | 'INCUMBENT';
export type Period = 'TARGET' | 'ACTUAL';

export const WEIGHTING_LABELS: Record<Weighting, string> = {
  FIRM: 'Firm-weighted',
  INCUMBENT: 'Incumbent-weighted',
};

export const WEIGHTING_DESCRIPTIONS: Record<Weighting, string> = {
  FIRM: 'Each participating firm contributes equally to percentiles',
  INCUMBENT: 'Each consultant contributes; percentiles reflect headcount',
};

export const PERIOD_LABELS: Record<Period, string> = {
  TARGET: 'Target',
  ACTUAL: 'Actual',
};

export const PERIOD_YEARS: Record<Period, number> = {
  TARGET: 2025,
  ACTUAL: 2024,
};
