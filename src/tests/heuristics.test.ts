import { describe, expect, it } from 'vitest';
import type { Employee } from '@/domain/employee';
import type { EmployeeMapping } from '@/lib/comp';
import { DEFAULT_ASSUMPTIONS } from '@/lib/assumptions';
import {
  attritionRiskFor,
  greedyAllocate,
  narrative,
  outlierFlags,
  summarize,
  zScore,
} from '@/lib/heuristics';

function emp(p: Partial<Employee>): Employee {
  return {
    id: 'E',
    displayName: 'E',
    jobFamily: 'Strategy',
    level: 'M',
    grade: 'G4',
    geography: 'HQ',
    businessUnit: 'Advisory',
    basePay: 80,
    fte: 1,
    ...p,
  };
}

function mapping(id: string, compaRatio: number, rangePenetration: number, over: Partial<Employee> = {}): EmployeeMapping {
  return {
    employee: emp({ id, displayName: id, ...over }),
    grade: null,
    compaRatio,
    rangePenetration,
    belowMin: false,
    aboveMax: false,
  };
}

describe('greedyAllocate — respects the budget and ranks by value-per-dollar', () => {
  it('never exceeds the budget and prefers higher score÷cost', () => {
    const actions = [
      { id: 'a', score: 90, cost: 100 }, // density 0.90
      { id: 'b', score: 40, cost: 20 }, // density 2.00 (best)
      { id: 'c', score: 60, cost: 60 }, // density 1.00
      { id: 'd', score: 10, cost: 200 }, // density 0.05 (won't fit)
    ];
    const res = greedyAllocate(actions, 100);
    expect(res.spent).toBeLessThanOrEqual(100);
    expect(res.remaining).toBe(100 - res.spent);
    // b (20) then c (60) fit within 100 before a (100) is considered.
    expect(res.chosen.map((x) => x.id)).toEqual(['b', 'c']);
    expect(res.spent).toBe(80);
    expect(res.remaining).toBe(20);
    expect(res.skipped.map((x) => x.id).sort()).toEqual(['a', 'd']);
  });

  it('skips ineligible actions (non-positive score, negative cost) and takes zero-cost wins', () => {
    const res = greedyAllocate(
      [
        { id: 'free', score: 50, cost: 0 },
        { id: 'bad', score: 0, cost: 10 },
        { id: 'neg', score: 30, cost: -5 },
      ],
      10,
    );
    expect(res.chosen.map((x) => x.id)).toEqual(['free']);
    expect(res.spent).toBe(0);
    expect(res.skipped.map((x) => x.id).sort()).toEqual(['bad', 'neg']);
  });

  it('a zero budget chooses nothing payable', () => {
    const res = greedyAllocate([{ id: 'a', score: 10, cost: 5 }], 0);
    expect(res.chosen).toHaveLength(0);
    expect(res.spent).toBe(0);
    expect(res.remaining).toBe(0);
  });
});

describe('zScore + outlier detection', () => {
  it('z-score equals (x − mean) / sd; flat samples return null', () => {
    const s = summarize([1, 2, 3, 4, 5]);
    expect(s.mean).toBeCloseTo(3, 6);
    expect(zScore(5, s)!).toBeCloseTo((5 - 3) / s.sd!, 6);
    expect(zScore(1, summarize([2, 2, 2]))).toBeNull();
  });

  it('flags a clear compa-ratio outlier within a peer bucket', () => {
    // Tight cluster around 1.0 with one extreme high payer in the same bucket.
    const ms: EmployeeMapping[] = [
      mapping('p1', 1.0, 0.5),
      mapping('p2', 1.01, 0.51),
      mapping('p3', 0.99, 0.49),
      mapping('p4', 1.0, 0.5),
      mapping('p5', 1.02, 0.52),
      mapping('OUT', 1.9, 0.95),
    ];
    const flags = outlierFlags(ms);
    const outlier = flags.find((f) => f.subject === 'OUT');
    expect(outlier).toBeDefined();
    expect(outlier!.metric).toBe('compaRatio');
    expect(outlier!.kind).toBe('outlier-compa-high');
    expect(outlier!.statistic).not.toBeNull();
    expect(Math.abs(outlier!.statistic!)).toBeGreaterThan(2);
  });
});

describe('attritionRiskFor — monotonic in pay position', () => {
  it('lower pay position yields higher attrition risk', () => {
    const low = attritionRiskFor(0.15, 'M', DEFAULT_ASSUMPTIONS);
    const mid = attritionRiskFor(0.5, 'M', DEFAULT_ASSUMPTIONS);
    const high = attritionRiskFor(0.85, 'M', DEFAULT_ASSUMPTIONS);
    expect(low).not.toBeNull();
    expect(mid).not.toBeNull();
    expect(high).not.toBeNull();
    expect(low!.value).toBeGreaterThan(mid!.value);
    expect(mid!.value).toBeGreaterThan(high!.value);
    // All probabilities stay in [0, 1].
    for (const r of [low!, mid!, high!]) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(1);
    }
  });

  it('early tenure and top performance raise risk via the deterministic modifier', () => {
    const base = attritionRiskFor(0.4, 'As', DEFAULT_ASSUMPTIONS, { tenureYears: 4, performanceRating: 3 });
    const risky = attritionRiskFor(0.4, 'As', DEFAULT_ASSUMPTIONS, { tenureYears: 0.5, performanceRating: 5 });
    expect(risky!.value).toBeGreaterThan(base!.value);
    expect(risky!.modifier).toBeGreaterThan(1);
  });
});

describe('narrative — deterministic, non-empty board commentary', () => {
  it('always returns at least one line and reflects the metrics', () => {
    const lines = narrative({
      headcount: 551,
      avgCompaRatio: 1.08,
      belowMinCount: 12,
      aboveMaxCount: 3,
      underMarketGroups: 4,
      topRiskFamily: 'Technology',
      hcroi: 2.4,
      recommendedSpend: 1800,
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.length > 0)).toBe(true);
    expect(lines.join(' ')).toContain('1.08');
    expect(lines.join(' ')).toContain('Technology');
    // No NaN ever leaks into the copy.
    expect(lines.join(' ')).not.toContain('NaN');
  });

  it('handles a null compa-ratio without crashing', () => {
    const lines = narrative({
      headcount: 10,
      avgCompaRatio: null,
      belowMinCount: 0,
      aboveMaxCount: 0,
      underMarketGroups: 0,
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join(' ')).not.toContain('NaN');
  });
});
