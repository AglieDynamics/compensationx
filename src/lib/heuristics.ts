/**
 * Module D — rule/statistics-based heuristics (NOT ML). Pure, deterministic,
 * unit-tested. Divide-by-zero / missing inputs → null, never NaN. Each function
 * surfaces the statistic that drove the flag so the cockpit can explain itself.
 *
 * Scope label (carried by every surfaced feature): "rule/statistics-based; ML
 * upgrade is platform-track."
 */

import type { Level } from '@/domain/levels';
import type { Employee } from '@/domain/employee';
import type { EmployeeMapping } from '@/lib/comp';
import { attrition, numericPosition, retentionParams } from '@/lib/capital';
import { percentilePositionOf } from '@/lib/benchmark';
import { BASELINE_ATTRITION, type GlobalAssumptions, STRUCTURE } from '@/lib/assumptions';
import type { Provenance } from '@/lib/provenance';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

// ----------------------------------------------------------------------------
// Descriptive statistics (pure)
// ----------------------------------------------------------------------------

export interface Stats {
  n: number;
  mean: number | null;
  sd: number | null; // population standard deviation
  q1: number | null;
  median: number | null;
  q3: number | null;
  iqr: number | null;
}

function quantileSorted(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

export function summarize(values: number[]): Stats {
  const xs = values.filter(isNum);
  const n = xs.length;
  if (n === 0) return { n: 0, mean: null, sd: null, q1: null, median: null, q3: null, iqr: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const sorted = [...xs].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = isNum(q1) && isNum(q3) ? q3 - q1 : null;
  return { n, mean, sd, q1, median, q3, iqr };
}

/** Z-score of x within a sample summary; null when sd is 0 or undefined. */
export function zScore(x: number, stats: Stats): number | null {
  if (!isNum(stats.mean) || !isNum(stats.sd) || stats.sd === 0) return null;
  return (x - stats.mean) / stats.sd;
}

// ----------------------------------------------------------------------------
// Anomaly flags — z-score + IQR outliers within peer buckets, compression,
// midpoint-progression inconsistency.
// ----------------------------------------------------------------------------

export type AnomalyKind =
  | 'outlier-compa-high'
  | 'outlier-compa-low'
  | 'outlier-penetration'
  | 'compression'
  | 'midpoint-inconsistency';

export interface AnomalyFlag {
  kind: AnomalyKind;
  /** Stable key for the subject (employee id, bucket key or grade pair). */
  subject: string;
  label: string;
  message: string;
  /** The statistic that triggered the flag (z, IQR fences, %, etc.). */
  statistic: number | null;
  metric: 'compaRatio' | 'rangePenetration' | 'compression' | 'progression';
  severity: 'amber' | 'red';
}

/** Default z / IQR thresholds (kept here so nothing is hard-coded in the UI). */
export const ANOMALY_THRESHOLDS = {
  z: 2.5,
  iqrK: 1.5,
  /** Manager-vs-subordinate-median compression threshold (Appendix B). */
  compressionPct: STRUCTURE.compressionThresholdPct,
  /** A peer bucket needs at least this many points for a meaningful z/IQR. */
  minBucket: 4,
} as const;

function bucketKey(m: EmployeeMapping): string {
  const e = m.employee;
  return `${e.jobFamily}|${e.level}|${e.geography}`;
}

/**
 * Outliers on compa-ratio & range penetration within family×level×geo buckets,
 * combining the z-score and the IQR fence (flag when EITHER fires — robust to
 * small samples). The reported statistic is the z-score (or the signed IQR
 * exceedance when z is unavailable).
 */
export function outlierFlags(mappings: EmployeeMapping[]): AnomalyFlag[] {
  const buckets = new Map<string, EmployeeMapping[]>();
  for (const m of mappings) {
    const key = bucketKey(m);
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  const flags: AnomalyFlag[] = [];
  for (const [key, group] of buckets) {
    if (group.length < ANOMALY_THRESHOLDS.minBucket) continue;
    flagMetric(group, key, 'compaRatio', flags);
    flagMetric(group, key, 'rangePenetration', flags);
  }
  // Deterministic order: most extreme first, then subject.
  return flags.sort(
    (a, b) => Math.abs(b.statistic ?? 0) - Math.abs(a.statistic ?? 0) || a.subject.localeCompare(b.subject),
  );
}

function flagMetric(
  group: EmployeeMapping[],
  key: string,
  metric: 'compaRatio' | 'rangePenetration',
  out: AnomalyFlag[],
): void {
  const values = group.map((m) => (metric === 'compaRatio' ? m.compaRatio : m.rangePenetration)).filter(isNum);
  if (values.length < ANOMALY_THRESHOLDS.minBucket) return;
  const stats = summarize(values);
  const loFence = isNum(stats.q1) && isNum(stats.iqr) ? stats.q1 - ANOMALY_THRESHOLDS.iqrK * stats.iqr : null;
  const hiFence = isNum(stats.q3) && isNum(stats.iqr) ? stats.q3 + ANOMALY_THRESHOLDS.iqrK * stats.iqr : null;

  for (const m of group) {
    const x = metric === 'compaRatio' ? m.compaRatio : m.rangePenetration;
    if (!isNum(x)) continue;
    const z = zScore(x, stats);
    const zHit = isNum(z) && Math.abs(z) >= ANOMALY_THRESHOLDS.z;
    const iqrHit = (isNum(loFence) && x < loFence) || (isNum(hiFence) && x > hiFence);
    if (!zHit && !iqrHit) continue;

    const high = x >= (stats.median ?? x);
    const kind: AnomalyKind =
      metric === 'compaRatio' ? (high ? 'outlier-compa-high' : 'outlier-compa-low') : 'outlier-penetration';
    const statistic = isNum(z) ? z : isNum(hiFence) && x > hiFence ? x - hiFence : isNum(loFence) ? x - loFence : null;
    const label = metric === 'compaRatio' ? 'Compa-ratio outlier' : 'Range-penetration outlier';
    out.push({
      kind,
      subject: m.employee.id,
      label: `${label} · ${m.employee.displayName}`,
      message: `${m.employee.displayName} (${key.replace(/\|/g, ' · ')}) ${metric === 'compaRatio' ? 'compa' : 'penetration'} ${x.toFixed(2)} vs peer median ${(stats.median ?? 0).toFixed(2)}${isNum(z) ? `, z=${z.toFixed(1)}` : ''}.`,
      statistic,
      metric,
      severity: isNum(z) && Math.abs(z) >= ANOMALY_THRESHOLDS.z + 1 ? 'red' : 'amber',
    });
  }
}

/**
 * Compression: a manager paid within `compressionPct` of (or below) the median
 * base of their direct reports. Uses managerId edges; falls back to per-bucket
 * level adjacency when no manager graph exists.
 */
export function compressionFlags(employees: Employee[]): AnomalyFlag[] {
  const byId = new Map<string, Employee>();
  for (const e of employees) byId.set(e.id, e);
  const reportsByMgr = new Map<string, Employee[]>();
  let hasGraph = false;
  for (const e of employees) {
    if (e.managerId && byId.has(e.managerId)) {
      hasGraph = true;
      const arr = reportsByMgr.get(e.managerId);
      if (arr) arr.push(e);
      else reportsByMgr.set(e.managerId, [e]);
    }
  }

  const flags: AnomalyFlag[] = [];
  const thr = ANOMALY_THRESHOLDS.compressionPct;
  if (hasGraph) {
    for (const [mgrId, reports] of reportsByMgr) {
      const mgr = byId.get(mgrId);
      if (!mgr || reports.length === 0) continue;
      const subMedian = quantileSorted(reports.map((r) => r.basePay).sort((a, b) => a - b), 0.5);
      if (!isNum(subMedian) || subMedian <= 0) continue;
      const gap = (mgr.basePay - subMedian) / subMedian;
      if (gap <= thr) {
        flags.push({
          kind: 'compression',
          subject: mgr.id,
          label: `Compression · ${mgr.displayName}`,
          message: `${mgr.displayName} (${mgr.level}) paid ${(gap * 100).toFixed(0)}% vs report median ${subMedian.toFixed(1)} — below the ${(thr * 100).toFixed(0)}% threshold.`,
          statistic: gap,
          metric: 'compression',
          severity: gap < 0 ? 'red' : 'amber',
        });
      }
    }
  }
  return flags.sort((a, b) => (a.statistic ?? 0) - (b.statistic ?? 0) || a.subject.localeCompare(b.subject));
}

/**
 * Midpoint-progression inconsistency: a non-monotonic or unusually small step
 * between consecutive grade midpoints (junior→senior). Flags a step whose ratio
 * is < 1 (inversion) or whose growth is below half the median step growth.
 */
export function progressionFlags(midpoints: { grade: string; midpoint: number | null }[]): AnomalyFlag[] {
  const pts = midpoints.filter((g): g is { grade: string; midpoint: number } => isNum(g.midpoint));
  if (pts.length < 2) return [];
  const ratios: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!.midpoint;
    const b = pts[i + 1]!.midpoint;
    if (a > 0) ratios.push(b / a);
  }
  const medianRatio = quantileSorted([...ratios].sort((x, y) => x - y), 0.5) ?? 1;
  const flags: AnomalyFlag[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (a.midpoint <= 0) continue;
    const ratio = b.midpoint / a.midpoint;
    const growth = ratio - 1;
    const medianGrowth = medianRatio - 1;
    const inversion = ratio < 1;
    const tooFlat = medianGrowth > 0 && growth < medianGrowth * 0.5;
    if (inversion || tooFlat) {
      flags.push({
        kind: 'midpoint-inconsistency',
        subject: `${a.grade}->${b.grade}`,
        label: `Progression ${a.grade}→${b.grade}`,
        message: inversion
          ? `Midpoint inversion: ${a.grade} ${a.midpoint.toFixed(1)} → ${b.grade} ${b.midpoint.toFixed(1)} (ratio ${ratio.toFixed(2)}).`
          : `Flat step ${a.grade}→${b.grade}: ${(growth * 100).toFixed(0)}% vs typical ${(medianGrowth * 100).toFixed(0)}%.`,
        statistic: growth,
        metric: 'progression',
        severity: inversion ? 'red' : 'amber',
      });
    }
  }
  return flags;
}

/** All anomaly flags for the cockpit (outliers + compression + progression). */
export function anomalyFlags(
  mappings: EmployeeMapping[],
  employees: Employee[],
  midpoints: { grade: string; midpoint: number | null }[],
): AnomalyFlag[] {
  return [...outlierFlags(mappings), ...compressionFlags(employees), ...progressionFlags(midpoints)];
}

// ----------------------------------------------------------------------------
// Attrition risk — the v2 logistic + deterministic tenure/performance modifiers.
// ----------------------------------------------------------------------------

export interface AttritionRisk {
  /** Annualized attrition probability in [0, 1] after modifiers. */
  value: number;
  /** Base logistic attrition before modifiers. */
  base: number;
  /** Combined deterministic multiplier from tenure + performance. */
  modifier: number;
  provenance: Provenance;
}

/**
 * Deterministic attrition risk for a pay percentile position at a level.
 *   base   = v2 logistic attrition(position, baselineAttrition, retentionParams)
 *   modifier multiplies base by tenure & performance factors:
 *     early tenure (<2y) is higher-risk; long tenure (≥6y) lower;
 *     top performers (5) are higher flight-risk, low performers (≤2) lower.
 * Clamped to [0, 1].
 */
export function attritionRiskFor(
  position: number | null,
  level: Level,
  assumptions: GlobalAssumptions,
  opts?: { tenureYears?: number | null; performanceRating?: number | null; baselineAttrition?: number | null },
): AttritionRisk | null {
  const rp = retentionParams(assumptions);
  const baseline = isNum(opts?.baselineAttrition) ? opts!.baselineAttrition! : BASELINE_ATTRITION[level];
  const p = isNum(position) ? position : rp.p0; // unknown position → inflection (neutral)
  const base = attrition(p, baseline, rp);
  if (!isNum(base)) return null;

  let modifier = 1;
  const tenure = opts?.tenureYears;
  if (isNum(tenure)) {
    if (tenure < 1) modifier *= 1.35;
    else if (tenure < 2) modifier *= 1.2;
    else if (tenure >= 6) modifier *= 0.8;
  }
  const perf = opts?.performanceRating;
  if (isNum(perf)) {
    if (perf >= 5) modifier *= 1.25;
    else if (perf === 4) modifier *= 1.1;
    else if (perf <= 2) modifier *= 0.85;
  }
  const value = Math.min(1, Math.max(0, base * modifier));
  return { value, base, modifier, provenance: 'ASSUMED' };
}

/**
 * Segment-level attrition risk: derives the pay position from the segment's avg
 * pay vs the survey percentile curve, then applies the average tenure/perf.
 */
export function segmentAttritionRisk(
  avgPay: number | null,
  percentiles: Record<string, number | null> | null,
  level: Level,
  assumptions: GlobalAssumptions,
  opts?: { avgTenureYears?: number | null; avgPerformance?: number | null },
): AttritionRisk | null {
  const position = percentiles ? numericPosition(percentilePositionOf(avgPay, percentiles)) : null;
  return attritionRiskFor(position, level, assumptions, {
    tenureYears: opts?.avgTenureYears ?? null,
    performanceRating: opts?.avgPerformance ?? null,
  });
}

// ----------------------------------------------------------------------------
// Greedy budget allocator — value-per-dollar ranking with guardrails.
// ----------------------------------------------------------------------------

export interface AllocatableAction {
  id: string;
  /** Priority score (0..100) — higher is more valuable. */
  score: number;
  /** Annualized cost of the action (GND k). Must be ≥ 0 to be eligible. */
  cost: number;
  label?: string;
}

export interface AllocationResult<A extends AllocatableAction> {
  chosen: A[];
  /** Actions evaluated but skipped (over remaining budget or ineligible). */
  skipped: A[];
  spent: number;
  remaining: number;
}

/**
 * Allocate a fixed budget to actions by value-per-dollar (score ÷ cost),
 * descending, taking each whole action that fits within the remaining budget.
 * Guardrails: non-positive scores and non-finite/negative costs are ineligible;
 * zero-cost positive-score actions are always taken (infinite value density).
 * Deterministic: ties broken by score then id.
 */
export function greedyAllocate<A extends AllocatableAction>(actions: A[], budget: number): AllocationResult<A> {
  const cap = isNum(budget) && budget > 0 ? budget : 0;
  const eligible: A[] = [];
  const skipped: A[] = [];
  for (const a of actions) {
    if (!isNum(a.cost) || a.cost < 0 || !isNum(a.score) || a.score <= 0) skipped.push(a);
    else eligible.push(a);
  }

  const density = (a: A): number => (a.cost > 0 ? a.score / a.cost : Number.POSITIVE_INFINITY);
  const ranked = [...eligible].sort(
    (x, y) => density(y) - density(x) || y.score - x.score || x.id.localeCompare(y.id),
  );

  const chosen: A[] = [];
  let spent = 0;
  for (const a of ranked) {
    if (spent + a.cost <= cap + 1e-9) {
      chosen.push(a);
      spent += a.cost;
    } else {
      skipped.push(a);
    }
  }
  return { chosen, skipped, spent, remaining: Math.max(0, cap - spent) };
}

// ----------------------------------------------------------------------------
// Narrative — templated board-commentary (no LLM).
// ----------------------------------------------------------------------------

export interface NarrativeMetrics {
  headcount: number;
  avgCompaRatio: number | null;
  belowMinCount: number;
  aboveMaxCount: number;
  underMarketGroups: number;
  topRiskFamily?: string | null;
  hcroi?: number | null;
  benefitsShare?: number | null;
  recommendedSpend?: number | null;
}

/**
 * Deterministic board-commentary lines from the cockpit metrics. Templated —
 * not generated by a language model. Always returns at least one line.
 */
export function narrative(m: NarrativeMetrics): string[] {
  const lines: string[] = [];
  const compa = m.avgCompaRatio;
  if (isNum(compa)) {
    const posture = compa >= 1.03 ? 'above' : compa <= 0.97 ? 'below' : 'at';
    lines.push(
      `Firm-wide compa-ratio is ${compa.toFixed(2)} — pay sits ${posture} the published midpoints across ${m.headcount.toLocaleString('en-US')} employees.`,
    );
  } else {
    lines.push(`Population of ${m.headcount.toLocaleString('en-US')} employees mapped to the published structure.`);
  }

  if (m.belowMinCount > 0 || m.aboveMaxCount > 0) {
    lines.push(
      `${m.belowMinCount.toLocaleString('en-US')} employees sit below grade minimum (green-circle) and ${m.aboveMaxCount.toLocaleString('en-US')} above maximum (red-circle) — the immediate range-maintenance backlog.`,
    );
  } else {
    lines.push('No employees fall outside their grade range — the structure currently contains the population.');
  }

  if (m.underMarketGroups > 0) {
    const fam = m.topRiskFamily ? ` led by ${m.topRiskFamily}` : '';
    lines.push(
      `${m.underMarketGroups} job-family×level group${m.underMarketGroups === 1 ? '' : 's'} are priced under market${fam}, concentrating attrition and replacement risk where correction is most economic.`,
    );
  }

  if (isNum(m.hcroi)) {
    lines.push(
      `Human-capital ROI is ${m.hcroi.toFixed(2)}× — each unit of loaded workforce cost returns ${m.hcroi.toFixed(2)} of gross value, before discretionary reinvestment.`,
    );
  }

  if (isNum(m.recommendedSpend) && m.recommendedSpend > 0) {
    lines.push(
      `The recommendation engine prioritises an annualized correction of ${Math.round(m.recommendedSpend).toLocaleString('en-US')} GND k against the highest-scoring segments.`,
    );
  }

  return lines;
}
