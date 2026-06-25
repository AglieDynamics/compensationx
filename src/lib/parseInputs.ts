/**
 * CSV/XLSX parsing for per-segment inputs (§2B mechanism 3). Auto-detects which
 * input columns are present, maps levels by code or full name, and reports
 * warnings. Bad files fail soft (never throw to the caller's UI).
 */

import * as XLSX from 'xlsx';
import { LEVELS, type Level } from '@/domain/levels';
import type { SegmentInputKey } from '@/lib/assumptions';

export type InputTemplate = 'value' | 'attrition' | 'cost';

interface ParsedEntry {
  level: Level;
  key: SegmentInputKey;
  value: number;
}

export interface InputParseResult {
  entries: ParsedEntry[];
  levelsFound: Level[];
  columns: SegmentInputKey[];
  warnings: string[];
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_TO_KEY: Record<string, SegmentInputKey> = {
  valueperhead: 'valuePerHead',
  productivityindex: 'productivityIndex',
  baselineattritionpct: 'baselineAttritionPct',
  baselineattrition: 'baselineAttritionPct',
  attrition: 'baselineAttritionPct',
  replacementcostmultiple: 'replacementCostMultiple',
  replacementmultiple: 'replacementCostMultiple',
  overtimespendperhead: 'overtimeSpendPerHead',
  overtimeperhead: 'overtimeSpendPerHead',
  contingentcosttotal: 'contingentCostTotal',
  contingenttotal: 'contingentCostTotal',
  equityrewardperhead: 'equityRewardPerHead',
  equityreward: 'equityRewardPerHead',
  equitytokenperhead: 'equityRewardPerHead',
  employercontributionpct: 'employerContributionPct',
  employercontribution: 'employerContributionPct',
};

const LEVEL_ALIASES: Record<string, Level> = {
  an: 'An', analyst: 'An',
  as: 'As', associate: 'As',
  m: 'M', manager: 'M',
  sm: 'SM', srmanager: 'SM', seniormanager: 'SM',
  pr: 'Pr', principal: 'Pr',
};

function toLevel(raw: unknown): Level | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  return LEVEL_ALIASES[norm(String(raw))] ?? null;
}

type Cell = string | number | boolean | null | undefined;

/** Parse a CSV/XLSX buffer of per-segment inputs. */
export function parseInputsData(data: ArrayBuffer | Uint8Array): InputParseResult {
  const warnings: string[] = [];
  let aoa: Cell[][] = [];
  try {
    const wb = XLSX.read(data, { type: 'array' });
    const first = wb.SheetNames[0];
    const ws = first ? wb.Sheets[first] : undefined;
    if (ws) aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Cell[][];
  } catch {
    warnings.push('Could not read the file — is it a valid CSV / XLSX?');
    return { entries: [], levelsFound: [], columns: [], warnings };
  }

  const header = aoa[0];
  if (!header) {
    warnings.push('No header row found.');
    return { entries: [], levelsFound: [], columns: [], warnings };
  }

  let levelCol = -1;
  const keyCols: { col: number; key: SegmentInputKey }[] = [];
  header.forEach((h, i) => {
    if (typeof h !== 'string') return;
    const n = norm(h);
    if (n === 'level' || n === 'segment') levelCol = i;
    const key = HEADER_TO_KEY[n];
    if (key) keyCols.push({ col: i, key });
  });

  if (levelCol === -1) {
    warnings.push('No "Level" column found. Add a Level column (An / As / M / SM / Pr).');
    return { entries: [], levelsFound: [], columns: [], warnings };
  }
  if (keyCols.length === 0) {
    warnings.push('No recognised input columns found (e.g. ValuePerHead, BaselineAttritionPct).');
    return { entries: [], levelsFound: [], columns: [], warnings };
  }

  const entries: ParsedEntry[] = [];
  const levelsFound = new Set<Level>();
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const level = toLevel(row[levelCol]);
    if (!level) continue;
    levelsFound.add(level);
    for (const { col, key } of keyCols) {
      const raw = row[col];
      const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : NaN;
      if (Number.isFinite(num)) entries.push({ level, key, value: num });
    }
  }

  if (entries.length === 0) warnings.push('No numeric input values were parsed from the rows.');

  return {
    entries,
    levelsFound: LEVELS.filter((l) => levelsFound.has(l)),
    columns: [...new Set(keyCols.map((k) => k.key))],
    warnings,
  };
}

const TEMPLATE_COLUMNS: Record<InputTemplate, { header: string; sample: (level: Level) => string }[]> = {
  value: [
    { header: 'ValuePerHead', sample: () => '' },
    { header: 'ProductivityIndex', sample: () => '' },
  ],
  attrition: [
    { header: 'BaselineAttritionPct', sample: () => '' },
    { header: 'ReplacementCostMultiple', sample: () => '' },
  ],
  cost: [
    { header: 'OvertimeSpendPerHead', sample: () => '' },
    { header: 'ContingentCostTotal', sample: () => '' },
    { header: 'EquityRewardPerHead', sample: () => '' },
    { header: 'EmployerContributionPct', sample: () => '' },
  ],
};

/** Generate a downloadable CSV template for an input class. */
export function inputTemplateCsv(template: InputTemplate): string {
  const cols = TEMPLATE_COLUMNS[template];
  const header = ['Level', ...cols.map((c) => c.header)].join(',');
  const rows = LEVELS.map((l) => [l, ...cols.map((c) => c.sample(l))].join(','));
  return [header, ...rows].join('\n');
}
