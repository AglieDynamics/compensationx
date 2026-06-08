import { describe, expect, it } from 'vitest';
import {
  budgetSimulation,
  compaRatio,
  deviationPct,
  growthFactor,
  marketValueAtPercentile,
  overallCompaRatio,
  percentilePositionOf,
  ragStatus,
  yoyMedianChange,
} from '@/lib/benchmark';
import {
  buildBasicSalaryFirmTargetTable,
  ORACLE,
} from '@/data/__fixtures__/basicSalaryFirmTarget.fixture';
import { buildSeedDataset } from '@/data/seed';
import { selectTable } from '@/domain/types';

const table = buildBasicSalaryFirmTargetTable();
const an1 = table.rows['An1']!;

describe('§5 — Basic Salary FIRM TARGET market percentiles (An1)', () => {
  it('reports the exact reported percentile values', () => {
    expect(an1.percentiles['0.50']).toBe(ORACLE.an1.marketMedian); // 44.32
    expect(an1.percentiles['0.75']).toBe(ORACLE.an1.market75); // 46.59
    expect(an1.percentiles['0.95']).toBe(ORACLE.an1.market95); // 59.07
    expect(an1.percentiles['0.05']).toBe(ORACLE.an1.market5); // 34.54
  });

  it('interpolates between grid points (piecewise-linear)', () => {
    // midpoint of 0.60 (44.83) and 0.65 (45.86) -> 45.345
    expect(marketValueAtPercentile(an1.percentiles, 0.625)).toBeCloseTo(45.345, 3);
    // exact grid point returns the reported value
    expect(marketValueAtPercentile(an1.percentiles, 0.5)).toBe(44.32);
  });

  it('clamps beyond the 5th/95th endpoints', () => {
    expect(marketValueAtPercentile(an1.percentiles, 0.01)).toBe(34.54);
    expect(marketValueAtPercentile(an1.percentiles, 0.99)).toBe(59.07);
  });
});

describe('§5 — derived metrics', () => {
  it('compa-ratio An1 = 45.75 / 44.32 ≈ 1.03', () => {
    const tmp = marketValueAtPercentile(an1.percentiles, 0.5);
    const cr = compaRatio(an1.firm.median, tmp);
    expect(cr).not.toBeNull();
    expect(cr as number).toBeCloseTo(1.03, 2);
  });

  it('percentile position of the firm median (45.75) sits ~65th', () => {
    const pos = percentilePositionOf(ORACLE.an1.firmMedian, an1.percentiles);
    expect(typeof pos).toBe('number');
    expect(pos as number).toBeCloseTo(0.65, 1);
  });

  it('RAG status follows the §3.6.7 thresholds', () => {
    expect(ragStatus(0.03)).toBe('green');
    expect(ragStatus(-0.05)).toBe('green');
    expect(ragStatus(0.08)).toBe('amber');
    expect(ragStatus(-0.1)).toBe('amber');
    expect(ragStatus(0.2)).toBe('red');
    expect(ragStatus(null)).toBeNull();
    // An1 deviation is small -> green
    const tmp = marketValueAtPercentile(an1.percentiles, 0.5);
    expect(ragStatus(deviationPct(an1.firm.median, tmp))).toBe('green');
  });

  it('budget simulation @ p=0.50 → total ≈ −1,704, perHead ≈ −3.09', () => {
    const sim = budgetSimulation(table, 0.5);
    expect(Math.abs(sim.total - ORACLE.budgetAt50.total)).toBeLessThanOrEqual(2);
    expect(sim.perHead).not.toBeNull();
    expect(Math.abs((sim.perHead as number) - ORACLE.budgetAt50.perHead)).toBeLessThanOrEqual(0.05);
    expect(sim.totalIncumbents).toBe(210 + 174 + 87 + 67 + 13); // 551
  });

  it('budget simulation responds to the target percentile', () => {
    const at50 = budgetSimulation(table, 0.5).total;
    const at75 = budgetSimulation(table, 0.75).total;
    // moving to a higher market percentile costs strictly more
    expect(at75).toBeGreaterThan(at50);
  });

  it('growth factor (Basic Salary FIRM TARGET) ≈ 3.6', () => {
    const gf = growthFactor(table);
    expect(gf).not.toBeNull();
    expect(gf as number).toBeCloseTo(3.6, 1);
  });

  it('overall (headcount-weighted) compa-ratio ≈ 1.08 at the 50th percentile', () => {
    const oc = overallCompaRatio(table, 0.5);
    expect(oc).not.toBeNull();
    expect(oc as number).toBeGreaterThan(1.05);
    expect(oc as number).toBeLessThan(1.1);
  });
});

describe('§5 — guards (never NaN)', () => {
  it('returns null on missing / zero inputs', () => {
    expect(compaRatio(10, 0)).toBeNull();
    expect(compaRatio(null, 5)).toBeNull();
    expect(deviationPct(10, 0)).toBeNull();
    expect(marketValueAtPercentile({}, 0.5)).toBeNull();
    expect(percentilePositionOf(10, {})).toBeNull();
  });

  it('flags out-of-range positions', () => {
    expect(percentilePositionOf(1000, an1.percentiles)).toBe('>95%');
    expect(percentilePositionOf(1, an1.percentiles)).toBe('<5%');
  });
});

describe('§5 — seed dataset YoY (derived ACTUAL reproduces published medians)', () => {
  const ds = buildSeedDataset();
  const target = selectTable(ds, 'FIRM', 'TARGET', 'BASIC_SALARY')!;
  const actual = selectTable(ds, 'FIRM', 'ACTUAL', 'BASIC_SALARY')!;

  it('has both TARGET (real) and ACTUAL (derived) Basic Salary tables', () => {
    expect(target).toBeTruthy();
    expect(actual).toBeTruthy();
    expect(actual.derived).toBe(true);
  });

  it('YoY market median change matches the published figures', () => {
    expect(yoyMedianChange(target, actual, 'An').pct as number).toBeCloseTo(0.087, 2);
    expect(yoyMedianChange(target, actual, 'As').pct as number).toBeCloseTo(0.082, 2);
    expect(yoyMedianChange(target, actual, 'Pr').pct as number).toBeCloseTo(0.074, 2);
  });
});
