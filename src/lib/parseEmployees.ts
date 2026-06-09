/**
 * Employee CSV/XLSX parsing (§2 mechanism 3). Auto-detects columns by header,
 * maps levels by code/name, reports warnings, fails soft.
 */

import * as XLSX from 'xlsx';
import { type Level } from '@/domain/levels';
import type { Employee, PerformanceRating } from '@/domain/employee';
import { LEVEL_TO_GRADE } from '@/lib/assumptions';

type Cell = string | number | boolean | null | undefined;
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const LEVEL_ALIASES: Record<string, Level> = {
  an: 'An', analyst: 'An',
  as: 'As', associate: 'As',
  m: 'M', manager: 'M',
  sm: 'SM', srmanager: 'SM', seniormanager: 'SM',
  pr: 'Pr', principal: 'Pr',
};

const FIELD: Record<string, keyof Employee> = {
  id: 'id',
  displayname: 'displayName',
  name: 'displayName',
  jobfamily: 'jobFamily',
  family: 'jobFamily',
  level: 'level',
  grade: 'grade',
  geography: 'geography',
  geo: 'geography',
  businessunit: 'businessUnit',
  bu: 'businessUnit',
  basepay: 'basePay',
  base: 'basePay',
  bonustarget: 'bonusTarget',
  bonus: 'bonusTarget',
  allowances: 'allowances',
  fte: 'fte',
  managerid: 'managerId',
  performancerating: 'performanceRating',
  performance: 'performanceRating',
  tenureyears: 'tenureYears',
  tenure: 'tenureYears',
};

export interface EmployeeParseResult {
  employees: Employee[];
  warnings: string[];
  count: number;
}

function toLevel(raw: Cell): Level | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  return LEVEL_ALIASES[norm(String(raw))] ?? null;
}
function toNum(raw: Cell): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseEmployeesData(data: ArrayBuffer | Uint8Array): EmployeeParseResult {
  const warnings: string[] = [];
  let aoa: Cell[][] = [];
  try {
    const wb = XLSX.read(data, { type: 'array' });
    const first = wb.SheetNames[0];
    const ws = first ? wb.Sheets[first] : undefined;
    if (ws) aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Cell[][];
  } catch {
    return { employees: [], warnings: ['Could not read the file.'], count: 0 };
  }

  const header = aoa[0];
  if (!header) return { employees: [], warnings: ['No header row.'], count: 0 };

  const colMap = new Map<keyof Employee, number>();
  header.forEach((h, i) => {
    if (typeof h !== 'string') return;
    const key = FIELD[norm(h)];
    if (key && !colMap.has(key)) colMap.set(key, i);
  });

  if (!colMap.has('level') || !colMap.has('basePay')) {
    warnings.push('Required columns Level and BasePay not found.');
    return { employees: [], warnings, count: 0 };
  }

  const employees: Employee[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const level = toLevel(row[colMap.get('level')!]);
    const basePay = toNum(row[colMap.get('basePay')!]);
    if (!level || basePay === null) continue;

    const get = (k: keyof Employee): Cell => {
      const i = colMap.get(k);
      return i == null ? null : row[i];
    };
    const str = (k: keyof Employee, fallback: string): string => {
      const v = get(k);
      return typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : fallback;
    };
    const id = str('id', `EMP-${String(employees.length + 1).padStart(4, '0')}`);
    const perfRaw = toNum(get('performanceRating'));
    const performanceRating = perfRaw && perfRaw >= 1 && perfRaw <= 5 ? (Math.round(perfRaw) as PerformanceRating) : undefined;

    employees.push({
      id,
      displayName: str('displayName', id),
      jobFamily: str('jobFamily', 'Strategy'),
      level,
      grade: str('grade', LEVEL_TO_GRADE[level]),
      geography: str('geography', 'HQ'),
      businessUnit: str('businessUnit', 'Advisory'),
      basePay,
      bonusTarget: toNum(get('bonusTarget')) ?? undefined,
      allowances: toNum(get('allowances')) ?? undefined,
      fte: toNum(get('fte')) ?? 1,
      managerId: typeof get('managerId') === 'string' ? (get('managerId') as string) : undefined,
      performanceRating,
      tenureYears: toNum(get('tenureYears')) ?? undefined,
    });
  }

  if (employees.length === 0) warnings.push('No employee rows parsed.');
  return { employees, warnings, count: employees.length };
}

export function employeeTemplateCsv(): string {
  const header = ['Id', 'DisplayName', 'JobFamily', 'Level', 'Grade', 'Geography', 'BusinessUnit', 'BasePay', 'BonusTarget', 'Fte', 'PerformanceRating', 'TenureYears'];
  const sample = ['EMP-0001', 'EMP-0001', 'Strategy', 'M', 'G4', 'HQ', 'Advisory', '82', '14.8', '1', '3', '5'];
  return [header.join(','), sample.join(',')].join('\n');
}
