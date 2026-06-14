/**
 * Deterministic seed plans — one per archetype — so the Library, Designer and
 * Comparison views render meaningfully on first load. All tagged ASSUMED
 * (illustrative), consistent with how the rest of the app ships seeded data.
 * Each is built from {@link createDefaultPlan} and overridden per group, so the
 * factory's constraint-valid defaults stand for anything not customized.
 */

import type { EquityPlanDefinition } from '@/domain/equityPlan';
import { createDefaultPlan } from '@/lib/equityPlanSchema';

type GroupOverrides = {
  [K in Exclude<keyof EquityPlanDefinition, 'id' | 'name' | 'provenance'>]?: Partial<EquityPlanDefinition[K]>;
};

function makePlan(id: string, name: string, o: GroupOverrides): EquityPlanDefinition {
  const d = createDefaultPlan(id, name);
  return {
    ...d,
    provenance: 'ASSUMED',
    archetype: { ...d.archetype, ...o.archetype },
    valueBasis: { ...d.valueBasis, ...o.valueBasis },
    pool: { ...d.pool, ...o.pool },
    performance: { ...d.performance, ...o.performance },
    vesting: { ...d.vesting, ...o.vesting },
    intensity: { ...d.intensity, ...o.intensity },
    governance: { ...d.governance, ...o.governance },
    experience: { ...d.experience, ...o.experience },
    modality: { ...d.modality, ...o.modality },
  };
}

export const SEED_EQUITY_PLANS: EquityPlanDefinition[] = [
  makePlan('seed-synth-tokens', 'Growth Token Pool', {
    archetype: {
      planType: 'SYNTH_EQUITY_TOKENS',
      primaryStrategicObjective: 'GROWTH_UPSIDE_SHARING',
      participationScope: ['SENIOR_LEADERSHIP', 'KEY_TALENT', 'BROAD_EMPLOYEES'],
      planMaturityStage: 'PILOT',
    },
    valueBasis: { referenceValueType: 'ADJUSTED_ENTERPRISE_VALUE', valuationMethod: 'INDEPENDENT_APPRAISAL', valuationCadence: 'ROLLING_QUARTERLY', distortionProtectionLevel: 'ROBUST' },
    pool: { poolSizePercentEV: 0.08, tokenSupply: 5_000_000, concentrationIndex: 'BROAD_BASED', allocationExecPercentOfPool: 0.2, allocationLeadershipPercentOfPool: 0.25, allocationEmployeesPercentOfPool: 0.45, allocationContractorsPercentOfPool: 0.05, allocationEcosystemPercentOfPool: 0.05 },
    intensity: { payPerformanceElasticity: 4, upsideLeverageProfile: 'BAND_GRADUATED', downsideExposure: 'PARTIAL_DOWNSIDE', capOnPayout: false, maxPayoutMultipleOfGrantValue: 6 },
    modality: { settlementMediumPrimary: 'CORPORATE_UTILITY_TOKEN', settlementMediumSecondary: 'STABLECOIN', executionLayer: 'ON_CHAIN_SMART_CONTRACT', liquidityProfile: 'PROGRAMMED_SETTLEMENT', kycRequiredForSettlement: true, jurisdictionalRestrictionLevel: 'HIGH' },
    experience: { transparencyMode: 'REALTIME_DASHBOARD', formulaComplexity: 'MODERATE', onePageNarrativeScore: 4, communicationCadence: 'ONGOING_PROGRAMMATIC' },
  }),

  makePlan('seed-performance-pay', 'Annual Performance Plan', {
    archetype: {
      planType: 'PERFORMANCE_PAY',
      primaryStrategicObjective: 'RETENTION',
      participationScope: ['SENIOR_LEADERSHIP', 'KEY_TALENT'],
      planMaturityStage: 'ROLLED_OUT',
    },
    valueBasis: { referenceValueType: 'FORMULAIC_VALUE', valuationMethod: 'INTERNAL_FORMULA', valuationCadence: 'ANNUAL', distortionProtectionLevel: 'PARTIAL' },
    pool: { poolSizePercentEV: 0.03, tokenSupply: 0, concentrationIndex: 'BALANCED' },
    performance: { weightEnterpriseKpis: 0.4, weightBuKpis: 0.4, weightIndividualKpis: 0.2, kpiTypeMixFinancialShare: 0.8, kpiTypeMixNonFinancialShare: 0.2, kpiTimeHorizonProfile: 'SHORT_TERM_DOMINANT', kpiCount: 5 },
    vesting: { vestingModel: 'TIME_BASED', vestingHorizonYears: 1, cliffPeriodYears: 0, milestoneGateCount: 0, primaryPayoutTrigger: 'ANNUAL_SETTLEMENT', secondaryTriggersFlag: false, forfeitureStrictness: 'MODERATE' },
    intensity: { payPerformanceElasticity: 3, upsideLeverageProfile: 'LINEAR', downsideExposure: 'NO_DOWNSIDE', capOnPayout: true, maxPayoutMultipleOfGrantValue: 2 },
    modality: { settlementMediumPrimary: 'FIAT_CASH', settlementMediumSecondary: null, executionLayer: 'OFF_CHAIN_LEDGER_ONLY', liquidityProfile: 'PERIODIC_WINDOWS', kycRequiredForSettlement: false, jurisdictionalRestrictionLevel: 'LOW' },
    experience: { transparencyMode: 'STATEMENT_ANNUAL', formulaComplexity: 'SIMPLE', onePageNarrativeScore: 5, communicationCadence: 'ANNUAL_CAMPAIGN' },
  }),

  makePlan('seed-appreciation', 'Phantom Appreciation Rights', {
    archetype: {
      planType: 'APPRECIATION_RIGHTS',
      primaryStrategicObjective: 'GROWTH_UPSIDE_SHARING',
      participationScope: ['EXECUTIVE_TEAM', 'SENIOR_LEADERSHIP'],
      planMaturityStage: 'ROLLED_OUT',
    },
    valueBasis: { referenceValueType: 'ENTERPRISE_VALUE', valuationMethod: 'EBITDA_MULTIPLE', valuationCadence: 'ANNUAL', distortionProtectionLevel: 'PARTIAL' },
    pool: { poolSizePercentEV: 0.06, tokenSupply: 2_000_000, concentrationIndex: 'TOP_HEAVY', allocationExecPercentOfPool: 0.5, allocationLeadershipPercentOfPool: 0.4, allocationEmployeesPercentOfPool: 0.1, allocationContractorsPercentOfPool: 0, allocationEcosystemPercentOfPool: 0 },
    vesting: { vestingModel: 'TIME_BASED', vestingHorizonYears: 4, cliffPeriodYears: 1, milestoneGateCount: 0, primaryPayoutTrigger: 'ON_VESTING', secondaryTriggersFlag: true, forfeitureStrictness: 'STRICT' },
    intensity: { payPerformanceElasticity: 4, upsideLeverageProfile: 'LINEAR', downsideExposure: 'PARTIAL_DOWNSIDE', capOnPayout: false, maxPayoutMultipleOfGrantValue: 5 },
    governance: { governanceRigorLevel: 'FULL_BOARD_INTEGRATION', ownerControlPreservationLevel: 'HIGH', capitalStructureResilience: 'ADAPTABLE', complianceComplexityIndex: 3 },
  }),

  makePlan('seed-value-band', 'Banded Value Plan', {
    archetype: {
      planType: 'VALUE_BAND',
      primaryStrategicObjective: 'RETENTION',
      participationScope: ['SENIOR_LEADERSHIP', 'KEY_TALENT', 'BROAD_EMPLOYEES'],
      planMaturityStage: 'PILOT',
    },
    valueBasis: { referenceValueType: 'ADJUSTED_ENTERPRISE_VALUE', valuationMethod: 'DCF', valuationCadence: 'SEMI_ANNUAL', distortionProtectionLevel: 'ROBUST' },
    pool: { poolSizePercentEV: 0.05, tokenSupply: 1_500_000, concentrationIndex: 'BALANCED' },
    performance: { weightEnterpriseKpis: 0.34, weightBuKpis: 0.33, weightIndividualKpis: 0.33, kpiTypeMixFinancialShare: 0.6, kpiTypeMixNonFinancialShare: 0.4, kpiTimeHorizonProfile: 'BALANCED', kpiCount: 4 },
    intensity: { payPerformanceElasticity: 3, upsideLeverageProfile: 'BAND_GRADUATED', downsideExposure: 'PARTIAL_DOWNSIDE', capOnPayout: true, maxPayoutMultipleOfGrantValue: 3 },
    experience: { transparencyMode: 'STATEMENT_QUARTERLY', formulaComplexity: 'MODERATE', onePageNarrativeScore: 4, communicationCadence: 'ONGOING_PROGRAMMATIC' },
  }),

  makePlan('seed-cic-units', 'CIC Transaction Units', {
    archetype: {
      planType: 'CHANGE_IN_CONTROL_UNITS',
      primaryStrategicObjective: 'SUCCESSION_PREP',
      participationScope: ['EXECUTIVE_TEAM'],
      planMaturityStage: 'CONCEPT',
    },
    valueBasis: { referenceValueType: 'EQUITY_FMV_PER_SHARE', valuationMethod: 'MARKET_CAP', valuationCadence: 'EVENT_DRIVEN_ONLY', distortionProtectionLevel: 'NONE' },
    pool: { poolSizePercentEV: 0.1, tokenSupply: 1_000_000, concentrationIndex: 'TOP_HEAVY', allocationExecPercentOfPool: 0.7, allocationLeadershipPercentOfPool: 0.3, allocationEmployeesPercentOfPool: 0, allocationContractorsPercentOfPool: 0, allocationEcosystemPercentOfPool: 0 },
    vesting: { vestingModel: 'MILESTONE_BASED', vestingHorizonYears: 3, cliffPeriodYears: 0, milestoneGateCount: 1, primaryPayoutTrigger: 'CHANGE_IN_CONTROL', secondaryTriggersFlag: true, forfeitureStrictness: 'STRICT' },
    intensity: { payPerformanceElasticity: 5, upsideLeverageProfile: 'HOCKEY_STICK', downsideExposure: 'FULL_DOWNSIDE', capOnPayout: false, maxPayoutMultipleOfGrantValue: 10 },
    governance: { governanceRigorLevel: 'FULL_BOARD_INTEGRATION', ownerControlPreservationLevel: 'HIGH', capitalStructureResilience: 'FRAGILE', complianceComplexityIndex: 5 },
    experience: { transparencyMode: 'STATEMENT_ANNUAL', formulaComplexity: 'COMPLEX', onePageNarrativeScore: 2, communicationCadence: 'AD_HOC' },
  }),

  makePlan('seed-division-equity', 'Division Value Plan', {
    archetype: {
      planType: 'DIVISION_BASED_EQUITY',
      primaryStrategicObjective: 'INNOVATION_LOCALIZATION',
      participationScope: ['SENIOR_LEADERSHIP', 'KEY_TALENT'],
      planMaturityStage: 'PILOT',
    },
    valueBasis: { referenceValueType: 'BUSINESS_UNIT_VALUE', valuationMethod: 'REVENUE_MULTIPLE', valuationCadence: 'ANNUAL', distortionProtectionLevel: 'PARTIAL' },
    pool: { poolSizePercentEV: 0.07, tokenSupply: 800_000, concentrationIndex: 'BALANCED' },
    performance: { weightEnterpriseKpis: 0.2, weightBuKpis: 0.6, weightIndividualKpis: 0.2, kpiTypeMixFinancialShare: 0.7, kpiTypeMixNonFinancialShare: 0.3, kpiTimeHorizonProfile: 'LONG_TERM_DOMINANT', kpiCount: 3 },
    vesting: { vestingModel: 'HYBRID', vestingHorizonYears: 4, cliffPeriodYears: 1, milestoneGateCount: 3, primaryPayoutTrigger: 'HYBRID', secondaryTriggersFlag: true, forfeitureStrictness: 'MODERATE' },
    intensity: { payPerformanceElasticity: 4, upsideLeverageProfile: 'BAND_GRADUATED', downsideExposure: 'PARTIAL_DOWNSIDE', capOnPayout: true, maxPayoutMultipleOfGrantValue: 4 },
    governance: { governanceRigorLevel: 'STANDARD_COMMITTEE', ownerControlPreservationLevel: 'MEDIUM', capitalStructureResilience: 'ADAPTABLE', complianceComplexityIndex: 3 },
  }),

  makePlan('seed-hybrid', 'Hybrid Token + Cash Plan', {
    archetype: {
      planType: 'HYBRID',
      primaryStrategicObjective: 'ECOSYSTEM_EXPANSION',
      participationScope: ['SENIOR_LEADERSHIP', 'KEY_TALENT', 'CONTRACTORS', 'ECOSYSTEM_PARTNERS'],
      planMaturityStage: 'PILOT',
    },
    valueBasis: { referenceValueType: 'ADJUSTED_ENTERPRISE_VALUE', valuationMethod: 'DCF', valuationCadence: 'ROLLING_QUARTERLY', distortionProtectionLevel: 'ROBUST' },
    pool: { poolSizePercentEV: 0.09, tokenSupply: 3_000_000, concentrationIndex: 'BROAD_BASED', allocationExecPercentOfPool: 0.2, allocationLeadershipPercentOfPool: 0.25, allocationEmployeesPercentOfPool: 0.3, allocationContractorsPercentOfPool: 0.1, allocationEcosystemPercentOfPool: 0.15 },
    vesting: { vestingModel: 'HYBRID', vestingHorizonYears: 3, cliffPeriodYears: 1, milestoneGateCount: 2, primaryPayoutTrigger: 'HYBRID', secondaryTriggersFlag: true, forfeitureStrictness: 'MODERATE' },
    intensity: { payPerformanceElasticity: 3, upsideLeverageProfile: 'BAND_GRADUATED', downsideExposure: 'PARTIAL_DOWNSIDE', capOnPayout: true, maxPayoutMultipleOfGrantValue: 4 },
    modality: { settlementMediumPrimary: 'HYBRID_FIAT_TOKEN', settlementMediumSecondary: 'STABLECOIN', executionLayer: 'HYBRID_EXECUTION', liquidityProfile: 'PERIODIC_WINDOWS', kycRequiredForSettlement: true, jurisdictionalRestrictionLevel: 'MEDIUM' },
    experience: { transparencyMode: 'REALTIME_DASHBOARD', formulaComplexity: 'MODERATE', onePageNarrativeScore: 4, communicationCadence: 'ONGOING_PROGRAMMATIC' },
  }),
];
