/**
 * v3 internal data layer (§2) — Employee records + Job Architecture.
 * Wires to the existing Segment dimension (level × unit × geography).
 */

import type { Valued } from '@/lib/provenance';
import type { Level } from './levels';

export interface JobArchitecture {
  id: string;
  jobFamily: string;
  subFamily?: string;
  level: Level;
  grade: string; // internal grade (distinct from career level)
  geography: string;
  jobEvaluationPoints?: number;
  benchmarkJobCode?: string;
  /** 0..1 match quality to the survey benchmark (reuses v2 provenance). */
  benchmarkMatchConfidence: Valued<number>;
}

export type PerformanceRating = 1 | 2 | 3 | 4 | 5;

export interface Employee {
  id: string;
  displayName: string; // anonymizable ("EMP-0001")
  jobFamily: string;
  level: Level;
  grade: string;
  geography: string;
  businessUnit: string;
  basePay: number; // GND k / yr
  bonusTarget?: number; // GND k / yr
  allowances?: number;
  fte: number;
  managerId?: string;
  performanceRating?: PerformanceRating;
  tenureYears?: number;
  hireDate?: string;
  isContingent?: boolean;
  skillPremiumFlag?: boolean;
}

export interface EmployeeDataset {
  employees: Employee[];
  jobArchitecture: JobArchitecture[];
  meta: {
    generatedFrom: string;
    count: number;
    provenance: 'ASSUMED' | 'MEASURED';
    seed?: string;
  };
}

/** Direct cash compensation for an employee (base + bonus + allowances). */
export function directComp(e: Employee): number {
  return e.basePay + (e.bonusTarget ?? 0) + (e.allowances ?? 0);
}

/** Bonus-target % of base by level (ASSUMED — survey bonus% not in the seed). */
export const BONUS_PCT_BY_LEVEL: Record<Level, number> = {
  An: 0.08,
  As: 0.12,
  M: 0.18,
  SM: 0.25,
  Pr: 0.35,
};
