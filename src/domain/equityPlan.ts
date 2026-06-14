/**
 * Domain types for the Synthetic Equity & Incentive Plan Benchmarking module.
 *
 * Pure data shapes only — no compute, no validation logic. Each of the ten
 * design dimensions is a typed group. Enum option sets are declared once as
 * `as const` arrays (the single source of truth) and the union types are
 * derived from them, so the validator, UI option lists and types never drift.
 *
 * The FAIR design-quality scores are NOT stored here: they are derived from
 * these structural inputs by the framework logic in `@/lib/equityScoring`.
 */

import type { Provenance } from '@/lib/provenance';

/** Helper: union of the literal members of an `as const` string array. */
type Member<T extends readonly string[]> = T[number];

// --- 1. Plan archetype & purpose -------------------------------------------

export const PLAN_TYPES = [
  'SYNTH_EQUITY_TOKENS',
  'PERFORMANCE_PAY',
  'APPRECIATION_RIGHTS',
  'VALUE_BAND',
  'CHANGE_IN_CONTROL_UNITS',
  'DIVISION_BASED_EQUITY',
  'HYBRID',
] as const;
export type PlanType = Member<typeof PLAN_TYPES>;

export const PRIMARY_OBJECTIVES = [
  'GROWTH_UPSIDE_SHARING',
  'RETENTION',
  'SUCCESSION_PREP',
  'INNOVATION_LOCALIZATION',
  'ECOSYSTEM_EXPANSION',
  'CASH_PRESERVATION',
] as const;
export type PrimaryObjective = Member<typeof PRIMARY_OBJECTIVES>;

export const PARTICIPATION_SCOPES = [
  'EXECUTIVE_TEAM',
  'SENIOR_LEADERSHIP',
  'KEY_TALENT',
  'BROAD_EMPLOYEES',
  'CONTRACTORS',
  'ECOSYSTEM_PARTNERS',
] as const;
export type ParticipationScope = Member<typeof PARTICIPATION_SCOPES>;

export const PLAN_MATURITY_STAGES = ['CONCEPT', 'PILOT', 'ROLLED_OUT', 'LEGACY_REVIEW'] as const;
export type PlanMaturityStage = Member<typeof PLAN_MATURITY_STAGES>;

export interface PlanArchetype {
  planType: PlanType;
  primaryStrategicObjective: PrimaryObjective;
  participationScope: ParticipationScope[];
  planMaturityStage: PlanMaturityStage;
}

// --- 2. Value basis & valuation logic --------------------------------------

export const REFERENCE_VALUE_TYPES = [
  'ENTERPRISE_VALUE',
  'EQUITY_FMV_PER_SHARE',
  'ADJUSTED_ENTERPRISE_VALUE',
  'BUSINESS_UNIT_VALUE',
  'FORMULAIC_VALUE',
] as const;
export type ReferenceValueType = Member<typeof REFERENCE_VALUE_TYPES>;

export const VALUATION_METHODS = [
  'MARKET_CAP',
  'DCF',
  'EBITDA_MULTIPLE',
  'REVENUE_MULTIPLE',
  'INDEPENDENT_APPRAISAL',
  'INTERNAL_FORMULA',
] as const;
export type ValuationMethod = Member<typeof VALUATION_METHODS>;

export const VALUATION_CADENCES = ['ANNUAL', 'SEMI_ANNUAL', 'EVENT_DRIVEN_ONLY', 'ROLLING_QUARTERLY'] as const;
export type ValuationCadence = Member<typeof VALUATION_CADENCES>;

/** Ordinal: how explicitly the design adjusts for capital-structure events. */
export const DISTORTION_PROTECTION_LEVELS = ['NONE', 'PARTIAL', 'ROBUST'] as const;
export type DistortionProtectionLevel = Member<typeof DISTORTION_PROTECTION_LEVELS>;

export interface ValueBasis {
  referenceValueType: ReferenceValueType;
  valuationMethod: ValuationMethod;
  valuationCadence: ValuationCadence;
  distortionProtectionLevel: DistortionProtectionLevel;
}

// --- 3. Pool size & allocation ---------------------------------------------

export const CONCENTRATION_INDICES = ['TOP_HEAVY', 'BALANCED', 'BROAD_BASED'] as const;
export type ConcentrationIndex = Member<typeof CONCENTRATION_INDICES>;

export interface PoolAllocation {
  /** Decimal fraction of the reference value, e.g. 0.05 = 5%. */
  poolSizePercentEV: number;
  /** Total synthetic units authorized (integer ≥ 0). */
  tokenSupply: number;
  /** Expected years until pool refresh (> 0). */
  poolUsageTargetHorizonYears: number;
  /** The five allocation shares are each 0–1 and sum to ≤ 1.0 (remainder = unallocated). */
  allocationExecPercentOfPool: number;
  allocationLeadershipPercentOfPool: number;
  allocationEmployeesPercentOfPool: number;
  allocationContractorsPercentOfPool: number;
  allocationEcosystemPercentOfPool: number;
  concentrationIndex: ConcentrationIndex;
}

/** The five allocation fields, in display order — used by validator and UI. */
export const ALLOCATION_KEYS = [
  'allocationExecPercentOfPool',
  'allocationLeadershipPercentOfPool',
  'allocationEmployeesPercentOfPool',
  'allocationContractorsPercentOfPool',
  'allocationEcosystemPercentOfPool',
] as const satisfies readonly (keyof PoolAllocation)[];

// --- 4. Performance architecture -------------------------------------------

export const KPI_TIME_HORIZON_PROFILES = ['SHORT_TERM_DOMINANT', 'BALANCED', 'LONG_TERM_DOMINANT'] as const;
export type KpiTimeHorizonProfile = Member<typeof KPI_TIME_HORIZON_PROFILES>;

export interface PerformanceArchitecture {
  /** The three KPI weights are each 0–1 and sum to exactly 1.0. */
  weightEnterpriseKpis: number;
  weightBuKpis: number;
  weightIndividualKpis: number;
  /** Financial + non-financial share each 0–1 and sum to exactly 1.0. */
  kpiTypeMixFinancialShare: number;
  kpiTypeMixNonFinancialShare: number;
  kpiTimeHorizonProfile: KpiTimeHorizonProfile;
  /** Integer ≥ 1. */
  kpiCount: number;
}

// --- 5. Vesting & triggers -------------------------------------------------

export const VESTING_MODELS = ['TIME_BASED', 'MILESTONE_BASED', 'HYBRID'] as const;
export type VestingModel = Member<typeof VESTING_MODELS>;

export const PAYOUT_TRIGGERS = [
  'ANNUAL_SETTLEMENT',
  'ON_VESTING',
  'CHANGE_IN_CONTROL',
  'IPO',
  'RETIREMENT',
  'SEPARATION_OF_SERVICE',
  'HYBRID',
] as const;
export type PayoutTrigger = Member<typeof PAYOUT_TRIGGERS>;

export const FORFEITURE_STRICTNESS_LEVELS = ['SOFT', 'MODERATE', 'STRICT'] as const;
export type ForfeitureStrictness = Member<typeof FORFEITURE_STRICTNESS_LEVELS>;

export interface VestingTriggers {
  vestingModel: VestingModel;
  vestingHorizonYears: number;
  /** 0 = none; must be ≤ vestingHorizonYears. */
  cliffPeriodYears: number;
  milestoneGateCount: number;
  primaryPayoutTrigger: PayoutTrigger;
  /** 409A-style events: death, disability, unforeseen emergency. */
  secondaryTriggersFlag: boolean;
  forfeitureStrictness: ForfeitureStrictness;
}

// --- 6. Incentive intensity & elasticity -----------------------------------

export const UPSIDE_LEVERAGE_PROFILES = ['LINEAR', 'BAND_GRADUATED', 'HOCKEY_STICK'] as const;
export type UpsideLeverageProfile = Member<typeof UPSIDE_LEVERAGE_PROFILES>;

export const DOWNSIDE_EXPOSURES = ['NO_DOWNSIDE', 'PARTIAL_DOWNSIDE', 'FULL_DOWNSIDE'] as const;
export type DownsideExposure = Member<typeof DOWNSIDE_EXPOSURES>;

export interface IncentiveIntensity {
  /** Ordinal 1–5 (1 = near-fixed retention; 5 = very steep payoff between bands). */
  payPerformanceElasticity: number;
  upsideLeverageProfile: UpsideLeverageProfile;
  downsideExposure: DownsideExposure;
  capOnPayout: boolean;
  /** ≥ 0, e.g. 3.0 = 3× grant fair value at target. */
  maxPayoutMultipleOfGrantValue: number;
}

// --- 8. Governance & flexibility -------------------------------------------

export const GOVERNANCE_RIGOR_LEVELS = ['OPERATIONAL_ONLY', 'STANDARD_COMMITTEE', 'FULL_BOARD_INTEGRATION'] as const;
export type GovernanceRigorLevel = Member<typeof GOVERNANCE_RIGOR_LEVELS>;

export const OWNER_CONTROL_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type OwnerControlPreservationLevel = Member<typeof OWNER_CONTROL_LEVELS>;

export const CAPITAL_STRUCTURE_RESILIENCE_LEVELS = ['FRAGILE', 'ADAPTABLE', 'ROBUST'] as const;
export type CapitalStructureResilience = Member<typeof CAPITAL_STRUCTURE_RESILIENCE_LEVELS>;

export interface GovernanceFlexibility {
  governanceRigorLevel: GovernanceRigorLevel;
  ownerControlPreservationLevel: OwnerControlPreservationLevel;
  capitalStructureResilience: CapitalStructureResilience;
  /** Ordinal 1–5. */
  complianceComplexityIndex: number;
}

// --- 9. Participant experience & clarity -----------------------------------

export const TRANSPARENCY_MODES = ['STATEMENT_ANNUAL', 'STATEMENT_QUARTERLY', 'REALTIME_DASHBOARD'] as const;
export type TransparencyMode = Member<typeof TRANSPARENCY_MODES>;

export const FORMULA_COMPLEXITIES = ['SIMPLE', 'MODERATE', 'COMPLEX'] as const;
export type FormulaComplexity = Member<typeof FORMULA_COMPLEXITIES>;

export const COMMUNICATION_CADENCES = ['AD_HOC', 'ANNUAL_CAMPAIGN', 'ONGOING_PROGRAMMATIC'] as const;
export type CommunicationCadence = Member<typeof COMMUNICATION_CADENCES>;

export interface ParticipantExperience {
  transparencyMode: TransparencyMode;
  formulaComplexity: FormulaComplexity;
  /** Ordinal 1–5: how easily the plan explains on one page to a high performer. */
  onePageNarrativeScore: number;
  communicationCadence: CommunicationCadence;
}

// --- 10. Token & payout modality -------------------------------------------

export const SETTLEMENT_MEDIA = [
  'FIAT_CASH',
  'STABLECOIN',
  'CORPORATE_UTILITY_TOKEN',
  'HYBRID_FIAT_TOKEN',
  'RWA_YIELD_LINKED',
] as const;
export type SettlementMedium = Member<typeof SETTLEMENT_MEDIA>;

export const EXECUTION_LAYERS = ['OFF_CHAIN_LEDGER_ONLY', 'ON_CHAIN_SMART_CONTRACT', 'HYBRID_EXECUTION'] as const;
export type ExecutionLayer = Member<typeof EXECUTION_LAYERS>;

export const LIQUIDITY_PROFILES = ['NO_INTERIM_LIQUIDITY', 'PERIODIC_WINDOWS', 'PROGRAMMED_SETTLEMENT'] as const;
export type LiquidityProfile = Member<typeof LIQUIDITY_PROFILES>;

export const JURISDICTIONAL_RESTRICTION_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type JurisdictionalRestrictionLevel = Member<typeof JURISDICTIONAL_RESTRICTION_LEVELS>;

export interface TokenModality {
  settlementMediumPrimary: SettlementMedium;
  /** Optional secondary medium (null when single-medium). */
  settlementMediumSecondary: SettlementMedium | null;
  executionLayer: ExecutionLayer;
  liquidityProfile: LiquidityProfile;
  kycRequiredForSettlement: boolean;
  jurisdictionalRestrictionLevel: JurisdictionalRestrictionLevel;
}

// --- Full plan definition ---------------------------------------------------

export interface EquityPlanDefinition {
  id: string;
  name: string;
  /**
   * Weakest provenance of the plan's inputs: ASSUMED for factory defaults /
   * seed plans, ENTERED once a consultant authors or edits one.
   */
  provenance: Provenance;
  archetype: PlanArchetype;
  valueBasis: ValueBasis;
  pool: PoolAllocation;
  performance: PerformanceArchitecture;
  vesting: VestingTriggers;
  intensity: IncentiveIntensity;
  governance: GovernanceFlexibility;
  experience: ParticipantExperience;
  modality: TokenModality;
}

/** The four FAIR design-quality axes, scored 1–5 by `@/lib/equityScoring`. */
export const FAIR_AXES = ['value', 'share', 'deal', 'team'] as const;
export type FairAxis = Member<typeof FAIR_AXES>;

export const FAIR_AXIS_LABELS: Record<FairAxis, string> = {
  value: 'Fair Value',
  share: 'Fair Share',
  deal: 'Fair Deal',
  team: 'Fair Team',
};
