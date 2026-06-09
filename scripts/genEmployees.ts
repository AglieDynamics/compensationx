/**
 * `npm run gen:employees` — deterministic synthetic employee seed (Appendix D).
 *
 * Fixed-seed mulberry32 PRNG → 551 employees consistent with the Greenland firm
 * distribution (An 210 / As 174 / M 87 / SM 67 / Pr 13), across 4 job families and
 * 2 geographies, pay drawn around the firm-weighted TARGET Basic Salary medians.
 * Output committed to src/data/employees.json. Provenance = ASSUMED (synthetic).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, type Level } from '@/domain/levels';
import {
  BONUS_PCT_BY_LEVEL,
  type Employee,
  type EmployeeDataset,
  type JobArchitecture,
  type PerformanceRating,
} from '@/domain/employee';
import { JOB_FAMILIES, LEVEL_TO_GRADE } from '@/lib/assumptions';
import { FIRM_MEDIAN } from '@/data/__fixtures__/basicSalaryFirmTarget.fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'src/data/employees.json');

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNTS: Record<Level, number> = { An: 210, As: 174, M: 87, SM: 67, Pr: 13 };
// Aggregate firm-median per level (fixture indices: An=3, As=7, M=11, SM=15, Pr=19).
const LEVEL_CENTER: Record<Level, number> = {
  An: FIRM_MEDIAN[3]!,
  As: FIRM_MEDIAN[7]!,
  M: FIRM_MEDIAN[11]!,
  SM: FIRM_MEDIAN[15]!,
  Pr: FIRM_MEDIAN[19]!,
};
const BUSINESS_UNITS = ['Advisory', 'Delivery', 'Platform'];

function pickPerformance(r: number): PerformanceRating {
  // {5:10%, 4:25%, 3:45%, 2:15%, 1:5%}
  if (r < 0.1) return 5;
  if (r < 0.35) return 4;
  if (r < 0.8) return 3;
  if (r < 0.95) return 2;
  return 1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function main(): void {
  const rng = mulberry32(0xc0ffee);
  const employees: Employee[] = [];
  const byFamilyLevel = new Map<string, string[]>(); // `${family}:${level}` → ids
  let n = 0;

  for (const level of LEVELS) {
    const count = COUNTS[level];
    const center = LEVEL_CENTER[level];
    for (let i = 0; i < count; i++) {
      n += 1;
      const id = `EMP-${String(n).padStart(4, '0')}`;
      const family = JOB_FAMILIES[n % JOB_FAMILIES.length]!;
      const geography = rng() < 0.7 ? 'HQ' : 'Regional';
      const businessUnit = BUSINESS_UNITS[n % BUSINESS_UNITS.length]!;
      const jitter = (rng() * 2 - 1) * 0.12; // ±12%
      const basePay = round2(center * (1 + jitter));
      const bonusTarget = round2(basePay * BONUS_PCT_BY_LEVEL[level]);
      const performanceRating = pickPerformance(rng());
      const tenureYears = Math.floor(rng() * 20);
      const skillPremiumFlag = rng() < 0.1;

      employees.push({
        id,
        displayName: id,
        jobFamily: family,
        level,
        grade: LEVEL_TO_GRADE[level],
        geography,
        businessUnit,
        basePay,
        bonusTarget,
        fte: 1,
        performanceRating,
        tenureYears,
        skillPremiumFlag,
      });

      const key = `${family}:${level}`;
      const list = byFamilyLevel.get(key) ?? [];
      list.push(id);
      byFamilyLevel.set(key, list);
    }
  }

  // Second pass: link each employee to a manager one level up in the same family.
  const levelUp: Partial<Record<Level, Level>> = { An: 'As', As: 'M', M: 'SM', SM: 'Pr' };
  for (const emp of employees) {
    const up = levelUp[emp.level];
    if (!up) continue;
    const managers = byFamilyLevel.get(`${emp.jobFamily}:${up}`);
    if (managers && managers.length > 0) {
      emp.managerId = managers[Math.floor(rng() * managers.length)];
    }
  }

  const jobArchitecture: JobArchitecture[] = [];
  for (const family of JOB_FAMILIES) {
    for (const level of LEVELS) {
      jobArchitecture.push({
        id: `JA-${family}-${level}`,
        jobFamily: family,
        level,
        grade: LEVEL_TO_GRADE[level],
        geography: 'HQ',
        benchmarkMatchConfidence: { value: 0.8, provenance: 'ASSUMED' },
      });
    }
  }

  const dataset: EmployeeDataset = {
    employees,
    jobArchitecture,
    meta: { generatedFrom: 'synthetic-mulberry32', count: employees.length, provenance: 'ASSUMED', seed: '0xC0FFEE' },
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  const dist = LEVELS.map((l) => `${l} ${employees.filter((e) => e.level === l).length}`).join(' / ');
  process.stdout.write(`✓ Wrote ${OUTPUT}\n  ${employees.length} employees (${dist})\n  ${jobArchitecture.length} job-architecture rows\n`);
}

main();
