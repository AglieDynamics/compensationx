import { describe, expect, it } from 'vitest';
import { dbnomicsSeriesCode, INDICATOR_PRESETS, parseDbnomicsSeries } from '@/lib/macro/dbnomics';
import { MacroParseError } from '@/lib/macro/timeSeries';

const CPI = INDICATOR_PRESETS[0]!;
const req = { indicator: CPI, iso3: 'USA' };

/** A trimmed copy of the real DBnomics v22 series response shape. */
const realShape = {
  _meta: { args: {} },
  series: {
    docs: [
      {
        '@frequency': 'annual',
        provider_code: 'WB',
        dataset_code: 'WDI',
        dataset_name: 'World Development Indicators',
        series_code: 'A-FP.CPI.TOTL.ZG-USA',
        series_name: 'Annual – Inflation, consumer prices (annual %) – United States',
        period: ['2020', '2021', '2022'],
        value: [1.23, 4.7, 8.0],
      },
    ],
    num_found: 1,
  },
};

describe('dbnomicsSeriesCode', () => {
  it('builds the {freq}-{indicator}-{ISO3} mask', () => {
    expect(dbnomicsSeriesCode('FP.CPI.TOTL.ZG', 'USA')).toBe('A-FP.CPI.TOTL.ZG-USA');
  });
});

describe('parseDbnomicsSeries', () => {
  it('normalizes the real response shape into a TimeSeries', () => {
    const ts = parseDbnomicsSeries(realShape, req);
    expect(ts.sourceId).toBe('dbnomics');
    expect(ts.providerCode).toBe('WB');
    expect(ts.datasetCode).toBe('WDI');
    expect(ts.country).toBe('USA');
    expect(ts.frequency).toBe('annual');
    expect(ts.unit).toBe(CPI.unit);
    expect(ts.observations).toEqual([
      { period: '2020', value: 1.23 },
      { period: '2021', value: 4.7 },
      { period: '2022', value: 8.0 },
    ]);
    expect(ts.provenance.sourceUrl).toContain('A-FP.CPI.TOTL.ZG-USA');
    expect(ts.fallback).toBe(false);
    expect(ts.cached).toBe(false);
  });

  it('preserves NA/null observations (never drops or fabricates)', () => {
    const withGaps = {
      series: { docs: [{ ...realShape.series.docs[0], period: ['2020', '2021', '2022'], value: [1.23, null, 'NA'] }] },
    };
    const ts = parseDbnomicsSeries(withGaps, req);
    expect(ts.observations).toEqual([
      { period: '2020', value: 1.23 },
      { period: '2021', value: null },
      { period: '2022', value: null },
    ]);
  });

  it('throws MacroParseError on an empty doc set', () => {
    expect(() => parseDbnomicsSeries({ series: { docs: [] } }, req)).toThrow(MacroParseError);
  });

  it('throws MacroParseError on mismatched period/value lengths', () => {
    const bad = { series: { docs: [{ period: ['2020', '2021'], value: [1.0] }] } };
    expect(() => parseDbnomicsSeries(bad, req)).toThrow(MacroParseError);
  });

  it('throws MacroParseError on a non-object response', () => {
    expect(() => parseDbnomicsSeries(null, req)).toThrow(MacroParseError);
    expect(() => parseDbnomicsSeries('nope', req)).toThrow(MacroParseError);
  });

  it('falls back to request-derived fields when optional doc fields are absent', () => {
    const sparse = { series: { docs: [{ period: ['2022'], value: [3.1] }] } };
    const ts = parseDbnomicsSeries(sparse, req);
    expect(ts.seriesCode).toBe('A-FP.CPI.TOTL.ZG-USA');
    expect(ts.seriesName).toBe(CPI.label);
    expect(ts.frequency).toBe('annual');
  });
});
