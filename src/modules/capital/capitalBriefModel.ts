/**
 * Capital Allocation Brief — pure view-model (§4 synthesis).
 *
 * Converges all five lenses, computed on ONE set of segment bases, into a single
 * per-segment action ledger plus the headline capital numbers. Deterministic and
 * guarded: missing inputs degrade to null and a tidy action, never NaN.
 *
 * The component renders this model; no formula is recomputed in the view. The
 * action-derivation and the math reuse the verified compute in `@/lib/capital`
 * and `@/lib/benchmark` — this file only *composes* and *classifies*.
 */

import type { Level } from '@/domain/levels';
import {
  computeConvexity,
  computeCostOfInaction,
  computeFrontier,
  computeTotalCost,
  computeValueDensity,
  type ConvexityRow,
  type CoiSegment,
  type FrontierPoint,
  type Quadrant,
  type SegmentBase,
} from '@/lib/capital';
import { marketValueAtPercentile } from '@/lib/benchmark';
import type { GlobalAssumptions, ResolvedInputsByLevel } from '@/lib/assumptions';
import { type Provenance, weakest } from '@/lib/provenance';

/** The four recommended actions, shared with the VD quadrant vocabulary (§4). */
export type BriefAction = 'PROTECT_INVEST' | 'OPTIMIZE' | 'SUSTAIN' | 'MONITOR';

export const ACTION_META: Record<
  BriefAction,
  { label: string; short: string; tone: 'green' | 'red' | 'navy' | 'amber'; color: string }
> = {
  PROTECT_INVEST: { label: 'Protect & Invest', short: 'Protect', tone: 'green', color: '#2E8B57' },
  OPTIMIZE: { label: 'Optimize', short: 'Optimize', tone: 'red', color: '#C0392B' },
  SUSTAIN: { label: 'Sustain', short: 'Sustain', tone: 'navy', color: '#2E5C9A' },
  MONITOR: { label: 'Monitor', short: 'Monitor', tone: 'amber', color: '#8A93A5' },
};

/** Stable display order: act first, hold last. */
const ACTION_RANK: Record<BriefAction, number> = {
  PROTECT_INVEST: 0,
  OPTIMIZE: 1,
  SUSTAIN: 2,
  MONITOR: 3,
};

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Map a Value-Density quadrant onto a brief action 1:1 (same four-box vocabulary). */
function actionFromQuadrant(q: Quadrant): BriefAction {
  return q;
}

export interface BriefRow {
  level: Level;
  label: string;
  headcount: number;
  /** Firm-median deviation vs market (negative = under market). */
  deviationPct: number | null;
  /** Convexity Opportunity Index 0–100 (retention leverage signal). */
  coiIndex: number | null;
  belowInflection: boolean;
  /** Value-Density quadrant — null when no value-per-head data is loaded. */
  quadrant: Quadrant | null;
  valueDensity: number | null;
  /** Pay-Productivity frontier zone for this level — null when the fit can't place it. */
  frontierZone: FrontierPoint['zone'] | null;
  frontierGap: number | null;
  /** Cost-of-Inaction net position over the horizon (negative = value destruction). */
  coiNet: number | null;
  coiLeakage: number | null;
  /** Σ pay-to-target for this segment (TMP − firmMedian)·headcount, ≥0 when under market. */
  payToTarget: number | null;
  falseSavings: boolean;
  underMarket: boolean;
  action: BriefAction;
  rationale: string;
  provenance: Provenance;
}

/** Portfolio headline figures — computed identically on Baseline and Scenario for deltas. */
export interface BriefHeadline {
  /** Σ pay-to-target across Protect & Invest segments (capital to deploy). */
  capitalRequired: number;
  /** Value-at-risk protected by acting on flagged segments (from convexity / CoI). */
  valueProtected: number;
  /** Cost-of-inaction avoided over the horizon for flagged segments. */
  coiAvoided: number;
  /** Recoverable false-savings: Σ (overtime + contingent) on flagged under-market segments. */
  falseSavingsRecoverable: number;
  /** Count of Protect & Invest segments. */
  flaggedCount: number;
}

export interface BriefModel {
  rows: BriefRow[];
  headline: BriefHeadline;
  /** Whether any value-per-head data drove the value-density quadrants. */
  hasValueData: boolean;
  /** Weakest provenance across every ledger row. */
  provenance: Provenance;
}

interface Derived {
  convex: ConvexityRow[];
  coi: CoiSegment[];
  frontier: Map<Level, FrontierPoint>;
  vd: Map<Level, { quadrant: Quadrant | null; valueDensity: number | null; provenance: Provenance }>;
  flexByLevel: Map<Level, { flex: number; underMarket: boolean; falseSavings: boolean }>;
  hasValueData: boolean;
}

/**
 * Derive a recommended action for one segment.
 *
 * Primary signal is the Value-Density quadrant (the four-box that already fuses
 * value-per-head with pay position). When no value data exists, fall back to a
 * deterministic decision tree over pay position + retention leverage (COI) +
 * cost-of-inaction leakage:
 *   under-market + (below inflection OR leaking)        → Protect & Invest
 *   under-market (otherwise)                            → Monitor
 *   over-market  + low retention leverage               → Optimize
 *   at/above-market with leverage                       → Sustain
 */
function deriveAction(args: {
  quadrant: Quadrant | null;
  deviationPct: number | null;
  underMarket: boolean;
  coiIndex: number | null;
  belowInflection: boolean;
  coiNet: number | null;
}): { action: BriefAction; rationale: string } {
  const { quadrant, deviationPct, underMarket, coiIndex, belowInflection, coiNet } = args;

  if (quadrant) {
    const action = actionFromQuadrant(quadrant);
    return { action, rationale: rationaleFor(action, { deviationPct, coiIndex, coiNet, hasValue: true }) };
  }

  // No value data — decide from pay position + retention leverage + leakage.
  const leaking = isNum(coiNet) && coiNet < 0;
  const highLeverage = isNum(coiIndex) && coiIndex >= 50;

  if (underMarket) {
    if (belowInflection || leaking || highLeverage) {
      return { action: 'PROTECT_INVEST', rationale: rationaleFor('PROTECT_INVEST', { deviationPct, coiIndex, coiNet, hasValue: false }) };
    }
    return { action: 'MONITOR', rationale: rationaleFor('MONITOR', { deviationPct, coiIndex, coiNet, hasValue: false }) };
  }

  // At or above market.
  if (isNum(deviationPct) && deviationPct > 0 && !highLeverage) {
    return { action: 'OPTIMIZE', rationale: rationaleFor('OPTIMIZE', { deviationPct, coiIndex, coiNet, hasValue: false }) };
  }
  return { action: 'SUSTAIN', rationale: rationaleFor('SUSTAIN', { deviationPct, coiIndex, coiNet, hasValue: false }) };
}

function pctText(deviationPct: number | null): string {
  if (!isNum(deviationPct)) return 'unclear vs market';
  const mag = Math.round(Math.abs(deviationPct) * 100);
  if (mag === 0) return 'at market';
  return deviationPct < 0 ? `${mag}% under market` : `${mag}% over market`;
}

function rationaleFor(
  action: BriefAction,
  ctx: { deviationPct: number | null; coiIndex: number | null; coiNet: number | null; hasValue: boolean },
): string {
  const pos = pctText(ctx.deviationPct);
  const leaking = isNum(ctx.coiNet) && ctx.coiNet < 0;
  switch (action) {
    case 'PROTECT_INVEST':
      return ctx.hasValue
        ? `High value density and ${pos} — fund to target to protect a value engine.`
        : leaking
          ? `${capitalize(pos)} with retention leakage — close the gap before it compounds.`
          : `${capitalize(pos)} on the convex side of retention — small pay moves unlock outsized value.`;
    case 'OPTIMIZE':
      return ctx.hasValue
        ? `Low value density and ${pos} — rebalance spend toward higher-return segments.`
        : `${capitalize(pos)} with limited retention leverage — review spend efficiency.`;
    case 'SUSTAIN':
      return ctx.hasValue
        ? `High value density, paid competitively — hold position.`
        : `${capitalize(pos)} and stable — maintain current posture.`;
    case 'MONITOR':
    default:
      return ctx.hasValue
        ? `Low value density, ${pos} — watch; no immediate action.`
        : `${capitalize(pos)} but low retention leverage — monitor.`;
  }
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Run every lens on a single set of bases and index the per-segment results. */
function deriveLenses(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
  coiOpts: { horizon: number; discountRate: number; targetPercentile: number },
): Derived {
  const cost = computeTotalCost(bases, inputs, assumptions);
  const convex = computeConvexity(bases, inputs, assumptions);
  const vdRes = computeValueDensity(bases, inputs, cost);
  const frontierRes = computeFrontier(bases, inputs);
  const coiRes = computeCostOfInaction(bases, inputs, assumptions, coiOpts);

  const frontier = new Map<Level, FrontierPoint>();
  for (const p of frontierRes.points) frontier.set(p.level, p);

  const vd = new Map<Level, { quadrant: Quadrant | null; valueDensity: number | null; provenance: Provenance }>();
  for (const r of vdRes.rows) vd.set(r.level, { quadrant: r.quadrant, valueDensity: r.valueDensity, provenance: r.provenance });

  const flexByLevel = new Map<Level, { flex: number; underMarket: boolean; falseSavings: boolean }>();
  for (const c of cost) {
    const flex = (isNum(c.overtimePerHead) ? c.overtimePerHead : 0) + (isNum(c.contingentPerHead) ? c.contingentPerHead : 0);
    flexByLevel.set(c.level, { flex: flex * c.headcount, underMarket: c.underMarket, falseSavings: c.falseSavingsFlag });
  }

  return { convex, coi: coiRes.segments, frontier, vd, flexByLevel, hasValueData: vdRes.hasValue };
}

/**
 * Build the full brief model for a set of bases. Pure: feed it `ctx.baseline` or
 * `ctx.scenarioBases` and it returns the ledger + headline for that world.
 */
export function buildBriefModel(
  bases: SegmentBase[],
  inputs: ResolvedInputsByLevel,
  assumptions: GlobalAssumptions,
  targetPercentile: number,
): BriefModel {
  const coiOpts = { horizon: assumptions.coiHorizon, discountRate: assumptions.discountRate, targetPercentile };
  const d = deriveLenses(bases, inputs, assumptions, coiOpts);

  const convexByLevel = new Map<Level, ConvexityRow>();
  for (const r of d.convex) convexByLevel.set(r.level, r);
  const coiByLevel = new Map<Level, CoiSegment>();
  for (const s of d.coi) coiByLevel.set(s.level, s);

  const rows: BriefRow[] = bases.map((b) => {
    const cx = convexByLevel.get(b.level) ?? null;
    const coiSeg = coiByLevel.get(b.level) ?? null;
    const fp = d.frontier.get(b.level) ?? null;
    const vdEntry = d.vd.get(b.level) ?? { quadrant: null, valueDensity: null, provenance: 'ASSUMED' as Provenance };
    const flexEntry = d.flexByLevel.get(b.level) ?? { flex: 0, underMarket: false, falseSavings: false };

    const underMarket = isNum(b.deviationPct) && b.deviationPct < 0;

    // Σ pay-to-target reuses the budget math: (TMP − firmMedian)·headcount, only
    // when under target (a positive number = capital to deploy).
    const tmp = b.percentiles ? marketValueAtPercentile(b.percentiles, targetPercentile) : null;
    const rawPay = isNum(tmp) && isNum(b.firmMedian) ? (tmp - b.firmMedian) * b.incumbents : null;
    const payToTarget = isNum(rawPay) ? Math.max(0, rawPay) : null;

    const { action, rationale } = deriveAction({
      quadrant: vdEntry.quadrant,
      deviationPct: b.deviationPct,
      underMarket,
      coiIndex: cx?.coi ?? null,
      belowInflection: cx?.belowInflection ?? false,
      coiNet: coiSeg?.net ?? null,
    });

    const provenance = weakest(
      cx?.provenance ?? null,
      coiSeg?.provenance ?? null,
      // Only fold in the value-density basis when a quadrant could be placed.
      vdEntry.quadrant ? vdEntry.provenance : null,
    );

    return {
      level: b.level,
      label: b.label,
      headcount: b.incumbents,
      deviationPct: b.deviationPct,
      coiIndex: cx?.coi ?? null,
      belowInflection: cx?.belowInflection ?? false,
      quadrant: vdEntry.quadrant,
      valueDensity: vdEntry.valueDensity,
      frontierZone: fp?.zone ?? null,
      frontierGap: fp?.gap ?? null,
      coiNet: coiSeg?.net ?? null,
      coiLeakage: coiSeg?.totalLeakage ?? null,
      payToTarget,
      falseSavings: flexEntry.falseSavings,
      underMarket,
      action,
      rationale,
      provenance,
    };
  });

  rows.sort((a, b) => ACTION_RANK[a.action] - ACTION_RANK[b.action] || a.level.localeCompare(b.level));

  const flagged = rows.filter((r) => r.action === 'PROTECT_INVEST');

  const capitalRequired = flagged.reduce((acc, r) => acc + (isNum(r.payToTarget) ? r.payToTarget : 0), 0);
  const coiAvoided = flagged.reduce((acc, r) => acc + (isNum(r.coiLeakage) ? r.coiLeakage : 0), 0);

  // Value protected = value-at-risk × headcount × (current − target attrition),
  // already encoded per-segment as the convexity raw signal scaled to value units.
  // We use the CoI attrition-leakage component as the value protected by acting,
  // falling back to 0 when value can't be placed.
  const valueProtected = flagged.reduce((acc, r) => {
    const seg = coiByLevel.get(r.level);
    return acc + (seg && isNum(seg.attritionLeakage) ? seg.attritionLeakage : 0);
  }, 0);

  // Recoverable false savings: flexible (overtime + contingent) spend on the
  // segments the Lens-5 detector actually FLAGGED (threshold-gated), so this
  // headline matches the ledger's false-savings badges exactly.
  const falseSavingsRecoverable = rows.reduce((acc, r) => {
    if (!r.falseSavings) return acc;
    const flex = d.flexByLevel.get(r.level);
    return acc + (flex ? flex.flex : 0);
  }, 0);

  const headline: BriefHeadline = {
    capitalRequired,
    valueProtected,
    coiAvoided,
    falseSavingsRecoverable,
    flaggedCount: flagged.length,
  };

  return {
    rows,
    headline,
    hasValueData: d.hasValueData,
    provenance: weakest(...rows.map((r) => r.provenance)),
  };
}

export interface AssumptionFootnote {
  label: string;
  value: string;
  basis: Provenance;
}

/**
 * Flatten the global assumptions into a footer list, tagging each as Assumed or
 * Entered. An assumption is Entered if it has been moved off the Appendix-A
 * default; otherwise it travels as Assumed. (Per-segment value/attrition
 * provenance is summarised by the ledger's own chips.)
 */
export function assumptionFootnotes(
  assumptions: GlobalAssumptions,
  defaults: GlobalAssumptions,
): AssumptionFootnote[] {
  const basisOf = (key: keyof GlobalAssumptions): Provenance =>
    assumptions[key] === defaults[key] ? 'ASSUMED' : 'ENTERED';

  const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
  const num = (v: number): string => `${v}`;

  return [
    { label: 'Retention ceiling (Rmax)', value: pct(assumptions.retentionRmax), basis: basisOf('retentionRmax') },
    { label: 'Retention slope (k)', value: num(assumptions.retentionK), basis: basisOf('retentionK') },
    { label: 'Retention inflection (p₀)', value: `${Math.round(assumptions.retentionP0 * 100)}th pctile`, basis: basisOf('retentionP0') },
    { label: 'Productivity haircut slope', value: num(assumptions.haircutSlope), basis: basisOf('haircutSlope') },
    { label: 'Productivity haircut cap', value: pct(assumptions.haircutCap), basis: basisOf('haircutCap') },
    { label: 'Employer contribution', value: `${pct(assumptions.employerContributionPct)} × TCC`, basis: basisOf('employerContributionPct') },
    { label: 'False-savings flag threshold', value: pct(assumptions.flexibleLoadThreshold), basis: basisOf('flexibleLoadThreshold') },
    { label: 'Salary inflation', value: pct(assumptions.salaryInflation), basis: basisOf('salaryInflation') },
    { label: 'Cost-of-inaction horizon', value: `${assumptions.coiHorizon} yr`, basis: basisOf('coiHorizon') },
    { label: 'Discount rate', value: pct(assumptions.discountRate), basis: basisOf('discountRate') },
  ];
}
