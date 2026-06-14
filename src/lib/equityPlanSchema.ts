/**
 * Validation + factory for {@link EquityPlanDefinition}.
 *
 * Hand-rolled to match the repo convention (cf. `parseInputs`, `parseEmployees`,
 * `isValidDataset`) — no schema library. Enum option sets come from
 * `@/domain/equityPlan` so types, UI lists and validation share one source of
 * truth. Every cross-field Constraint from the domain spec is enforced here, not
 * just in the UI:
 *   - the five pool allocations sum to ≤ 1.0
 *   - the three KPI weights sum to exactly 1.0
 *   - financial + non-financial KPI share sum to exactly 1.0
 *   - cliff period ≤ vesting horizon
 *   - ordinals (elasticity, compliance, narrative) are integers in 1–5
 */

import {
  ALLOCATION_KEYS,
  CAPITAL_STRUCTURE_RESILIENCE_LEVELS,
  COMMUNICATION_CADENCES,
  CONCENTRATION_INDICES,
  DISTORTION_PROTECTION_LEVELS,
  DOWNSIDE_EXPOSURES,
  type EquityPlanDefinition,
  EXECUTION_LAYERS,
  FORFEITURE_STRICTNESS_LEVELS,
  FORMULA_COMPLEXITIES,
  GOVERNANCE_RIGOR_LEVELS,
  JURISDICTIONAL_RESTRICTION_LEVELS,
  KPI_TIME_HORIZON_PROFILES,
  LIQUIDITY_PROFILES,
  OWNER_CONTROL_LEVELS,
  PARTICIPATION_SCOPES,
  type ParticipationScope,
  PAYOUT_TRIGGERS,
  PLAN_MATURITY_STAGES,
  PLAN_TYPES,
  PRIMARY_OBJECTIVES,
  REFERENCE_VALUE_TYPES,
  SETTLEMENT_MEDIA,
  TRANSPARENCY_MODES,
  UPSIDE_LEVERAGE_PROFILES,
  VALUATION_CADENCES,
  VALUATION_METHODS,
  VESTING_MODELS,
} from '@/domain/equityPlan';

export interface ValidationError {
  /** Dot path to the offending field, e.g. "pool.allocationExecPercentOfPool". */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  /** The narrowed plan when structurally valid (even if constraints fail), else null. */
  value: EquityPlanDefinition | null;
  errors: ValidationError[];
}

/** Tolerance for "sums to exactly 1.0" checks, to absorb float error. */
const SUM_EPS = 1e-6;

const approxEq = (a: number, b: number): boolean => Math.abs(a - b) <= SUM_EPS;
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => isFiniteNum(v) && Number.isInteger(v);
const inRange = (v: number, min: number, max: number): boolean => v >= min && v <= max;
const isMember = <T extends string>(arr: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (arr as readonly string[]).includes(v);

// ---------------------------------------------------------------------------
// Constraint checks over a structurally-typed plan (used live by the Designer).
// ---------------------------------------------------------------------------

/**
 * Field-range + cross-field constraint checks over a typed plan. Assumes the
 * object already has the right field types (the Designer mutates via typed
 * setters); returns the list of violations to surface inline.
 */
export function checkConstraints(plan: EquityPlanDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  const fail = (path: string, message: string) => errors.push({ path, message });

  // 1. Archetype
  if (plan.archetype.participationScope.length === 0) {
    fail('archetype.participationScope', 'Select at least one participation group.');
  }

  // 3. Pool size & allocation
  const { pool } = plan;
  if (!(pool.poolSizePercentEV >= 0 && pool.poolSizePercentEV <= 1)) {
    fail('pool.poolSizePercentEV', 'Pool size must be a fraction between 0 and 1.');
  }
  if (!isInt(pool.tokenSupply) || pool.tokenSupply < 0) {
    fail('pool.tokenSupply', 'Token supply must be a whole number ≥ 0.');
  }
  if (!(pool.poolUsageTargetHorizonYears > 0)) {
    fail('pool.poolUsageTargetHorizonYears', 'Pool usage horizon must be greater than 0 years.');
  }
  let allocSum = 0;
  for (const key of ALLOCATION_KEYS) {
    const v = pool[key];
    if (!(v >= 0 && v <= 1)) fail(`pool.${key}`, 'Allocation share must be between 0 and 1.');
    allocSum += v;
  }
  if (allocSum > 1 + SUM_EPS) {
    fail('pool.allocation', `Allocation shares sum to ${(allocSum * 100).toFixed(1)}% — must total ≤ 100%.`);
  }

  // 4. Performance architecture
  const perf = plan.performance;
  for (const key of ['weightEnterpriseKpis', 'weightBuKpis', 'weightIndividualKpis'] as const) {
    if (!(perf[key] >= 0 && perf[key] <= 1)) fail(`performance.${key}`, 'KPI weight must be between 0 and 1.');
  }
  const weightSum = perf.weightEnterpriseKpis + perf.weightBuKpis + perf.weightIndividualKpis;
  if (!approxEq(weightSum, 1)) {
    fail('performance.weights', `Enterprise + BU + individual weights must total 100% (currently ${(weightSum * 100).toFixed(1)}%).`);
  }
  const mixSum = perf.kpiTypeMixFinancialShare + perf.kpiTypeMixNonFinancialShare;
  if (!approxEq(mixSum, 1)) {
    fail('performance.kpiTypeMix', `Financial + non-financial share must total 100% (currently ${(mixSum * 100).toFixed(1)}%).`);
  }
  if (!isInt(perf.kpiCount) || perf.kpiCount < 1) {
    fail('performance.kpiCount', 'KPI count must be a whole number ≥ 1.');
  }

  // 5. Vesting & triggers
  const vest = plan.vesting;
  if (!(vest.vestingHorizonYears >= 0)) fail('vesting.vestingHorizonYears', 'Vesting horizon must be ≥ 0 years.');
  if (!(vest.cliffPeriodYears >= 0)) fail('vesting.cliffPeriodYears', 'Cliff period must be ≥ 0 years.');
  if (vest.cliffPeriodYears > vest.vestingHorizonYears + SUM_EPS) {
    fail('vesting.cliffPeriodYears', 'Cliff period cannot exceed the vesting horizon.');
  }
  if (!isInt(vest.milestoneGateCount) || vest.milestoneGateCount < 0) {
    fail('vesting.milestoneGateCount', 'Milestone gate count must be a whole number ≥ 0.');
  }

  // 6. Incentive intensity
  const intensity = plan.intensity;
  if (!isInt(intensity.payPerformanceElasticity) || !inRange(intensity.payPerformanceElasticity, 1, 5)) {
    fail('intensity.payPerformanceElasticity', 'Pay-performance elasticity must be an integer 1–5.');
  }
  if (!(intensity.maxPayoutMultipleOfGrantValue >= 0)) {
    fail('intensity.maxPayoutMultipleOfGrantValue', 'Max payout multiple must be ≥ 0.');
  }

  // 8. Governance
  if (!isInt(plan.governance.complianceComplexityIndex) || !inRange(plan.governance.complianceComplexityIndex, 1, 5)) {
    fail('governance.complianceComplexityIndex', 'Compliance complexity must be an integer 1–5.');
  }

  // 9. Participant experience
  if (!isInt(plan.experience.onePageNarrativeScore) || !inRange(plan.experience.onePageNarrativeScore, 1, 5)) {
    fail('experience.onePageNarrativeScore', 'One-page narrative score must be an integer 1–5.');
  }

  // 10. Modality — secondary medium, when set, must differ from primary
  const mod = plan.modality;
  if (mod.settlementMediumSecondary && mod.settlementMediumSecondary === mod.settlementMediumPrimary) {
    fail('modality.settlementMediumSecondary', 'Secondary settlement medium must differ from the primary.');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Structural validation of unknown input (used for load / import).
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null);

/**
 * Validate arbitrary input into an {@link EquityPlanDefinition}. Returns
 * `ok:false` with a flat error list when structurally invalid; when structurally
 * sound it also runs {@link checkConstraints} so callers get one combined verdict.
 */
export function validateEquityPlan(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const fail = (path: string, message: string) => errors.push({ path, message });
  const root = asRec(input);
  if (!root) return { ok: false, value: null, errors: [{ path: '', message: 'Plan must be an object.' }] };

  const groups = ['archetype', 'valueBasis', 'pool', 'performance', 'vesting', 'intensity', 'governance', 'experience', 'modality'] as const;
  for (const g of groups) {
    if (!asRec(root[g])) fail(g, `Missing "${g}" group.`);
  }
  if (typeof root.id !== 'string' || typeof root.name !== 'string') {
    fail('id', 'Plan id and name are required strings.');
  }
  // Bail early if the shape is fundamentally wrong — field checks below assume groups exist.
  if (errors.length > 0) return { ok: false, value: null, errors };

  const archetype = root.archetype as Rec;
  const valueBasis = root.valueBasis as Rec;
  const pool = root.pool as Rec;
  const performance = root.performance as Rec;
  const vesting = root.vesting as Rec;
  const intensity = root.intensity as Rec;
  const governance = root.governance as Rec;
  const experience = root.experience as Rec;
  const modality = root.modality as Rec;

  const enumField = <T extends string>(obj: Rec, key: string, arr: readonly T[], path: string) => {
    if (!isMember(arr, obj[key])) fail(path, `"${String(obj[key])}" is not a valid ${path}.`);
  };
  const numField = (obj: Rec, key: string, path: string) => {
    if (!isFiniteNum(obj[key])) fail(path, `${path} must be a number.`);
  };
  const boolField = (obj: Rec, key: string, path: string) => {
    if (typeof obj[key] !== 'boolean') fail(path, `${path} must be true/false.`);
  };

  // 1. archetype
  enumField(archetype, 'planType', PLAN_TYPES, 'archetype.planType');
  enumField(archetype, 'primaryStrategicObjective', PRIMARY_OBJECTIVES, 'archetype.primaryStrategicObjective');
  enumField(archetype, 'planMaturityStage', PLAN_MATURITY_STAGES, 'archetype.planMaturityStage');
  const scope = archetype.participationScope;
  if (!Array.isArray(scope) || !scope.every((s) => isMember(PARTICIPATION_SCOPES, s))) {
    fail('archetype.participationScope', 'Participation scope must be a set of valid groups.');
  } else if (new Set(scope).size !== scope.length) {
    fail('archetype.participationScope', 'Participation groups must be unique.');
  }

  // 2. valueBasis
  enumField(valueBasis, 'referenceValueType', REFERENCE_VALUE_TYPES, 'valueBasis.referenceValueType');
  enumField(valueBasis, 'valuationMethod', VALUATION_METHODS, 'valueBasis.valuationMethod');
  enumField(valueBasis, 'valuationCadence', VALUATION_CADENCES, 'valueBasis.valuationCadence');
  enumField(valueBasis, 'distortionProtectionLevel', DISTORTION_PROTECTION_LEVELS, 'valueBasis.distortionProtectionLevel');

  // 3. pool
  for (const key of ['poolSizePercentEV', 'tokenSupply', 'poolUsageTargetHorizonYears', ...ALLOCATION_KEYS]) {
    numField(pool, key, `pool.${key}`);
  }
  enumField(pool, 'concentrationIndex', CONCENTRATION_INDICES, 'pool.concentrationIndex');

  // 4. performance
  for (const key of ['weightEnterpriseKpis', 'weightBuKpis', 'weightIndividualKpis', 'kpiTypeMixFinancialShare', 'kpiTypeMixNonFinancialShare', 'kpiCount']) {
    numField(performance, key, `performance.${key}`);
  }
  enumField(performance, 'kpiTimeHorizonProfile', KPI_TIME_HORIZON_PROFILES, 'performance.kpiTimeHorizonProfile');

  // 5. vesting
  for (const key of ['vestingHorizonYears', 'cliffPeriodYears', 'milestoneGateCount']) {
    numField(vesting, key, `vesting.${key}`);
  }
  enumField(vesting, 'vestingModel', VESTING_MODELS, 'vesting.vestingModel');
  enumField(vesting, 'primaryPayoutTrigger', PAYOUT_TRIGGERS, 'vesting.primaryPayoutTrigger');
  enumField(vesting, 'forfeitureStrictness', FORFEITURE_STRICTNESS_LEVELS, 'vesting.forfeitureStrictness');
  boolField(vesting, 'secondaryTriggersFlag', 'vesting.secondaryTriggersFlag');

  // 6. intensity
  numField(intensity, 'payPerformanceElasticity', 'intensity.payPerformanceElasticity');
  numField(intensity, 'maxPayoutMultipleOfGrantValue', 'intensity.maxPayoutMultipleOfGrantValue');
  enumField(intensity, 'upsideLeverageProfile', UPSIDE_LEVERAGE_PROFILES, 'intensity.upsideLeverageProfile');
  enumField(intensity, 'downsideExposure', DOWNSIDE_EXPOSURES, 'intensity.downsideExposure');
  boolField(intensity, 'capOnPayout', 'intensity.capOnPayout');

  // 8. governance
  numField(governance, 'complianceComplexityIndex', 'governance.complianceComplexityIndex');
  enumField(governance, 'governanceRigorLevel', GOVERNANCE_RIGOR_LEVELS, 'governance.governanceRigorLevel');
  enumField(governance, 'ownerControlPreservationLevel', OWNER_CONTROL_LEVELS, 'governance.ownerControlPreservationLevel');
  enumField(governance, 'capitalStructureResilience', CAPITAL_STRUCTURE_RESILIENCE_LEVELS, 'governance.capitalStructureResilience');

  // 9. experience
  numField(experience, 'onePageNarrativeScore', 'experience.onePageNarrativeScore');
  enumField(experience, 'transparencyMode', TRANSPARENCY_MODES, 'experience.transparencyMode');
  enumField(experience, 'formulaComplexity', FORMULA_COMPLEXITIES, 'experience.formulaComplexity');
  enumField(experience, 'communicationCadence', COMMUNICATION_CADENCES, 'experience.communicationCadence');

  // 10. modality
  enumField(modality, 'settlementMediumPrimary', SETTLEMENT_MEDIA, 'modality.settlementMediumPrimary');
  if (modality.settlementMediumSecondary != null && !isMember(SETTLEMENT_MEDIA, modality.settlementMediumSecondary)) {
    fail('modality.settlementMediumSecondary', 'Secondary settlement medium is invalid.');
  }
  enumField(modality, 'executionLayer', EXECUTION_LAYERS, 'modality.executionLayer');
  enumField(modality, 'liquidityProfile', LIQUIDITY_PROFILES, 'modality.liquidityProfile');
  enumField(modality, 'jurisdictionalRestrictionLevel', JURISDICTIONAL_RESTRICTION_LEVELS, 'modality.jurisdictionalRestrictionLevel');
  boolField(modality, 'kycRequiredForSettlement', 'modality.kycRequiredForSettlement');

  if (errors.length > 0) return { ok: false, value: null, errors };

  // Structurally sound: safe to treat as a plan and run the constraint pass.
  const plan = input as EquityPlanDefinition;
  const constraintErrors = checkConstraints(plan);
  return { ok: constraintErrors.length === 0, value: plan, errors: constraintErrors };
}

/**
 * A sensible, internally-consistent default plan that passes every constraint.
 * Defaults are marked ASSUMED — the consultant tunes them in the Designer, which
 * flips provenance to ENTERED on save.
 */
export function createDefaultPlan(id: string, name = 'New incentive plan'): EquityPlanDefinition {
  return {
    id,
    name,
    provenance: 'ASSUMED',
    archetype: {
      planType: 'PERFORMANCE_PAY',
      primaryStrategicObjective: 'RETENTION',
      participationScope: ['SENIOR_LEADERSHIP', 'KEY_TALENT'],
      planMaturityStage: 'CONCEPT',
    },
    valueBasis: {
      referenceValueType: 'ADJUSTED_ENTERPRISE_VALUE',
      valuationMethod: 'INDEPENDENT_APPRAISAL',
      valuationCadence: 'ANNUAL',
      distortionProtectionLevel: 'PARTIAL',
    },
    pool: {
      poolSizePercentEV: 0.05,
      tokenSupply: 1_000_000,
      poolUsageTargetHorizonYears: 4,
      allocationExecPercentOfPool: 0.3,
      allocationLeadershipPercentOfPool: 0.3,
      allocationEmployeesPercentOfPool: 0.3,
      allocationContractorsPercentOfPool: 0,
      allocationEcosystemPercentOfPool: 0,
      concentrationIndex: 'BALANCED',
    },
    performance: {
      weightEnterpriseKpis: 0.5,
      weightBuKpis: 0.3,
      weightIndividualKpis: 0.2,
      kpiTypeMixFinancialShare: 0.7,
      kpiTypeMixNonFinancialShare: 0.3,
      kpiTimeHorizonProfile: 'BALANCED',
      kpiCount: 4,
    },
    vesting: {
      vestingModel: 'HYBRID',
      vestingHorizonYears: 4,
      cliffPeriodYears: 1,
      milestoneGateCount: 2,
      primaryPayoutTrigger: 'ON_VESTING',
      secondaryTriggersFlag: true,
      forfeitureStrictness: 'MODERATE',
    },
    intensity: {
      payPerformanceElasticity: 3,
      upsideLeverageProfile: 'BAND_GRADUATED',
      downsideExposure: 'PARTIAL_DOWNSIDE',
      capOnPayout: true,
      maxPayoutMultipleOfGrantValue: 3,
    },
    governance: {
      governanceRigorLevel: 'STANDARD_COMMITTEE',
      ownerControlPreservationLevel: 'MEDIUM',
      capitalStructureResilience: 'ADAPTABLE',
      complianceComplexityIndex: 3,
    },
    experience: {
      transparencyMode: 'STATEMENT_ANNUAL',
      formulaComplexity: 'MODERATE',
      onePageNarrativeScore: 3,
      communicationCadence: 'ANNUAL_CAMPAIGN',
    },
    modality: {
      settlementMediumPrimary: 'FIAT_CASH',
      settlementMediumSecondary: null,
      executionLayer: 'OFF_CHAIN_LEDGER_ONLY',
      liquidityProfile: 'PERIODIC_WINDOWS',
      kycRequiredForSettlement: false,
      jurisdictionalRestrictionLevel: 'MEDIUM',
    },
  };
}

/** A participation-scope toggle helper kept here so UI and validation agree. */
export function toggleParticipationScope(
  current: ParticipationScope[],
  scope: ParticipationScope,
): ParticipationScope[] {
  const has = current.includes(scope);
  const next = has ? current.filter((s) => s !== scope) : [...current, scope];
  // Preserve canonical order so the set is stable regardless of click order.
  return PARTICIPATION_SCOPES.filter((s) => next.includes(s));
}
