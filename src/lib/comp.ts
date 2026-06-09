/**
 * v3 pricing + range/structure compute (§3 Modules A & B, Appendix A/B).
 * Pure, deterministic, guarded — divide-by-zero / missing inputs → null, never NaN.
 * All magic numbers come from assumptions.ts (Appendix B). Components render only.
 */

import { type Level, LEVELS } from '@/domain/levels';
import type { Component, Period, Weighting } from '@/domain/components';
import { type Dataset } from '@/domain/types';
import type { Employee, JobArchitecture } from '@/domain/employee';
import { directComp } from '@/domain/employee';
import type {
  GradeDef,
  PricingInputs,
  PricingIntake,
  PricingPosture,
  StructureDesign,
} from '@/domain/structure';
import {
  CONFIDENCE_DEFAULTS,
  CONFIDENCE_WEIGHTS,
  type GlobalAssumptions,
  PRICING,
  STRUCTURE,
} from '@/lib/assumptions';
import { marketReference } from '@/lib/marketReference';
import { type Provenance, type Valued, weakest } from '@/lib/provenance';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// ----------------------------------------------------------------------------
// Range math (Appendix A) — min = 2M/(2+S), max = min·(1+S), midpoint = M
// ----------------------------------------------------------------------------

export interface Range {
  min: number;
  max: number;
  midpoint: number;
}

export function rangeFromMidpoint(midpoint: number, spread: number): Range {
  const min = (2 * midpoint) / (2 + spread);
  const max = min * (1 + spread);
  return { min, max, midpoint };
}

export function compaRatio(base: number | null, midpoint: number | null): number | null {
  return isNum(base) && isNum(midpoint) && midpoint !== 0 ? base / midpoint : null;
}

export function rangePenetration(base: number | null, min: number | null, max: number | null): number | null {
  if (!isNum(base) || !isNum(min) || !isNum(max) || max === min) return null;
  return (base - min) / (max - min);
}

/** Overlap between grade g (maxG/minG) and grade g+1 (minNext): (maxG − minNext)/(maxG − minG). */
export function gradeOverlap(maxG: number, minG: number, minNext: number): number | null {
  return maxG === minG ? null : (maxG - minNext) / (maxG - minG);
}

// ----------------------------------------------------------------------------
// Posture → percentile
// ----------------------------------------------------------------------------

export const POSTURE_PERCENTILE: Record<PricingPosture, number> = {
  lead: 0.65,
  match: PRICING.matchPercentile, // 0.50
  lag: 0.4,
};

// ----------------------------------------------------------------------------
// Midpoint progression (3 methods)
// ----------------------------------------------------------------------------

interface MidpointCtx {
  ds: Dataset;
  assumptions: GlobalAssumptions;
  weighting?: Weighting;
  period?: Period;
  component?: Component;
}

function benchmarkMidpoint(grade: GradeDef, design: StructureDesign, ctx: MidpointCtx): number | null {
  const ref = marketReference(ctx.ds, ctx.assumptions, {
    level: grade.level,
    percentile: design.anchorPercentile,
    weighting: ctx.weighting,
    period: ctx.period,
    component: ctx.component,
  });
  return ref?.value ?? null;
}

/** Log-linear OLS of benchmark midpoints on grade index → smoothed fitted values. */
function regressionMidpoints(design: StructureDesign, ctx: MidpointCtx): (number | null)[] {
  const pts = design.grades
    .map((g, i) => ({ i, y: benchmarkMidpoint(g, design, ctx) }))
    .filter((p): p is { i: number; y: number } => isNum(p.y) && p.y > 0);
  if (pts.length < 2) return design.grades.map((g) => benchmarkMidpoint(g, design, ctx));
  const xs = pts.map((p) => p.i);
  const ys = pts.map((p) => Math.log(p.y));
  const n = xs.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let k = 0; k < n; k++) {
    const dx = xs[k]! - xbar;
    sxy += dx * (ys[k]! - ybar);
    sxx += dx * dx;
  }
  if (sxx === 0) return design.grades.map((g) => benchmarkMidpoint(g, design, ctx));
  const b = sxy / sxx;
  const a = ybar - b * xbar;
  return design.grades.map((_, i) => Math.exp(a + b * i));
}

export function buildMidpoints(design: StructureDesign, ctx: MidpointCtx): (number | null)[] {
  let mids: (number | null)[];
  if (design.progression === 'fixed') {
    const first = design.grades[0];
    const anchor = first ? benchmarkMidpoint(first, design, ctx) : null;
    mids = design.grades.map((_, i) => (isNum(anchor) ? anchor * Math.pow(1 + design.fixedStep, i) : null));
  } else if (design.progression === 'regression') {
    mids = regressionMidpoints(design, ctx);
  } else {
    mids = design.grades.map((g) => benchmarkMidpoint(g, design, ctx));
  }
  // Apply manual overrides on top.
  return design.grades.map((g, i) => {
    const override = design.midpointOverrides[g.grade];
    return isNum(override) ? override : (mids[i] ?? null);
  });
}

// ----------------------------------------------------------------------------
// Range/Market Confidence Index (Appendix B; extends the v2 provenance system)
// ----------------------------------------------------------------------------

export interface ConfidenceSubScores {
  dataFreshness: number;
  providerAgreement: number;
  benchmarkMatch: number;
  architectureStability: number;
}

export function confidenceIndex(s: ConfidenceSubScores): number {
  return (
    (CONFIDENCE_WEIGHTS.dataFreshness * s.dataFreshness +
      CONFIDENCE_WEIGHTS.providerAgreement * s.providerAgreement +
      CONFIDENCE_WEIGHTS.benchmarkMatch * s.benchmarkMatch +
      CONFIDENCE_WEIGHTS.architectureStability * s.architectureStability) *
    100
  );
}

function benchmarkMatchFor(level: Level, jobArch: JobArchitecture[]): Valued<number> {
  const rows = jobArch.filter((j) => j.level === level);
  if (rows.length === 0) return { value: CONFIDENCE_DEFAULTS.benchmarkMatch, provenance: 'ASSUMED' };
  const avg = rows.reduce((a, j) => a + j.benchmarkMatchConfidence.value, 0) / rows.length;
  const prov = weakest(...rows.map((j) => j.benchmarkMatchConfidence.provenance));
  return { value: avg, provenance: prov };
}

// ----------------------------------------------------------------------------
// Structure build
// ----------------------------------------------------------------------------

export interface GradeRange {
  grade: string;
  level: Level;
  midpoint: number | null;
  min: number | null;
  max: number | null;
  spread: number;
  overlapWithNext: number | null;
  confidence: number | null;
  confidenceProvenance: Provenance;
}

export interface Structure {
  design: StructureDesign;
  grades: GradeRange[];
}

export function buildStructure(
  design: StructureDesign,
  ctx: MidpointCtx,
  jobArch: JobArchitecture[],
): Structure {
  const mids = buildMidpoints(design, ctx);
  const grades: GradeRange[] = design.grades.map((g, i) => {
    const midpoint = mids[i] ?? null;
    const range = isNum(midpoint) ? rangeFromMidpoint(midpoint, design.spread) : null;
    const match = benchmarkMatchFor(g.level, jobArch);
    const confidence = confidenceIndex({
      dataFreshness: CONFIDENCE_DEFAULTS.dataFreshness,
      providerAgreement: CONFIDENCE_DEFAULTS.providerAgreement,
      benchmarkMatch: match.value,
      architectureStability: CONFIDENCE_DEFAULTS.architectureStability,
    });
    return {
      grade: g.grade,
      level: g.level,
      midpoint,
      min: range?.min ?? null,
      max: range?.max ?? null,
      spread: design.spread,
      overlapWithNext: null,
      confidence,
      confidenceProvenance: match.provenance,
    };
  });
  // Overlap pass.
  for (let i = 0; i < grades.length - 1; i++) {
    const g = grades[i]!;
    const next = grades[i + 1]!;
    if (isNum(g.max) && isNum(g.min) && isNum(next.min)) {
      g.overlapWithNext = gradeOverlap(g.max, g.min, next.min);
    }
  }
  return { design, grades };
}

// ----------------------------------------------------------------------------
// Employee mapping & cost-to-policy
// ----------------------------------------------------------------------------

export interface EmployeeMapping {
  employee: Employee;
  grade: GradeRange | null;
  compaRatio: number | null;
  rangePenetration: number | null;
  belowMin: boolean;
  aboveMax: boolean;
}

function gradeFor(employee: Employee, structure: Structure): GradeRange | null {
  return (
    structure.grades.find((g) => g.grade === employee.grade) ??
    structure.grades.find((g) => g.level === employee.level) ??
    null
  );
}

export function mapEmployee(employee: Employee, structure: Structure): EmployeeMapping {
  const grade = gradeFor(employee, structure);
  const cr = compaRatio(employee.basePay, grade?.midpoint ?? null);
  const rp = rangePenetration(employee.basePay, grade?.min ?? null, grade?.max ?? null);
  return {
    employee,
    grade,
    compaRatio: cr,
    rangePenetration: rp,
    belowMin: isNum(grade?.min) && employee.basePay < grade!.min!,
    aboveMax: isNum(grade?.max) && employee.basePay > grade!.max!,
  };
}

export function mapEmployees(employees: Employee[], structure: Structure): EmployeeMapping[] {
  return employees.map((e) => mapEmployee(e, structure));
}

export interface CostToPolicy {
  costToMinimum: number;
  costToPolicyMidpoint: number;
  costToTargetCompa: number;
  belowMinCount: number;
  aboveMaxCount: number;
}

export function costToPolicy(mappings: EmployeeMapping[], targetCompa = 1.0): CostToPolicy {
  let costToMinimum = 0;
  let costToPolicyMidpoint = 0;
  let costToTargetCompa = 0;
  let belowMinCount = 0;
  let aboveMaxCount = 0;
  for (const m of mappings) {
    const base = m.employee.basePay;
    if (isNum(m.grade?.min)) costToMinimum += Math.max(0, m.grade!.min! - base);
    if (isNum(m.grade?.midpoint)) {
      costToPolicyMidpoint += Math.max(0, m.grade!.midpoint! * STRUCTURE.policyMidpointCompa - base);
      costToTargetCompa += Math.max(0, m.grade!.midpoint! * targetCompa - base);
    }
    if (m.belowMin) belowMinCount += 1;
    if (m.aboveMax) aboveMaxCount += 1;
  }
  return { costToMinimum, costToPolicyMidpoint, costToTargetCompa, belowMinCount, aboveMaxCount };
}

// ----------------------------------------------------------------------------
// Equity tension, structure debt, talent scarcity premium
// ----------------------------------------------------------------------------

/** clamp(|market − internal| / internal, 0, 1) · 100. */
export function equityTensionScore(marketMid: number | null, internalMid: number | null): number | null {
  if (!isNum(marketMid) || !isNum(internalMid) || internalMid === 0) return null;
  return clamp(Math.abs(marketMid - internalMid) / internalMid, 0, 1) * 100;
}

/**
 * Cost of Structure Debt: deferring maintenance H years (midpoints drift by
 * inflation) adds catch-up cost, plus penalties for green-circle count and stale
 * benchmarks. Reuses the v2 inflation/leakage pattern.
 */
export function structureDebt(
  mappings: EmployeeMapping[],
  structure: Structure,
  assumptions: GlobalAssumptions,
  greenCircleCount: number,
): { catchUp: number; greenCirclePenalty: number; total: number } {
  const H = assumptions.coiHorizon;
  const inflate = Math.pow(1 + assumptions.salaryInflation, H);
  const now = costToPolicy(mappings, STRUCTURE.policyMidpointCompa).costToPolicyMidpoint;
  // Inflated structure → inflated cost-to-policy.
  const inflatedGrades = structure.grades.map((g) => ({
    ...g,
    midpoint: isNum(g.midpoint) ? g.midpoint * inflate : g.midpoint,
    min: isNum(g.min) ? g.min * inflate : g.min,
    max: isNum(g.max) ? g.max * inflate : g.max,
  }));
  const inflatedStructure: Structure = { ...structure, grades: inflatedGrades };
  const later = costToPolicy(
    mappings.map((m) => mapEmployee(m.employee, inflatedStructure)),
    STRUCTURE.policyMidpointCompa,
  ).costToPolicyMidpoint;
  const catchUp = Math.max(0, later - now);
  const greenCirclePenalty = greenCircleCount * assumptions.salaryInflation * STRUCTURE.greenCirclePenaltyFactor;
  return { catchUp, greenCirclePenalty, total: catchUp + greenCirclePenalty };
}

/** Talent scarcity premium: Σ (familyMidpoint − basePostureMidpoint)·headcount over families above base posture. */
export function talentScarcityPremium(
  perFamily: { family: string; familyMidpoint: number; basePostureMidpoint: number; headcount: number }[],
): number {
  return perFamily.reduce(
    (acc, f) => acc + Math.max(0, f.familyMidpoint - f.basePostureMidpoint) * f.headcount,
    0,
  );
}

// ----------------------------------------------------------------------------
// Pricing engine (Module A)
// ----------------------------------------------------------------------------

export interface PeerStats {
  count: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  max: number | null;
  medianCompa: number | null;
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
}

export function peerStats(
  employees: Employee[],
  intake: { level: Level; jobFamily: string; geography: string },
  midpoint: number | null,
): PeerStats {
  const peers = employees.filter(
    (e) => e.level === intake.level && e.jobFamily === intake.jobFamily && e.geography === intake.geography,
  );
  const pays = peers.map((e) => e.basePay).sort((a, b) => a - b);
  const median = quantile(pays, 0.5);
  return {
    count: peers.length,
    median,
    p25: quantile(pays, 0.25),
    p75: quantile(pays, 0.75),
    max: pays.length ? pays[pays.length - 1]! : null,
    medianCompa: compaRatio(median, midpoint),
  };
}

export interface WaterfallEntry {
  label: string;
  value: number;
}

export interface EquityFlag {
  kind: 'compression' | 'inversion' | 'outlier-compa' | 'exceeds-peer-average';
  message: string;
}

export interface PricingResult {
  marketReference: number | null;
  midpoint: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
  floor: number | null;
  target: number | null;
  stretch: number | null;
  targetCompa: number | null;
  approval: 'auto' | 'needs-approval';
  flags: EquityFlag[];
  rationale: WaterfallEntry[];
  peers: PeerStats;
  provenance: Provenance;
  usedStructure: boolean;
}

export function priceRole(
  intake: PricingIntake,
  inputs: PricingInputs,
  ds: Dataset,
  assumptions: GlobalAssumptions,
  employees: Employee[],
  structure: Structure | null,
): PricingResult {
  const p = POSTURE_PERCENTILE[inputs.posture];
  const refOpts = { level: intake.level, geography: intake.geography, jobFamily: intake.jobFamily };
  const refRaw = marketReference(ds, assumptions, { ...refOpts, percentile: p });
  const market5 = marketReference(ds, assumptions, { ...refOpts, percentile: 0.05 });
  const market75 = marketReference(ds, assumptions, { ...refOpts, percentile: 0.75 });

  const baseRef = refRaw?.value ?? null;
  const adjusted = isNum(baseRef) ? baseRef * (1 + inputs.adjustmentPremium) : null;

  // Range from the published structure grade, else default around the adjusted reference.
  const gradeRange = structure?.grades.find((g) => g.grade === intake.grade || g.level === intake.level) ?? null;
  const usedStructure = !!gradeRange && isNum(gradeRange.midpoint);
  const midpoint = usedStructure ? gradeRange!.midpoint : adjusted;
  const range = isNum(midpoint) ? rangeFromMidpoint(midpoint, PRICING.defaultRangeSpread) : null;
  const rangeMin = usedStructure ? gradeRange!.min : range?.min ?? null;
  const rangeMax = usedStructure ? gradeRange!.max : range?.max ?? null;

  const peers = peerStats(employees, intake, midpoint);

  // Floor / Stretch / Target.
  const floorCandidates = [rangeMin, market5?.value ?? null, peers.p25].filter(isNum);
  const floor = floorCandidates.length ? Math.max(...floorCandidates) : null;

  const stretchCandidates = [rangeMax, market75?.value ?? null, isNum(peers.max) ? peers.max * (1 + inputs.candidatePremium) : null].filter(isNum);
  const stretch = stretchCandidates.length ? Math.min(...stretchCandidates) : null;

  const targetRaw = isNum(midpoint) ? midpoint * PRICING.policyTargetCompa * (1 + inputs.candidatePremium) : null;
  let target = targetRaw;
  if (isNum(target) && isNum(floor)) target = Math.max(target, floor);
  if (isNum(target) && isNum(stretch)) target = Math.min(target, stretch);
  if (inputs.useStretch && isNum(stretch)) target = stretch;

  const targetCompa = compaRatio(target, midpoint);

  // Rationale waterfall — self-consistent: every delta lands exactly on the Offer target.
  // baseRef + premiumΔ + midpointBridgeΔ + policyΔ + guardrailΔ = target.
  const rationale: WaterfallEntry[] = [];
  if (isNum(baseRef)) rationale.push({ label: `Market ${Math.round(p * 100)}th`, value: baseRef });
  const afterPremium = adjusted ?? baseRef;
  if (isNum(adjusted) && isNum(baseRef) && adjusted !== baseRef) {
    rationale.push({ label: 'Adjustment premium', value: adjusted - baseRef });
  }
  // Bridge to the (published-structure) range midpoint — the basis of the policy target.
  if (isNum(midpoint) && isNum(afterPremium) && Math.abs(midpoint - afterPremium) > 1e-6) {
    rationale.push({ label: 'Range midpoint', value: midpoint - afterPremium });
  }
  if (isNum(midpoint) && isNum(targetRaw)) {
    rationale.push({ label: `Policy target ×${PRICING.policyTargetCompa}`, value: targetRaw - midpoint });
  }
  if (isNum(target) && isNum(targetRaw) && target !== targetRaw) {
    rationale.push({ label: inputs.useStretch ? 'Stretch to range max' : 'Equity guardrail', value: target - targetRaw });
  }
  if (isNum(target)) rationale.push({ label: 'Offer target', value: target });

  // Equity flags.
  const flags: EquityFlag[] = [];
  const [bandLo, bandHi] = PRICING.compaPolicyBand;
  if (isNum(targetCompa) && (targetCompa < bandLo || targetCompa > bandHi)) {
    flags.push({ kind: 'outlier-compa', message: `Compa-ratio ${targetCompa.toFixed(2)} outside policy band ${bandLo}–${bandHi}.` });
  }
  if (isNum(target) && isNum(peers.median) && target > peers.median * (1 + PRICING.equityTolerancePct)) {
    flags.push({ kind: 'exceeds-peer-average', message: `Offer exceeds peer median (${peers.median.toFixed(1)}) by more than ${Math.round(PRICING.equityTolerancePct * 100)}%.` });
  }
  if (isNum(target) && isNum(peers.max) && target > peers.max) {
    flags.push({ kind: 'inversion', message: `Offer above the highest-paid peer (${peers.max.toFixed(1)}).` });
  }
  if (isNum(target) && isNum(peers.median) && Math.abs(target - peers.median) <= peers.median * PRICING.equityTolerancePct && peers.count > 0) {
    flags.push({ kind: 'compression', message: `Offer within ${Math.round(PRICING.equityTolerancePct * 100)}% of peer median — compression risk.` });
  }

  const needsApproval =
    inputs.useStretch ||
    (isNum(targetCompa) && targetCompa > bandHi) ||
    (isNum(target) && isNum(peers.median) && target > peers.median);
  const approval: PricingResult['approval'] = needsApproval ? 'needs-approval' : 'auto';

  // Inherits the weakest input provenance, INCLUDING the published structure grade
  // (its midpoint/range carry their own — often ASSUMED — confidence provenance).
  const provenance = weakest(
    refRaw?.provenance ?? null,
    usedStructure && gradeRange ? gradeRange.confidenceProvenance : null,
    inputs.adjustmentPremium !== 0 || inputs.candidatePremium !== 0 ? 'ENTERED' : null,
  );

  return {
    marketReference: adjusted,
    midpoint,
    rangeMin,
    rangeMax,
    floor,
    target,
    stretch,
    targetCompa,
    approval,
    flags,
    rationale,
    peers,
    provenance,
    usedStructure,
  };
}

/** Default 5-grade benchmark-anchored structure design (G2..G6 → An..Pr). */
export function defaultStructureDesign(): StructureDesign {
  const grades: GradeDef[] = LEVELS.map((level) => ({
    grade: ({ An: 'G2', As: 'G3', M: 'G4', SM: 'G5', Pr: 'G6' } as Record<Level, string>)[level],
    level,
  }));
  return {
    id: 'default',
    name: 'Benchmark-anchored (default)',
    type: 'grades',
    progression: 'benchmark',
    fixedStep: STRUCTURE.fixedProgressionStep,
    anchorPercentile: 0.5,
    spread: PRICING.defaultRangeSpread,
    grades,
    midpointOverrides: {},
    published: true,
  };
}

export { directComp };
