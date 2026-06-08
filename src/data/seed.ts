/**
 * Seed (Greenland) dataset assembler.
 *
 * Pure TypeScript so it can be used by:
 *   - the app as a guaranteed-valid runtime fallback,
 *   - `scripts/ingest.ts` as the no-workbook fallback that emits greenland.json,
 *   - tests as an oracle.
 *
 * Only Basic Salary / FIRM / TARGET is real (Appendix A). The prior-year (ACTUAL)
 * Basic Salary table is *derived* from the published YoY medians (and tagged as
 * such) so the Executive Summary is fully functional from the seed alone. Every
 * other (weighting × period × component) combo is absent and shows an empty-state
 * until a real workbook is ingested.
 */

import { type Level, levelOf } from '@/domain/levels';
import type {
  ComponentTable,
  Dataset,
  FirmStats,
  GrowthReference,
  IncumbentDistribution,
  MarketStats,
  ReportScope,
  SubLevelData,
  YoYReference,
} from '@/domain/types';
import { CAREER_ISSUES_SEED } from './careerIssues.seed';
import {
  buildBasicSalaryFirmTargetTable,
  FIRM_INCUMBENTS_AGG,
  MARKET_INCUMBENTS_AGG,
} from './__fixtures__/basicSalaryFirmTarget.fixture';

export const SEED_META: ReportScope = {
  country: 'Greenland',
  currency: 'GND',
  reportYear: 2025,
  participatingFirms: 19,
  marketIncumbents: 5067,
  yourFirmIncumbents: 551,
  targetMarketPercentile: 0.5,
  dataGatheredUpTo: '2025-12-31',
  fxRateDate: '2025-09-30',
  salaryForecastPct: 0.06,
  costOfLivingVsReference: 0.65,
  easeOfDoingBusinessRank: '30 / 199',
  yourFirmName: 'Your Firm',
};

/** Published YoY median % change (§6 Module 3). Tagged illustrative — sourced from the brief. */
const YOY_BASIC: Record<Level, number> = { An: 0.087, As: 0.082, M: 0.068, SM: 0.071, Pr: 0.074 };
const YOY_TCC: Record<Level, number> = { An: 0.112, As: 0.1, M: 0.09, SM: 0.085, Pr: 0.08 };

export const SEED_YOY: YoYReference = {
  illustrative: true,
  byComponent: {
    BASIC_SALARY: { ...YOY_BASIC },
    TCC: { ...YOY_TCC },
  },
};

/** Published growth factors that can't be computed from the seed (TCC not present). */
export const SEED_GROWTH: GrowthReference = {
  byKey: {
    'FIRM:TARGET:TCC': { value: 4.2, illustrative: true },
    'FIRM:ACTUAL:TCC': { value: 4.2, illustrative: true },
  },
};

export const SEED_DISTRIBUTION: IncumbentDistribution = {
  firm: { ...FIRM_INCUMBENTS_AGG },
  market: { ...MARKET_INCUMBENTS_AGG },
};

function scaleStat(v: number | null, factor: number): number | null {
  return v === null ? null : Math.round(v * factor * 100) / 100;
}

function scaleFirm(s: FirmStats, factor: number): FirmStats {
  return {
    incumbents: s.incumbents ?? null,
    max: scaleStat(s.max, factor),
    mean: scaleStat(s.mean, factor),
    midpoint: scaleStat(s.midpoint, factor),
    median: scaleStat(s.median, factor),
    min: scaleStat(s.min, factor),
  };
}

function scaleMarket(s: MarketStats, factor: number): MarketStats {
  return {
    firms: s.firms,
    incumbents: s.incumbents ?? null,
    max: scaleStat(s.max, factor),
    mean: scaleStat(s.mean, factor),
    midpoint: scaleStat(s.midpoint, factor),
    median: scaleStat(s.median, factor),
    min: scaleStat(s.min, factor),
  };
}

/**
 * Derive a prior-year (ACTUAL) table by deflating each sublevel by its level's
 * published YoY median growth. The result reproduces the published YoY % exactly.
 */
function deriveActualByYoY(target: ComponentTable, yoy: Record<Level, number>): ComponentTable {
  const rows: Partial<Record<string, SubLevelData>> = {};
  for (const row of Object.values(target.rows)) {
    if (!row) continue;
    const level = row.subLevel === 'Overall' ? null : (levelOf(row.subLevel) as Level | null);
    const pct = level ? yoy[level] : 0;
    const factor = 1 / (1 + pct);
    const percentiles: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(row.percentiles)) {
      percentiles[k] = scaleStat(v, factor);
    }
    rows[row.subLevel] = {
      subLevel: row.subLevel,
      firm: scaleFirm(row.firm, factor),
      market: scaleMarket(row.market, factor),
      percentiles,
    };
  }
  return {
    weighting: target.weighting,
    period: 'ACTUAL',
    component: target.component,
    unit: target.unit,
    rows: rows as ComponentTable['rows'],
    derived: true,
    note: 'Illustrative — derived from published YoY medians. Ingest the source workbook for reported prior-year data.',
  };
}

/** Build the complete seed (Greenland) Dataset. */
export function buildSeedDataset(): Dataset {
  const basicFirmTarget = buildBasicSalaryFirmTargetTable();
  const basicFirmActual = deriveActualByYoY(basicFirmTarget, YOY_BASIC);

  return {
    meta: SEED_META,
    tables: [basicFirmTarget, basicFirmActual],
    distribution: SEED_DISTRIBUTION,
    yoy: SEED_YOY,
    growth: SEED_GROWTH,
    careerIssues: CAREER_ISSUES_SEED,
  };
}
