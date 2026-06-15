/**
 * Client-side access to our serverless macro proxy (`/api/macro`).
 *
 * Used for Class B sources (FRED) that the browser cannot reach directly, and as
 * the CORS/offline fallback for Class A. The proxy returns the internal
 * {@link TimeSeries} shape for FRED; we still guard it at runtime so a bad
 * response can't crash a view. Range is applied client-side (clipToRecent), so
 * the proxy always returns full annual history — no date params needed here.
 */

import { MacroFetchError, MacroParseError, type Observation, type TimeSeries } from './timeSeries';
import type { FredPreset } from './fred';

const SOURCE_IDS = new Set(['dbnomics', 'fred']);

/** Sound structural guard for a TimeSeries coming back from the proxy. */
export function isTimeSeries(v: unknown): v is TimeSeries {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  if (typeof t.sourceId !== 'string' || !SOURCE_IDS.has(t.sourceId)) return false;
  for (const k of ['seriesName', 'country', 'unit', 'frequency', 'retrievedAt'] as const) {
    if (typeof t[k] !== 'string') return false;
  }
  if (typeof t.fallback !== 'boolean') return false;
  if (!Array.isArray(t.observations)) return false;
  const okObs = (t.observations as unknown[]).every((o) => {
    const r = o as Record<string, unknown> | null;
    return !!r && typeof r.period === 'string' && (r.value === null || typeof r.value === 'number');
  });
  if (!okObs) return false;
  const p = t.provenance as Record<string, unknown> | null;
  return !!p && typeof p.sourceLabel === 'string' && typeof p.sourceUrl === 'string' && typeof p.license === 'string';
}

const isJson = (res: Response): boolean => (res.headers.get('content-type') ?? '').includes('application/json');

/** Fetch a FRED series through the proxy (the key is injected server-side). */
export async function fetchFredSeries(preset: FredPreset, opts: { signal?: AbortSignal } = {}): Promise<TimeSeries> {
  const params = new URLSearchParams({ source: 'fred', series: preset.seriesId });

  let res: Response;
  try {
    res = await fetch(`/api/macro?${params.toString()}`, { signal: opts.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new MacroFetchError('Could not reach the data proxy (offline?).', 'network');
  }

  // In `vite dev` there are no serverless functions, so /api/macro returns the
  // SPA HTML — diagnose that first, regardless of status code.
  if (!isJson(res)) {
    throw new MacroFetchError('The proxy isn’t available in this environment (run `vercel dev` or deploy).', 'network');
  }
  if (res.status === 501) throw new MacroFetchError('FRED isn’t configured on this deployment yet.', 'http', 501);
  if (!res.ok) throw new MacroFetchError(`Proxy returned HTTP ${res.status}.`, 'http', res.status);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new MacroParseError('Proxy returned invalid JSON.');
  }
  if (!isTimeSeries(data)) throw new MacroParseError('Proxy returned an unexpected shape.');

  const observations: Observation[] = data.observations.map((o) => ({ period: o.period, value: o.value }));
  return { ...data, observations, cached: false };
}
