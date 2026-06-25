/**
 * `npm run convert:employees` — adapt a generic HR roster to the CompBench
 * employee-upload template.
 *
 * The platform's employee importer (src/lib/parseEmployees.ts) keys on the
 * `Level` (An/As/M/SM/Pr) and `BasePay` (GND k/yr) columns. A raw roster such as
 * public/fake_employee.csv has neither — it carries real-world job titles, a
 * `department`, and an absolute `salary`. This script bridges the gap:
 *
 *   • Level  — job-title keyword first; salary band as fallback (using the seed
 *              firm pyramid so the distribution stays realistic). Provenance of
 *              every assignment (title vs salary) is reported.
 *   • BasePay — salary ÷ 1000 (absolute → GND thousands).
 *   • JobFamily — department mapped to a canonical family so the UI filter works;
 *                 the raw department is preserved in BusinessUnit.
 *   • PerformanceRating / TenureYears / FTE — taken from real columns where present.
 *
 * Output: public/fake_employee.compbench.csv, ready to drop into
 * Operate → Employees & Job Architecture → "Upload employees". The script then
 * re-parses its own output through the platform parser to prove it loads clean.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { LEVELS, type Level } from '@/domain/levels';
import { JOB_FAMILIES, LEVEL_TO_GRADE } from '@/lib/assumptions';
import { BONUS_PCT_BY_LEVEL } from '@/domain/employee';
import { parseEmployeesData } from '@/lib/parseEmployees';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE = resolve(ROOT, 'public/fake_employee.csv');
const OUTPUT = resolve(ROOT, 'public/fake_employee.compbench.csv');

/** As-of date for tenure (kept fixed for reproducible output). */
const AS_OF = new Date('2026-06-25T00:00:00Z');
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

type Cell = string | number | boolean | Date | null | undefined;
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function str(cell: Cell): string {
  return typeof cell === 'string' ? cell.trim() : typeof cell === 'number' ? String(cell) : '';
}

function num(cell: Cell): number | null {
  const n = typeof cell === 'number' ? cell : typeof cell === 'string' ? Number.parseFloat(cell) : NaN;
  return Number.isFinite(n) ? n : null;
}

// --- Level from job title --------------------------------------------------
// Ordered most-senior → most-junior; first match wins. Patterns are deliberate
// and reported so the (inherently fuzzy) title→ladder mapping stays auditable.
const TITLE_RULES: { level: Level; re: RegExp }[] = [
  { level: 'Pr', re: /\b(chief|c[efot]o|president|partner|principal|founder|owner|director|head of|vice president|vp|executive)\b/ },
  { level: 'SM', re: /\b(senior|sr\.?)\s+manager\b/ },
  { level: 'M', re: /\b(manager|lead|supervisor|superintendent|foreman)\b/ },
  { level: 'As', re: /\b(associate|consultant|specialist|engineer|officer|accountant|advisor|adviser|architect|scientist|developer|designer|nurse|administrator|analyst ii)\b/ },
  { level: 'An', re: /\b(analyst|assistant|junior|jr\.?|intern|trainee|clerk|coordinator|technician|operator|representative|aide|cashier)\b/ },
];

function levelFromTitle(title: string): Level | null {
  const t = title.toLowerCase();
  for (const rule of TITLE_RULES) {
    if (rule.re.test(t)) return rule.level;
  }
  return null;
}

// --- Level from salary band ------------------------------------------------
// Cumulative proportions of the seed firm pyramid (An 210 / As 174 / M 87 /
// SM 67 / Pr 13 of 551) — keeps the inferred distribution realistic instead of
// flat quintiles.
const SEED_COUNTS: Record<Level, number> = { An: 210, As: 174, M: 87, SM: 67, Pr: 13 };

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sortedAsc[lo] ?? 0;
  const b = sortedAsc[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

function buildSalaryBander(salaries: number[]): (salary: number) => Level {
  const sorted = [...salaries].sort((x, y) => x - y);
  const total = LEVELS.reduce((sum, l) => sum + SEED_COUNTS[l], 0);
  // Upper-bound salary for each level except the last (Pr catches the top).
  let cum = 0;
  const bands: { level: Level; max: number }[] = [];
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const level = LEVELS[i]!;
    cum += SEED_COUNTS[level];
    bands.push({ level, max: quantile(sorted, cum / total) });
  }
  const top = LEVELS[LEVELS.length - 1]!;
  return (salary: number): Level => {
    for (const band of bands) {
      if (salary <= band.max) return band.level;
    }
    return top;
  };
}

// --- department → canonical job family ------------------------------------
const FAMILY_RULES: { family: string; re: RegExp }[] = [
  { family: 'Risk', re: /risk|complian|legal|audit|security|fraud/i },
  { family: 'Technology', re: /tech|engineer|software|\bit\b|information technology|data|product|develop|r&d/i },
  { family: 'Strategy', re: /strateg|sales|market|business develop|consult|communicat|growth/i },
  { family: 'Operations', re: /financ|account|payroll|treasury|\bhr\b|human resource|operation|admin|support|facilit|procure|logistic|customer|supply/i },
];
const FAMILY_FALLBACK = 'Strategy';

function familyFromDepartment(department: string): string {
  for (const rule of FAMILY_RULES) {
    if (rule.re.test(department)) return rule.family;
  }
  return FAMILY_FALLBACK;
}

/** Excel's 1900 date system: serial 1 = 1900-01-01, epoch effectively 1899-12-30. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/**
 * Resolve a hire-date cell to a Date. `cellDates: true` yields a Date for
 * date-formatted cells; a bare number is an Excel serial; a string is ISO.
 */
function toDate(cell: Cell): Date | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell;
  if (typeof cell === 'number') return new Date(EXCEL_EPOCH_MS + cell * 24 * 60 * 60 * 1000);
  if (typeof cell === 'string' && cell.trim()) {
    const d = new Date(cell.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function tenureYears(cell: Cell): number | null {
  const d = toDate(cell);
  if (!d) return null;
  const years = Math.floor((AS_OF.getTime() - d.getTime()) / MS_PER_YEAR);
  return years >= 0 ? years : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const TEMPLATE_HEADER = [
  'Id', 'DisplayName', 'JobFamily', 'Level', 'Grade', 'Geography',
  'BusinessUnit', 'BasePay', 'BonusTarget', 'Fte', 'PerformanceRating', 'TenureYears',
] as const;

function main(): void {
  const buf = readFileSync(SOURCE);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) throw new Error('No sheet found in source CSV.');
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Cell[][];

  const header = aoa[0];
  if (!header) throw new Error('Source CSV has no header row.');

  // Locate source columns by normalized header name (robust to position).
  const col = (name: string): number => header.findIndex((h) => typeof h === 'string' && norm(h) === name);
  const idx = {
    name: col('name'),
    department: col('department'),
    jobTitle: col('jobtitles'),
    salary: col('salary'),
    employmentStatus: col('employmentstatus'),
    hireDate: col('hiredate'),
    performance: col('performanceratings'),
  };
  if (idx.salary < 0) throw new Error('Source CSV has no `salary` column — cannot derive BasePay.');

  const at = (row: Cell[], i: number): Cell => (i >= 0 ? row[i] : null);

  // First pass: collect valid salaries to size the salary-band fallback.
  const salaries: number[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const salary = num(at(row, idx.salary));
    if (salary !== null && salary > 0) salaries.push(salary);
  }
  const bandOf = buildSalaryBander(salaries);

  // Second pass: build template rows.
  const lines: string[] = [TEMPLATE_HEADER.join(',')];
  const levelDist: Record<Level, number> = { An: 0, As: 0, M: 0, SM: 0, Pr: 0 };
  let fromTitle = 0;
  let fromSalary = 0;
  let skipped = 0;
  let n = 0;

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const salary = num(at(row, idx.salary));
    if (salary === null || salary <= 0) {
      skipped++;
      continue;
    }
    n++;

    const title = str(at(row, idx.jobTitle));
    let level = levelFromTitle(title);
    if (level) {
      fromTitle++;
    } else {
      level = bandOf(salary);
      fromSalary++;
    }
    levelDist[level]++;

    const department = str(at(row, idx.department));
    const basePay = round1(salary / 1000);
    const employmentStatus = str(at(row, idx.employmentStatus)).toLowerCase();
    const perf = num(at(row, idx.performance));
    const performanceRating = perf !== null && perf >= 1 && perf <= 5 ? String(Math.round(perf)) : '';
    const tenure = tenureYears(at(row, idx.hireDate));

    const record: Record<(typeof TEMPLATE_HEADER)[number], string | number> = {
      Id: `EMP-${String(n).padStart(4, '0')}`,
      DisplayName: str(at(row, idx.name)) || `EMP-${String(n).padStart(4, '0')}`,
      JobFamily: familyFromDepartment(department),
      Level: level,
      Grade: LEVEL_TO_GRADE[level],
      Geography: n % 10 < 7 ? 'HQ' : 'Regional',
      BusinessUnit: department || 'General',
      BasePay: basePay,
      BonusTarget: round1(basePay * BONUS_PCT_BY_LEVEL[level]),
      Fte: employmentStatus.includes('part') ? 0.5 : 1,
      PerformanceRating: performanceRating,
      TenureYears: tenure === null ? '' : tenure,
    };
    lines.push(TEMPLATE_HEADER.map((h) => csvCell(record[h])).join(','));
  }

  writeFileSync(OUTPUT, `${lines.join('\n')}\n`, 'utf8');

  // Verify the output loads through the platform's own importer.
  const verify = parseEmployeesData(readFileSync(OUTPUT));

  log(`✓ Wrote ${OUTPUT}`);
  log(`  ${n} employees converted (${skipped} skipped — missing/invalid salary)`);
  log(`  Level source: ${fromTitle} from job title · ${fromSalary} from salary band`);
  log(`  Distribution: ${LEVELS.map((l) => `${l} ${levelDist[l]}`).join(' · ')}`);
  log(`  Families: ${JOB_FAMILIES.filter((f) => lines.some((ln) => ln.includes(`,${f},`))).join(', ')}`);
  log(`  Importer check: ${verify.count} rows accepted${verify.warnings.length ? ` · ⚠ ${verify.warnings.join(' ')}` : ' · no warnings'}`);
}

main();
