import { describe, expect, it } from 'vitest';
import { buildSeedDataset } from '@/data/seed';
import { DEFAULT_ASSUMPTIONS } from '@/lib/assumptions';
import type { Employee } from '@/domain/employee';
import type { PricingInputs, PricingIntake } from '@/domain/structure';
import {
  buildStructure,
  confidenceIndex,
  costToPolicy,
  defaultStructureDesign,
  equityTensionScore,
  gradeOverlap,
  mapEmployee,
  priceRole,
  rangeFromMidpoint,
  structureDebt,
} from '@/lib/comp';
import { computeEconomics as econ } from '@/lib/economics';
import employeesJson from '@/data/employees.json';
import type { EmployeeDataset } from '@/domain/employee';

const ds = buildSeedDataset();
const ctx = { ds, assumptions: DEFAULT_ASSUMPTIONS };
const structure = buildStructure(defaultStructureDesign(), ctx, []);
const r2 = (n: number | null): number | null => (n === null ? null : Math.round(n * 100) / 100);

function emp(p: Partial<Employee>): Employee {
  return {
    id: 'X',
    displayName: 'X',
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

describe('§Appendix A — range math', () => {
  it('min = 2M/(2+S), max = min·(1+S), midpoint = M', () => {
    const r = rangeFromMidpoint(86.69, 0.5);
    expect(r.min).toBeCloseTo(69.352, 3);
    expect(r.max).toBeCloseTo(104.028, 3);
    expect(r.midpoint).toBe(86.69);
  });
  it('overlap formula', () => {
    expect(gradeOverlap(104, 69, 92)!).toBeCloseTo((104 - 92) / (104 - 69), 6);
  });
});

describe('§3 oracle — benchmark-anchored 5-grade structure', () => {
  it('midpoints / mins / maxes match the survey aggregate medians', () => {
    expect(structure.grades.map((g) => r2(g.midpoint))).toEqual([47.62, 65.79, 86.69, 116.03, 156.17]);
    expect(structure.grades.map((g) => r2(g.min))).toEqual([38.1, 52.63, 69.35, 92.82, 124.94]);
    expect(structure.grades.map((g) => r2(g.max))).toEqual([57.14, 78.95, 104.03, 139.24, 187.4]);
  });
  it('overlap is computed between consecutive grades', () => {
    expect(structure.grades[structure.grades.length - 1]!.overlapWithNext).toBeNull();
    expect(structure.grades[0]!.overlapWithNext).not.toBeNull();
  });
});

describe('§3 oracle — employee mapping (base 82 @ grade M)', () => {
  it('compa-ratio 0.946 and range penetration 0.365', () => {
    const m = mapEmployee(emp({ level: 'M', grade: 'G4', basePay: 82 }), structure);
    expect(m.compaRatio!).toBeCloseTo(0.946, 2);
    expect(m.rangePenetration!).toBeCloseTo(0.365, 2);
    expect(m.belowMin).toBe(false);
    expect(m.aboveMax).toBe(false);
  });
});

describe('§3 oracle — Job Pricing (Manager, match)', () => {
  const intake: PricingIntake = {
    title: 'Manager',
    hiringManager: '',
    level: 'M',
    jobFamily: 'Strategy',
    geography: 'HQ',
    grade: 'G4',
    businessUnit: 'Advisory',
    replacement: false,
    mustHaveSkills: '',
  };
  const inputs: PricingInputs = { posture: 'match', adjustmentPremium: 0, candidatePremium: 0, useStretch: false };

  it('market reference 86.69, midpoint 86.69, min 69.35, max 104.03, target 82.36', () => {
    const r = priceRole(intake, inputs, ds, DEFAULT_ASSUMPTIONS, [], null);
    expect(r.marketReference!).toBeCloseTo(86.69, 2);
    expect(r.midpoint!).toBeCloseTo(86.69, 2);
    expect(r.rangeMin!).toBeCloseTo(69.35, 2);
    expect(r.rangeMax!).toBeCloseTo(104.03, 2);
    expect(r.target!).toBeCloseTo(82.36, 2);
    expect(r.provenance).toBe('MEASURED'); // HQ / default family / aging 0 → pure survey
  });

  it('regional geography downgrades provenance to ASSUMED (0.92 differential)', () => {
    const r = priceRole({ ...intake, geography: 'Regional' }, inputs, ds, DEFAULT_ASSUMPTIONS, [], null);
    expect(r.marketReference!).toBeCloseTo(86.69 * 0.92, 2);
    expect(r.provenance).toBe('ASSUMED');
  });

  it('lead posture raises the reference above match', () => {
    const match = priceRole(intake, inputs, ds, DEFAULT_ASSUMPTIONS, [], null).marketReference!;
    const lead = priceRole(intake, { ...inputs, posture: 'lead' }, ds, DEFAULT_ASSUMPTIONS, [], null).marketReference!;
    expect(lead).toBeGreaterThan(match);
  });

  it('rationale waterfall deltas reconcile to the Offer target across postures + structure', () => {
    const struct = buildStructure(defaultStructureDesign(), { ds, assumptions: DEFAULT_ASSUMPTIONS }, []);
    const cases = [
      { inputs, structure: null as typeof struct | null },
      { inputs: { ...inputs, posture: 'lead' as const }, structure: struct },
      { inputs: { ...inputs, posture: 'lag' as const, adjustmentPremium: 0.05 }, structure: struct },
      { inputs: { ...inputs, useStretch: true }, structure: struct },
    ];
    for (const c of cases) {
      const r = priceRole(intake, c.inputs, ds, DEFAULT_ASSUMPTIONS, [], c.structure);
      const deltas = r.rationale.filter((s) => s.label !== 'Offer target').reduce((a, s) => a + s.value, 0);
      expect(deltas).toBeCloseTo(r.target!, 4);
    }
  });

  it('pricing off a published structure inherits the grade (ASSUMED) provenance', () => {
    const struct = buildStructure(defaultStructureDesign(), { ds, assumptions: DEFAULT_ASSUMPTIONS }, []);
    // grade confidence is ASSUMED (no jobArch) → result provenance must not over-report
    const r = priceRole(intake, inputs, ds, DEFAULT_ASSUMPTIONS, [], struct);
    expect(r.usedStructure).toBe(true);
    expect(r.provenance).toBe('ASSUMED');
  });
});

describe('Confidence Index + Equity Tension', () => {
  it('confidence index is the weighted sub-score sum × 100', () => {
    expect(confidenceIndex({ dataFreshness: 1, providerAgreement: 1, benchmarkMatch: 1, architectureStability: 1 })).toBe(100);
    expect(
      confidenceIndex({ dataFreshness: 0.85, providerAgreement: 1.0, benchmarkMatch: 0.8, architectureStability: 0.9 }),
    ).toBeCloseTo(87.5, 1);
  });
  it('equity tension clamps to 0..100', () => {
    expect(equityTensionScore(100, 100)).toBe(0);
    expect(equityTensionScore(110, 100)!).toBeCloseTo(10, 6);
    expect(equityTensionScore(300, 100)).toBe(100);
  });
});

describe('cost-to-policy + structure debt on the synthetic seed', () => {
  const all = (employeesJson as unknown as EmployeeDataset).employees;
  const mappings = all.map((e) => mapEmployee(e, structure));
  it('cost measures are finite and non-negative', () => {
    const c = costToPolicy(mappings, 1.0);
    expect(Number.isFinite(c.costToMinimum)).toBe(true);
    expect(c.costToMinimum).toBeGreaterThanOrEqual(0);
    expect(c.belowMinCount + c.aboveMaxCount).toBeGreaterThanOrEqual(0);
  });
  it('structure debt catch-up rises with horizon', () => {
    const d1 = structureDebt(mappings, structure, { ...DEFAULT_ASSUMPTIONS, coiHorizon: 1 }, 5).catchUp;
    const d3 = structureDebt(mappings, structure, { ...DEFAULT_ASSUMPTIONS, coiHorizon: 3 }, 5).catchUp;
    expect(d3).toBeGreaterThanOrEqual(d1);
  });
});

describe('economics metric pack', () => {
  const all = (employeesJson as unknown as EmployeeDataset).employees;
  it('computes loaded cost; revenue metrics are null without a revenue input', () => {
    const m = econ(all, DEFAULT_ASSUMPTIONS, { totalRevenue: null, nonLaborOpex: null });
    expect(m.headcount).toBe(551);
    expect(m.totalWorkforceCost).toBeGreaterThan(0);
    expect(m.directCompPerFte).not.toBeNull();
    expect(m.revenuePerEmployee).toBeNull();
    expect(m.hcroi).toBeNull();
    expect(m.revenueProvenance).toBe('ASSUMED');
  });
  it('revenue metrics compute when revenue is provided', () => {
    const m = econ(all, DEFAULT_ASSUMPTIONS, { totalRevenue: 500000, nonLaborOpex: 200000 });
    expect(m.revenuePerEmployee!).toBeCloseTo(500000 / 551, 3);
    expect(m.hcroi).not.toBeNull();
    expect(m.revenueProvenance).toBe('ENTERED');
  });
});
