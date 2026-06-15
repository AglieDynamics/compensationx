/**
 * FRED source adapter (Class B — requires an API key AND sends no CORS headers,
 * so it is reachable ONLY through our serverless proxy; never from the browser).
 *
 * This module holds the PURE, server-shareable pieces: the indicator presets,
 * the series-id allowlist, and the FRED→TimeSeries normalizer. `api/macro.ts`
 * imports them on the edge; the client imports only the presets. No API key
 * appears here — the key lives solely in the proxy via `process.env`.
 */

import { MacroParseError, type Observation, type TimeSeries } from './timeSeries';

export interface FredPreset {
  /** FRED series id, e.g. "UNRATE". */
  seriesId: string;
  label: string;
  unit: string;
  role: 'inflation' | 'output' | 'labor' | 'rate';
}

/** US benchmarking-relevant FRED series (FRED is US-centric). */
export const FRED_PRESETS: FredPreset[] = [
  { seriesId: 'UNRATE', label: 'Unemployment rate', unit: '%', role: 'labor' },
  { seriesId: 'FEDFUNDS', label: 'Federal funds rate', unit: '%', role: 'rate' },
  { seriesId: 'CPIAUCSL', label: 'CPI (all urban consumers, index)', unit: 'index 1982-84=100', role: 'inflation' },
  { seriesId: 'GDPC1', label: 'Real GDP (chained 2017 US$bn)', unit: 'US$bn', role: 'output' },
  { seriesId: 'MEHOINUSA672N', label: 'Real median household income', unit: 'US$', role: 'output' },
];

/** Strict allowlist: FRED ids are uppercase alnum + underscore. Blocks SSRF. */
export const FRED_SERIES_ID_RE = /^[A-Z0-9_]{1,32}$/;
export function isAllowedFredSeries(id: string): boolean {
  return FRED_SERIES_ID_RE.test(id);
}

export function fredPreset(seriesId: string): FredPreset | undefined {
  return FRED_PRESETS.find((p) => p.seriesId === seriesId);
}

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null);

export interface FredNormalizeOpts {
  seriesId: string;
  label: string;
  unit: string;
  /** ISO timestamp; passed in so the function stays pure/deterministic. */
  retrievedAt: string;
}

/**
 * Normalize a FRED `series/observations` payload into the internal
 * {@link TimeSeries}. FRED values are strings and use "." for missing — those
 * become `null` (preserved, never fabricated). Annual frequency assumed (the
 * proxy requests `frequency=a`), so the period is the 4-digit year.
 */
export function parseFredObservations(json: unknown, opts: FredNormalizeOpts): TimeSeries {
  const root = asRec(json);
  if (!root) throw new MacroParseError('FRED response was not an object.');
  const obs = root.observations;
  if (!Array.isArray(obs)) throw new MacroParseError('FRED response is missing its observations array.');

  const observations: Observation[] = obs.map((entry) => {
    const r = asRec(entry) ?? {};
    const date = typeof r.date === 'string' ? r.date : '';
    const period = date.length >= 4 ? date.slice(0, 4) : date;
    // FRED uses "." for NA; also treat blank/whitespace as NA so Number('')→0
    // can't fabricate a value.
    const s = typeof r.value === 'string' ? r.value.trim() : '';
    const num = s !== '' && s !== '.' ? Number(s) : NaN;
    return { period, value: Number.isFinite(num) ? num : null };
  });

  return {
    sourceId: 'fred',
    providerCode: 'FRED',
    datasetCode: opts.seriesId,
    indicatorCode: opts.seriesId,
    seriesCode: opts.seriesId,
    seriesName: opts.label,
    country: 'USA',
    unit: opts.unit,
    frequency: 'annual',
    observations,
    retrievedAt: opts.retrievedAt,
    cached: false,
    fallback: false,
    provenance: {
      sourceLabel: 'FRED · Federal Reserve Bank of St. Louis (via proxy)',
      sourceUrl: `https://fred.stlouisfed.org/series/${opts.seriesId}`,
      license: 'FRED® — usage subject to each source series’ terms',
    },
  };
}
