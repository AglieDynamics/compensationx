/**
 * DBnomics source adapter (Class A — browser-direct, no key, CORS-friendly).
 *
 * DBnomics aggregates World Bank / IMF / OECD / Eurostat behind one JSON API and
 * sends `Access-Control-Allow-Origin: *`, so the SPA fetches it directly. The
 * spike pulls World Bank WDI series, requesting EXACTLY one series at a time
 * (`/v22/series/WB/WDI/{freq}-{indicator}-{ISO3}?observations=1`) — never whole
 * datasets — which keeps each pull to a few KB. A small in-memory TTL cache
 * avoids refetching the same series within a session.
 */

import {
  MacroFetchError,
  MacroParseError,
  type Observation,
  type TimeSeries,
} from './timeSeries';

const DBN_API = 'https://api.db.nomics.world/v22';
const DBN_WEB = 'https://db.nomics.world';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface IndicatorPreset {
  /** World Bank WDI indicator code, e.g. "FP.CPI.TOTL.ZG". */
  indicatorCode: string;
  label: string;
  unit: string;
  /** Suitability hints for later "attach as benchmarking context". */
  role: 'inflation' | 'output' | 'labor';
}

/** Benchmarking-relevant WDI indicators (all verified against the live API). */
export const INDICATOR_PRESETS: IndicatorPreset[] = [
  { indicatorCode: 'FP.CPI.TOTL.ZG', label: 'Inflation, consumer prices (annual %)', unit: '% / yr', role: 'inflation' },
  { indicatorCode: 'NY.GDP.DEFL.KD.ZG', label: 'GDP deflator inflation (annual %)', unit: '% / yr', role: 'inflation' },
  { indicatorCode: 'NY.GDP.PCAP.CD', label: 'GDP per capita (current US$)', unit: 'US$', role: 'output' },
  { indicatorCode: 'NY.GDP.MKTP.KD.ZG', label: 'GDP growth (annual %)', unit: '% / yr', role: 'output' },
  { indicatorCode: 'SL.UEM.TOTL.ZS', label: 'Unemployment, total (% of labor force)', unit: '%', role: 'labor' },
];

export interface MacroCountry {
  iso3: string;
  name: string;
}

/** A curated set of major economies — avoids pulling the full WDI country dimension. */
export const MACRO_COUNTRIES: MacroCountry[] = [
  { iso3: 'USA', name: 'United States' },
  { iso3: 'GBR', name: 'United Kingdom' },
  { iso3: 'DEU', name: 'Germany' },
  { iso3: 'FRA', name: 'France' },
  { iso3: 'ESP', name: 'Spain' },
  { iso3: 'ITA', name: 'Italy' },
  { iso3: 'NLD', name: 'Netherlands' },
  { iso3: 'CHE', name: 'Switzerland' },
  { iso3: 'SWE', name: 'Sweden' },
  { iso3: 'CAN', name: 'Canada' },
  { iso3: 'AUS', name: 'Australia' },
  { iso3: 'JPN', name: 'Japan' },
  { iso3: 'SGP', name: 'Singapore' },
  { iso3: 'ARE', name: 'United Arab Emirates' },
  { iso3: 'IND', name: 'India' },
  { iso3: 'BRA', name: 'Brazil' },
];

/** Provider-native series id for a WB/WDI annual series. */
export function dbnomicsSeriesCode(indicatorCode: string, iso3: string): string {
  return `A-${indicatorCode}-${iso3}`;
}

function seriesWebUrl(seriesCode: string): string {
  return `${DBN_WEB}/WB/WDI/${seriesCode}`;
}

// --- Parsing (hand-rolled, fail-safe on drift) ------------------------------

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null);
const asArr = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.length > 0 ? v : fallback);
/** Preserve NA: anything not a finite number becomes null (never fabricated). */
const toValue = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export interface DbnomicsRequest {
  indicator: IndicatorPreset;
  iso3: string;
}

/** Normalize a DBnomics series response into the internal {@link TimeSeries}. */
export function parseDbnomicsSeries(json: unknown, req: DbnomicsRequest): TimeSeries {
  const root = asRec(json);
  if (!root) throw new MacroParseError('DBnomics response was not an object.');
  const series = asRec(root.series);
  const docs = series ? asArr(series.docs) : null;
  if (!docs || docs.length === 0) {
    throw new MacroParseError('No series returned for this indicator and country.');
  }
  const doc = asRec(docs[0]);
  if (!doc) throw new MacroParseError('Malformed series document.');

  const periods = asArr(doc.period);
  const values = asArr(doc.value);
  if (!periods || !values) throw new MacroParseError('Series is missing its period/value arrays.');
  if (periods.length !== values.length) {
    throw new MacroParseError('Series period/value arrays have mismatched lengths.');
  }

  const observations: Observation[] = periods.map((p, i) => ({
    period: String(p),
    value: toValue(values[i]),
  }));

  const seriesCode = str(doc.series_code, dbnomicsSeriesCode(req.indicator.indicatorCode, req.iso3));

  return {
    sourceId: 'dbnomics',
    providerCode: str(doc.provider_code, 'WB'),
    datasetCode: str(doc.dataset_code, 'WDI'),
    indicatorCode: req.indicator.indicatorCode,
    seriesCode,
    seriesName: str(doc.series_name, req.indicator.label),
    country: req.iso3,
    unit: req.indicator.unit,
    frequency: str(doc['@frequency'], 'annual'),
    observations,
    retrievedAt: new Date().toISOString(),
    cached: false,
    fallback: false,
    provenance: {
      sourceLabel: 'DBnomics · World Bank WDI',
      sourceUrl: seriesWebUrl(seriesCode),
      license: 'World Bank Open Data — CC BY 4.0',
    },
  };
}

// --- In-memory TTL cache ----------------------------------------------------

interface CacheEntry {
  ts: TimeSeries;
  expires: number;
}
const cache = new Map<string, CacheEntry>();
const cacheKey = (indicatorCode: string, iso3: string): string => `${indicatorCode}|${iso3}`;

function cacheGet(key: string): TimeSeries | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return { ...hit.ts, cached: true };
}

// --- Fetch ------------------------------------------------------------------

export interface FetchOpts {
  signal?: AbortSignal;
  /** Bypass the cache and force a live request. */
  force?: boolean;
}

/**
 * Fetch one WB/WDI series for a country, direct from DBnomics. Cached for the
 * session; throws {@link MacroFetchError} (network/CORS/HTTP) or
 * {@link MacroParseError} (schema drift), never a raw error.
 */
export async function fetchDbnomicsSeries(
  indicator: IndicatorPreset,
  iso3: string,
  opts: FetchOpts = {},
): Promise<TimeSeries> {
  const key = cacheKey(indicator.indicatorCode, iso3);
  if (!opts.force) {
    const cached = cacheGet(key);
    if (cached) return cached;
  }

  const code = dbnomicsSeriesCode(indicator.indicatorCode, iso3);
  // observations=1 gets the data points; metadata=false drops the dataset's full
  // dimension-label dictionary we don't need — ~128 KB → ~3 KB per pull.
  const url = `${DBN_API}/series/WB/WDI/${code}?observations=1&metadata=false`;

  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // Direct browser fetch failed (offline or a CORS preflight wall) — fall back
    // to our serverless proxy, which fetches DBnomics server-side.
    return fetchViaProxy(indicator, iso3, key, opts.signal);
  }

  if (res.status === 404) throw new MacroFetchError('DBnomics has no such series.', 'notFound', 404);
  if (!res.ok) throw new MacroFetchError(`DBnomics returned HTTP ${res.status}.`, 'http', res.status);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new MacroParseError('DBnomics response was not valid JSON.');
  }

  const ts = parseDbnomicsSeries(json, { indicator, iso3 });
  cache.set(key, { ts, expires: Date.now() + CACHE_TTL_MS });
  return ts;
}

/** CORS/offline fallback: pull the same DBnomics series via our `/api/macro` proxy. */
async function fetchViaProxy(
  indicator: IndicatorPreset,
  iso3: string,
  key: string,
  signal: AbortSignal | undefined,
): Promise<TimeSeries> {
  const code = dbnomicsSeriesCode(indicator.indicatorCode, iso3);
  const params = new URLSearchParams({ source: 'dbnomics', series: code });
  let res: Response;
  try {
    res = await fetch(`/api/macro?${params.toString()}`, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new MacroFetchError('Could not reach DBnomics directly or via the proxy (offline?).', 'network');
  }
  // `vite dev` has no functions → /api/macro returns SPA HTML; detect and report.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new MacroFetchError('The proxy isn’t available in this environment (run `vercel dev` or deploy).', 'network');
  }
  if (res.status === 404) throw new MacroFetchError('DBnomics has no such series.', 'notFound', 404);
  if (!res.ok) throw new MacroFetchError(`Proxy returned HTTP ${res.status}.`, 'http', res.status);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new MacroParseError('Proxy returned invalid JSON.');
  }
  const ts = parseDbnomicsSeries(json, { indicator, iso3 });
  cache.set(key, { ts, expires: Date.now() + CACHE_TTL_MS });
  return ts;
}
