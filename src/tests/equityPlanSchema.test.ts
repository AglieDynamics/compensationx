import { describe, expect, it } from 'vitest';
import { checkConstraints, createDefaultPlan, toggleParticipationScope, validateEquityPlan } from '@/lib/equityPlanSchema';
import { SEED_EQUITY_PLANS } from '@/data/equityPlans.seed';
import { PLAN_TYPES } from '@/domain/equityPlan';

const hasError = (errors: { path: string }[], path: string) => errors.some((e) => e.path === path);

describe('createDefaultPlan', () => {
  it('produces an internally-consistent, constraint-valid plan tagged ASSUMED', () => {
    const p = createDefaultPlan('p1');
    expect(p.provenance).toBe('ASSUMED');
    expect(checkConstraints(p)).toEqual([]);
    const res = validateEquityPlan(p);
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });
});

describe('checkConstraints', () => {
  it('flags pool allocations summing above 100%', () => {
    const p = createDefaultPlan('p1');
    p.pool.allocationExecPercentOfPool = 0.6;
    p.pool.allocationLeadershipPercentOfPool = 0.6;
    expect(hasError(checkConstraints(p), 'pool.allocation')).toBe(true);
  });

  it('allows allocations summing to less than 100% (unallocated remainder)', () => {
    const p = createDefaultPlan('p1');
    p.pool.allocationExecPercentOfPool = 0.1;
    p.pool.allocationLeadershipPercentOfPool = 0.1;
    p.pool.allocationEmployeesPercentOfPool = 0.1;
    p.pool.allocationContractorsPercentOfPool = 0;
    p.pool.allocationEcosystemPercentOfPool = 0;
    expect(hasError(checkConstraints(p), 'pool.allocation')).toBe(false);
  });

  it('requires the three KPI weights to total exactly 100%', () => {
    const p = createDefaultPlan('p1');
    p.performance.weightEnterpriseKpis = 0.5;
    p.performance.weightBuKpis = 0.5;
    p.performance.weightIndividualKpis = 0.5;
    expect(hasError(checkConstraints(p), 'performance.weights')).toBe(true);
  });

  it('requires financial + non-financial KPI share to total 100%', () => {
    const p = createDefaultPlan('p1');
    p.performance.kpiTypeMixFinancialShare = 0.8;
    p.performance.kpiTypeMixNonFinancialShare = 0.8;
    expect(hasError(checkConstraints(p), 'performance.kpiTypeMix')).toBe(true);
  });

  it('rejects a cliff longer than the vesting horizon', () => {
    const p = createDefaultPlan('p1');
    p.vesting.vestingHorizonYears = 2;
    p.vesting.cliffPeriodYears = 3;
    expect(hasError(checkConstraints(p), 'vesting.cliffPeriodYears')).toBe(true);
  });

  it('rejects ordinals outside the 1–5 integer range', () => {
    const p = createDefaultPlan('p1');
    p.intensity.payPerformanceElasticity = 6;
    p.experience.onePageNarrativeScore = 0;
    const errors = checkConstraints(p);
    expect(hasError(errors, 'intensity.payPerformanceElasticity')).toBe(true);
    expect(hasError(errors, 'experience.onePageNarrativeScore')).toBe(true);
  });

  it('requires at least one participation group', () => {
    const p = createDefaultPlan('p1');
    p.archetype.participationScope = [];
    expect(hasError(checkConstraints(p), 'archetype.participationScope')).toBe(true);
  });

  it('rejects a secondary settlement medium equal to the primary', () => {
    const p = createDefaultPlan('p1');
    p.modality.settlementMediumPrimary = 'STABLECOIN';
    p.modality.settlementMediumSecondary = 'STABLECOIN';
    expect(hasError(checkConstraints(p), 'modality.settlementMediumSecondary')).toBe(true);
  });
});

describe('validateEquityPlan (unknown input)', () => {
  it('rejects non-objects', () => {
    expect(validateEquityPlan(null).ok).toBe(false);
    expect(validateEquityPlan(42).ok).toBe(false);
    expect(validateEquityPlan('plan').ok).toBe(false);
  });

  it('rejects missing dimension groups', () => {
    const res = validateEquityPlan({ id: 'x', name: 'x' });
    expect(res.ok).toBe(false);
    expect(res.value).toBeNull();
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('rejects duplicate participation scopes', () => {
    const p = createDefaultPlan('p1') as unknown as Record<string, unknown>;
    (p.archetype as Record<string, unknown>).participationScope = ['KEY_TALENT', 'KEY_TALENT'];
    const res = validateEquityPlan(p);
    expect(res.ok).toBe(false);
    expect(hasError(res.errors, 'archetype.participationScope')).toBe(true);
  });

  it('rejects invalid enum members with a pathed error', () => {
    const p = createDefaultPlan('p1') as unknown as Record<string, unknown>;
    (p.archetype as Record<string, unknown>).planType = 'NOT_A_TYPE';
    const res = validateEquityPlan(p);
    expect(res.ok).toBe(false);
    expect(hasError(res.errors, 'archetype.planType')).toBe(true);
  });
});

describe('SEED_EQUITY_PLANS', () => {
  it('ships one valid plan per archetype', () => {
    for (const plan of SEED_EQUITY_PLANS) {
      const res = validateEquityPlan(plan);
      expect(res.ok, `${plan.name}: ${JSON.stringify(res.errors)}`).toBe(true);
      expect(plan.provenance).toBe('ASSUMED');
    }
    const coveredTypes = new Set(SEED_EQUITY_PLANS.map((p) => p.archetype.planType));
    for (const t of PLAN_TYPES) expect(coveredTypes.has(t)).toBe(true);
  });

  it('has unique ids', () => {
    const ids = SEED_EQUITY_PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('toggleParticipationScope', () => {
  it('adds, removes, and preserves canonical order', () => {
    expect(toggleParticipationScope([], 'KEY_TALENT')).toEqual(['KEY_TALENT']);
    expect(toggleParticipationScope(['KEY_TALENT'], 'KEY_TALENT')).toEqual([]);
    // canonical order is EXECUTIVE_TEAM before KEY_TALENT regardless of click order
    expect(toggleParticipationScope(['KEY_TALENT'], 'EXECUTIVE_TEAM')).toEqual(['EXECUTIVE_TEAM', 'KEY_TALENT']);
  });
});
