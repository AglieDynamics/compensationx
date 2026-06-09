/**
 * C3 — Adjustment Simulator (cohort). Pure, deterministic methods that propose a
 * new base pay per employee, then aggregate the cost / count / compa-ratio shift.
 *
 * Reuses the v3 comp/economics math for EMPLOYEE cohorts — this is NOT the v1
 * survey Budget simulator (that operates on survey medians by level). Label in
 * the UI: rule/statistics-based; ML upgrade is platform-track.
 *
 * Divide-by-zero / missing structure → the employee is left unchanged (delta 0),
 * never NaN.
 */

import type { Level } from '@/domain/levels';
import type { Employee, PerformanceRating } from '@/domain/employee';
import type { EmployeeMapping } from '@/lib/comp';
import { compaRatio } from '@/lib/comp';
import { marketReference } from '@/lib/marketReference';
import { type Dataset } from '@/domain/types';
import { attrition, numericPosition, retentionParams } from '@/lib/capital';
import { percentilePositionOf } from '@/lib/benchmark';
import { aggregateOf } from '@/domain/levels';
import { selectTable } from '@/domain/types';
import { BASELINE_ATTRITION, type GlobalAssumptions, PRICING, STRUCTURE } from '@/lib/assumptions';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export type AdjustmentMethod =
  | 'to-midpoint'
  | 'to-market-median'
  | 'to-policy-corridor'
  | 'to-competitive-zone'
  | 'compression-fix'
  | 'merit-matrix';

export const ADJUSTMENT_METHODS: { value: AdjustmentMethod; label: string; note: string }[] = [
  { value: 'to-midpoint', label: 'To midpoint', note: 'Raise everyone below midpoint to 100% compa.' },
  { value: 'to-market-median', label: 'To market median', note: 'Raise below-market pay to the survey 50th percentile.' },
  { value: 'to-policy-corridor', label: 'To policy corridor', note: 'Pull compa-ratios into the 95–105% band.' },
  { value: 'to-competitive-zone', label: 'To competitive zone', note: 'Bring pay within ±10% of the family market reference.' },
  { value: 'compression-fix', label: 'Compression fix', note: 'Raise managers to ≥ X% above their reports’ median.' },
  { value: 'merit-matrix', label: 'Merit matrix', note: 'Merit % by performance × position-in-range.' },
];

export interface CohortScope {
  family: string | 'all';
  level: Level | 'all';
  businessUnit: string | 'all';
}

export interface MeritMatrixParams {
  /** Merit % grid indexed [perf 1..5][position bucket: low/mid/high]. */
  budgetPct?: number; // overall cap; merit cells are scaled to respect it when set
}

export interface CompressionParams {
  /** Minimum manager premium over subordinate median (fraction, e.g. 0.15). */
  minPremium: number;
}

export interface CohortOptions {
  /** ±band for the competitive-zone method (fraction). Default 0.10. */
  competitiveBand?: number;
  /** Policy corridor [lo, hi] compa-ratio. Default [0.95, 1.05]. */
  corridor?: readonly [number, number];
  compression?: CompressionParams;
  merit?: MeritMatrixParams;
}

export interface EmployeeAdjustment {
  employee: Employee;
  oldPay: number;
  newPay: number;
  delta: number;
  oldCompa: number | null;
  newCompa: number | null;
}

export interface CohortGroupResult {
  key: string;
  label: string;
  headcount: number;
  affected: number;
  totalCost: number; // sum of deltas (annualized recurring, GND k)
}

export interface CompaBucket {
  label: string;
  /** Inclusive lower / exclusive upper compa-ratio bound (last bucket open-ended). */
  lo: number;
  hi: number;
  before: number;
  after: number;
}

export interface CohortResult {
  method: AdjustmentMethod;
  adjustments: EmployeeAdjustment[];
  totalCost: number;
  affected: number;
  affectedPct: number | null;
  cohortSize: number;
  byBusinessUnit: CohortGroupResult[];
  byFamily: CohortGroupResult[];
  compaShift: CompaBucket[];
  avgCompaBefore: number | null;
  avgCompaAfter: number | null;
  /** Modeled HCROI / retention effect from the move (reuses v2 retention logistic). */
  retentionEffect: RetentionEffect | null;
}

export interface RetentionEffect {
  /** Avg attrition probability before / after the move (population-weighted). */
  attritionBefore: number | null;
  attritionAfter: number | null;
  /** Expected regrettable exits avoided per year (headcount). */
  exitsAvoided: number | null;
  note: string;
}

const COMPA_BUCKETS: { label: string; lo: number; hi: number }[] = [
  { label: '<80%', lo: 0, hi: 0.8 },
  { label: '80–90%', lo: 0.8, hi: 0.9 },
  { label: '90–95%', lo: 0.9, hi: 0.95 },
  { label: '95–105%', lo: 0.95, hi: 1.05 },
  { label: '105–115%', lo: 1.05, hi: 1.15 },
  { label: '≥115%', lo: 1.15, hi: Number.POSITIVE_INFINITY },
];

function inScope(e: Employee, scope: CohortScope): boolean {
  return (
    (scope.family === 'all' || e.jobFamily === scope.family) &&
    (scope.level === 'all' || e.level === scope.level) &&
    (scope.businessUnit === 'all' || e.businessUnit === scope.businessUnit)
  );
}

/** Default merit grid: merit % by performance rating × position-in-range bucket. */
function meritPct(perf: PerformanceRating | undefined, penetration: number | null): number {
  const rating: PerformanceRating = perf ?? 3;
  // position bucket: lower in range earns more merit (range-penetration <0.4 / 0.4–0.7 / >0.7)
  const posBucket = !isNum(penetration) ? 1 : penetration < 0.4 ? 0 : penetration <= 0.7 ? 1 : 2;
  // grid[rating-1][posBucket]
  const grid: number[][] = [
    [0.0, 0.0, 0.0], // 1 — below expectations: no merit
    [0.01, 0.005, 0.0], // 2
    [0.03, 0.02, 0.015], // 3 — meets
    [0.05, 0.04, 0.03], // 4 — exceeds
    [0.08, 0.06, 0.045], // 5 — outstanding
  ];
  return grid[rating - 1]?.[posBucket] ?? 0;
}

interface Targeter {
  (m: EmployeeMapping): number;
}

/** Per-method new-pay function. Each returns the proposed new base (≥ old pay by default). */
function buildTargeter(
  method: AdjustmentMethod,
  ds: Dataset,
  assumptions: GlobalAssumptions,
  scopeEmployees: Employee[],
  opts: CohortOptions,
): Targeter {
  const band = isNum(opts.competitiveBand) ? opts.competitiveBand : 0.1;
  const corridor = opts.corridor ?? [STRUCTURE.policyMidpointCompa, 1.05];
  const corridorLo = corridor[0] ?? 0.95;

  if (method === 'compression-fix') {
    const minPremium = opts.compression?.minPremium ?? 0.15;
    // Build manager → subordinate-median map from the in-scope population.
    const byId = new Map<string, Employee>();
    for (const e of scopeEmployees) byId.set(e.id, e);
    const reports = new Map<string, number[]>();
    for (const e of scopeEmployees) {
      if (e.managerId && byId.has(e.managerId)) {
        const arr = reports.get(e.managerId);
        if (arr) arr.push(e.basePay);
        else reports.set(e.managerId, [e.basePay]);
      }
    }
    const subMedian = new Map<string, number>();
    for (const [mgr, pays] of reports) {
      const sorted = [...pays].sort((a, b) => a - b);
      const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
      subMedian.set(mgr, mid);
    }
    return (m) => {
      const med = subMedian.get(m.employee.id);
      if (!isNum(med) || med <= 0) return m.employee.basePay;
      const floor = med * (1 + minPremium);
      return Math.max(m.employee.basePay, floor);
    };
  }

  if (method === 'merit-matrix') {
    return (m) => {
      const pct = meritPct(m.employee.performanceRating, m.rangePenetration);
      return m.employee.basePay * (1 + pct);
    };
  }

  // Market reference per (level, family, geo) — memoized by key.
  const refCache = new Map<string, number | null>();
  const refFor = (e: Employee, percentile: number): number | null => {
    const key = `${e.level}|${e.jobFamily}|${e.geography}|${percentile}`;
    if (refCache.has(key)) return refCache.get(key) ?? null;
    const ref = marketReference(ds, assumptions, {
      level: e.level,
      jobFamily: e.jobFamily,
      geography: e.geography,
      percentile,
    });
    const v = ref?.value ?? null;
    refCache.set(key, v);
    return v;
  };

  if (method === 'to-midpoint') {
    return (m) => {
      const mid = m.grade?.midpoint ?? null;
      if (!isNum(mid)) return m.employee.basePay;
      return Math.max(m.employee.basePay, mid); // raise to 100% compa; no cuts
    };
  }

  if (method === 'to-market-median') {
    return (m) => {
      const med = refFor(m.employee, PRICING.matchPercentile);
      if (!isNum(med)) return m.employee.basePay;
      return Math.max(m.employee.basePay, med);
    };
  }

  if (method === 'to-policy-corridor') {
    return (m) => {
      const mid = m.grade?.midpoint ?? null;
      if (!isNum(mid) || mid <= 0) return m.employee.basePay;
      const compa = m.employee.basePay / mid;
      if (compa < corridorLo) return mid * corridorLo; // pull up into the band; never cut high payers
      return m.employee.basePay;
    };
  }

  // to-competitive-zone: within ±band of the family market reference (50th).
  return (m) => {
    const ref = refFor(m.employee, PRICING.matchPercentile);
    if (!isNum(ref) || ref <= 0) return m.employee.basePay;
    const lowFloor = ref * (1 - band);
    if (m.employee.basePay < lowFloor) return lowFloor; // raise into zone; leave above-zone alone
    return m.employee.basePay;
  };
}

function bucketIndex(compa: number): number {
  for (let i = 0; i < COMPA_BUCKETS.length; i++) {
    const b = COMPA_BUCKETS[i]!;
    if (compa >= b.lo && compa < b.hi) return i;
  }
  return COMPA_BUCKETS.length - 1;
}

/** Population-weighted average attrition over the cohort at a given pay percentile basis. */
function avgAttrition(
  adjustments: EmployeeAdjustment[],
  ds: Dataset,
  assumptions: GlobalAssumptions,
  which: 'old' | 'new',
): number | null {
  const rp = retentionParams(assumptions);
  let sum = 0;
  let n = 0;
  // memoize percentile curve per level
  const curveCache = new Map<Level, Record<string, number | null> | null>();
  const curveFor = (level: Level): Record<string, number | null> | null => {
    if (curveCache.has(level)) return curveCache.get(level) ?? null;
    const row = selectTable(ds, 'FIRM', 'TARGET', 'BASIC_SALARY')?.rows[aggregateOf(level)];
    const c = row?.percentiles ?? null;
    curveCache.set(level, c);
    return c;
  };
  for (const a of adjustments) {
    const curve = curveFor(a.employee.level);
    if (!curve) continue;
    const pay = which === 'old' ? a.oldPay : a.newPay;
    const pos = numericPosition(percentilePositionOf(pay, curve));
    if (!isNum(pos)) continue;
    const attr = attrition(pos, BASELINE_ATTRITION[a.employee.level], rp);
    if (!isNum(attr)) continue;
    sum += attr;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

/**
 * Run an adjustment method over a cohort. `mappings` are the firm-wide employee
 * mappings (against the published structure); we filter to scope, propose new pay,
 * and aggregate cost / counts / compa-ratio shift, plus a modeled retention effect.
 */
export function runCohortAdjustment(
  method: AdjustmentMethod,
  mappings: EmployeeMapping[],
  scope: CohortScope,
  ds: Dataset,
  assumptions: GlobalAssumptions,
  opts: CohortOptions = {},
): CohortResult {
  const inScopeMappings = mappings.filter((m) => inScope(m.employee, scope));
  const scopeEmployees = inScopeMappings.map((m) => m.employee);
  const target = buildTargeter(method, ds, assumptions, scopeEmployees, opts);

  const adjustments: EmployeeAdjustment[] = inScopeMappings.map((m) => {
    const oldPay = m.employee.basePay;
    let newPay = target(m);
    if (!isNum(newPay)) newPay = oldPay;
    // No method cuts pay; clamp to avoid float drift below old.
    newPay = Math.max(oldPay, newPay);
    const mid = m.grade?.midpoint ?? null;
    return {
      employee: m.employee,
      oldPay,
      newPay,
      delta: newPay - oldPay,
      oldCompa: m.compaRatio,
      newCompa: compaRatio(newPay, mid),
    };
  });

  const totalCost = adjustments.reduce((a, x) => a + x.delta, 0);
  const affected = adjustments.filter((a) => a.delta > 1e-6).length;
  const cohortSize = adjustments.length;

  // Group aggregations.
  const groupBy = (keyFn: (e: Employee) => string): CohortGroupResult[] => {
    const map = new Map<string, { head: number; affected: number; cost: number }>();
    for (const a of adjustments) {
      const key = keyFn(a.employee);
      const g = map.get(key) ?? { head: 0, affected: 0, cost: 0 };
      g.head += 1;
      if (a.delta > 1e-6) g.affected += 1;
      g.cost += a.delta;
      map.set(key, g);
    }
    return [...map.entries()]
      .map(([key, g]) => ({ key, label: key, headcount: g.head, affected: g.affected, totalCost: g.cost }))
      .sort((x, y) => y.totalCost - x.totalCost || x.label.localeCompare(y.label));
  };

  const byBusinessUnit = groupBy((e) => e.businessUnit);
  const byFamily = groupBy((e) => e.jobFamily);

  // Compa-ratio distribution shift (only employees with a valid midpoint).
  const before = new Array(COMPA_BUCKETS.length).fill(0);
  const after = new Array(COMPA_BUCKETS.length).fill(0);
  let compaBeforeSum = 0;
  let compaAfterSum = 0;
  let compaN = 0;
  for (const a of adjustments) {
    if (isNum(a.oldCompa)) {
      before[bucketIndex(a.oldCompa)]! += 1;
    }
    if (isNum(a.newCompa)) {
      after[bucketIndex(a.newCompa)]! += 1;
    }
    if (isNum(a.oldCompa) && isNum(a.newCompa)) {
      compaBeforeSum += a.oldCompa;
      compaAfterSum += a.newCompa;
      compaN += 1;
    }
  }
  const compaShift: CompaBucket[] = COMPA_BUCKETS.map((b, i) => ({
    label: b.label,
    lo: b.lo,
    hi: b.hi,
    before: before[i]!,
    after: after[i]!,
  }));

  // Modeled retention effect.
  const attritionBefore = avgAttrition(adjustments, ds, assumptions, 'old');
  const attritionAfter = avgAttrition(adjustments, ds, assumptions, 'new');
  const exitsAvoided =
    isNum(attritionBefore) && isNum(attritionAfter)
      ? Math.max(0, attritionBefore - attritionAfter) * cohortSize
      : null;
  const retentionEffect: RetentionEffect = {
    attritionBefore,
    attritionAfter,
    exitsAvoided,
    note: 'Modeled via the v2 retention logistic on the survey pay-percentile curve. Rule/statistics-based; ML upgrade is platform-track.',
  };

  return {
    method,
    adjustments,
    totalCost,
    affected,
    affectedPct: cohortSize > 0 ? affected / cohortSize : null,
    cohortSize,
    byBusinessUnit,
    byFamily,
    compaShift,
    avgCompaBefore: compaN > 0 ? compaBeforeSum / compaN : null,
    avgCompaAfter: compaN > 0 ? compaAfterSum / compaN : null,
    retentionEffect,
  };
}

export { clamp };
