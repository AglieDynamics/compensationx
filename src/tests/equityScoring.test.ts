import { describe, expect, it } from 'vitest';
import type { EquityPlanDefinition } from '@/domain/equityPlan';
import { createDefaultPlan } from '@/lib/equityPlanSchema';
import { comparePlans, fairRadarData, scoreBand, scorePlan } from '@/lib/equityScoring';

const base = (overrides: Partial<EquityPlanDefinition> = {}): EquityPlanDefinition => ({
  ...createDefaultPlan('p1'),
  ...overrides,
});

describe('scoreBand', () => {
  it('bands 1–2 red, 3 amber, 4–5 green (on the rounded value)', () => {
    expect(scoreBand(1)).toBe('red');
    expect(scoreBand(2.4)).toBe('red');
    expect(scoreBand(3)).toBe('amber');
    expect(scoreBand(3.4)).toBe('amber');
    expect(scoreBand(4)).toBe('green');
    expect(scoreBand(5)).toBe('green');
  });
});

describe('scorePlan', () => {
  it('is deterministic — same input yields identical output', () => {
    const p = base();
    expect(scorePlan(p)).toEqual(scorePlan(p));
  });

  it('returns all four FAIR axes as integers in 1–5 with non-empty factors', () => {
    const s = scorePlan(base());
    for (const axis of ['value', 'share', 'deal', 'team'] as const) {
      const a = s.fair[axis];
      expect(Number.isInteger(a.score)).toBe(true);
      expect(a.score).toBeGreaterThanOrEqual(1);
      expect(a.score).toBeLessThanOrEqual(5);
      expect(a.factors.length).toBeGreaterThan(0);
      for (const f of a.factors) {
        expect(f.score).toBeGreaterThanOrEqual(1);
        expect(f.score).toBeLessThanOrEqual(5);
      }
    }
  });

  it('scores a low-distortion value basis green and a distorted one red', () => {
    const strong = base({
      valueBasis: {
        referenceValueType: 'ADJUSTED_ENTERPRISE_VALUE',
        valuationMethod: 'INDEPENDENT_APPRAISAL',
        valuationCadence: 'ROLLING_QUARTERLY',
        distortionProtectionLevel: 'ROBUST',
      },
    });
    const weak = base({
      valueBasis: {
        referenceValueType: 'EQUITY_FMV_PER_SHARE',
        valuationMethod: 'MARKET_CAP',
        valuationCadence: 'EVENT_DRIVEN_ONLY',
        distortionProtectionLevel: 'NONE',
      },
    });
    expect(scorePlan(strong).fair.value.score).toBe(5);
    expect(scorePlan(strong).fair.value.band).toBe('green');
    expect(scorePlan(weak).fair.value.score).toBeLessThanOrEqual(2);
    expect(scorePlan(weak).fair.value.band).toBe('red');
  });

  it('rewards graduated, broadly-shared upside on Fair Share', () => {
    const graduated = base({
      intensity: { ...base().intensity, upsideLeverageProfile: 'BAND_GRADUATED', payPerformanceElasticity: 3 },
      pool: { ...base().pool, concentrationIndex: 'BALANCED' },
      archetype: { ...base().archetype, participationScope: ['EXECUTIVE_TEAM', 'SENIOR_LEADERSHIP', 'KEY_TALENT', 'BROAD_EMPLOYEES'] },
    });
    const lumpy = base({
      intensity: { ...base().intensity, upsideLeverageProfile: 'HOCKEY_STICK', payPerformanceElasticity: 5 },
      pool: { ...base().pool, concentrationIndex: 'TOP_HEAVY' },
      archetype: { ...base().archetype, participationScope: ['EXECUTIVE_TEAM'] },
    });
    expect(scorePlan(graduated).fair.share.score).toBeGreaterThan(scorePlan(lumpy).fair.share.score);
  });

  it('rewards real skin-in-the-game on Fair Deal', () => {
    const skin = base({
      intensity: { ...base().intensity, downsideExposure: 'FULL_DOWNSIDE', capOnPayout: true },
      vesting: { ...base().vesting, forfeitureStrictness: 'STRICT', vestingHorizonYears: 5, cliffPeriodYears: 1 },
    });
    const soft = base({
      intensity: { ...base().intensity, downsideExposure: 'NO_DOWNSIDE', capOnPayout: false },
      vesting: { ...base().vesting, forfeitureStrictness: 'SOFT', vestingHorizonYears: 0, cliffPeriodYears: 0 },
    });
    expect(scorePlan(skin).fair.deal.score).toBeGreaterThan(scorePlan(soft).fair.deal.score);
  });

  it('rewards reallocation agility over first-in bias on Fair Team', () => {
    const agile = base({
      valueBasis: { ...base().valueBasis, valuationCadence: 'ROLLING_QUARTERLY' },
      pool: { ...base().pool, poolUsageTargetHorizonYears: 2 },
      vesting: { ...base().vesting, vestingModel: 'MILESTONE_BASED', primaryPayoutTrigger: 'ANNUAL_SETTLEMENT' },
    });
    const sticky = base({
      valueBasis: { ...base().valueBasis, valuationCadence: 'EVENT_DRIVEN_ONLY' },
      pool: { ...base().pool, poolUsageTargetHorizonYears: 8 },
      vesting: { ...base().vesting, vestingModel: 'TIME_BASED', primaryPayoutTrigger: 'IPO' },
    });
    expect(scorePlan(agile).fair.team.score).toBeGreaterThan(scorePlan(sticky).fair.team.score);
  });

  it('never emits NaN scores even on non-finite inputs', () => {
    const broken = base({
      intensity: { ...base().intensity, payPerformanceElasticity: Number.NaN },
      pool: { ...base().pool, allocationExecPercentOfPool: Number.NaN },
    });
    const s = scorePlan(broken);
    for (const axis of ['value', 'share', 'deal', 'team'] as const) {
      expect(Number.isFinite(s.fair[axis].score)).toBe(true);
      expect(s.fair[axis].score).toBeGreaterThanOrEqual(1);
    }
    expect(Number.isFinite(s.overall.score)).toBe(true);
    expect(Number.isFinite(s.reads.unallocatedPoolPct)).toBe(true);
    expect(s.reads.unallocatedPoolPct).toBeGreaterThanOrEqual(0);
    expect(s.reads.unallocatedPoolPct).toBeLessThanOrEqual(1);
  });

  it('reports unallocated pool remainder', () => {
    const p = base({
      pool: {
        ...base().pool,
        allocationExecPercentOfPool: 0.2,
        allocationLeadershipPercentOfPool: 0.2,
        allocationEmployeesPercentOfPool: 0.2,
        allocationContractorsPercentOfPool: 0,
        allocationEcosystemPercentOfPool: 0,
      },
    });
    expect(scorePlan(p).reads.unallocatedPoolPct).toBeCloseTo(0.4, 6);
  });
});

describe('comparePlans', () => {
  it('builds a normalized matrix with one cell per plan and a divergence spread', () => {
    const a = base({ id: 'a' });
    const b = base({
      id: 'b',
      valueBasis: { ...base().valueBasis, distortionProtectionLevel: 'NONE', valuationCadence: 'EVENT_DRIVEN_ONLY' },
    });
    const cmp = comparePlans([a, b]);
    expect(cmp.planIds).toEqual(['a', 'b']);
    for (const row of cmp.rows) {
      expect(row.cells).toHaveLength(2);
      for (const cell of row.cells) {
        expect(cell.normalized).toBeGreaterThanOrEqual(0);
        expect(cell.normalized).toBeLessThanOrEqual(1);
      }
      expect(row.spread).toBeGreaterThanOrEqual(0);
    }
    const valueRow = cmp.rows.find((r) => r.dimension.key === 'value');
    expect(valueRow?.spread).toBeGreaterThan(0);
  });
});

describe('fairRadarData', () => {
  it('returns one datum per FAIR axis keyed by plan id', () => {
    const data = fairRadarData([base({ id: 'a' }), base({ id: 'b' })]);
    expect(data).toHaveLength(4);
    for (const d of data) {
      expect(typeof d.axis).toBe('string');
      expect(typeof d.a).toBe('number');
      expect(typeof d.b).toBe('number');
    }
  });
});
