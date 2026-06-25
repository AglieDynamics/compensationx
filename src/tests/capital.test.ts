import { describe, expect, it } from 'vitest';
import { LEVELS, type Level } from '@/domain/levels';
import { buildSeedDataset } from '@/data/seed';
import {
  DEFAULT_ASSUMPTIONS,
  ILLUSTRATIVE_VALUE_PER_HEAD,
  resolveSegmentInputs,
  type ResolvedInputsByLevel,
  type SegmentInputs,
} from '@/lib/assumptions';
import {
  applyScenario,
  attrition,
  buildSegmentBases,
  computeConvexity,
  computeCostOfInaction,
  computeFrontier,
  computeTotalCost,
  computeValueDensity,
  coiTornado,
  dRetention,
  d2Retention,
  numericPosition,
  ols,
  retention,
  retentionParams,
  type SegmentBase,
} from '@/lib/capital';
import { provenanceOf, weakest } from '@/lib/provenance';

const RP = retentionParams(DEFAULT_ASSUMPTIONS);

function resolvedDefaults(): ResolvedInputsByLevel {
  const out = {} as ResolvedInputsByLevel;
  for (const l of LEVELS) out[l] = resolveSegmentInputs(l, undefined, undefined, DEFAULT_ASSUMPTIONS);
  return out;
}
function resolvedWith(overrides: (l: Level) => Partial<SegmentInputs>, prov: 'ENTERED' | 'MEASURED' = 'ENTERED'): ResolvedInputsByLevel {
  const out = {} as ResolvedInputsByLevel;
  for (const l of LEVELS) {
    const o = overrides(l);
    const p = Object.fromEntries(Object.keys(o).map((k) => [k, prov]));
    out[l] = resolveSegmentInputs(l, o, p as never, DEFAULT_ASSUMPTIONS);
  }
  return out;
}

const ds = buildSeedDataset();
const bases = buildSegmentBases(ds, 'FIRM', 'TARGET', 'BASIC_SALARY');
const byLevel = (l: Level): SegmentBase => bases.find((b) => b.level === l)!;

describe('retention model (closed-form oracles)', () => {
  it('R/dR/d²R match closed form at p = 0.35 / 0.5 / 0.2', () => {
    expect(retention(0.35, RP)).toBeCloseTo(0.485, 3);
    expect(dRetention(0.35, RP)).toBeCloseTo(1.94, 3);
    expect(d2Retention(0.35, RP)).toBeCloseTo(0, 6);

    expect(retention(0.5, RP)).toBeCloseTo(0.74547, 4);
    expect(dRetention(0.5, RP)).toBeCloseTo(1.38047, 4);
    expect(d2Retention(0.5, RP)).toBeCloseTo(-5.932, 2);

    expect(retention(0.2, RP)).toBeCloseTo(0.22453, 4);
    expect(dRetention(0.2, RP)).toBeCloseTo(1.38047, 4); // symmetric with 0.5
    expect(d2Retention(0.2, RP)).toBeCloseTo(5.932, 2);
  });

  it('convexity sign flips at the inflection p0', () => {
    expect(d2Retention(0.2, RP)).toBeGreaterThan(0); // below p0 → accelerating
    expect(d2Retention(0.5, RP)).toBeLessThan(0); // above p0 → decelerating
  });

  it('below-inflection marginal return exceeds a well-above-inflection one', () => {
    expect(dRetention(0.2, RP)).toBeGreaterThan(dRetention(0.7, RP));
  });

  it('attrition normalizes to baseline at p=0.5 and rises below market', () => {
    expect(attrition(0.5, 0.22, RP)).toBeCloseTo(0.22, 6);
    expect(attrition(0.2, 0.22, RP)!).toBeGreaterThan(0.22);
  });

  it('numericPosition clamps the sentinels', () => {
    expect(numericPosition('>95%')).toBe(0.97);
    expect(numericPosition('<5%')).toBe(0.03);
    expect(numericPosition(0.42)).toBe(0.42);
    expect(numericPosition(null)).toBeNull();
  });
});

describe('segment bases from the Greenland seed', () => {
  it('positions Managers below market and Analysts above', () => {
    expect(byLevel('M').position!).toBeLessThan(0.35); // below inflection
    expect(byLevel('M').deviationPct!).toBeLessThan(0); // under market
    expect(byLevel('An').position!).toBeGreaterThan(0.5);
    expect(byLevel('An').deviationPct!).toBeGreaterThan(0); // over market
    expect(byLevel('M').incumbents).toBe(87);
    expect(byLevel('An').incumbents).toBe(210);
  });
});

describe('Lens 1 — convexity', () => {
  const rows = computeConvexity(bases, resolvedDefaults(), DEFAULT_ASSUMPTIONS);
  it('marks below-inflection segments and finite COI, no NaN', () => {
    for (const r of rows) {
      expect(r.coi === null || Number.isFinite(r.coi)).toBe(true);
    }
    const m = rows.find((r) => r.level === 'M')!;
    const an = rows.find((r) => r.level === 'An')!;
    expect(m.belowInflection).toBe(true);
    expect(an.belowInflection).toBe(false);
    expect(m.dR!).toBeGreaterThan(an.dR!);
  });
  it('top-COI segment is below the inflection', () => {
    const top = [...rows].sort((a, b) => (b.coi ?? 0) - (a.coi ?? 0))[0]!;
    expect(top.belowInflection).toBe(true);
  });
  it('COI is provenance ASSUMED on defaults', () => {
    expect(rows.every((r) => r.provenance === 'ASSUMED')).toBe(true);
  });
});

describe('Lens 5 — total workforce cost', () => {
  it('TWC = TCC·(1+empContrib) + overtime + contingent', () => {
    const inputs = resolvedWith(() => ({ overtimeSpendPerHead: 10, contingentCostTotal: 0, employerContributionPct: 0.2 }));
    const rows = computeTotalCost(bases, inputs, DEFAULT_ASSUMPTIONS);
    const m = rows.find((r) => r.level === 'M')!;
    expect(m.tcc).not.toBeNull();
    expect(m.tCtc!).toBeCloseTo(m.tcc! * 1.2, 6);
    expect(m.twc!).toBeCloseTo(m.tcc! * 1.2 + 10, 6);
  });

  it('false-savings flag fires on an under-market segment with elevated flexible load', () => {
    const inputs = resolvedWith((l) => (l === 'M' ? { overtimeSpendPerHead: 30, contingentCostTotal: 2000 } : {}));
    const rows = computeTotalCost(bases, inputs, DEFAULT_ASSUMPTIONS);
    expect(rows.find((r) => r.level === 'M')!.falseSavingsFlag).toBe(true);
    // Over-market Analyst never flags regardless of flex load
    const an = computeTotalCost(bases, resolvedWith((l) => (l === 'An' ? { overtimeSpendPerHead: 40 } : {})), DEFAULT_ASSUMPTIONS);
    expect(an.find((r) => r.level === 'An')!.falseSavingsFlag).toBe(false);
  });

  it('renders with zero optional inputs (TWC = t-CTC)', () => {
    const rows = computeTotalCost(bases, resolvedDefaults(), DEFAULT_ASSUMPTIONS);
    const m = rows.find((r) => r.level === 'M')!;
    expect(m.twc!).toBeCloseTo(m.tCtc!, 6);
    expect(m.falseSavingsFlag).toBe(false);
  });

  it('equity/token reward loads into TWC but never into TCC', () => {
    const inputs = resolvedWith(() => ({ equityRewardPerHead: 50, employerContributionPct: 0.2 }));
    const rows = computeTotalCost(bases, inputs, DEFAULT_ASSUMPTIONS);
    const m = rows.find((r) => r.level === 'M')!;
    expect(m.equityPerHead).toBe(50);
    expect(m.tCtc!).toBeCloseTo(m.tcc! * 1.2, 6); // cash path unchanged by equity
    expect(m.twc!).toBeCloseTo(m.tcc! * 1.2 + 50, 6); // equity added on top of t-CTC
  });
});

describe('Lens 4 — cost of inaction', () => {
  const opts = { horizon: 3, discountRate: 0, targetPercentile: 0.5 };
  it('produces finite leakage and net for under-market segments', () => {
    const res = computeCostOfInaction(bases, resolvedDefaults(), DEFAULT_ASSUMPTIONS, opts);
    const m = res.segments.find((s) => s.level === 'M')!;
    expect(m.underMarket).toBe(true);
    expect(Number.isFinite(m.totalLeakage!)).toBe(true);
    expect(Number.isFinite(m.net!)).toBe(true);
    expect(Number.isFinite(res.totalLeakage)).toBe(true);
  });

  it('leakage rises monotonically with horizon', () => {
    const inputs = resolvedDefaults();
    const l1 = computeCostOfInaction(bases, inputs, DEFAULT_ASSUMPTIONS, { ...opts, horizon: 1 }).totalLeakage;
    const l3 = computeCostOfInaction(bases, inputs, DEFAULT_ASSUMPTIONS, { ...opts, horizon: 3 }).totalLeakage;
    const l5 = computeCostOfInaction(bases, inputs, DEFAULT_ASSUMPTIONS, { ...opts, horizon: 5 }).totalLeakage;
    expect(l3).toBeGreaterThan(l1);
    expect(l5).toBeGreaterThan(l3);
  });

  it('leakage rises with attrition sensitivity k', () => {
    const inputs = resolvedDefaults();
    const lowK = computeCostOfInaction(bases, inputs, { ...DEFAULT_ASSUMPTIONS, retentionK: 4 }, opts).totalLeakage;
    const highK = computeCostOfInaction(bases, inputs, { ...DEFAULT_ASSUMPTIONS, retentionK: 12 }, opts).totalLeakage;
    expect(highK).toBeGreaterThan(lowK);
  });

  it('tornado reorders drivers by sensitivity (largest delta first)', () => {
    const t = coiTornado(bases, resolvedDefaults(), DEFAULT_ASSUMPTIONS, opts);
    expect(t.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < t.length; i++) expect(t[i - 1]!.delta).toBeGreaterThanOrEqual(t[i]!.delta);
  });
});

describe('Lens 3 — OLS frontier', () => {
  it('recovers a known slope/intercept', () => {
    const { slope, intercept } = ols([1, 2, 3, 4], [3, 5, 7, 9]); // y = 1 + 2x
    expect(slope).toBeCloseTo(2, 6);
    expect(intercept).toBeCloseTo(1, 6);
  });

  it('classifies zones and fits with the illustrative value set', () => {
    const inputs = resolvedWith((l) => ({ valuePerHead: ILLUSTRATIVE_VALUE_PER_HEAD[l] }));
    const res = computeFrontier(bases, inputs);
    expect(res.hasValue).toBe(true);
    expect(res.fitOk).toBe(true);
    expect(res.points.length).toBe(5);
    expect(res.points.every((p) => Number.isFinite(p.gap))).toBe(true);
  });

  it('falls back gracefully with <2 usable points', () => {
    const res = computeFrontier(bases, resolvedDefaults()); // no valuePerHead
    expect(res.hasValue).toBe(false);
    expect(res.fitOk).toBe(false);
    expect(res.points).toEqual([]);
  });
});

describe('Lens 2 — value density', () => {
  it('is empty without value data', () => {
    const res = computeValueDensity(bases, resolvedDefaults());
    expect(res.hasValue).toBe(false);
    expect(res.rows.every((r) => r.valueDensity === null)).toBe(true);
  });

  it('computes VD and places under-market high-VD segments into Protect & Invest', () => {
    // Give the under-market Manager a high value density; over-market Analyst a low one.
    const inputs = resolvedWith((l) => ({ valuePerHead: l === 'M' ? 600 : l === 'An' ? 30 : 200 }));
    const res = computeValueDensity(bases, inputs);
    expect(res.hasValue).toBe(true);
    const m = res.rows.find((r) => r.level === 'M')!;
    expect(m.valueDensity).not.toBeNull();
    expect(m.deviationPct!).toBeLessThan(0); // under market
    expect(m.quadrant).toBe('PROTECT_INVEST');
  });
});

describe('scenario application', () => {
  it('moving a segment up changes its position and deviation', () => {
    const moved = applyScenario(bases, { M: { targetPercentile: 0.75 } });
    const m0 = byLevel('M');
    const m1 = moved.find((b) => b.level === 'M')!;
    expect(m1.firmMedian!).toBeGreaterThan(m0.firmMedian!);
    expect(m1.position!).toBeGreaterThan(m0.position!);
    expect(m1.deviationPct!).toBeGreaterThan(m0.deviationPct!);
  });
});

describe('provenance inheritance (weakest-wins)', () => {
  it('weakest picks ASSUMED over ENTERED over MEASURED', () => {
    expect(weakest('MEASURED', 'ENTERED')).toBe('ENTERED');
    expect(weakest('MEASURED', 'ENTERED', 'ASSUMED')).toBe('ASSUMED');
    expect(weakest('MEASURED', 'MEASURED')).toBe('MEASURED');
    expect(weakest()).toBe('ASSUMED');
  });

  it('a derived figure inherits the weakest input provenance', () => {
    // MEASURED value-per-head but ASSUMED replacement multiple → ASSUMED overall
    const inputs = resolvedWith((l) => ({ valuePerHead: ILLUSTRATIVE_VALUE_PER_HEAD[l] }), 'MEASURED');
    const rows = computeConvexity(bases, inputs, DEFAULT_ASSUMPTIONS);
    expect(rows.every((r) => r.provenance === 'ASSUMED')).toBe(true); // replacement multiple still ASSUMED
    expect(provenanceOf({ value: 1, provenance: 'MEASURED' }, { value: 2, provenance: 'ASSUMED' })).toBe('ASSUMED');
  });
});
