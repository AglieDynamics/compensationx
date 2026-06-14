/**
 * Plan Designer (route /incentives/designer[?id=…]).
 *
 * Edits a LOCAL draft of an {@link EquityPlanDefinition} grouped by the ten
 * design dimensions, recomputing FAIR scores and constraint validation live (all
 * math from @/lib/equityScoring + @/lib/equityPlanSchema — this module renders
 * only). Save upserts into the equity-plan store and flips provenance to ENTERED.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, RotateCcw, Save } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import {
  BoolField,
  DimensionSection,
  EnumField,
  Field,
  FractionField,
  MultiField,
  NumberField,
  OrdinalField,
} from '@/components/equity/PlanFields';
import { FairScorecard, OverallQualityBadge } from '@/components/equity/FairScorecard';
import {
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
  type PlanArchetype,
  PAYOUT_TRIGGERS,
  PLAN_MATURITY_STAGES,
  PLAN_TYPES,
  PRIMARY_OBJECTIVES,
  REFERENCE_VALUE_TYPES,
  SETTLEMENT_MEDIA,
  type SettlementMedium,
  TRANSPARENCY_MODES,
  UPSIDE_LEVERAGE_PROFILES,
  VALUATION_CADENCES,
  VALUATION_METHODS,
  VESTING_MODELS,
} from '@/domain/equityPlan';
import { checkConstraints, createDefaultPlan, toggleParticipationScope } from '@/lib/equityPlanSchema';
import { scorePlan } from '@/lib/equityScoring';
import { humanizeEnum } from '@/components/equity/equityLabels';
import { useEquityPlanStore, usePlanById } from '@/store/equityPlanStore';

const newDraftId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `plan-${crypto.randomUUID().slice(0, 8)}` : 'plan-new';

const inputCls =
  'h-8 w-full rounded-lg border border-border bg-card px-2.5 text-[0.82rem] text-ink placeholder:text-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30';

export function PlanDesigner() {
  const [params] = useSearchParams();
  const editId = params.get('id') ?? undefined;
  const existing = usePlanById(editId);
  const savePlan = useEquityPlanStore((s) => s.savePlan);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<EquityPlanDefinition>(() => existing ?? createDefaultPlan(newDraftId()));
  const [saved, setSaved] = useState(false);

  // Load the persisted plan once it hydrates (edit links may open pre-hydration).
  useEffect(() => {
    if (existing && existing.id !== draft.id) setDraft(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const score = useMemo(() => scorePlan(draft), [draft]);
  const errors = useMemo(() => checkConstraints(draft), [draft]);
  const isValid = errors.length === 0;

  // Type-safe per-group setters keep edits explicit and bulletproof.
  const dirty = () => setSaved(false);
  const setName = (name: string) => { setDraft((d) => ({ ...d, name })); dirty(); };
  const setArchetype = (p: Partial<EquityPlanDefinition['archetype']>) => { setDraft((d) => ({ ...d, archetype: { ...d.archetype, ...p } })); dirty(); };
  const setValueBasis = (p: Partial<EquityPlanDefinition['valueBasis']>) => { setDraft((d) => ({ ...d, valueBasis: { ...d.valueBasis, ...p } })); dirty(); };
  const setPool = (p: Partial<EquityPlanDefinition['pool']>) => { setDraft((d) => ({ ...d, pool: { ...d.pool, ...p } })); dirty(); };
  const setPerformance = (p: Partial<EquityPlanDefinition['performance']>) => { setDraft((d) => ({ ...d, performance: { ...d.performance, ...p } })); dirty(); };
  const setVesting = (p: Partial<EquityPlanDefinition['vesting']>) => { setDraft((d) => ({ ...d, vesting: { ...d.vesting, ...p } })); dirty(); };
  const setIntensity = (p: Partial<EquityPlanDefinition['intensity']>) => { setDraft((d) => ({ ...d, intensity: { ...d.intensity, ...p } })); dirty(); };
  const setGovernance = (p: Partial<EquityPlanDefinition['governance']>) => { setDraft((d) => ({ ...d, governance: { ...d.governance, ...p } })); dirty(); };
  const setExperience = (p: Partial<EquityPlanDefinition['experience']>) => { setDraft((d) => ({ ...d, experience: { ...d.experience, ...p } })); dirty(); };
  const setModality = (p: Partial<EquityPlanDefinition['modality']>) => { setDraft((d) => ({ ...d, modality: { ...d.modality, ...p } })); dirty(); };

  const onSave = () => {
    if (!isValid) return;
    savePlan(draft);
    setSaved(true);
  };
  const onReset = () => { setDraft(existing ?? createDefaultPlan(newDraftId())); dirty(); };

  const allocTotal =
    draft.pool.allocationExecPercentOfPool +
    draft.pool.allocationLeadershipPercentOfPool +
    draft.pool.allocationEmployeesPercentOfPool +
    draft.pool.allocationContractorsPercentOfPool +
    draft.pool.allocationEcosystemPercentOfPool;
  const weightTotal =
    draft.performance.weightEnterpriseKpis + draft.performance.weightBuKpis + draft.performance.weightIndividualKpis;

  return (
    <ModuleShell
      title={editId ? 'Edit incentive plan' : 'Design incentive plan'}
      subtitle="Define a synthetic-equity / incentive plan across ten design dimensions; FAIR scores update live."
      controls={
        <Link to="/incentives/library" className="text-[0.8rem] font-medium text-navy-700 hover:underline">
          ← Plan Library
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        {/* --- Form: ten dimensions --- */}
        <div className="space-y-5">
          <DimensionSection n={1} title="Plan archetype & purpose" right={<ProvenanceChip provenance={draft.provenance} />}>
            <Field label="Plan name">
              <input className={inputCls} value={draft.name} onChange={(e) => setName(e.target.value)} aria-label="Plan name" placeholder="e.g. Growth Token Pool" />
            </Field>
            <EnumField label="Plan type" value={draft.archetype.planType} values={PLAN_TYPES} onChange={(v) => setArchetype({ planType: v })} />
            <EnumField label="Primary objective" value={draft.archetype.primaryStrategicObjective} values={PRIMARY_OBJECTIVES} onChange={(v) => setArchetype({ primaryStrategicObjective: v })} />
            <EnumField label="Maturity stage" value={draft.archetype.planMaturityStage} values={PLAN_MATURITY_STAGES} onChange={(v) => setArchetype({ planMaturityStage: v })} />
            <div className="sm:col-span-2 lg:col-span-3">
              <MultiField<PlanArchetype['participationScope'][number]>
                label="Participation scope"
                values={PARTICIPATION_SCOPES}
                selected={draft.archetype.participationScope}
                onToggle={(v) => setArchetype({ participationScope: toggleParticipationScope(draft.archetype.participationScope, v) })}
                error={errorMessage(errors, 'archetype.participationScope')}
              />
            </div>
          </DimensionSection>

          <DimensionSection n={2} title="Value basis & valuation logic">
            <EnumField label="Reference value type" value={draft.valueBasis.referenceValueType} values={REFERENCE_VALUE_TYPES} onChange={(v) => setValueBasis({ referenceValueType: v })} />
            <EnumField label="Valuation method" value={draft.valueBasis.valuationMethod} values={VALUATION_METHODS} onChange={(v) => setValueBasis({ valuationMethod: v })} />
            <EnumField label="Valuation cadence" value={draft.valueBasis.valuationCadence} values={VALUATION_CADENCES} onChange={(v) => setValueBasis({ valuationCadence: v })} />
            <EnumField label="Distortion protection" value={draft.valueBasis.distortionProtectionLevel} values={DISTORTION_PROTECTION_LEVELS} onChange={(v) => setValueBasis({ distortionProtectionLevel: v })} hint="Adjustment for capital-structure events (ESOP leverage, redemptions, dividends)." />
          </DimensionSection>

          <DimensionSection
            n={3}
            title="Pool size & allocation"
            subtitle="The five allocation shares must total ≤ 100%; the remainder is unallocated."
            right={<AllocationTag total={allocTotal} />}
          >
            <FractionField label="Pool size (% of value)" value={draft.pool.poolSizePercentEV} onChange={(v) => setPool({ poolSizePercentEV: v })} />
            <NumberField label="Token supply" value={draft.pool.tokenSupply} onChange={(v) => setPool({ tokenSupply: v })} min={0} step={100000} integer />
            <NumberField label="Pool refresh horizon" value={draft.pool.poolUsageTargetHorizonYears} onChange={(v) => setPool({ poolUsageTargetHorizonYears: v })} min={0.5} step={0.5} suffix="yrs" />
            <FractionField label="→ Executives" value={draft.pool.allocationExecPercentOfPool} onChange={(v) => setPool({ allocationExecPercentOfPool: v })} step={5} />
            <FractionField label="→ Leadership" value={draft.pool.allocationLeadershipPercentOfPool} onChange={(v) => setPool({ allocationLeadershipPercentOfPool: v })} step={5} />
            <FractionField label="→ Employees" value={draft.pool.allocationEmployeesPercentOfPool} onChange={(v) => setPool({ allocationEmployeesPercentOfPool: v })} step={5} />
            <FractionField label="→ Contractors" value={draft.pool.allocationContractorsPercentOfPool} onChange={(v) => setPool({ allocationContractorsPercentOfPool: v })} step={5} />
            <FractionField label="→ Ecosystem" value={draft.pool.allocationEcosystemPercentOfPool} onChange={(v) => setPool({ allocationEcosystemPercentOfPool: v })} step={5} error={errorMessage(errors, 'pool.allocation')} />
            <EnumField label="Concentration" value={draft.pool.concentrationIndex} values={CONCENTRATION_INDICES} onChange={(v) => setPool({ concentrationIndex: v })} />
          </DimensionSection>

          <DimensionSection
            n={4}
            title="Performance architecture"
            subtitle="KPI weights total exactly 100%; financial + non-financial share total 100%."
            right={<WeightTag total={weightTotal} />}
          >
            <FractionField label="Weight · Enterprise KPIs" value={draft.performance.weightEnterpriseKpis} onChange={(v) => setPerformance({ weightEnterpriseKpis: v })} step={5} />
            <FractionField label="Weight · BU KPIs" value={draft.performance.weightBuKpis} onChange={(v) => setPerformance({ weightBuKpis: v })} step={5} />
            <FractionField label="Weight · Individual KPIs" value={draft.performance.weightIndividualKpis} onChange={(v) => setPerformance({ weightIndividualKpis: v })} step={5} error={errorMessage(errors, 'performance.weights')} />
            <FractionField label="Financial share" value={draft.performance.kpiTypeMixFinancialShare} onChange={(v) => setPerformance({ kpiTypeMixFinancialShare: v })} step={5} />
            <FractionField label="Non-financial share" value={draft.performance.kpiTypeMixNonFinancialShare} onChange={(v) => setPerformance({ kpiTypeMixNonFinancialShare: v })} step={5} error={errorMessage(errors, 'performance.kpiTypeMix')} />
            <EnumField label="KPI time horizon" value={draft.performance.kpiTimeHorizonProfile} values={KPI_TIME_HORIZON_PROFILES} onChange={(v) => setPerformance({ kpiTimeHorizonProfile: v })} />
            <NumberField label="KPI count" value={draft.performance.kpiCount} onChange={(v) => setPerformance({ kpiCount: v })} min={1} step={1} integer />
          </DimensionSection>

          <DimensionSection n={5} title="Vesting & triggers">
            <EnumField label="Vesting model" value={draft.vesting.vestingModel} values={VESTING_MODELS} onChange={(v) => setVesting({ vestingModel: v })} />
            <NumberField label="Vesting horizon" value={draft.vesting.vestingHorizonYears} onChange={(v) => setVesting({ vestingHorizonYears: v })} min={0} step={0.5} suffix="yrs" />
            <NumberField label="Cliff period" value={draft.vesting.cliffPeriodYears} onChange={(v) => setVesting({ cliffPeriodYears: v })} min={0} step={0.5} suffix="yrs" error={errorMessage(errors, 'vesting.cliffPeriodYears')} />
            <NumberField label="Milestone gates" value={draft.vesting.milestoneGateCount} onChange={(v) => setVesting({ milestoneGateCount: v })} min={0} step={1} integer />
            <EnumField label="Primary payout trigger" value={draft.vesting.primaryPayoutTrigger} values={PAYOUT_TRIGGERS} onChange={(v) => setVesting({ primaryPayoutTrigger: v })} />
            <EnumField label="Forfeiture strictness" value={draft.vesting.forfeitureStrictness} values={FORFEITURE_STRICTNESS_LEVELS} onChange={(v) => setVesting({ forfeitureStrictness: v })} />
            <BoolField label="Secondary (409A) triggers" value={draft.vesting.secondaryTriggersFlag} onChange={(v) => setVesting({ secondaryTriggersFlag: v })} />
          </DimensionSection>

          <DimensionSection n={6} title="Incentive intensity & elasticity">
            <OrdinalField label="Pay-performance elasticity" value={draft.intensity.payPerformanceElasticity} onChange={(v) => setIntensity({ payPerformanceElasticity: v })} hint="1 = near-fixed · 5 = very steep" />
            <EnumField label="Upside leverage" value={draft.intensity.upsideLeverageProfile} values={UPSIDE_LEVERAGE_PROFILES} onChange={(v) => setIntensity({ upsideLeverageProfile: v })} />
            <EnumField label="Downside exposure" value={draft.intensity.downsideExposure} values={DOWNSIDE_EXPOSURES} onChange={(v) => setIntensity({ downsideExposure: v })} />
            <BoolField label="Cap on payout" value={draft.intensity.capOnPayout} onChange={(v) => setIntensity({ capOnPayout: v })} />
            <NumberField label="Max payout multiple" value={draft.intensity.maxPayoutMultipleOfGrantValue} onChange={(v) => setIntensity({ maxPayoutMultipleOfGrantValue: v })} min={0} step={0.5} suffix="× grant" />
          </DimensionSection>

          <DimensionSection n={7} title="Governance & flexibility">
            <EnumField label="Governance rigor" value={draft.governance.governanceRigorLevel} values={GOVERNANCE_RIGOR_LEVELS} onChange={(v) => setGovernance({ governanceRigorLevel: v })} />
            <EnumField label="Owner control preserved" value={draft.governance.ownerControlPreservationLevel} values={OWNER_CONTROL_LEVELS} onChange={(v) => setGovernance({ ownerControlPreservationLevel: v })} />
            <EnumField label="Capital-structure resilience" value={draft.governance.capitalStructureResilience} values={CAPITAL_STRUCTURE_RESILIENCE_LEVELS} onChange={(v) => setGovernance({ capitalStructureResilience: v })} />
            <OrdinalField label="Compliance complexity" value={draft.governance.complianceComplexityIndex} onChange={(v) => setGovernance({ complianceComplexityIndex: v })} hint="1 = simple · 5 = highly complex" />
          </DimensionSection>

          <DimensionSection n={8} title="Participant experience & clarity">
            <EnumField label="Transparency mode" value={draft.experience.transparencyMode} values={TRANSPARENCY_MODES} onChange={(v) => setExperience({ transparencyMode: v })} />
            <EnumField label="Formula complexity" value={draft.experience.formulaComplexity} values={FORMULA_COMPLEXITIES} onChange={(v) => setExperience({ formulaComplexity: v })} />
            <OrdinalField label="One-page narrative" value={draft.experience.onePageNarrativeScore} onChange={(v) => setExperience({ onePageNarrativeScore: v })} hint="How easily it explains on one page" />
            <EnumField label="Communication cadence" value={draft.experience.communicationCadence} values={COMMUNICATION_CADENCES} onChange={(v) => setExperience({ communicationCadence: v })} />
          </DimensionSection>

          <DimensionSection n={9} title="Token & payout modality">
            <EnumField label="Settlement medium (primary)" value={draft.modality.settlementMediumPrimary} values={SETTLEMENT_MEDIA} onChange={(v) => setModality({ settlementMediumPrimary: v })} />
            <Field label="Settlement medium (secondary)" error={errorMessage(errors, 'modality.settlementMediumSecondary')}>
              <select
                className={inputCls}
                aria-label="Settlement medium (secondary)"
                value={draft.modality.settlementMediumSecondary ?? 'NONE'}
                onChange={(e) => setModality({ settlementMediumSecondary: e.target.value === 'NONE' ? null : (e.target.value as SettlementMedium) })}
              >
                <option value="NONE">None</option>
                {SETTLEMENT_MEDIA.map((m) => (
                  <option key={m} value={m}>{humanizeEnum(m)}</option>
                ))}
              </select>
            </Field>
            <EnumField label="Execution layer" value={draft.modality.executionLayer} values={EXECUTION_LAYERS} onChange={(v) => setModality({ executionLayer: v })} />
            <EnumField label="Liquidity profile" value={draft.modality.liquidityProfile} values={LIQUIDITY_PROFILES} onChange={(v) => setModality({ liquidityProfile: v })} />
            <EnumField label="Jurisdictional restriction" value={draft.modality.jurisdictionalRestrictionLevel} values={JURISDICTIONAL_RESTRICTION_LEVELS} onChange={(v) => setModality({ jurisdictionalRestrictionLevel: v })} />
            <BoolField label="KYC required to settle" value={draft.modality.kycRequiredForSettlement} onChange={(v) => setModality({ kycRequiredForSettlement: v })} />
          </DimensionSection>
        </div>

        {/* --- Sticky FAIR scorecard + actions --- */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card title="FAIR design quality" subtitle="Framework score from the structural inputs." right={<OverallQualityBadge band={score.overall.band} score={score.overall.score} />}>
            <FairScorecard score={score} />
            <div className="mt-4 border-t border-border pt-3">
              {isValid ? (
                <div className="flex items-center gap-2 text-[0.78rem] text-brand-green">
                  <Check size={14} /> All constraints satisfied.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-wide text-brand-red">
                    {errors.length} issue{errors.length === 1 ? '' : 's'} to resolve
                  </div>
                  <ul className="space-y-1 text-[0.74rem] text-ink-soft">
                    {errors.map((e) => (
                      <li key={e.path}>· {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!isValid}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-navy-700 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={13} /> {editId ? 'Save changes' : 'Save plan'}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
            {saved && (
              <button
                type="button"
                onClick={() => navigate('/incentives/library')}
                className="mt-2 flex w-full items-center justify-center gap-1 text-[0.76rem] text-brand-green hover:underline"
              >
                <Check size={13} /> Saved — view in Library
              </button>
            )}
          </Card>
          <Card className="mt-5" title="Reads" subtitle="Plain-language summary of the design.">
            <dl className="space-y-2 text-[0.78rem]">
              <Read label="Concentration" value={score.reads.concentration} />
              <Read label="Risk / elasticity" value={score.reads.downsideElasticity} />
              <Read label="Unallocated pool" value={`${Math.round(score.reads.unallocatedPoolPct * 100)}%`} />
            </dl>
          </Card>
          {!editId && draft.provenance === 'ASSUMED' && (
            <EmptyState compact className="mt-5" message="Defaults are illustrative (Assumed). Tune the dimensions, then Save to record this plan." />
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

function errorMessage(errors: { path: string; message: string }[], path: string): string | undefined {
  return errors.find((e) => e.path === path)?.message;
}

function AllocationTag({ total }: { total: number }) {
  const pct = Math.round(total * 100);
  const over = total > 1 + 1e-6;
  return (
    <span className={`text-[0.72rem] font-semibold tabular-nums ${over ? 'text-brand-red' : 'text-muted'}`}>
      {pct}% allocated{over ? ' (over 100%)' : ''}
    </span>
  );
}

function WeightTag({ total }: { total: number }) {
  const pct = Math.round(total * 100);
  const ok = Math.abs(total - 1) <= 1e-6;
  return (
    <span className={`text-[0.72rem] font-semibold tabular-nums ${ok ? 'text-brand-green' : 'text-brand-red'}`}>
      weights {pct}%
    </span>
  );
}

function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-ink-soft">{value}</dd>
    </div>
  );
}
