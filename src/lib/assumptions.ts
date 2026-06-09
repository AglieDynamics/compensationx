/**
 * Appendix A — default assumption constants (§2B / Appendix A).
 *
 * SINGLE SOURCE OF TRUTH for every magic number in v2. Nothing is hard-coded in
 * components. All values are editable in the Assumptions panel (edits flip the
 * dependent figures' provenance to ENTERED); uploaded actuals flip to MEASURED.
 */

import { type Level, LEVELS } from '@/domain/levels';
import { type Provenance, type Valued } from '@/lib/provenance';

// --- Retention logistic (pay-percentile → retention) ---
export const RETENTION = { Rmax: 0.97, k: 8, p0: 0.35 } as const;

// --- Baseline annual voluntary attrition by level (ASSUMED) ---
export const BASELINE_ATTRITION: Record<Level, number> = {
  An: 0.22,
  As: 0.18,
  M: 0.14,
  SM: 0.1,
  Pr: 0.07,
};

// --- Replacement cost as a multiple of TCC by level (ASSUMED) ---
export const REPLACEMENT_MULTIPLE: Record<Level, number> = {
  An: 0.5,
  As: 0.75,
  M: 1.0,
  SM: 1.5,
  Pr: 2.0,
};

// --- Productivity drag from under-market gap: haircut(g) = clamp(-g*slope, 0, cap) ---
export const HAIRCUT = { slope: 0.5, cap: 0.15 } as const;

// --- Total cost ---
export const EMPLOYER_CONTRIBUTION_PCT_DEFAULT = 0.2; // × TCC (country-tunable, ASSUMED)
export const FLEXIBLE_LOAD_FLAG_THRESHOLD = 0.15; // (overtime + contingent) / TWC

// --- Time ---
export const SALARY_INFLATION = 0.06; // reuse seed meta.salaryForecastPct if present
export const COI_HORIZON_DEFAULT = 3; // years
export const DISCOUNT_RATE_DEFAULT = 0.0;

// --- Model parameters (kept here so Appendix A is the only source of magic numbers) ---
/** Convexity Opportunity Index multiplier applied to above-inflection segments. */
export const CONVEXITY_ABOVE_INFLECTION_BOOST = 0.5;
/** Pay-Productivity frontier classification band, in residual standard deviations. */
export const FRONTIER_BAND_SIGMA = 0.5;

/** Editable global assumptions (defaults from the constants above). */
export interface GlobalAssumptions {
  retentionRmax: number;
  retentionK: number;
  retentionP0: number;
  haircutSlope: number;
  haircutCap: number;
  employerContributionPct: number;
  flexibleLoadThreshold: number;
  salaryInflation: number;
  coiHorizon: number;
  discountRate: number;
  /** Years to age survey data to the as-of date: factor = (1+salaryInflation)^agingYears. */
  agingYears: number;
}

export const DEFAULT_ASSUMPTIONS: GlobalAssumptions = {
  retentionRmax: RETENTION.Rmax,
  retentionK: RETENTION.k,
  retentionP0: RETENTION.p0,
  haircutSlope: HAIRCUT.slope,
  haircutCap: HAIRCUT.cap,
  employerContributionPct: EMPLOYER_CONTRIBUTION_PCT_DEFAULT,
  flexibleLoadThreshold: FLEXIBLE_LOAD_FLAG_THRESHOLD,
  salaryInflation: SALARY_INFLATION,
  coiHorizon: COI_HORIZON_DEFAULT,
  discountRate: DISCOUNT_RATE_DEFAULT,
  agingYears: 0,
};

/** Per-segment net-new inputs the salary survey lacks (§2B). null = not provided. */
export interface SegmentInputs {
  baselineAttritionPct: number | null;
  replacementCostMultiple: number | null;
  valuePerHead: number | null;
  overtimeSpendPerHead: number | null;
  contingentCostTotal: number | null;
  employerContributionPct: number | null;
  productivityIndex: number | null;
}

export type SegmentInputKey = keyof SegmentInputs;

/** Default (ASSUMED) per-segment inputs by level. `valuePerHead`/`productivityIndex` have no default. */
export function defaultSegmentInputs(level: Level): SegmentInputs {
  return {
    baselineAttritionPct: BASELINE_ATTRITION[level],
    replacementCostMultiple: REPLACEMENT_MULTIPLE[level],
    valuePerHead: null,
    overtimeSpendPerHead: 0,
    contingentCostTotal: 0,
    employerContributionPct: EMPLOYER_CONTRIBUTION_PCT_DEFAULT,
    productivityIndex: null,
  };
}

/** Metadata for the manual-entry grid, templates and tooltips. */
export interface InputMeta {
  key: SegmentInputKey;
  label: string;
  unit: string;
  /** 'attrition' | 'value' | 'cost' — drives which CSV template carries it. */
  template: 'attrition' | 'value' | 'cost';
  hint: string;
  /** Whether the default is a real number (ASSUMED) or absent (null). */
  hasDefault: boolean;
}

export const INPUT_META: InputMeta[] = [
  { key: 'baselineAttritionPct', label: 'Baseline attrition', unit: '% / yr', template: 'attrition', hint: 'Annual voluntary attrition at market-median pay.', hasDefault: true },
  { key: 'replacementCostMultiple', label: 'Replacement cost', unit: '× TCC', template: 'attrition', hint: 'Cost to replace a regrettable exit, as a multiple of TCC.', hasDefault: true },
  { key: 'valuePerHead', label: 'Value per head', unit: 'GND k / yr', template: 'value', hint: 'Revenue / margin / output per head per year.', hasDefault: false },
  { key: 'productivityIndex', label: 'Productivity index', unit: '0–2 (1=expected)', template: 'value', hint: 'Optional explicit productivity; derived from the frontier if absent.', hasDefault: false },
  { key: 'overtimeSpendPerHead', label: 'Overtime spend', unit: 'GND k / yr', template: 'cost', hint: 'Actual overtime spend per head per year.', hasDefault: true },
  { key: 'contingentCostTotal', label: 'Contingent cost', unit: 'GND k / yr', template: 'cost', hint: 'Contractor / contingent spend for the segment (total).', hasDefault: true },
  { key: 'employerContributionPct', label: 'Employer contribution', unit: '× TCC', template: 'cost', hint: 'Benefits / employer contribution as a fraction of TCC.', hasDefault: true },
];

/** Illustrative value-per-head set (GND k/yr) so Lenses 2 & 3 can be explored. Tagged ASSUMED. */
export const ILLUSTRATIVE_VALUE_PER_HEAD: Record<Level, number> = {
  An: 180,
  As: 320,
  M: 540,
  SM: 760,
  Pr: 1150,
};

/**
 * Illustrative flexible-cost set (overtime per head, contingent total) for Lens 5
 * demos. Loaded high on the under-market levels (M, SM) so the false-savings
 * detector demonstrably fires: underinvested base, cost reappearing as overtime /
 * contractors.
 */
export const ILLUSTRATIVE_FLEX_COST: Record<Level, { overtimePerHead: number; contingentTotal: number }> = {
  An: { overtimePerHead: 4, contingentTotal: 800 },
  As: { overtimePerHead: 5, contingentTotal: 1200 },
  M: { overtimePerHead: 16, contingentTotal: 2000 },
  SM: { overtimePerHead: 12, contingentTotal: 1000 },
  Pr: { overtimePerHead: 0, contingentTotal: 0 },
};

export const ALL_LEVELS: readonly Level[] = LEVELS;

// ----------------------------------------------------------------------------
// Resolution: overrides + defaults + assumptions → Valued inputs (with provenance)
// ----------------------------------------------------------------------------

export interface ResolvedInputs {
  baselineAttritionPct: Valued<number>;
  replacementCostMultiple: Valued<number>;
  valuePerHead: Valued<number> | null;
  overtimeSpendPerHead: Valued<number>;
  contingentCostTotal: Valued<number>;
  employerContributionPct: Valued<number>;
  productivityIndex: Valued<number> | null;
}

export type ResolvedInputsByLevel = Record<Level, ResolvedInputs>;

const v = (value: number, provenance: Provenance): Valued<number> => ({ value, provenance });

/**
 * Resolve one segment's effective inputs from user overrides, per-level defaults
 * and the global assumptions. Each value carries its provenance:
 *   override present  → ENTERED / MEASURED (whatever was recorded)
 *   from a default     → ASSUMED
 *   employer-contribution falls back to the (possibly-edited) global assumption.
 * `valuePerHead` / `productivityIndex` have no default → null when not provided.
 */
export function resolveSegmentInputs(
  level: Level,
  overrides: Partial<SegmentInputs> | undefined,
  prov: Partial<Record<SegmentInputKey, Provenance>> | undefined,
  assumptions: GlobalAssumptions,
): ResolvedInputs {
  const o = overrides ?? {};
  const p = prov ?? {};
  const ov = (key: SegmentInputKey): number | null | undefined => o[key];

  const numeric = (key: SegmentInputKey, fallback: number, fallbackProv: Provenance): Valued<number> => {
    const val = ov(key);
    return typeof val === 'number' && Number.isFinite(val)
      ? v(val, p[key] ?? 'ENTERED')
      : v(fallback, fallbackProv);
  };

  const optional = (key: SegmentInputKey): Valued<number> | null => {
    const val = ov(key);
    return typeof val === 'number' && Number.isFinite(val) ? v(val, p[key] ?? 'ENTERED') : null;
  };

  const empDefault = assumptions.employerContributionPct;
  const empProv: Provenance = empDefault === DEFAULT_ASSUMPTIONS.employerContributionPct ? 'ASSUMED' : 'ENTERED';

  return {
    baselineAttritionPct: numeric('baselineAttritionPct', BASELINE_ATTRITION[level], 'ASSUMED'),
    replacementCostMultiple: numeric('replacementCostMultiple', REPLACEMENT_MULTIPLE[level], 'ASSUMED'),
    valuePerHead: optional('valuePerHead'),
    overtimeSpendPerHead: numeric('overtimeSpendPerHead', 0, 'ASSUMED'),
    contingentCostTotal: numeric('contingentCostTotal', 0, 'ASSUMED'),
    employerContributionPct: numeric('employerContributionPct', empDefault, empProv),
    productivityIndex: optional('productivityIndex'),
  };
}

// ----------------------------------------------------------------------------
// v3 — Appendix B constants (single source of truth; nothing hard-coded in UI)
// ----------------------------------------------------------------------------

export const PRICING = {
  policyTargetCompa: 0.95, // Target = midpoint × this
  compaPolicyBand: [0.9, 1.1] as const, // outside → equity flag / approval
  equityTolerancePct: 0.05, // peer comparison tolerance
  defaultRangeSpread: 0.5, // S
  matchPercentile: 0.5, // "match" posture
} as const;

export const STRUCTURE = {
  fixedProgressionStep: 0.18, // midpoint progression p
  overlapExcessiveThreshold: 0.5,
  compressionThresholdPct: 0.05, // manager vs subordinate-median
  policyMidpointCompa: 0.95, // cost-to-policy-midpoint posture
  greenCirclePenaltyFactor: 10, // structure-debt penalty per green-circle, × salary inflation
} as const;

/** Range/Market Confidence Index sub-score weights (sum = 1.0). */
export const CONFIDENCE_WEIGHTS = {
  dataFreshness: 0.3,
  providerAgreement: 0.2,
  benchmarkMatch: 0.3,
  architectureStability: 0.2,
} as const;

export const CONFIDENCE_DEFAULTS = {
  dataFreshness: 0.85,
  providerAgreement: 1.0, // single provider
  benchmarkMatch: 0.8, // when JobArchitecture confidence absent
  architectureStability: 0.9,
} as const;

/** Recommendation scorecard weights (normalized sub-scores 0..1; sum = 1.0). */
export const RECO_WEIGHTS = {
  externalGapSeverity: 0.2,
  internalEquityRisk: 0.15,
  performanceCriticality: 0.15,
  attritionRisk: 0.2,
  replacementDifficulty: 0.1,
  revenueSensitivity: 0.1,
  costToCorrectInverse: 0.05,
  productivityUpside: 0.05,
} as const;

/** Geographic pay differentials (× market reference). */
export const GEO_DIFFERENTIAL: Record<string, number> = { HQ: 1.0, Regional: 0.92 };
/** Job-family pay differentials (× market reference). Single-LOB survey ⇒ all 1.0 by default. */
export const FAMILY_DIFFERENTIAL: Record<string, number> = {
  Strategy: 1.0,
  Operations: 1.0,
  Technology: 1.0,
  Risk: 1.0,
};

export const GEOGRAPHIES: readonly string[] = ['HQ', 'Regional'];
export const JOB_FAMILIES: readonly string[] = ['Strategy', 'Operations', 'Technology', 'Risk'];

/** Replacement difficulty by level (0..1) for the recommendation scorecard. */
export const REPLACEMENT_DIFFICULTY: Record<Level, number> = {
  An: 0.25,
  As: 0.4,
  M: 0.6,
  SM: 0.8,
  Pr: 0.95,
};

/** Grade band per career level (Appendix D). */
export const LEVEL_TO_GRADE: Record<Level, string> = { An: 'G2', As: 'G3', M: 'G4', SM: 'G5', Pr: 'G6' };
