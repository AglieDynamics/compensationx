/**
 * Vencon workbook → typed Dataset (§4.2 / §4.3).
 *
 * Browser-safe and Node-safe: SheetJS runs in both. The Node ingest script and
 * the in-browser upload share this one mapping so they can never drift.
 *
 * Tab → model mapping and the within-tab row/column grid follow §4.2 exactly.
 * Cells are mapped by ROW OFFSET (not by parsing label text) for the percentile
 * matrix, per the spec.
 */

import * as XLSX from 'xlsx';
import type { Component, Period, Weighting } from '@/domain/components';
import { unitOf } from '@/domain/components';
import { isAggregate, LEVELS, levelOf, SUBLEVELS, type SubLevel } from '@/domain/levels';
import {
  type ComponentTable,
  type Dataset,
  type IncumbentDistribution,
  percentileKey,
  PERCENTILES,
  type PulseDataset,
  type PulseResponse,
  type ReportScope,
  selectTable,
  type SubLevelData,
} from '@/domain/types';
import { CAREER_ISSUES_SEED } from '@/data/careerIssues.seed';
import { SEED_GROWTH, SEED_META, SEED_YOY } from '@/data/seed';

type Cell = string | number | boolean | null | undefined;
type AOA = Cell[][];

export interface ParsedSheet {
  name: string;
  aoa: AOA;
}

export interface ParseReport {
  tabsFound: number;
  componentTabs: number;
  combosLoaded: string[];
  warnings: string[];
}

export interface ParseResult {
  dataset: Dataset;
  report: ParseReport;
}

interface TabTarget {
  weighting: Weighting;
  period: Period;
  component: Component;
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Build the tab-name → (weighting, period, component) map (§4.2). */
function buildTabMap(): Map<string, TabTarget> {
  const comps: [string, Component][] = [
    ['Basic Salary', 'BASIC_SALARY'],
    ['Bonus %', 'BONUS_PCT'],
    ['Bonus', 'BONUS'],
    ['TCC', 'TCC'],
  ];
  const weights: [string, Weighting][] = [
    ['Firm-weighted', 'FIRM'],
    ['Incu-weighted', 'INCUMBENT'],
  ];
  const map = new Map<string, TabTarget>();
  for (const [wlabel, weighting] of weights) {
    for (const [clabel, component] of comps) {
      // TARGET basic salary carries no prefix; accept the `t-` variant too.
      if (clabel === 'Basic Salary') {
        map.set(norm(`${clabel} ${wlabel}`), { weighting, period: 'TARGET', component });
      }
      map.set(norm(`t-${clabel} ${wlabel}`), { weighting, period: 'TARGET', component });
      map.set(norm(`a-${clabel} ${wlabel}`), { weighting, period: 'ACTUAL', component });
    }
  }
  return map;
}

const TAB_MAP = buildTabMap();

// Row map (1-indexed in the workbook → 0-indexed AOA).
const ROW = {
  firmIncumbents: 4, // R5
  firmMax: 5,
  firmMean: 6,
  firmMidpoint: 7,
  firmMedian: 8,
  firmMin: 9,
  marketFirms: 25, // R26
  marketIncumbents: 26,
  marketMax: 27,
  marketMean: 28,
  marketMidpoint: 29,
  marketMedian: 30,
  marketMin: 31,
  pctTop: 39, // R40 = 0.95
} as const;

/** Percentiles in descending order, aligned with the matrix rows R40..R58. */
const PERCENTILES_DESC = [...PERCENTILES].reverse();

function cellNum(aoa: AOA, r: number, c: number): number | null {
  const row = aoa[r];
  if (!row) return null;
  const v = row[c];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 0-indexed AOA column for a sublevel: col 0 holds labels; An1 starts at col 1. */
function colOf(index: number): number {
  return 1 + index;
}

/** Parse one component data tab into a ComponentTable (§4.2). Returns null if unmapped. */
export function parseAOAToTable(name: string, aoa: AOA): ComponentTable | null {
  const target = TAB_MAP.get(norm(name));
  if (!target) return null;

  const rows: Partial<Record<SubLevel, SubLevelData>> = {};
  const order: SubLevel[] = [...SUBLEVELS]; // 20 sublevels + Overall (col 21)

  order.forEach((sl, idx) => {
    const col = sl === 'Overall' ? 21 : colOf(idx);
    const agg = isAggregate(sl);

    const percentiles: Record<string, number | null> = {};
    PERCENTILES_DESC.forEach((p, offset) => {
      percentiles[percentileKey(p)] = cellNum(aoa, ROW.pctTop + offset, col);
    });

    rows[sl] = {
      subLevel: sl,
      firm: {
        incumbents: agg ? cellNum(aoa, ROW.firmIncumbents, col) : null,
        max: cellNum(aoa, ROW.firmMax, col),
        mean: cellNum(aoa, ROW.firmMean, col),
        midpoint: cellNum(aoa, ROW.firmMidpoint, col),
        median: cellNum(aoa, ROW.firmMedian, col),
        min: cellNum(aoa, ROW.firmMin, col),
      },
      market: {
        firms: cellNum(aoa, ROW.marketFirms, col),
        incumbents: agg ? cellNum(aoa, ROW.marketIncumbents, col) : null,
        max: cellNum(aoa, ROW.marketMax, col),
        mean: cellNum(aoa, ROW.marketMean, col),
        midpoint: cellNum(aoa, ROW.marketMidpoint, col),
        median: cellNum(aoa, ROW.marketMedian, col),
        min: cellNum(aoa, ROW.marketMin, col),
      },
      percentiles,
    };
  });

  return {
    weighting: target.weighting,
    period: target.period,
    component: target.component,
    unit: unitOf(target.component),
    rows,
  };
}

function computeDistribution(tables: ComponentTable[]): IncumbentDistribution {
  // Default to zeros (NOT the Greenland seed) so a partial upload never bleeds
  // sample headcounts into a different dataset.
  const firm = { An: 0, As: 0, M: 0, SM: 0, Pr: 0 };
  const market = { An: 0, As: 0, M: 0, SM: 0, Pr: 0 };
  // Prefer a firm-weighted TARGET table for headcounts; fall back to any table.
  const source =
    tables.find((t) => t.weighting === 'FIRM' && t.period === 'TARGET') ?? tables[0];
  if (source) {
    for (const level of LEVELS) {
      const row = source.rows[level as SubLevel];
      if (row?.firm.incumbents != null) firm[level] = row.firm.incumbents;
      if (row?.market.incumbents != null) market[level] = row.market.incumbents;
    }
  }
  return { firm, market };
}

/** Scope derived from parsed tables (headcounts, firm count); defaults to §3.7. */
function readMeta(tables: ComponentTable[]): ReportScope {
  const meta: ReportScope = { ...SEED_META };
  const dist = computeDistribution(tables);
  const sumFirm = (Object.values(dist.firm) as number[]).reduce((a, b) => a + b, 0);
  const sumMarket = (Object.values(dist.market) as number[]).reduce((a, b) => a + b, 0);
  if (sumFirm > 0) meta.yourFirmIncumbents = sumFirm;
  if (sumMarket > 0) meta.marketIncumbents = sumMarket;

  const basic = tables.find((t) => t.weighting === 'FIRM' && t.period === 'TARGET');
  const firms = basic ? firstFirmsCount(basic) : null;
  if (firms != null) meta.participatingFirms = firms;
  return meta;
}

function firstFirmsCount(table: ComponentTable): number | null {
  for (const level of LEVELS) {
    const f = table.rows[level as SubLevel]?.market.firms;
    if (f != null) return f;
  }
  return null;
}

const cellStr = (v: Cell): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

/**
 * Parse the long-format Pulse "Raw Data" sheet (§6 Module 7).
 * Columns are matched by normalised header name (Area, Section, Question_ID,
 * Question, Item_or_Option, Response_Type, Response, Comment). Returns undefined
 * when no pulse sheet / no rows are present.
 */
function parsePulse(sheets: ParsedSheet[]): PulseDataset | undefined {
  const sheet = sheets.find((s) => /raw\s*data/i.test(s.name));
  if (!sheet || sheet.aoa.length < 2) return undefined;
  const header = sheet.aoa[0];
  if (!header) return undefined;

  const col: Record<string, number> = {};
  header.forEach((h, i) => {
    if (typeof h === 'string') col[h.toLowerCase().replace(/[^a-z0-9]/g, '')] = i;
  });
  const cArea = col['area'];
  const cSection = col['section'];
  const cResp = col['response'];
  if (cArea == null || cSection == null || cResp == null) return undefined;
  const cQid = col['questionid'];
  const cQ = col['question'];
  const cItem = col['itemoroption'];
  const cRtype = col['responsetype'];
  const cComment = col['comment'];

  const at = (row: Cell[], i: number | undefined): string => (i == null ? '' : cellStr(row[i]));

  const responses: PulseResponse[] = [];
  const sections: string[] = [];
  for (let r = 1; r < sheet.aoa.length; r++) {
    const row = sheet.aoa[r];
    if (!row) continue;
    const areaRaw = at(row, cArea);
    const response = at(row, cResp);
    if (!areaRaw || !response) continue;
    const section = at(row, cSection) || 'Unsectioned';
    const responseType = at(row, cRtype).toUpperCase().includes('MULTI') ? 'MULTI' : 'SINGLE';
    const item = at(row, cItem);
    const comment = at(row, cComment);
    responses.push({
      area: /non/i.test(areaRaw) ? 'NON_GCC' : 'GCC',
      section,
      questionId: at(row, cQid),
      question: at(row, cQ),
      item: item || undefined,
      responseType,
      response,
      comment: comment || undefined,
    });
    if (!sections.includes(section)) sections.push(section);
  }
  return responses.length > 0 ? { sections, responses } : undefined;
}

/** Assemble a Dataset from already-extracted sheets (shared core of both entry points). */
export function parseSheets(sheets: ParsedSheet[]): ParseResult {
  const warnings: string[] = [];
  const tables: ComponentTable[] = [];
  let componentTabs = 0;

  for (const sheet of sheets) {
    if (!TAB_MAP.has(norm(sheet.name))) continue;
    componentTabs += 1;
    const table = parseAOAToTable(sheet.name, sheet.aoa);
    if (table) {
      const hasAnyValue = Object.values(table.rows).some(
        (r) => r && (r.market.median != null || r.firm.median != null),
      );
      if (hasAnyValue) tables.push(table);
      else warnings.push(`Tab "${sheet.name}" matched but contained no numeric data — skipped.`);
    }
  }

  if (tables.length === 0) {
    warnings.push('No recognised component tabs with data were found.');
  }

  const meta = readMeta(tables);
  const pulse = parsePulse(sheets);
  const dataset: Dataset = {
    meta,
    tables,
    distribution: computeDistribution(tables),
    yoy: SEED_YOY,
    growth: SEED_GROWTH,
    careerIssues: CAREER_ISSUES_SEED,
    ...(pulse ? { pulse } : {}),
  };
  if (pulse) warnings.push(`Pulse: ${pulse.responses.length} responses across ${pulse.sections.length} sections.`);

  const combosLoaded = tables.map((t) => `${t.weighting}/${t.period}/${t.component}`);
  return {
    dataset,
    report: { tabsFound: sheets.length, componentTabs, combosLoaded, warnings },
  };
}

/** Convert a SheetJS workbook to ParsedSheet[]. */
export function workbookToSheets(wb: XLSX.WorkBook): ParsedSheet[] {
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const aoa = ws
      ? (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as AOA)
      : [];
    return { name, aoa };
  });
}

/** Parse raw workbook bytes (browser upload or Node buffer) into a Dataset. */
export function parseWorkbookData(data: ArrayBuffer | Uint8Array): ParseResult {
  const wb = XLSX.read(data, { type: 'array' });
  const result = parseSheets(workbookToSheets(wb));
  // Sanity: warn on any (weighting×period×component) that resolved with no median anywhere.
  for (const t of result.dataset.tables) {
    const present = selectTable(result.dataset, t.weighting, t.period, t.component);
    if (!present) result.report.warnings.push(`Combo ${t.component} failed to register.`);
  }
  return result;
}

/** Levels helper re-export so the UI can describe parsed coverage. */
export function describeCoverage(ds: Dataset): string {
  const components = new Set(ds.tables.map((t) => t.component));
  return `${ds.tables.length} tables · ${components.size} components`;
}

export { levelOf };
