/**
 * Appendix A — REAL Greenland data: Basic Salary, FIRM-weighted, TARGET (2025).
 *
 * This is the canonical oracle for the whole platform:
 *   - it builds the initial `greenland.json` (via the seed builder),
 *   - it is the ingest fallback when no source workbook is present, and
 *   - it is the test oracle that pins the §5 acceptance numbers.
 *
 * Sublevel order (20):
 *   [An1,An2,An3,An, As1,As2,As3,As, M1,M2,M3,M, SM1,SM2,SM3,SM, Pr1,Pr2,Pr3,Pr]
 */

import { isAggregate, SUBLEVELS_20, type Level, type SubLevel } from '@/domain/levels';
import { percentileKey, PERCENTILES, type ComponentTable, type SubLevelData } from '@/domain/types';

/** Aggregate incumbents (§ Appendix A). */
export const FIRM_INCUMBENTS_AGG: Record<Level, number> = { An: 210, As: 174, M: 87, SM: 67, Pr: 13 };
export const MARKET_INCUMBENTS_AGG: Record<Level, number> = {
  An: 1477,
  As: 1974,
  M: 1005,
  SM: 446,
  Pr: 165,
};

export const MARKET_FIRMS = 19;

// --- Your Firm statistics (20 values, sublevel order) ---
export const FIRM_MAX = [
  55.07, 82.2, 84.94, 84.94, 86.18, 91.03, 93.08, 93.08, 88.11, 105.15, 108.25, 108.25, 119.36,
  129.65, 139.88, 139.88, 160, 169, 172, 172,
];
export const FIRM_MEAN = [
  45.24, 62.93, 75.68, 58.73, 65.79, 73.08, 73.34, 70.65, 73.51, 78.44, 77.94, 76.63, 91.39,
  105.26, 117.94, 105.25, 154.64, 167, 170.4, 164.5,
];
export const FIRM_MIDPOINT = [
  44.27, 59.49, 69.43, 59.21, 65.9, 71.29, 72.98, 69.36, 71.04, 79.85, 83.77, 81.11, 91.72, 109.98,
  122.44, 101.98, 155.78, 167, 171, 161.78,
];
export const FIRM_MEDIAN = [
  45.75, 62.42, 76.73, 57.78, 65.75, 72.49, 73.25, 71.03, 74.28, 76.7, 78.95, 77.11, 92.44, 105.94,
  117.78, 106.14, 153.5, 167, 170, 168,
];
export const FIRM_MIN = [
  33.47, 36.79, 53.91, 33.47, 45.63, 51.55, 52.88, 45.63, 53.97, 54.55, 59.29, 53.97, 64.08, 90.32,
  105.0, 64.08, 151.55, 165, 170, 151.55,
];

// --- Market statistics (20 values, sublevel order) ---
export const MARKET_MAX = [
  59.07, 62.39, 65.36, 65.36, 75.88, 81.64, 90.59, 89.07, 94.77, 105.52, 113.93, 105.45, 127.16,
  135.88, 146.58, 141.35, 168.77, 176.11, 195.35, 183.23,
];
export const MARKET_MEAN = [
  44.91, 48.42, 52.02, 48.68, 60.65, 65.13, 70.8, 66.22, 81.74, 88.43, 94.73, 88.24, 107.84, 114.63,
  123.14, 115.35, 144.46, 153.3, 166.98, 154.96,
];
export const MARKET_MIDPOINT = [
  46.8, 49.64, 52.91, 49.62, 61.14, 64.89, 72.49, 67.74, 78.45, 86.01, 92.68, 83.79, 103.21, 110.7,
  119.6, 109.7, 143.11, 151.3, 169.04, 151.85,
];
export const MARKET_MEDIAN = [
  44.32, 47.73, 50.65, 47.62, 59.13, 65.11, 69.29, 65.79, 82.56, 87.36, 93.59, 86.69, 109.39, 117.67,
  125.67, 116.03, 149.52, 158.26, 170.73, 156.17,
];
export const MARKET_MIN = [
  34.54, 36.89, 40.47, 33.88, 46.41, 48.14, 54.39, 46.41, 62.14, 66.5, 71.43, 62.14, 79.25, 85.52,
  92.62, 78.06, 117.45, 126.5, 142.74, 120.46,
];

/** Market percentile matrix — keyed by percentile, each 20 values (sublevel order). */
export const MARKET_PERCENTILE_MATRIX: Record<string, number[]> = {
  '0.95': [
    59.07, 62.39, 65.36, 65.36, 75.88, 81.64, 90.59, 89.07, 94.77, 105.52, 113.93, 105.45, 127.16,
    135.88, 146.58, 141.35, 168.77, 176.11, 195.35, 183.23,
  ],
  '0.90': [
    53.08, 58.6, 64.37, 61.95, 67.89, 75.28, 86.09, 82.0, 94.28, 101.98, 105.52, 104.0, 120.85,
    127.27, 142.65, 137.13, 166.56, 171.25, 182.95, 175.78,
  ],
  '0.85': [
    49.24, 51.99, 56.63, 56.16, 66.98, 72.65, 75.92, 75.8, 90.83, 100.36, 104.9, 102.83, 116.56,
    127.1, 137.97, 131.4, 165.78, 168.95, 182.22, 173.62,
  ],
  '0.80': [
    47.27, 50.8, 56.16, 52.33, 66.46, 70.7, 75.91, 72.17, 87.2, 98.98, 103.12, 100.49, 116.26,
    126.14, 136.09, 127.71, 159.63, 168.35, 179.38, 171.25,
  ],
  '0.75': [
    46.59, 50.16, 54.55, 51.05, 65.45, 69.27, 75.82, 71.61, 86.54, 96.12, 102.94, 96.2, 116.03,
    122.67, 133.42, 125.78, 157.04, 168.26, 175.89, 169.55,
  ],
  '0.70': [
    46.2, 49.65, 53.23, 50.73, 64.12, 68.33, 75.15, 69.56, 85.86, 93.24, 101.0, 93.28, 115.34,
    122.26, 131.31, 124.3, 155.42, 166.51, 174.81, 167.71,
  ],
  '0.65': [
    45.86, 48.85, 52.58, 50.44, 63.09, 68.15, 73.65, 68.84, 84.59, 92.71, 99.78, 91.81, 114.67,
    121.65, 128.83, 122.11, 152.79, 161.36, 174.51, 164.15,
  ],
  '0.60': [
    44.83, 48.49, 51.9, 49.89, 61.35, 66.9, 71.68, 67.78, 83.48, 90.28, 97.12, 90.03, 112.48,
    120.21, 126.56, 121.3, 152.29, 159.51, 173.6, 159.74,
  ],
  '0.55': [
    44.55, 48.0, 51.25, 49.15, 60.72, 65.82, 70.14, 66.83, 83.08, 88.91, 95.21, 89.22, 110.66, 118.4,
    125.78, 117.44, 151.84, 159.13, 171.41, 158.6,
  ],
  '0.50': [
    44.32, 47.73, 50.65, 47.62, 59.13, 65.11, 69.29, 65.79, 82.56, 87.36, 93.59, 86.69, 109.39,
    117.67, 125.67, 116.03, 149.52, 158.26, 170.73, 156.17,
  ],
  '0.45': [
    43.95, 46.88, 50.6, 46.9, 58.94, 63.84, 69.1, 64.79, 81.72, 86.89, 91.72, 85.86, 108.21, 117.17,
    124.09, 115.34, 149.34, 156.85, 169.17, 152.31,
  ],
  '0.40': [
    43.8, 46.59, 50.27, 46.51, 58.2, 62.89, 68.36, 64.14, 80.81, 85.48, 90.67, 83.57, 106.66, 115.56,
    123.67, 111.83, 137.89, 152.44, 160.19, 151.29,
  ],
  '0.35': [
    43.68, 46.3, 49.87, 45.87, 57.4, 62.13, 67.63, 61.88, 80.27, 84.65, 89.88, 83.08, 106.09, 112.26,
    121.34, 109.39, 135.08, 148.93, 159.9, 148.94,
  ],
  '0.30': [
    43.05, 45.73, 49.7, 44.45, 57.06, 61.0, 65.6, 59.83, 79.03, 83.7, 89.44, 82.59, 105.62, 110.89,
    116.45, 108.08, 130.15, 139.01, 154.37, 147.42,
  ],
  '0.25': [
    42.4, 45.29, 49.39, 43.79, 56.87, 59.68, 65.17, 58.97, 77.57, 82.72, 88.55, 80.63, 104.44,
    108.94, 115.33, 106.05, 128.0, 136.96, 151.88, 143.31,
  ],
  '0.20': [
    41.24, 44.57, 48.72, 43.2, 56.34, 58.4, 64.78, 58.49, 77.05, 81.11, 87.31, 78.93, 97.93, 103.29,
    107.15, 103.42, 124.75, 135.0, 148.94, 138.09,
  ],
  '0.15': [
    40.71, 44.31, 47.38, 42.78, 55.55, 58.27, 64.15, 56.9, 72.72, 80.2, 83.82, 77.07, 94.64, 98.24,
    104.54, 99.84, 124.16, 130.72, 148.42, 132.23,
  ],
  '0.10': [
    40.21, 43.47, 45.2, 40.89, 54.96, 57.29, 61.91, 55.53, 70.4, 77.31, 79.36, 75.27, 87.27, 93.73,
    98.54, 92.67, 119.55, 130.0, 146.55, 128.35,
  ],
  '0.05': [
    34.54, 36.89, 40.47, 33.88, 46.41, 48.14, 54.39, 46.41, 62.14, 66.5, 71.43, 62.14, 79.25, 85.52,
    92.62, 78.06, 117.45, 126.5, 142.74, 120.46,
  ],
};

/** Strict array access — the fixture is known-complete, so undefined is a programmer error. */
function at(arr: readonly number[], i: number): number {
  const v = arr[i];
  if (v === undefined) throw new Error(`fixture: missing value at index ${i}`);
  return v;
}

/** Build the canonical Basic Salary / FIRM / TARGET ComponentTable from the raw arrays. */
export function buildBasicSalaryFirmTargetTable(): ComponentTable {
  const rows: Partial<Record<SubLevel, SubLevelData>> = {};

  SUBLEVELS_20.forEach((sl, i) => {
    const agg = isAggregate(sl);
    const level = agg ? (sl as Level) : null;

    const percentiles: Record<string, number | null> = {};
    for (const p of PERCENTILES) {
      const key = percentileKey(p);
      const col = MARKET_PERCENTILE_MATRIX[key];
      percentiles[key] = col ? at(col, i) : null;
    }

    rows[sl] = {
      subLevel: sl,
      firm: {
        incumbents: level ? FIRM_INCUMBENTS_AGG[level] : null,
        max: at(FIRM_MAX, i),
        mean: at(FIRM_MEAN, i),
        midpoint: at(FIRM_MIDPOINT, i),
        median: at(FIRM_MEDIAN, i),
        min: at(FIRM_MIN, i),
      },
      market: {
        firms: MARKET_FIRMS,
        incumbents: level ? MARKET_INCUMBENTS_AGG[level] : null,
        max: at(MARKET_MAX, i),
        mean: at(MARKET_MEAN, i),
        midpoint: at(MARKET_MIDPOINT, i),
        median: at(MARKET_MEDIAN, i),
        min: at(MARKET_MIN, i),
      },
      percentiles,
    };
  });

  return {
    weighting: 'FIRM',
    period: 'TARGET',
    component: 'BASIC_SALARY',
    unit: 'GND_K',
    rows,
  };
}

/** Oracle values pinned by the §5 / §10 acceptance tests. */
export const ORACLE = {
  an1: {
    marketMedian: 44.32,
    market75: 46.59,
    market95: 59.07,
    market5: 34.54,
    firmMedian: 45.75,
    compaRatioAt50: 1.03,
    percentilePositionAt50: 0.65,
  },
  budgetAt50: { total: -1704, perHead: -3.09 },
  growthFactor: 3.6,
} as const;
