/**
 * FAIR design-quality scoring for incentive / synthetic-equity plans.
 *
 * Pure and deterministic — same input always yields the same output, no
 * `Date.now()` / `Math.random()`. Every axis score (1–5) is the rounded mean of
 * a handful of transparent sub-signals, and each sub-signal is returned as a
 * {@link FairFactor} so the UI can explain *why* (mirroring the explainable
 * Job-Pricing rationale). All scoring rules live in this one module so an advisor
 * can audit and tune them.
 *
 * FAIR axes:
 *   - value: alignment with a low-distortion value basis
 *   - share: graduated value-sharing aligned with the owner utility curve
 *   - deal:  risk balance / "skin in the game"
 *   - team:  ability to reallocate value to current high performers vs first-in bias
 */

import {
  type CapitalStructureResilience,
  type EquityPlanDefinition,
  FAIR_AXES,
  type FairAxis,
  type GovernanceRigorLevel,
  type OwnerControlPreservationLevel,
} from '@/domain/equityPlan';

export type ScoreBand = 'red' | 'amber' | 'green';

export interface FairFactor {
  label: string;
  /** This signal's contribution on the same 1–5 scale as the axis. */
  score: number;
  detail: string;
}

export interface FairAxisScore {
  axis: FairAxis;
  /** Integer 1–5. */
  score: number;
  band: ScoreBand;
  factors: FairFactor[];
}

export interface PlanScore {
  planId: string;
  fair: Record<FairAxis, FairAxisScore>;
  overall: {
    /** Precise mean of the four axes (1 decimal), for display. */
    score: number;
    /** Banded on the rounded mean. */
    band: ScoreBand;
  };
  reads: {
    concentration: string;
    downsideElasticity: string;
    /** Fraction of the pool left unallocated (0–1). */
    unallocatedPoolPct: number;
  };
}

// NaN-safe: a non-finite input collapses to the floor so axis scores always
// honor their documented integer 1–5 contract regardless of caller hygiene.
const clamp1to5 = (n: number): number => (Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 1);
const round1 = (n: number): number => Math.round(n * 10) / 10;
const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

export function scoreBand(score: number): ScoreBand {
  const r = Math.round(score);
  return r <= 2 ? 'red' : r === 3 ? 'amber' : 'green';
}

const axisFromFactors = (axis: FairAxis, factors: FairFactor[]): FairAxisScore => {
  const mean = factors.reduce((a, f) => a + f.score, 0) / factors.length;
  const score = clamp1to5(Math.round(mean));
  return { axis, score, band: scoreBand(score), factors };
};

// --- Ordinal maps (exhaustive Records → no missing/extra keys can compile) ---

const REFERENCE_VALUE_ALIGNMENT: Record<EquityPlanDefinition['valueBasis']['referenceValueType'], number> = {
  ADJUSTED_ENTERPRISE_VALUE: 5,
  FORMULAIC_VALUE: 4,
  BUSINESS_UNIT_VALUE: 4,
  ENTERPRISE_VALUE: 3,
  EQUITY_FMV_PER_SHARE: 2,
};

const VALUATION_METHOD_ALIGNMENT: Record<EquityPlanDefinition['valueBasis']['valuationMethod'], number> = {
  INDEPENDENT_APPRAISAL: 5,
  DCF: 4,
  EBITDA_MULTIPLE: 4,
  REVENUE_MULTIPLE: 3,
  INTERNAL_FORMULA: 3,
  MARKET_CAP: 2,
};

const CADENCE_FRESHNESS: Record<EquityPlanDefinition['valueBasis']['valuationCadence'], number> = {
  ROLLING_QUARTERLY: 5,
  SEMI_ANNUAL: 4,
  ANNUAL: 3,
  EVENT_DRIVEN_ONLY: 2,
};

const DISTORTION_PROTECTION_SCORE: Record<EquityPlanDefinition['valueBasis']['distortionProtectionLevel'], number> = {
  ROBUST: 5,
  PARTIAL: 3,
  NONE: 1,
};

const UPSIDE_GRADUATION: Record<EquityPlanDefinition['intensity']['upsideLeverageProfile'], number> = {
  BAND_GRADUATED: 5,
  LINEAR: 3,
  HOCKEY_STICK: 2,
};

const CONCENTRATION_SHARING: Record<EquityPlanDefinition['pool']['concentrationIndex'], number> = {
  BALANCED: 5,
  BROAD_BASED: 4,
  TOP_HEAVY: 2,
};

const DOWNSIDE_SKIN: Record<EquityPlanDefinition['intensity']['downsideExposure'], number> = {
  FULL_DOWNSIDE: 5,
  PARTIAL_DOWNSIDE: 4,
  NO_DOWNSIDE: 2,
};

const FORFEITURE_SKIN: Record<EquityPlanDefinition['vesting']['forfeitureStrictness'], number> = {
  STRICT: 5,
  MODERATE: 4,
  SOFT: 2,
};

const VESTING_MODEL_REALLOCATION: Record<EquityPlanDefinition['vesting']['vestingModel'], number> = {
  MILESTONE_BASED: 5,
  HYBRID: 4,
  TIME_BASED: 2,
};

const TRIGGER_REALLOCATION: Record<EquityPlanDefinition['vesting']['primaryPayoutTrigger'], number> = {
  ANNUAL_SETTLEMENT: 5,
  ON_VESTING: 4,
  HYBRID: 4,
  RETIREMENT: 3,
  SEPARATION_OF_SERVICE: 3,
  CHANGE_IN_CONTROL: 2,
  IPO: 2,
};

const GOVERNANCE_RIGOR_VALUE: Record<GovernanceRigorLevel, number> = {
  FULL_BOARD_INTEGRATION: 5,
  STANDARD_COMMITTEE: 3,
  OPERATIONAL_ONLY: 1,
};

const OWNER_CONTROL_VALUE: Record<OwnerControlPreservationLevel, number> = {
  HIGH: 5,
  MEDIUM: 3,
  LOW: 1,
};

const RESILIENCE_VALUE: Record<CapitalStructureResilience, number> = {
  ROBUST: 5,
  ADAPTABLE: 3,
  FRAGILE: 1,
};

// --- Bucketed numeric sub-signals ------------------------------------------

const horizonCommitment = (years: number): number =>
  years >= 4 ? 5 : years >= 3 ? 4 : years >= 2 ? 3 : years >= 1 ? 2 : 1;

const refreshAgility = (years: number): number =>
  years <= 2 ? 5 : years <= 3 ? 4 : years <= 4 ? 3 : years <= 6 ? 2 : 1;

const scopeBreadth = (count: number): number => clamp1to5(1 + count);

// --- Axis scorers -----------------------------------------------------------

function scoreValue(p: EquityPlanDefinition): FairAxisScore {
  const vb = p.valueBasis;
  return axisFromFactors('value', [
    { label: 'Reference value basis', score: REFERENCE_VALUE_ALIGNMENT[vb.referenceValueType], detail: `${vb.referenceValueType.replaceAll('_', ' ').toLowerCase()} as the value reference` },
    { label: 'Valuation method', score: VALUATION_METHOD_ALIGNMENT[vb.valuationMethod], detail: `valued via ${vb.valuationMethod.replaceAll('_', ' ').toLowerCase()}` },
    { label: 'Valuation freshness', score: CADENCE_FRESHNESS[vb.valuationCadence], detail: `${vb.valuationCadence.replaceAll('_', ' ').toLowerCase()} revaluation` },
    { label: 'Distortion protection', score: DISTORTION_PROTECTION_SCORE[vb.distortionProtectionLevel], detail: `${vb.distortionProtectionLevel.toLowerCase()} adjustment for capital-structure events` },
  ]);
}

function scoreShare(p: EquityPlanDefinition): FairAxisScore {
  const elasticityFit = clamp1to5(5 - Math.abs(p.intensity.payPerformanceElasticity - 3));
  return axisFromFactors('share', [
    { label: 'Upside graduation', score: UPSIDE_GRADUATION[p.intensity.upsideLeverageProfile], detail: `${p.intensity.upsideLeverageProfile.replaceAll('_', ' ').toLowerCase()} payoff curve` },
    { label: 'Elasticity fit', score: elasticityFit, detail: `pay-performance elasticity ${p.intensity.payPerformanceElasticity}/5 vs owner utility curve` },
    { label: 'Concentration', score: CONCENTRATION_SHARING[p.pool.concentrationIndex], detail: `${p.pool.concentrationIndex.replaceAll('_', ' ').toLowerCase()} distribution` },
    { label: 'Participation breadth', score: scopeBreadth(p.archetype.participationScope.length), detail: `${p.archetype.participationScope.length} participation group(s)` },
  ]);
}

function scoreDeal(p: EquityPlanDefinition): FairAxisScore {
  return axisFromFactors('deal', [
    { label: 'Downside exposure', score: DOWNSIDE_SKIN[p.intensity.downsideExposure], detail: `${p.intensity.downsideExposure.replaceAll('_', ' ').toLowerCase()}` },
    { label: 'Payout cap', score: p.intensity.capOnPayout ? 5 : 3, detail: p.intensity.capOnPayout ? `capped at ${p.intensity.maxPayoutMultipleOfGrantValue}× grant value` : 'uncapped upside' },
    { label: 'Forfeiture strictness', score: FORFEITURE_SKIN[p.vesting.forfeitureStrictness], detail: `${p.vesting.forfeitureStrictness.toLowerCase()} forfeiture on exit` },
    { label: 'Vesting commitment', score: horizonCommitment(p.vesting.vestingHorizonYears), detail: `${p.vesting.vestingHorizonYears}y horizon, ${p.vesting.cliffPeriodYears}y cliff` },
  ]);
}

function scoreTeam(p: EquityPlanDefinition): FairAxisScore {
  return axisFromFactors('team', [
    { label: 'Revaluation cadence', score: CADENCE_FRESHNESS[p.valueBasis.valuationCadence], detail: `${p.valueBasis.valuationCadence.replaceAll('_', ' ').toLowerCase()} keeps grants current` },
    { label: 'Pool refresh agility', score: refreshAgility(p.pool.poolUsageTargetHorizonYears), detail: `${p.pool.poolUsageTargetHorizonYears}y until pool refresh` },
    { label: 'Vesting model', score: VESTING_MODEL_REALLOCATION[p.vesting.vestingModel], detail: `${p.vesting.vestingModel.replaceAll('_', ' ').toLowerCase()} ties value to ongoing performance` },
    { label: 'Payout trigger', score: TRIGGER_REALLOCATION[p.vesting.primaryPayoutTrigger], detail: `${p.vesting.primaryPayoutTrigger.replaceAll('_', ' ').toLowerCase()} settlement` },
  ]);
}

function reads(p: EquityPlanDefinition): PlanScore['reads'] {
  const allocSum =
    p.pool.allocationExecPercentOfPool +
    p.pool.allocationLeadershipPercentOfPool +
    p.pool.allocationEmployeesPercentOfPool +
    p.pool.allocationContractorsPercentOfPool +
    p.pool.allocationEcosystemPercentOfPool;
  const concentration =
    p.pool.concentrationIndex === 'TOP_HEAVY'
      ? `Top-heavy — ${Math.round(p.pool.allocationExecPercentOfPool * 100)}% of the pool to executives`
      : p.pool.concentrationIndex === 'BROAD_BASED'
        ? 'Broad-based — value shared widely across the workforce'
        : 'Balanced distribution across tiers';
  const downsideElasticity = `${p.intensity.downsideExposure.replaceAll('_', ' ').toLowerCase()}, elasticity ${p.intensity.payPerformanceElasticity}/5 (${p.intensity.upsideLeverageProfile.replaceAll('_', ' ').toLowerCase()})`;
  return { concentration, downsideElasticity, unallocatedPoolPct: Math.max(0, Math.min(1, finite(1 - allocSum))) };
}

/** Score a single plan across all four FAIR axes plus roll-up reads. */
export function scorePlan(p: EquityPlanDefinition): PlanScore {
  const fair: Record<FairAxis, FairAxisScore> = {
    value: scoreValue(p),
    share: scoreShare(p),
    deal: scoreDeal(p),
    team: scoreTeam(p),
  };
  const mean = FAIR_AXES.reduce((a, axis) => a + fair[axis].score, 0) / FAIR_AXES.length;
  return {
    planId: p.id,
    fair,
    overall: { score: round1(mean), band: scoreBand(mean) },
    reads: reads(p),
  };
}

// --- Cross-plan comparison --------------------------------------------------

export interface ComparisonDimension {
  key: string;
  label: string;
  /** How to read a high value: 'high' = more is better, 'context' = neutral. */
  direction: 'high' | 'context';
}

export interface ComparisonCell {
  planId: string;
  /** Raw 1–5 value. */
  raw: number;
  /** Normalized 0–1 (raw / 5) for heatmap intensity. */
  normalized: number;
}

export interface ComparisonRow {
  dimension: ComparisonDimension;
  cells: ComparisonCell[];
  /** Max − min normalized value across plans: how much plans diverge here. */
  spread: number;
}

export interface PlanComparison {
  planIds: string[];
  rows: ComparisonRow[];
}

/** Dimensions shown in the comparison heatmap / radar, each on a 1–5 scale. */
const COMPARISON_DIMENSIONS: {
  dimension: ComparisonDimension;
  extract: (plan: EquityPlanDefinition, score: PlanScore) => number;
}[] = [
  { dimension: { key: 'value', label: 'Fair Value', direction: 'high' }, extract: (_p, s) => s.fair.value.score },
  { dimension: { key: 'share', label: 'Fair Share', direction: 'high' }, extract: (_p, s) => s.fair.share.score },
  { dimension: { key: 'deal', label: 'Fair Deal', direction: 'high' }, extract: (_p, s) => s.fair.deal.score },
  { dimension: { key: 'team', label: 'Fair Team', direction: 'high' }, extract: (_p, s) => s.fair.team.score },
  { dimension: { key: 'overall', label: 'Overall quality', direction: 'high' }, extract: (_p, s) => s.overall.score },
  { dimension: { key: 'elasticity', label: 'Pay-perf elasticity', direction: 'context' }, extract: (p) => p.intensity.payPerformanceElasticity },
  { dimension: { key: 'clarity', label: 'One-page clarity', direction: 'high' }, extract: (p) => p.experience.onePageNarrativeScore },
  { dimension: { key: 'governance', label: 'Governance rigor', direction: 'high' }, extract: (p) => GOVERNANCE_RIGOR_VALUE[p.governance.governanceRigorLevel] },
  { dimension: { key: 'ownerControl', label: 'Owner control', direction: 'context' }, extract: (p) => OWNER_CONTROL_VALUE[p.governance.ownerControlPreservationLevel] },
  { dimension: { key: 'resilience', label: 'Capital resilience', direction: 'high' }, extract: (p) => RESILIENCE_VALUE[p.governance.capitalStructureResilience] },
];

/**
 * Build a per-dimension comparison matrix across N plans. Each cell is raw 1–5
 * plus a 0–1 normalization for heatmap intensity; `spread` flags where plans
 * diverge most.
 */
export function comparePlans(plans: EquityPlanDefinition[]): PlanComparison {
  const scored = plans.map((p) => ({ plan: p, score: scorePlan(p) }));
  const rows: ComparisonRow[] = COMPARISON_DIMENSIONS.map(({ dimension, extract }) => {
    const cells: ComparisonCell[] = scored.map(({ plan, score }) => {
      const raw = extract(plan, score);
      return { planId: plan.id, raw, normalized: raw / 5 };
    });
    const norms = cells.map((c) => c.normalized);
    const spread = norms.length ? Math.max(...norms) - Math.min(...norms) : 0;
    return { dimension, cells, spread };
  });
  return { planIds: plans.map((p) => p.id), rows };
}

/** Radar-friendly view of the four FAIR axes for a set of plans. */
export interface RadarDatum {
  axis: string;
  /** planId → score, keyed for a recharts multi-series radar. */
  [planId: string]: number | string;
}

export function fairRadarData(plans: EquityPlanDefinition[]): RadarDatum[] {
  const scored = plans.map((p) => ({ id: p.id, score: scorePlan(p) }));
  return FAIR_AXES.map((axis) => {
    const datum: RadarDatum = { axis: axis.charAt(0).toUpperCase() + axis.slice(1) };
    for (const { id, score } of scored) datum[id] = score.fair[axis].score;
    return datum;
  });
}
