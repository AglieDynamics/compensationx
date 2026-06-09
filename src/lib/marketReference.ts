/**
 * Market reference for an internal role (§2). Reads the existing survey tables and
 * applies geographic + job-family differentials and an aging factor. Reuses the v2
 * provenance: a pure survey lookup is MEASURED; any applied multiplier (≠1) makes
 * the result ASSUMED (weakest-wins).
 */

import { aggregateOf, type Level } from '@/domain/levels';
import type { Component, Period, Weighting } from '@/domain/components';
import { type Dataset, selectTable } from '@/domain/types';
import { marketValueAtPercentile } from '@/lib/benchmark';
import { FAMILY_DIFFERENTIAL, GEO_DIFFERENTIAL, type GlobalAssumptions } from '@/lib/assumptions';
import type { Provenance, Valued } from '@/lib/provenance';

export interface MarketRefOpts {
  level: Level;
  percentile: number;
  period?: Period;
  weighting?: Weighting;
  component?: Component;
  geography?: string;
  jobFamily?: string;
}

/** Aging factor = (1 + salaryInflation)^agingYears. Guards missing/legacy fields. */
export function agingFactor(assumptions: GlobalAssumptions): number {
  const inflation = Number.isFinite(assumptions.salaryInflation) ? assumptions.salaryInflation : 0;
  const years = Number.isFinite(assumptions.agingYears) ? assumptions.agingYears : 0;
  return Math.pow(1 + inflation, years);
}

export function geoDifferential(geography?: string): number {
  return geography ? (GEO_DIFFERENTIAL[geography] ?? 1) : 1;
}
export function familyDifferential(jobFamily?: string): number {
  return jobFamily ? (FAMILY_DIFFERENTIAL[jobFamily] ?? 1) : 1;
}

/** Market reference value for a role, with provenance. Returns null when the survey combo is absent. */
export function marketReference(
  ds: Dataset,
  assumptions: GlobalAssumptions,
  opts: MarketRefOpts,
): Valued<number> | null {
  const {
    level,
    percentile,
    period = 'TARGET',
    weighting = 'FIRM',
    component = 'BASIC_SALARY',
    geography,
    jobFamily,
  } = opts;

  const row = selectTable(ds, weighting, period, component)?.rows[aggregateOf(level)];
  const base = row ? marketValueAtPercentile(row.percentiles, percentile) : null;
  if (base === null || !Number.isFinite(base)) return null;

  const geo = geoDifferential(geography);
  const fam = familyDifferential(jobFamily);
  const aging = agingFactor(assumptions);
  const value = base * geo * fam * aging;

  // Survey value is MEASURED; any modeled multiplier ≠ 1 downgrades to ASSUMED.
  const modeled = geo !== 1 || fam !== 1 || aging !== 1;
  const provenance: Provenance = modeled ? 'ASSUMED' : 'MEASURED';
  return { value, provenance };
}
