/**
 * Pure compute library (§5). No I/O, no state, deterministic.
 * Every derived metric in §3.6 is computed here; components only render.
 *
 * Robust to missing data: divide-by-zero, absent sublevels and non-numeric
 * cells degrade to `null` — never `NaN`.
 */

import { aggregateOf, LEVELS, type Level, subLevelsOf } from '@/domain/levels';
import {
  type ComponentTable,
  percentileKey,
  PERCENTILES,
  type SubLevelData,
} from '@/domain/types';

export type RagStatus = 'green' | 'amber' | 'red';
export type PercentilePosition = number | '>95%' | '<5%';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

interface PctPoint {
  p: number;
  v: number;
}

/** Available (percentile, value) points in ascending percentile order. */
function pctPoints(percentiles: Record<string, number | null>): PctPoint[] {
  const pts: PctPoint[] = [];
  for (const p of PERCENTILES) {
    const v = percentiles[percentileKey(p)];
    if (isNum(v)) pts.push({ p, v });
  }
  return pts;
}

/**
 * §3.6.2 — Target Market Percentile value: piecewise-linear interpolation across
 * the 19 points, clamped to the [lowest, highest] available percentile endpoints.
 */
export function marketValueAtPercentile(
  percentiles: Record<string, number | null>,
  p: number,
): number | null {
  const pts = pctPoints(percentiles);
  if (pts.length === 0) return null;
  const lo = pts[0]!;
  const hi = pts[pts.length - 1]!;
  if (p <= lo.p) return lo.v;
  if (p >= hi.p) return hi.v;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (p >= a.p && p <= b.p) {
      if (b.p === a.p) return a.v;
      const t = (p - a.p) / (b.p - a.p);
      return a.v + t * (b.v - a.v);
    }
  }
  return hi.v;
}

/**
 * §3.6.1 — Position of a value within the market percentile curve.
 * `>95%` if at/above the top point, `<5%` if at/below the bottom point,
 * otherwise the interpolated percentile (0..1). Inverse of the above.
 *
 * Assumes the curve is monotonic non-decreasing in percentile — true for survey
 * data by construction (a higher percentile never pays less). Under a degenerate
 * non-monotonic curve it returns the first bracketing segment.
 */
export function percentilePositionOf(
  value: number | null | undefined,
  percentiles: Record<string, number | null>,
): PercentilePosition | null {
  if (!isNum(value)) return null;
  const pts = pctPoints(percentiles);
  if (pts.length === 0) return null;
  const lo = pts[0]!;
  const hi = pts[pts.length - 1]!;
  if (value >= hi.v) return '>95%';
  if (value <= lo.v) return '<5%';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const lowV = Math.min(a.v, b.v);
    const highV = Math.max(a.v, b.v);
    if (value >= lowV && value <= highV) {
      if (b.v === a.v) return a.p;
      const t = (value - a.v) / (b.v - a.v);
      return a.p + t * (b.p - a.p);
    }
  }
  return null;
}

/** §3.6.6 — Compa-ratio = firm median / TMP. */
export function compaRatio(
  firmMedian: number | null | undefined,
  tmpValue: number | null | undefined,
): number | null {
  if (!isNum(firmMedian) || !isNum(tmpValue) || tmpValue === 0) return null;
  return firmMedian / tmpValue;
}

/** §3.6.3/4 — absolute delta vs TMP. */
export function deviationAbs(
  firmValue: number | null | undefined,
  tmpValue: number | null | undefined,
): number | null {
  if (!isNum(firmValue) || !isNum(tmpValue)) return null;
  return firmValue - tmpValue;
}

/** §3.6.4 — % deviation vs TMP = (firm − TMP) / TMP. */
export function deviationPct(
  firmValue: number | null | undefined,
  tmpValue: number | null | undefined,
): number | null {
  if (!isNum(firmValue) || !isNum(tmpValue) || tmpValue === 0) return null;
  return (firmValue - tmpValue) / tmpValue;
}

/** §3.6.7 — RAG status from a % deviation. */
export function ragStatus(deviation: number | null | undefined): RagStatus | null {
  if (!isNum(deviation)) return null;
  const d = Math.abs(deviation);
  if (d <= 0.05) return 'green';
  if (d <= 0.1) return 'amber';
  return 'red';
}

export interface BudgetResult {
  perLevel: Record<Level, number | null>;
  perLevelDetail: Record<
    Level,
    { firmMedian: number | null; tmp: number | null; gapAbs: number | null; gapPct: number | null; incumbents: number | null; delta: number | null }
  >;
  total: number;
  perHead: number | null;
  totalIncumbents: number;
}

/**
 * §3.6.8 — Budget simulation per career-level aggregate.
 *   levelDelta = (TMP_level − firmMedian_level) × firmIncumbents_level
 *   total = Σ levelDelta ; perHead = total / Σ incumbents
 */
export function budgetSimulation(table: ComponentTable, p: number): BudgetResult {
  const perLevel = {} as Record<Level, number | null>;
  const perLevelDetail = {} as BudgetResult['perLevelDetail'];
  let total = 0;
  let totalIncumbents = 0;

  for (const level of LEVELS) {
    const row = table.rows[aggregateOf(level)];
    const firmMedian = row?.firm.median ?? null;
    const incumbents = row?.firm.incumbents ?? null;
    const tmp = row ? marketValueAtPercentile(row.percentiles, p) : null;
    const gapAbs = deviationAbs(firmMedian, tmp);
    const gapPct = deviationPct(firmMedian, tmp);

    let delta: number | null = null;
    if (isNum(tmp) && isNum(firmMedian) && isNum(incumbents)) {
      delta = (tmp - firmMedian) * incumbents;
      total += delta;
      totalIncumbents += incumbents;
    }
    perLevel[level] = delta;
    perLevelDetail[level] = { firmMedian, tmp, gapAbs, gapPct, incumbents, delta };
  }

  return {
    perLevel,
    perLevelDetail,
    total,
    perHead: totalIncumbents > 0 ? total / totalIncumbents : null,
    totalIncumbents,
  };
}

/**
 * §5 — growth factor: market midpoint of the most-senior rung (Pr3) over the
 * market midpoint of the entry rung (An1). Matches the published ≈3.6× / ≈4.2×.
 */
export function growthFactor(table: ComponentTable): number | null {
  const juniorLevel = LEVELS[0]!;
  const seniorLevel = LEVELS[LEVELS.length - 1]!;
  const entrySub = subLevelsOf(juniorLevel)[0];
  const topSub = subLevelsOf(seniorLevel)[2];
  const entry = table.rows[entrySub]?.market.midpoint ?? null;
  const top = table.rows[topSub]?.market.midpoint ?? null;
  if (!isNum(entry) || !isNum(top) || entry === 0) return null;
  return top / entry;
}

export interface YoYChange {
  abs: number | null;
  pct: number | null;
}

/** §5 — YoY median change for a level between TARGET and ACTUAL tables. */
export function yoyMedianChange(
  targetTable: ComponentTable,
  actualTable: ComponentTable,
  level: Level,
  which: 'firm' | 'market' = 'market',
): YoYChange {
  const agg = aggregateOf(level);
  const t = targetTable.rows[agg];
  const a = actualTable.rows[agg];
  const tMed = which === 'firm' ? t?.firm.median ?? null : t?.market.median ?? null;
  const aMed = which === 'firm' ? a?.firm.median ?? null : a?.market.median ?? null;
  if (!isNum(tMed) || !isNum(aMed) || aMed === 0) return { abs: null, pct: null };
  return { abs: tMed - aMed, pct: (tMed - aMed) / aMed };
}

/**
 * Headcount-weighted overall compa-ratio: the firm-incumbent-weighted mean of the
 * five per-level compa-ratios (KPI on the dashboard). With the Greenland seed this
 * is ≈1.08 at the 50th percentile.
 */
export function overallCompaRatio(table: ComponentTable, p: number): number | null {
  let weighted = 0;
  let weight = 0;
  for (const level of LEVELS) {
    const row = table.rows[aggregateOf(level)];
    if (!row) continue;
    const tmp = marketValueAtPercentile(row.percentiles, p);
    const compa = compaRatio(row.firm.median, tmp);
    const inc = row.firm.incumbents;
    if (compa !== null && isNum(inc)) {
      weighted += compa * inc;
      weight += inc;
    }
  }
  return weight > 0 ? weighted / weight : null;
}

/** Convenience: market value at a sublevel's target percentile. */
export function tmpAt(row: SubLevelData | undefined, p: number): number | null {
  return row ? marketValueAtPercentile(row.percentiles, p) : null;
}

export interface QuartileBox {
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
}

/** Box-chart five-number summary from the percentile curve (5/25/50/75/95). */
export function quartileBox(row: SubLevelData | undefined): QuartileBox {
  if (!row) return { min: null, q1: null, median: null, q3: null, max: null };
  const at = (p: number): number | null => marketValueAtPercentile(row.percentiles, p);
  return { min: at(0.05), q1: at(0.25), median: at(0.5), q3: at(0.75), max: at(0.95) };
}
