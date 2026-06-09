/**
 * Workforce capital-allocation compute (§2E / §3). Pure, deterministic, guarded.
 * Divide-by-zero / missing inputs degrade to `null` — never `NaN`. All magic
 * numbers come from `assumptions.ts` (Appendix A); nothing is hard-coded here.
 *
 * Every result carries a provenance that inherits the WEAKEST among its inputs
 * (MEASURED > ENTERED > ASSUMED), per §2C.
 */

import { aggregateOf, type Level, LEVELS } from '@/domain/levels';
import type { Component, Period, Weighting } from '@/domain/components';
import { type Dataset, selectTable } from '@/domain/types';
import {
  deviationPct,
  marketValueAtPercentile,
  type PercentilePosition,
  percentilePositionOf,
} from '@/lib/benchmark';
import {
  CONVEXITY_ABOVE_INFLECTION_BOOST,
  FRONTIER_BAND_SIGMA,
  type GlobalAssumptions,
  type ResolvedInputs,
  type ResolvedInputsByLevel,
} from '@/lib/assumptions';
import { type Provenance, weakest } from '@/lib/provenance';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export type { ResolvedInputs, ResolvedInputsByLevel };

// ----------------------------------------------------------------------------
// Retention model (§3 Lens 1) — logistic in pay-percentile position
// ----------------------------------------------------------------------------

export interface RetentionParams {
  Rmax: number;
  k: number;
  p0: number;
}

export function retentionParams(a: GlobalAssumptions): RetentionParams {
  return { Rmax: a.retentionRmax, k: a.retentionK, p0: a.retentionP0 };
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** R(p) = Rmax · σ(k·(p − p0)). */
export function retention(p: number, a: RetentionParams): number {
  return a.Rmax * sigmoid(a.k * (p - a.p0));
}

/** dR/dp = Rmax · k · σ(1−σ). */
export function dRetention(p: number, a: RetentionParams): number {
  const s = sigmoid(a.k * (p - a.p0));
  return a.Rmax * a.k * s * (1 - s);
}

/** d²R/dp² = Rmax · k² · σ(1−σ)(1−2σ). Positive below p0 (accelerating returns). */
export function d2Retention(p: number, a: RetentionParams): number {
  const s = sigmoid(a.k * (p - a.p0));
  return a.Rmax * a.k * a.k * s * (1 - s) * (1 - 2 * s);
}

/** Attrition normalized so A(0.5) = baselineAttrition. Rises below market. */
export function attrition(p: number, baselineAttrition: number, a: RetentionParams): number | null {
  const denom = 1 - retention(0.5, a);
  if (denom <= 0) return null;
  return baselineAttrition * ((1 - retention(p, a)) / denom);
}

/** Map a percentile position to a number, clamping the >95% / <5% sentinels. */
export function numericPosition(pos: PercentilePosition | null): number | null {
  if (pos === null) return null;
  if (pos === '>95%') return 0.97;
  if (pos === '<5%') return 0.03;
  return pos;
}

// ----------------------------------------------------------------------------
// Segment base extraction from the v1 dataset
// ----------------------------------------------------------------------------

export interface SegmentBase {
  level: Level;
  label: string;
  firmMedian: number | null;
  marketMedian: number | null;
  base: number | null;
  allowances: number | null;
  bonus: number | null;
  tcc: number | null;
  costPerHead: number | null; // tcc ?? base
  position: number | null; // numeric percentile position of firm median
  deviationPct: number | null;
  incumbents: number;
  percentiles: Record<string, number | null> | null;
}

function medianOf(
  ds: Dataset,
  weighting: Weighting,
  period: Period,
  component: Component,
  level: Level,
): number | null {
  return selectTable(ds, weighting, period, component)?.rows[aggregateOf(level)]?.firm.median ?? null;
}

/**
 * Per-level pay/cost/position basis for the lenses. `payComponent` drives the
 * percentile position (defaults to the user's active component). The cost stack
 * always uses the cash components when present, falling back to base.
 */
export function buildSegmentBases(
  ds: Dataset,
  weighting: Weighting,
  period: Period,
  payComponent: Component = 'BASIC_SALARY',
): SegmentBase[] {
  return LEVELS.map((level) => {
    const agg = aggregateOf(level);
    const payTable = selectTable(ds, weighting, period, payComponent);
    const payRow = payTable?.rows[agg];
    const firmMedian = payRow?.firm.median ?? null;
    const marketMedian = payRow?.market.median ?? null;
    const percentiles = payRow?.percentiles ?? null;
    const position = percentiles ? numericPosition(percentilePositionOf(firmMedian, percentiles)) : null;

    const base = medianOf(ds, weighting, period, 'BASIC_SALARY', level) ?? medianOf(ds, weighting, period, 'BASE_SALARY', level);
    const allowances = medianOf(ds, weighting, period, 'ALLOWANCES', level);
    const bonus = medianOf(ds, weighting, period, 'BONUS', level);
    const tccTable = medianOf(ds, weighting, period, 'TCC', level);
    const tcc =
      tccTable ?? (isNum(base) ? base + (allowances ?? 0) + (bonus ?? 0) : null);
    const costPerHead = tcc ?? base;

    return {
      level,
      label: aggregateLabel(level),
      firmMedian,
      marketMedian,
      base,
      allowances,
      bonus,
      tcc,
      costPerHead,
      position,
      deviationPct: deviationPct(firmMedian, marketMedian),
      incumbents: ds.distribution.firm[level] ?? 0,
      percentiles,
    };
  });
}

function aggregateLabel(level: Level): string {
  const labels: Record<Level, string> = { An: 'Analyst', As: 'Associate', M: 'Manager', SM: 'Sr Manager', Pr: 'Principal' };
  return labels[level];
}

// ----------------------------------------------------------------------------
// Scenario application (§2D) — proposed pay moves layered on the baseline bases
// ----------------------------------------------------------------------------

export interface ScenarioMove {
  /** Move the firm median to this market percentile (0.05–0.95). */
  targetPercentile?: number;
  /** Or apply an absolute median delta (GND k). */
  medianDelta?: number;
}

/** Re-derive segment bases under a scenario's pay moves (position/deviation recomputed). */
export function applyScenario(
  bases: SegmentBase[],
  moves: Partial<Record<Level, ScenarioMove>>,
): SegmentBase[] {
  return bases.map((b) => {
    const m = moves[b.level];
    if (!m || !b.percentiles || !isNum(b.firmMedian)) return b;
    let newMedian: number | null = b.firmMedian;
    if (typeof m.targetPercentile === 'number') {
      newMedian = marketValueAtPercentile(b.percentiles, m.targetPercentile);
    } else if (typeof m.medianDelta === 'number') {
      newMedian = b.firmMedian + m.medianDelta;
    }
    if (!isNum(newMedian)) return b;
    return {
      ...b,
      firmMedian: newMedian,
      position: numericPosition(percentilePositionOf(newMedian, b.percentiles)),
      deviationPct: deviationPct(newMedian, b.marketMedian),
    };
  });
}

/** Pay cost of a scenario vs baseline (Σ (scenarioMedian − baselineMedian)·headcount). */
export function scenarioPayCost(baseline: SegmentBase[], scenario: SegmentBase[]): number {
  let cost = 0;
  for (let i = 0; i < baseline.length; i++) {
    const b = baseline[i];
    const s = scenario[i];
    if (b && s && isNum(b.firmMedian) && isNum(s.firmMedian)) {
      cost += (s.firmMedian - b.firmMedian) * b.incumbents;
    }
  }
  return cost;
}

/** Value-at-risk per head: replacement cost of a regrettable exit + value lost. */
export function valueAtRisk(
  costPerHead: number | null,
  inputs: ResolvedInputs,
): { value: number | null; provenance: Provenance } {
  if (!isNum(costPerHead)) return { value: null, provenance: 'ASSUMED' };
  const repl = inputs.replacementCostMultiple.value;
  const vph = inputs.valuePerHead?.value ?? 0;
  return {
    value: repl * costPerHead + vph,
    provenance: weakest(inputs.replacementCostMultiple.provenance, inputs.valuePerHead?.provenance ?? null),
  };
}

// ----------------------------------------------------------------------------
// Lens 1 — Human Capital Convexity
// ----------------------------------------------------------------------------

export interface ConvexityRow {
  level: Level;
  label: string;
  position: number | null;
  retention: number | null;
  dR: number | null;
  d2R: number | null;
  attrition: number | null;
  varPerHead: number | null;
  headcount: number;
  coiRaw: number | null;
  coi: number | null; // normalized 0–100
  belowInflection: boolean;
  provenance: Provenance;
}

export function computeConvexity(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
): ConvexityRow[] {
  const rp = retentionParams(assumptions);
  const interim = bases.map((b) => {
    const inp = inputs[b.level];
    const p = b.position;
    const var_ = valueAtRisk(b.costPerHead, inp);
    let dR: number | null = null;
    let coiRaw: number | null = null;
    let retentionV: number | null = null;
    let d2RV: number | null = null;
    let attr: number | null = null;
    if (isNum(p)) {
      dR = dRetention(p, rp);
      retentionV = retention(p, rp);
      d2RV = d2Retention(p, rp);
      attr = attrition(p, inp.baselineAttritionPct.value, rp);
      if (isNum(var_.value)) {
        const boost = p < rp.p0 ? 1 : CONVEXITY_ABOVE_INFLECTION_BOOST;
        coiRaw = dR * var_.value * b.incumbents * boost;
      }
    }
    return {
      level: b.level,
      label: b.label,
      position: p,
      retention: retentionV,
      dR,
      d2R: d2RV,
      attrition: attr,
      varPerHead: var_.value,
      headcount: b.incumbents,
      coiRaw,
      belowInflection: isNum(p) ? p < rp.p0 : false,
      provenance: weakest(var_.provenance, inp.baselineAttritionPct.provenance),
    };
  });

  const maxCoi = Math.max(0, ...interim.map((r) => (isNum(r.coiRaw) ? r.coiRaw : 0)));
  return interim.map((r) => ({
    ...r,
    coi: isNum(r.coiRaw) && maxCoi > 0 ? (r.coiRaw / maxCoi) * 100 : isNum(r.coiRaw) ? 0 : null,
  }));
}

/** Retention curve sample points for charting (p in [0,1]). */
export function retentionCurve(assumptions: GlobalAssumptions, steps = 50): { p: number; r: number }[] {
  const rp = retentionParams(assumptions);
  const out: { p: number; r: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    out.push({ p, r: retention(p, rp) });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Lens 5 — Total Workforce Cost Truth
// ----------------------------------------------------------------------------

export interface CostStackRow {
  level: Level;
  label: string;
  base: number | null;
  allowances: number | null;
  bonus: number | null;
  tcc: number | null;
  employerContribution: number | null;
  tCtc: number | null;
  overtimePerHead: number | null;
  contingentPerHead: number | null;
  twc: number | null;
  flexibleLoad: number | null;
  underMarket: boolean;
  falseSavingsFlag: boolean;
  headcount: number;
  provenance: Provenance;
}

export function computeTotalCost(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
): CostStackRow[] {
  return bases.map((b) => {
    const inp = inputs[b.level];
    const tcc = b.tcc;
    const empPct = inp.employerContributionPct.value;
    const employerContribution = isNum(tcc) ? tcc * empPct : null;
    const tCtc = isNum(tcc) && isNum(employerContribution) ? tcc + employerContribution : null;
    const overtimePerHead = inp.overtimeSpendPerHead.value;
    const contingentPerHead = b.incumbents > 0 ? inp.contingentCostTotal.value / b.incumbents : 0;
    const flex = overtimePerHead + contingentPerHead;
    const twc = isNum(tCtc) ? tCtc + flex : null;
    const flexibleLoad = isNum(twc) && twc > 0 ? flex / twc : null;
    const underMarket = isNum(b.deviationPct) && b.deviationPct < 0;
    const falseSavingsFlag =
      underMarket && isNum(flexibleLoad) && flexibleLoad > assumptions.flexibleLoadThreshold;
    return {
      level: b.level,
      label: b.label,
      base: b.base,
      allowances: b.allowances,
      bonus: b.bonus,
      tcc,
      employerContribution,
      tCtc,
      overtimePerHead,
      contingentPerHead,
      twc,
      flexibleLoad,
      underMarket,
      falseSavingsFlag,
      headcount: b.incumbents,
      provenance: weakest(
        inp.employerContributionPct.provenance,
        inp.overtimeSpendPerHead.provenance,
        inp.contingentCostTotal.provenance,
      ),
    };
  });
}

// ----------------------------------------------------------------------------
// Lens 4 — Cost of Inaction (multi-period)
// ----------------------------------------------------------------------------

/** Productivity haircut from an under-market gap: clamp(−gap·slope, 0, cap). */
export function haircut(gapPct: number, assumptions: GlobalAssumptions): number {
  return clamp(-gapPct * assumptions.haircutSlope, 0, assumptions.haircutCap);
}

export interface CoiOptions {
  horizon: number;
  discountRate: number;
  targetPercentile: number;
}

export interface CoiSegment {
  level: Level;
  label: string;
  underMarket: boolean;
  presentSaving: number | null; // apparent saving from staying under market (≥0)
  attritionLeakage: number | null;
  productivityDrag: number | null;
  catchUpPremium: number | null;
  totalLeakage: number | null;
  net: number | null; // presentSaving − totalLeakage (negative = value destruction)
  provenance: Provenance;
}

export interface CoiResult {
  segments: CoiSegment[];
  totalPresentSaving: number;
  totalLeakage: number;
  net: number;
}

export function computeCostOfInaction(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
  opts: CoiOptions,
): CoiResult {
  const rp = retentionParams(assumptions);
  const H = Math.max(1, Math.round(opts.horizon));
  // Guard: a discount rate ≤ −100% would make discounting non-finite.
  const disc = opts.discountRate <= -1 ? 0 : opts.discountRate;
  const infl = assumptions.salaryInflation;

  const segments: CoiSegment[] = bases.map((b) => {
    const inp = inputs[b.level];
    const tmp = b.percentiles ? marketValueAtPercentile(b.percentiles, opts.targetPercentile) : null;
    const underMarket = isNum(b.deviationPct) && b.deviationPct < 0;
    const var_ = valueAtRisk(b.costPerHead, inp);

    if (!underMarket || !isNum(tmp) || !isNum(b.firmMedian)) {
      return {
        level: b.level,
        label: b.label,
        underMarket,
        presentSaving: underMarket && isNum(tmp) && isNum(b.firmMedian) ? (tmp - b.firmMedian) * b.incumbents : underMarket ? null : 0,
        attritionLeakage: underMarket ? null : 0,
        productivityDrag: underMarket ? null : 0,
        catchUpPremium: underMarket ? null : 0,
        totalLeakage: underMarket ? null : 0,
        net: underMarket ? null : 0,
        provenance: weakest(var_.provenance, inp.baselineAttritionPct.provenance),
      };
    }

    // Apparent saving from staying under the target — money not spent (floored at 0;
    // a segment below market-median can still sit above a low chosen target).
    const presentSaving = Math.max(0, (tmp - b.firmMedian) * b.incumbents);
    const aNow = attrition(b.position ?? 0.5, inp.baselineAttritionPct.value, rp);
    const aTarget = attrition(opts.targetPercentile, inp.baselineAttritionPct.value, rp);

    // Discounted multi-period sums
    let discountSum = 0;
    for (let t = 1; t <= H; t++) discountSum += 1 / Math.pow(1 + disc, t);

    const attritionLeakage =
      isNum(aNow) && isNum(aTarget) && isNum(var_.value)
        ? Math.max(0, aNow - aTarget) * b.incumbents * var_.value * discountSum
        : isNum(var_.value)
          ? 0
          : null;

    const valueCreated = inp.valuePerHead ? inp.valuePerHead.value * b.incumbents : 0;
    const hc = isNum(b.deviationPct) ? haircut(b.deviationPct, assumptions) : 0;
    const productivityDrag = hc * valueCreated * discountSum;

    // Catch-up premium: market drift over the horizon, realized once at year H and
    // discounted to present (consistent time basis with the annual leakage streams).
    const catchUpPremium = (tmp * (Math.pow(1 + infl, H) - 1) * b.incumbents) / Math.pow(1 + disc, H);

    const totalLeakage =
      (attritionLeakage ?? 0) + productivityDrag + catchUpPremium;
    const net = presentSaving - totalLeakage;

    return {
      level: b.level,
      label: b.label,
      underMarket,
      presentSaving,
      attritionLeakage,
      productivityDrag,
      catchUpPremium,
      totalLeakage,
      net,
      provenance: weakest(
        var_.provenance,
        inp.baselineAttritionPct.provenance,
        inp.valuePerHead?.provenance ?? null,
      ),
    };
  });

  const under = segments.filter((s) => s.underMarket);
  const totalPresentSaving = under.reduce((a, s) => a + (s.presentSaving ?? 0), 0);
  const totalLeakage = under.reduce((a, s) => a + (s.totalLeakage ?? 0), 0);
  return { segments, totalPresentSaving, totalLeakage, net: totalPresentSaving - totalLeakage };
}

/** Total under-market leakage across the portfolio for a given (horizon, k, repl, slope, infl). */
export function portfolioLeakage(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
  opts: CoiOptions,
): number {
  return computeCostOfInaction(bases, inputs, assumptions, opts).totalLeakage;
}

export interface TornadoRow {
  key: string;
  label: string;
  low: number;
  high: number;
  delta: number; // |high − low|
}

/** Sensitivity tornado: swing each high-leverage assumption ±swing and measure portfolio-leakage range. */
export function coiTornado(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
  opts: CoiOptions,
  swing = 0.25,
): TornadoRow[] {
  const drivers: { key: string; label: string; apply: (a: GlobalAssumptions, f: number) => GlobalAssumptions }[] = [
    { key: 'retentionK', label: 'Attrition sensitivity (k)', apply: (a, f) => ({ ...a, retentionK: a.retentionK * f }) },
    { key: 'haircutSlope', label: 'Productivity haircut slope', apply: (a, f) => ({ ...a, haircutSlope: a.haircutSlope * f }) },
    { key: 'salaryInflation', label: 'Salary inflation', apply: (a, f) => ({ ...a, salaryInflation: a.salaryInflation * f }) },
  ];
  const replSwing = (f: number): ResolvedInputsByLevel => {
    const out = {} as ResolvedInputsByLevel;
    for (const lvl of LEVELS) {
      const inp = inputs[lvl];
      out[lvl] = {
        ...inp,
        replacementCostMultiple: { ...inp.replacementCostMultiple, value: inp.replacementCostMultiple.value * f },
      };
    }
    return out;
  };

  const rows: TornadoRow[] = drivers.map((d) => {
    const low = portfolioLeakage(bases, inputs, d.apply(assumptions, 1 - swing), opts);
    const high = portfolioLeakage(bases, inputs, d.apply(assumptions, 1 + swing), opts);
    return { key: d.key, label: d.label, low, high, delta: Math.abs(high - low) };
  });
  // replacement multiple swings the inputs, not the assumptions
  const replLow = portfolioLeakage(bases, replSwing(1 - swing), assumptions, opts);
  const replHigh = portfolioLeakage(bases, replSwing(1 + swing), assumptions, opts);
  rows.push({ key: 'replacementMultiple', label: 'Replacement cost multiple', low: replLow, high: replHigh, delta: Math.abs(replHigh - replLow) });

  return rows.sort((a, b) => b.delta - a.delta);
}

// ----------------------------------------------------------------------------
// Lens 2 — Workforce Value Density
// ----------------------------------------------------------------------------

export type Quadrant = 'PROTECT_INVEST' | 'OPTIMIZE' | 'SUSTAIN' | 'MONITOR';

export interface ValueDensityRow {
  level: Level;
  label: string;
  workforceCost: number | null;
  valueCreated: number | null;
  valueDensity: number | null;
  deviationPct: number | null;
  quadrant: Quadrant | null;
  headcount: number;
  provenance: Provenance;
}

export interface ValueDensityResult {
  rows: ValueDensityRow[];
  medianVD: number | null;
  hasValue: boolean;
}

export function computeValueDensity(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  costRows?: CostStackRow[],
): ValueDensityResult {
  const costByLevel = new Map<Level, number | null>();
  if (costRows) for (const c of costRows) costByLevel.set(c.level, c.twc ?? c.tcc ?? null);

  const interim = bases.map((b) => {
    const inp = inputs[b.level];
    const vph = inp.valuePerHead;
    const costPerHead = costByLevel.get(b.level) ?? b.costPerHead;
    const workforceCost = isNum(costPerHead) ? costPerHead * b.incumbents : null;
    const valueCreated = vph ? vph.value * b.incumbents : null;
    const valueDensity =
      isNum(valueCreated) && isNum(workforceCost) && workforceCost > 0 ? valueCreated / workforceCost : null;
    return {
      level: b.level,
      label: b.label,
      workforceCost,
      valueCreated,
      valueDensity,
      deviationPct: b.deviationPct,
      headcount: b.incumbents,
      provenance: weakest(vph?.provenance ?? null, inp.employerContributionPct.provenance),
    };
  });

  const vds = interim.map((r) => r.valueDensity).filter(isNum).sort((a, b) => a - b);
  const medianVD = vds.length > 0 ? (vds[Math.floor((vds.length - 1) / 2)]! + vds[Math.ceil((vds.length - 1) / 2)]!) / 2 : null;
  const hasValue = vds.length > 0;

  const rows: ValueDensityRow[] = interim.map((r) => ({
    ...r,
    quadrant:
      isNum(r.valueDensity) && isNum(medianVD) && isNum(r.deviationPct)
        ? quadrantOf(r.valueDensity, medianVD, r.deviationPct)
        : null,
  }));

  return { rows, medianVD, hasValue };
}

function quadrantOf(vd: number, medianVD: number, dev: number): Quadrant {
  const highVD = vd >= medianVD;
  const underMarket = dev < 0;
  if (highVD && underMarket) return 'PROTECT_INVEST';
  if (!highVD && !underMarket) return 'OPTIMIZE';
  if (highVD && !underMarket) return 'SUSTAIN';
  return 'MONITOR';
}

export const QUADRANT_META: Record<Quadrant, { label: string; action: string; color: string }> = {
  PROTECT_INVEST: { label: 'Protect & Invest', action: 'High value density, under market — underpaying a value engine.', color: '#2E8B57' },
  OPTIMIZE: { label: 'Optimize', action: 'Low value density, over market — overspend to correct.', color: '#C0392B' },
  SUSTAIN: { label: 'Sustain', action: 'High value density, paid above market — hold.', color: '#2E5C9A' },
  MONITOR: { label: 'Monitor', action: 'Low value density, under market — watch.', color: '#8A93A5' },
};

// ----------------------------------------------------------------------------
// Lens 3 — Pay-Productivity Frontier (OLS)
// ----------------------------------------------------------------------------

export type FrontierZone = 'PRODUCTIVITY_AHEAD' | 'ALIGNED' | 'PAY_AHEAD';

export interface FrontierPoint {
  level: Level;
  label: string;
  x: number; // compa-ratio (pay)
  y: number; // productivity
  yhat: number;
  gap: number;
  zone: FrontierZone;
}

export interface FrontierResult {
  points: FrontierPoint[];
  slope: number | null;
  intercept: number | null;
  residualSd: number | null;
  band: number | null;
  fitOk: boolean;
  hasValue: boolean;
}

/** Ordinary least squares. Returns null slope/intercept with <2 points. */
export function ols(xs: number[], ys: number[]): { slope: number | null; intercept: number | null } {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return { slope: null, intercept: null };
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - xbar;
    sxy += dx * (ys[i]! - ybar);
    sxx += dx * dx;
  }
  if (sxx === 0) return { slope: null, intercept: null };
  const slope = sxy / sxx;
  return { slope, intercept: ybar - slope * xbar };
}

export function computeFrontier(bases: SegmentBase[], inputs: ResolvedInputsByLevel): FrontierResult {
  const usable = bases
    .map((b) => {
      const inp = inputs[b.level];
      const x = isNum(b.firmMedian) && isNum(b.marketMedian) && b.marketMedian > 0 ? b.firmMedian / b.marketMedian : null;
      const y = inp.productivityIndex?.value ?? inp.valuePerHead?.value ?? null;
      return x !== null && isNum(y) ? { level: b.level, label: b.label, x, y } : null;
    })
    .filter((v): v is { level: Level; label: string; x: number; y: number } => v !== null);

  const hasValue = usable.length > 0;
  if (usable.length < 2) {
    return { points: [], slope: null, intercept: null, residualSd: null, band: null, fitOk: false, hasValue };
  }

  const { slope, intercept } = ols(usable.map((u) => u.x), usable.map((u) => u.y));
  if (slope === null || intercept === null) {
    return { points: [], slope: null, intercept: null, residualSd: null, band: null, fitOk: false, hasValue };
  }

  const residuals = usable.map((u) => u.y - (intercept + slope * u.x));
  const meanRes = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance = residuals.reduce((a, r) => a + (r - meanRes) ** 2, 0) / residuals.length;
  const residualSd = Math.sqrt(variance);
  const band = FRONTIER_BAND_SIGMA * residualSd;
  const fitOk = usable.length >= 3;

  const points: FrontierPoint[] = usable.map((u) => {
    const yhat = intercept + slope * u.x;
    const gap = u.y - yhat;
    const zone: FrontierZone = gap > band ? 'PRODUCTIVITY_AHEAD' : gap < -band ? 'PAY_AHEAD' : 'ALIGNED';
    return { ...u, yhat, gap, zone };
  });

  return { points, slope, intercept, residualSd, band, fitOk, hasValue };
}

export const ZONE_META: Record<FrontierZone, { label: string; note: string; color: string }> = {
  PRODUCTIVITY_AHEAD: { label: 'Productivity ahead of pay', note: 'Under-rewarded — flight risk.', color: '#2E8B57' },
  ALIGNED: { label: 'Aligned', note: 'Pay tracks output.', color: '#8A93A5' },
  PAY_AHEAD: { label: 'Pay ahead of productivity', note: 'Spend unsupported by output.', color: '#C0392B' },
};
