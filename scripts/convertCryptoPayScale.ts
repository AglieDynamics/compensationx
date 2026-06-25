/**
 * `npm run convert:cryptopayscale` — turn the CryptoPayScale strategic-value
 * dataset into CompX per-segment economic inputs.
 *
 * CryptoPayScale is NOT a roster: it has no base salary and no career level —
 * it's 20 per-employee value/risk/cost metrics plus crypto comp (token + equity).
 * CompX's economics layer (src/lib/parseInputs.ts → Capital → Inputs &
 * Assumptions) keys on per-LEVEL segment inputs, so this script:
 *
 *   1. Assigns each row a level from its job title, modulated by
 *      strategic_criticality_score (high → bump up a rung, low → bump down),
 *      which also populates Senior-Manager from criticality spread.
 *   2. Aggregates per level into the inputs CompX actually consumes:
 *        BaselineAttritionPct   ← mean(resignation_probability)        [0–1]
 *        ValuePerHead           ← mean(revenue_per_fte) / 1000         [GND k/yr]
 *        ProductivityIndex      ← 1 + mean(ai_productivity_gain_pct)/100
 *        EquityRewardPerHead    ← mean(token_allocation_usd + equity/VEST)/1000 [GND k/yr]
 *
 * Skipped on purpose: ReplacementCostMultiple (needs per-segment TCC, absent
 * here); OvertimeSpendPerHead / EmployerContributionPct (no source column); and
 * the replacement_time_days × vacancy_cost_per_day exposure — its per-head scale
 * (~600 GND k) is an order of magnitude above base and would distort the cost
 * stack, so it's left unmapped rather than forced into ContingentCostTotal. All
 * skipped fields keep their Appendix-A defaults. Output loads through the platform's own
 * parseInputsData (re-checked at the end). Upload via Capital → Inputs &
 * Assumptions → "Upload inputs".
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { LEVELS, type Level } from '@/domain/levels';
import { parseInputsData } from '@/lib/parseInputs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE = resolve(ROOT, 'public/CryptoPayScale_Top20_Mandatory_Fields_Dataset.csv');
const OUTPUT = resolve(ROOT, 'public/cryptopayscale.segment-inputs.csv');

/** Years over which a synthetic-equity holding is annualized into reward. */
const EQUITY_VEST_YEARS = 4;

type Cell = string | number | boolean | null | undefined;
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function num(cell: Cell): number | null {
  const n = typeof cell === 'number' ? cell : typeof cell === 'string' ? Number.parseFloat(cell) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(cell: Cell): string {
  return typeof cell === 'string' ? cell : typeof cell === 'number' ? String(cell) : '';
}

// --- Level from job title, modulated by strategic criticality --------------
function baseLevelFromTitle(title: string): Level {
  const t = title.toLowerCase();
  if (/\b(director|chief|c[efot]o|vp|vice president|head|principal|partner)\b/.test(t)) return 'Pr';
  if (/\bmanager\b/.test(t)) return 'M';
  if (/\b(engineer|developer|architect|specialist|consultant|counsel|advisor)\b/.test(t)) return 'As';
  return 'An'; // analyst / associate / default
}

/** Criticality bumps seniority: ≥8 up a rung, ≤2 down a rung. Spreads into SM. */
function levelFromRow(title: string, criticality: number | null): Level {
  const base = LEVELS.indexOf(baseLevelFromTitle(title));
  let idx = base;
  if (criticality !== null) {
    if (criticality >= 8) idx = Math.min(base + 1, LEVELS.length - 1);
    else if (criticality <= 2) idx = Math.max(base - 1, 0);
  }
  return LEVELS[idx]!;
}

// --- Per-level accumulator -------------------------------------------------
interface Acc {
  count: number;
  resignSum: number;
  resignN: number;
  rpfSum: number;
  rpfN: number;
  aiSum: number;
  aiN: number;
  equitySum: number; // Σ (token + equity/VEST)
  equityN: number;
}

function newAcc(): Acc {
  return { count: 0, resignSum: 0, resignN: 0, rpfSum: 0, rpfN: 0, aiSum: 0, aiN: 0, equitySum: 0, equityN: 0 };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const OUTPUT_HEADER = [
  'Level', 'BaselineAttritionPct', 'ValuePerHead', 'ProductivityIndex', 'EquityRewardPerHead',
] as const;

function main(): void {
  const buf = readFileSync(SOURCE);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) throw new Error('No sheet found in source CSV.');
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Cell[][];

  const header = aoa[0];
  if (!header) throw new Error('Source CSV has no header row.');
  const col = (name: string): number => header.findIndex((h) => typeof h === 'string' && norm(h) === name);
  const idx = {
    jobTitle: col('jobtitle'),
    criticality: col('strategiccriticalityscore'),
    resignation: col('resignationprobability'),
    revenuePerFte: col('revenueperfte'),
    aiGain: col('aiproductivitygainpct'),
    token: col('tokenallocationusd'),
    equity: col('syntheticequityvalueusd'),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v < 0) throw new Error(`Source CSV missing expected column: ${k}`);
  }
  const at = (row: Cell[], i: number): Cell => row[i];

  const accs = new Map<Level, Acc>(LEVELS.map((l) => [l, newAcc()]));
  let n = 0;
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const title = str(at(row, idx.jobTitle));
    if (!title) continue;
    n++;
    const level = levelFromRow(title, num(at(row, idx.criticality)));
    const a = accs.get(level)!;
    a.count++;

    const resign = num(at(row, idx.resignation));
    if (resign !== null) { a.resignSum += resign; a.resignN++; }
    const rpf = num(at(row, idx.revenuePerFte));
    if (rpf !== null) { a.rpfSum += rpf; a.rpfN++; }
    const ai = num(at(row, idx.aiGain));
    if (ai !== null) { a.aiSum += ai; a.aiN++; }
    const token = num(at(row, idx.token)) ?? 0;
    const equity = num(at(row, idx.equity)) ?? 0;
    a.equitySum += token + equity / EQUITY_VEST_YEARS;
    a.equityN++;
  }

  const lines: string[] = [OUTPUT_HEADER.join(',')];
  const summary: string[] = [];
  for (const level of LEVELS) {
    const a = accs.get(level)!;
    if (a.count === 0) continue; // no rows assigned to this level → leave defaults
    const attrition = a.resignN ? round(a.resignSum / a.resignN, 3) : '';
    const valuePerHead = a.rpfN ? round(a.rpfSum / a.rpfN / 1000, 1) : '';
    const productivity = a.aiN ? round(1 + a.aiSum / a.aiN / 100, 2) : '';
    const equityPerHead = a.equityN ? round(a.equitySum / a.equityN / 1000, 1) : '';
    lines.push([level, attrition, valuePerHead, productivity, equityPerHead].join(','));
    summary.push(`${level} n=${a.count} attr=${attrition} vph=${valuePerHead} prod=${productivity} equity=${equityPerHead}`);
  }

  writeFileSync(OUTPUT, `${lines.join('\n')}\n`, 'utf8');

  // Verify the output loads through the platform's own segment-inputs parser.
  const verify = parseInputsData(readFileSync(OUTPUT));

  log(`✓ Wrote ${OUTPUT}`);
  log(`  ${n} rows aggregated into ${summary.length} level(s):`);
  for (const s of summary) log(`    ${s}`);
  log(`  Importer check: ${verify.entries.length} values across ${verify.levelsFound.length} levels · columns: ${verify.columns.join(', ')}`);
  if (verify.warnings.length) log(`  ⚠ ${verify.warnings.join(' ')}`);
}

main();
