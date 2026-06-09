/**
 * C5 — Recommendation Engine (rules-based, explainable, NOT ML).
 *
 * A weighted scorecard over normalized 0..1 sub-scores per family×level segment,
 * using RECO_WEIGHTS (single source of truth). Output is ActionItem[] for the
 * shared <ActionQueue>, with each recommendation exposing its drivers + the
 * weakest provenance. Label in the UI: rule/statistics-based; ML upgrade is
 * platform-track.
 *
 * Pure & deterministic. Missing inputs degrade a sub-score to 0 (never NaN).
 */

import { aggregateOf, type Level, LEVEL_LABELS_SHORT } from '@/domain/levels';
import { type Dataset, selectTable } from '@/domain/types';
import type { EmployeeMapping, GradeRange, Structure } from '@/lib/comp';
import { marketReference } from '@/lib/marketReference';
import { attrition, numericPosition, retentionParams } from '@/lib/capital';
import { percentilePositionOf } from '@/lib/benchmark';
import {
  BASELINE_ATTRITION,
  type GlobalAssumptions,
  RECO_WEIGHTS,
  REPLACEMENT_DIFFICULTY,
} from '@/lib/assumptions';
import { type Provenance, weakest } from '@/lib/provenance';
import type { ActionItem, ScoreDriver } from '@/components/operate/ActionQueue';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// ----------------------------------------------------------------------------
// Segment model (family × level), built from employees + survey + structure.
// ----------------------------------------------------------------------------

export interface RecoSegment {
  family: string;
  level: Level;
  headcount: number;
  avgPay: number | null;
  marketReference: number | null;
  midpoint: number | null;
  avgCompaRatio: number | null;
  avgRangePenetration: number | null;
  penetrationSpread: number | null; // max − min penetration (internal equity)
  avgPerformance: number | null;
  avgTenureYears: number | null;
  position: number | null; // pay-percentile position of avg pay
  costToMarket: number | null; // Σ max(0, market − pay) over the segment
  provenance: Provenance;
}

function mean(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function gradeFor(structure: Structure, level: Level): GradeRange | null {
  return structure.grades.find((g) => g.level === level) ?? null;
}

/**
 * Build family×level segments. `mappings` already carry compa-ratio / penetration
 * against the published structure; we re-bucket them by (family, level).
 */
export function buildRecoSegments(
  mappings: EmployeeMapping[],
  structure: Structure,
  ds: Dataset,
  assumptions: GlobalAssumptions,
  families: readonly string[],
  levels: readonly Level[],
): RecoSegment[] {
  const segments: RecoSegment[] = [];
  for (const family of families) {
    for (const level of levels) {
      const inSeg = mappings.filter((m) => m.employee.jobFamily === family && m.employee.level === level);
      if (inSeg.length === 0) continue;
      const emps = inSeg.map((m) => m.employee);
      const avgPay = mean(emps.map((e) => e.basePay));
      const grade = gradeFor(structure, level);
      const midpoint = grade?.midpoint ?? null;

      // Market reference at the survey median for the family (geo-blended at HQ).
      const ref = marketReference(ds, assumptions, { level, jobFamily: family, percentile: 0.5 });
      const marketRef = ref?.value ?? null;

      const penetrations = inSeg.map((m) => m.rangePenetration).filter(isNum);
      const penetrationSpread =
        penetrations.length >= 2 ? Math.max(...penetrations) - Math.min(...penetrations) : null;

      const row = selectTable(ds, 'FIRM', 'TARGET', 'BASIC_SALARY')?.rows[aggregateOf(level)];
      const percentiles = row?.percentiles ?? null;
      const position = percentiles ? numericPosition(percentilePositionOf(avgPay, percentiles)) : null;

      const costToMarket = isNum(marketRef)
        ? emps.reduce((a, e) => a + Math.max(0, marketRef - e.basePay), 0)
        : null;

      segments.push({
        family,
        level,
        headcount: emps.length,
        avgPay,
        marketReference: marketRef,
        midpoint,
        avgCompaRatio: mean(inSeg.map((m) => m.compaRatio)),
        avgRangePenetration: mean(penetrations),
        penetrationSpread,
        avgPerformance: mean(emps.map((e) => e.performanceRating ?? null)),
        avgTenureYears: mean(emps.map((e) => e.tenureYears ?? null)),
        position,
        costToMarket,
        provenance: weakest(ref?.provenance ?? null, grade?.confidenceProvenance ?? null),
      });
    }
  }
  return segments;
}

// ----------------------------------------------------------------------------
// Sub-scores (each normalized 0..1) — explainable, deterministic.
// ----------------------------------------------------------------------------

export interface SubScores {
  externalGapSeverity: number;
  internalEquityRisk: number;
  performanceCriticality: number;
  attritionRisk: number;
  replacementDifficulty: number;
  revenueSensitivity: number;
  costToCorrectInverse: number;
  productivityUpside: number;
}

/** Revenue-sensitivity proxy by level (seniority → bigger revenue lever). 0..1. */
const REVENUE_SENSITIVITY: Record<Level, number> = { An: 0.2, As: 0.35, M: 0.55, SM: 0.75, Pr: 0.95 };

function computeSubScores(
  seg: RecoSegment,
  assumptions: GlobalAssumptions,
  maxCostToMarket: number,
): SubScores {
  // External gap severity: |market − pay| / market, clamped (only under-market matters for action).
  const externalGapSeverity =
    isNum(seg.marketReference) && seg.marketReference > 0 && isNum(seg.avgPay)
      ? clamp01(Math.max(0, seg.marketReference - seg.avgPay) / seg.marketReference / 0.25) // 25% gap → full score
      : 0;

  // Internal equity risk: penetration spread within the segment (wide spread = inconsistent pay).
  const internalEquityRisk = isNum(seg.penetrationSpread) ? clamp01(seg.penetrationSpread) : 0;

  // Performance × criticality: avg perf (1..5 → 0..1) × replacement difficulty.
  const perfNorm = isNum(seg.avgPerformance) ? clamp01((seg.avgPerformance - 1) / 4) : 0.5;
  const performanceCriticality = clamp01(perfNorm * REPLACEMENT_DIFFICULTY[seg.level]);

  // Attrition risk: v2 logistic at the segment's pay-percentile position.
  const rp = retentionParams(assumptions);
  const attr = isNum(seg.position) ? attrition(seg.position, BASELINE_ATTRITION[seg.level], rp) : null;
  // Normalize against the junior baseline (the highest plausible) so 0..1 is meaningful.
  const attritionRisk = isNum(attr) ? clamp01(attr / Math.max(1e-6, BASELINE_ATTRITION.An * 1.5)) : 0;

  const replacementDifficulty = REPLACEMENT_DIFFICULTY[seg.level];
  const revenueSensitivity = REVENUE_SENSITIVITY[seg.level];

  // Cost-to-correct inverse: cheap-to-fix segments score higher (1 − normalized cost).
  // An unknown cost (no market reference) is neutral 0, NOT the most-favourable 1.
  const costToCorrectInverse = !isNum(seg.costToMarket)
    ? 0
    : maxCostToMarket > 0
      ? clamp01(1 - seg.costToMarket / maxCostToMarket)
      : 1;

  // Productivity upside: under-paid high performers have the most upside on correction.
  const productivityUpside = clamp01(externalGapSeverity * perfNorm);

  return {
    externalGapSeverity,
    internalEquityRisk,
    performanceCriticality,
    attritionRisk,
    replacementDifficulty,
    revenueSensitivity,
    costToCorrectInverse,
    productivityUpside,
  };
}

const DRIVER_LABELS: Record<keyof SubScores, string> = {
  externalGapSeverity: 'External gap severity',
  internalEquityRisk: 'Internal equity risk',
  performanceCriticality: 'Performance × criticality',
  attritionRisk: 'Attrition risk',
  replacementDifficulty: 'Replacement difficulty',
  revenueSensitivity: 'Revenue leverage (seniority proxy)',
  costToCorrectInverse: 'Cost-to-correct (inverse)',
  productivityUpside: 'Productivity upside',
};

const DRIVER_ORDER: (keyof SubScores)[] = [
  'externalGapSeverity',
  'attritionRisk',
  'internalEquityRisk',
  'performanceCriticality',
  'replacementDifficulty',
  'revenueSensitivity',
  'costToCorrectInverse',
  'productivityUpside',
];

export interface SegmentRecommendation {
  segment: RecoSegment;
  score: number; // 0..100
  subScores: SubScores;
  drivers: ScoreDriver[];
}

/** Weighted score (0..100) = Σ (sub-score × weight) × 100. Weights sum to 1. */
export function scoreSegment(sub: SubScores): number {
  let s = 0;
  for (const key of DRIVER_ORDER) s += sub[key] * RECO_WEIGHTS[key];
  return clamp01(s) * 100;
}

function buildDrivers(sub: SubScores): ScoreDriver[] {
  return DRIVER_ORDER.map((key) => ({ label: DRIVER_LABELS[key], score: sub[key], weight: RECO_WEIGHTS[key] }));
}

/** Rank segments into scored recommendations (highest first). */
export function rankSegments(
  segments: RecoSegment[],
  assumptions: GlobalAssumptions,
): SegmentRecommendation[] {
  const maxCost = Math.max(0, ...segments.map((s) => (isNum(s.costToMarket) ? s.costToMarket : 0)));
  return segments
    .map((segment) => {
      const subScores = computeSubScores(segment, assumptions, maxCost);
      return { segment, subScores, score: scoreSegment(subScores), drivers: buildDrivers(subScores) };
    })
    .sort((a, b) => b.score - a.score || a.segment.family.localeCompare(b.segment.family));
}

// ----------------------------------------------------------------------------
// ActionItem mapping for <ActionQueue>.
// ----------------------------------------------------------------------------

import { formatGndK } from '@/lib/format';

function badgeFor(rec: SegmentRecommendation): ActionItem['badge'] {
  const gap = rec.subScores.externalGapSeverity;
  if (gap >= 0.6) return { label: 'Under market', tone: 'red' };
  if (rec.subScores.attritionRisk >= 0.6) return { label: 'Attrition risk', tone: 'amber' };
  if (rec.subScores.internalEquityRisk >= 0.6) return { label: 'Equity risk', tone: 'amber' };
  return { label: 'Monitor', tone: 'navy' };
}

/** Map scored recommendations to ActionItem[] for the shared queue. */
export function toActionItems(recs: SegmentRecommendation[]): ActionItem[] {
  return recs.map((rec) => {
    const s = rec.segment;
    const cost = isNum(s.costToMarket) ? s.costToMarket : null;
    return {
      id: `${s.family}-${s.level}`,
      title: `${s.family} · ${LEVEL_LABELS_SHORT[s.level]}`,
      subtitle: `${s.headcount} head${s.headcount === 1 ? '' : 's'}${isNum(s.avgCompaRatio) ? ` · compa ${s.avgCompaRatio.toFixed(2)}` : ''}${isNum(cost) ? ` · ${formatGndK(cost, 0, true)} GND k to market` : ''}`,
      score: rec.score,
      drivers: rec.drivers,
      badge: badgeFor(rec),
      rightValue: isNum(cost) ? `${formatGndK(cost, 0, true)} GND k` : undefined,
      provenance: s.provenance,
    };
  });
}

/** Convenience: segments → ActionItem[] in one call (build, rank, map). */
export function recommendActions(
  mappings: EmployeeMapping[],
  structure: Structure,
  ds: Dataset,
  assumptions: GlobalAssumptions,
  families: readonly string[],
  levels: readonly Level[],
): { recommendations: SegmentRecommendation[]; items: ActionItem[] } {
  const segments = buildRecoSegments(mappings, structure, ds, assumptions, families, levels);
  const recommendations = rankSegments(segments, assumptions);
  return { recommendations, items: toActionItems(recommendations) };
}
