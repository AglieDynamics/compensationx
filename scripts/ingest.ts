/**
 * `npm run ingest` — build src/data/greenland.json (typed Dataset).
 *
 * If ./data-source/Salary-Survey_Data-Sheets.xlsx is present, parse it via the
 * shared §4.2 mapping. Otherwise fall back to the embedded Appendix A fixture
 * (seed) so the app always boots. Validates the output before writing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTable, type Dataset } from '@/domain/types';
import { ORACLE } from '@/data/__fixtures__/basicSalaryFirmTarget.fixture';
import { buildSeedDataset } from '@/data/seed';
import { parseWorkbookData } from '@/lib/parseWorkbook';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE = resolve(ROOT, 'data-source/Salary-Survey_Data-Sheets.xlsx');
const OUTPUT = resolve(ROOT, 'src/data/greenland.json');

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function validate(ds: Dataset, fromFallback: boolean): void {
  if (!ds.meta?.country) throw new Error('Dataset missing meta.country');
  if (!Array.isArray(ds.tables) || ds.tables.length === 0) {
    throw new Error('Dataset has no component tables');
  }
  const basic = selectTable(ds, 'FIRM', 'TARGET', 'BASIC_SALARY');
  if (!basic) throw new Error('Dataset missing Basic Salary / FIRM / TARGET table');

  if (fromFallback) {
    const an1 = basic.rows['An1'];
    if (!an1) throw new Error('Fallback: missing An1 row');
    const checks: [string, number | null | undefined, number][] = [
      ['An1 market median', an1.percentiles['0.50'], ORACLE.an1.marketMedian],
      ['An1 market 75th', an1.percentiles['0.75'], ORACLE.an1.market75],
      ['An1 market 95th', an1.percentiles['0.95'], ORACLE.an1.market95],
      ['An1 market 5th', an1.percentiles['0.05'], ORACLE.an1.market5],
      ['An1 firm median', an1.firm.median, ORACLE.an1.firmMedian],
    ];
    for (const [label, got, want] of checks) {
      if (got !== want) throw new Error(`Fallback validation failed: ${label} = ${got}, expected ${want}`);
    }
  }
}

function main(): void {
  let dataset: Dataset;
  let fromFallback = false;

  if (existsSync(SOURCE)) {
    log(`→ Reading source workbook: ${SOURCE}`);
    const buf = readFileSync(SOURCE);
    const { dataset: parsed, report } = parseWorkbookData(new Uint8Array(buf));
    dataset = parsed;
    log(`  Tabs found: ${report.tabsFound} · component tabs: ${report.componentTabs}`);
    log(`  Combos loaded: ${report.combosLoaded.join(', ') || '(none)'}`);
    for (const w of report.warnings) log(`  ⚠ ${w}`);
    if (dataset.tables.length === 0) {
      log('  No usable tables parsed — falling back to embedded Greenland fixture.');
      dataset = buildSeedDataset();
      fromFallback = true;
    }
  } else {
    log('→ No source workbook found at data-source/Salary-Survey_Data-Sheets.xlsx');
    log('  Using embedded Greenland fallback fixture (Appendix A).');
    dataset = buildSeedDataset();
    fromFallback = true;
  }

  validate(dataset, fromFallback);

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  const combos = dataset.tables.map((t) => `${t.weighting}/${t.period}/${t.component}`);
  log(`✓ Wrote ${OUTPUT}`);
  log(`  ${dataset.tables.length} table(s): ${combos.join(', ')}`);
  log(`  Scope: ${dataset.meta.country} ${dataset.meta.reportYear} · ${dataset.meta.currency} · ${dataset.meta.participatingFirms} firms · ${dataset.meta.marketIncumbents} incumbents`);
}

main();
