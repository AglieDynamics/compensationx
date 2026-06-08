import { describe, expect, it } from 'vitest';
import { buildSeedDataset } from '@/data/seed';
import { ORACLE } from '@/data/__fixtures__/basicSalaryFirmTarget.fixture';
import { parseAOAToTable } from '@/lib/parseWorkbook';
import { selectTable } from '@/domain/types';
import greenland from '@/data/greenland.json';
import type { Dataset } from '@/domain/types';

type Cell = string | number | null;

describe('seed dataset', () => {
  const ds = buildSeedDataset();

  it('contains the real Basic Salary FIRM TARGET table with Appendix A values', () => {
    const t = selectTable(ds, 'FIRM', 'TARGET', 'BASIC_SALARY')!;
    expect(t.rows['An1']?.percentiles['0.50']).toBe(ORACLE.an1.marketMedian);
    expect(t.rows['An1']?.firm.median).toBe(ORACLE.an1.firmMedian);
    expect(t.rows['An']?.firm.incumbents).toBe(210);
    expect(t.rows['As']?.market.incumbents).toBe(1974);
  });

  it('carries scope, distribution, and career issues', () => {
    expect(ds.meta.country).toBe('Greenland');
    expect(ds.meta.marketIncumbents).toBe(5067);
    expect(ds.distribution.firm.An).toBe(210);
    expect(ds.distribution.market.Pr).toBe(165);
    expect(ds.careerIssues?.illustrative).toBe(true);
  });
});

describe('committed greenland.json', () => {
  const ds = greenland as unknown as Dataset;

  it('round-trips through ingest with the oracle numbers intact', () => {
    const t = selectTable(ds, 'FIRM', 'TARGET', 'BASIC_SALARY')!;
    expect(ds.meta.country).toBe('Greenland');
    expect(ds.tables.length).toBeGreaterThanOrEqual(2);
    expect(t.rows['An1']?.percentiles['0.95']).toBe(ORACLE.an1.market95);
    expect(t.rows['An1']?.percentiles['0.05']).toBe(ORACLE.an1.market5);
  });
});

describe('§4.2 workbook mapping (synthetic AOA round-trip)', () => {
  function blankSheet(): Cell[][] {
    return Array.from({ length: 58 }, () => Array<Cell>(22).fill(null));
  }

  it('maps rows/columns and percentile offsets correctly', () => {
    const aoa = blankSheet();
    const AN1 = 1; // col index for An1
    const AN_AGG = 4; // col index for An aggregate
    // Firm + market stats (R-1 indices)
    aoa[8]![AN1] = 45.75; // firm median
    aoa[30]![AN1] = 44.32; // market median (50th)
    aoa[25]![AN1] = 19; // market firms
    aoa[4]![AN_AGG] = 210; // firm incumbents (aggregate only)
    aoa[26]![AN_AGG] = 1477; // market incumbents (aggregate only)
    // Percentile matrix, descending from R40=0.95
    aoa[39]![AN1] = 59.07; // 0.95
    aoa[43]![AN1] = 46.59; // 0.75 (offset 4)
    aoa[48]![AN1] = 44.32; // 0.50 (offset 9)
    aoa[57]![AN1] = 34.54; // 0.05 (offset 18)
    // Non-numeric cells coerce to null, never NaN
    aoa[29]![AN1] = '>95%';

    const table = parseAOAToTable('Basic Salary Firm-weighted', aoa);
    expect(table).not.toBeNull();
    expect(table!.weighting).toBe('FIRM');
    expect(table!.period).toBe('TARGET');
    expect(table!.component).toBe('BASIC_SALARY');
    expect(table!.unit).toBe('GND_K');

    const an1 = table!.rows['An1']!;
    expect(an1.firm.median).toBe(45.75);
    expect(an1.market.median).toBe(44.32);
    expect(an1.market.firms).toBe(19);
    expect(an1.percentiles['0.95']).toBe(59.07);
    expect(an1.percentiles['0.75']).toBe(46.59);
    expect(an1.percentiles['0.50']).toBe(44.32);
    expect(an1.percentiles['0.05']).toBe(34.54);
    expect(an1.market.midpoint).toBeNull(); // ">95%" -> null

    // Incumbents only on the aggregate column
    expect(table!.rows['An']?.firm.incumbents).toBe(210);
    expect(table!.rows['An']?.market.incumbents).toBe(1477);
    expect(an1.firm.incumbents).toBeNull();
  });

  it('returns null for unmapped tabs', () => {
    expect(parseAOAToTable('c-TBR-TCC Firm-weighted', [])).toBeNull();
    expect(parseAOAToTable('Introduction', [])).toBeNull();
  });

  it('maps an Incu-weighted ACTUAL bonus % tab to the right combo + unit', () => {
    const table = parseAOAToTable('a-Bonus % Incu-weighted', Array.from({ length: 58 }, () => Array<Cell>(22).fill(0.18)));
    expect(table!.weighting).toBe('INCUMBENT');
    expect(table!.period).toBe('ACTUAL');
    expect(table!.component).toBe('BONUS_PCT');
    expect(table!.unit).toBe('RATIO');
  });
});
