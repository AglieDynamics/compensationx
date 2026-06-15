import { describe, expect, it } from 'vitest';
import { FRED_PRESETS, isAllowedFredSeries, parseFredObservations } from '@/lib/macro/fred';
import { MacroParseError } from '@/lib/macro/timeSeries';

const opts = { seriesId: 'UNRATE', label: 'Unemployment rate', unit: '%', retrievedAt: '2024-01-01T00:00:00.000Z' };

/** Trimmed real FRED series/observations payload (value is a string; "." = NA). */
const fredShape = {
  observations: [
    { realtime_start: '2024-01-01', realtime_end: '2024-01-01', date: '2020-01-01', value: '8.1' },
    { realtime_start: '2024-01-01', realtime_end: '2024-01-01', date: '2021-01-01', value: '5.4' },
    { realtime_start: '2024-01-01', realtime_end: '2024-01-01', date: '2022-01-01', value: '.' },
  ],
};

describe('isAllowedFredSeries', () => {
  it('accepts well-formed FRED ids and rejects anything else (SSRF guard)', () => {
    expect(isAllowedFredSeries('UNRATE')).toBe(true);
    expect(isAllowedFredSeries('MEHOINUSA672N')).toBe(true);
    expect(isAllowedFredSeries('bad-id')).toBe(false);
    expect(isAllowedFredSeries('../etc/passwd')).toBe(false);
    expect(isAllowedFredSeries('UNRATE&api_key=x')).toBe(false);
    expect(isAllowedFredSeries('')).toBe(false);
  });
});

describe('parseFredObservations', () => {
  it('normalizes FRED observations into a TimeSeries (annual year periods)', () => {
    const ts = parseFredObservations(fredShape, opts);
    expect(ts.sourceId).toBe('fred');
    expect(ts.providerCode).toBe('FRED');
    expect(ts.country).toBe('USA');
    expect(ts.unit).toBe('%');
    expect(ts.observations).toEqual([
      { period: '2020', value: 8.1 },
      { period: '2021', value: 5.4 },
      { period: '2022', value: null }, // "." → null (NA preserved)
    ]);
    expect(ts.provenance.sourceUrl).toContain('UNRATE');
    expect(ts.provenance.sourceLabel).toContain('proxy');
  });

  it('treats blank/whitespace values as NA (never fabricates 0)', () => {
    const blanks = {
      observations: [
        { date: '2020-01-01', value: '' },
        { date: '2021-01-01', value: '   ' },
        { date: '2022-01-01', value: '3.5' },
      ],
    };
    expect(parseFredObservations(blanks, opts).observations).toEqual([
      { period: '2020', value: null },
      { period: '2021', value: null },
      { period: '2022', value: 3.5 },
    ]);
  });

  it('uses the provided retrievedAt (stays pure/deterministic)', () => {
    expect(parseFredObservations(fredShape, opts).retrievedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('throws MacroParseError when observations are missing or malformed', () => {
    expect(() => parseFredObservations({}, opts)).toThrow(MacroParseError);
    expect(() => parseFredObservations(null, opts)).toThrow(MacroParseError);
    expect(() => parseFredObservations({ observations: 'nope' }, opts)).toThrow(MacroParseError);
  });

  it('ships only US presets with valid ids', () => {
    expect(FRED_PRESETS.length).toBeGreaterThan(0);
    for (const p of FRED_PRESETS) expect(isAllowedFredSeries(p.seriesId)).toBe(true);
  });
});
