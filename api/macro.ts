/**
 * Macro data proxy + normalizer (edge function).
 *
 * The ONLY server code for the macro layer. Two jobs:
 *   1. FRED (Class B): inject FRED_API_KEY from env into the upstream request —
 *      the key never reaches the client or any response body — and return the
 *      normalized internal TimeSeries.
 *   2. DBnomics (Class A): a CORS/network fallback the client uses when its
 *      direct browser fetch fails; raw upstream JSON is passed through.
 *
 * Security posture: the upstream HOST is always a hardcoded constant (never
 * user-controlled). `source` is allowlisted; the FRED series must be one of the
 * known presets (value allowlist, not just a pattern); the DBnomics code is
 * pattern-validated and rejected if it could climb a path segment. Upstream
 * fetches have a timeout. Error responses never echo upstream bodies/headers
 * (which could reflect the key-bearing URL). Mirrors the edge style of
 * api/gate.ts.
 */

import { fredPreset, isAllowedFredSeries, parseFredObservations } from '../src/lib/macro/fred';

export const config = { runtime: 'edge' };

const FRED_API_KEY = process.env.FRED_API_KEY ?? '';

const DBN_API = 'https://api.db.nomics.world/v22';
const FRED_OBS = 'https://api.stlouisfed.org/fred/series/observations';
const ALLOWED_SOURCES = new Set(['fred', 'dbnomics']);
const UPSTREAM_TIMEOUT_MS = 8000;

// DBnomics masks: must START alphanumeric (blocks ".", "..", "..." dot-segments)
// then alnum plus . - : (e.g. "A-FP.CPI.TOTL.ZG-USA").
const DBN_SERIES_RE = /^[A-Za-z0-9][A-Za-z0-9.:-]{0,79}$/;

/** Shared cache policy: short on the CDN, longer stale-while-revalidate. */
const CACHE_HEADER = 'public, s-maxage=86400, stale-while-revalidate=604800';

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

function fetchUpstream(url: string): Promise<Response> {
  return fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

/** DBnomics passthrough — fetch the allowlisted upstream, return its JSON body. */
async function dbnomicsPassthrough(series: string): Promise<Response> {
  const upstream = `${DBN_API}/series/WB/WDI/${series}?observations=1&metadata=false`;
  let res: Response;
  try {
    res = await fetchUpstream(upstream);
  } catch {
    return json({ error: 'Upstream DBnomics request failed or timed out.' }, { status: 502 });
  }
  if (res.status === 404) return json({ error: 'DBnomics has no such series.' }, { status: 404 });
  if (!res.ok) return json({ error: `DBnomics returned HTTP ${res.status}.` }, { status: 502 });
  // Pass the body through verbatim; set only our own headers (don't forward upstream's).
  const body = await res.text();
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': CACHE_HEADER },
  });
}

/** FRED — inject the key server-side, normalize to TimeSeries. Annual history. */
async function fredSeries(series: string): Promise<Response> {
  if (!FRED_API_KEY) {
    return json({ error: 'FRED is not configured on this deployment (no API key set).' }, { status: 501 });
  }
  const u = new URL(FRED_OBS);
  u.searchParams.set('series_id', series);
  u.searchParams.set('api_key', FRED_API_KEY);
  u.searchParams.set('file_type', 'json');
  u.searchParams.set('frequency', 'a'); // annual aggregation — only what we need
  u.searchParams.set('aggregation_method', 'avg');

  let res: Response;
  try {
    res = await fetchUpstream(u.toString());
  } catch {
    return json({ error: 'Upstream FRED request failed or timed out.' }, { status: 502 });
  }
  // Never echo upstream's body/headers on error (its URL reflection could carry the key).
  if (!res.ok) return json({ error: `FRED returned HTTP ${res.status}.` }, { status: 502 });

  let fjson: unknown;
  try {
    fjson = await res.json();
  } catch {
    return json({ error: 'FRED returned invalid JSON.' }, { status: 502 });
  }

  const preset = fredPreset(series);
  try {
    const ts = parseFredObservations(fjson, {
      seriesId: series,
      label: preset?.label ?? series,
      unit: preset?.unit ?? '',
      retrievedAt: new Date().toISOString(),
    });
    return json(ts, { headers: { 'Cache-Control': CACHE_HEADER } });
  } catch {
    return json({ error: 'Could not normalize the FRED response.' }, { status: 502 });
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  const url = new URL(req.url);
  const source = url.searchParams.get('source') ?? '';
  if (!ALLOWED_SOURCES.has(source)) {
    return json({ error: 'Unknown or unsupported source.' }, { status: 400 });
  }

  const series = url.searchParams.get('series') ?? '';

  if (source === 'dbnomics') {
    if (!DBN_SERIES_RE.test(series) || series.includes('..')) {
      return json({ error: 'Invalid DBnomics series code.' }, { status: 400 });
    }
    return dbnomicsPassthrough(series);
  }

  // source === 'fred': syntactic guard + value allowlist (must be a known preset).
  if (!isAllowedFredSeries(series) || !fredPreset(series)) {
    return json({ error: 'Unknown or unsupported FRED series.' }, { status: 400 });
  }
  return fredSeries(series);
}
