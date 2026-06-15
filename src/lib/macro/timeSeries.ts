/**
 * One normalized internal shape for external macro/financial reference data.
 *
 * Every source adapter maps INTO this; the rest of the app never sees raw
 * upstream JSON/SDMX. NA/null observations are preserved (never dropped or
 * interpolated). Parsing is hand-rolled and fails safe on schema drift (a
 * {@link MacroParseError}), matching the repo's `parseWorkbook` convention —
 * Zod is the recommended upgrade once the proxy/multi-source phase lands.
 */

/** Sources we can pull from. DBnomics is browser-direct; FRED is proxy-only. */
export type MacroSourceId = 'dbnomics' | 'fred';

export interface Observation {
  /** Period label as the source reports it, e.g. "2024" or "2024-01". */
  period: string;
  /** Numeric value, or null for NA / missing (preserved, never fabricated). */
  value: number | null;
}

export interface Provenance {
  sourceLabel: string;
  sourceUrl: string;
  license: string;
}

export interface TimeSeries {
  sourceId: MacroSourceId;
  /** Upstream provider behind the source, e.g. "WB" (World Bank) via DBnomics. */
  providerCode: string;
  datasetCode: string;
  indicatorCode: string;
  /** Provider-native series id, e.g. "A-FP.CPI.TOTL.ZG-USA". */
  seriesCode: string;
  seriesName: string;
  /** ISO-3 country code. */
  country: string;
  unit: string;
  /** Frequency label as reported, e.g. "annual" / "monthly". */
  frequency: string;
  observations: Observation[];
  /** ISO timestamp of retrieval (set by the adapter). */
  retrievedAt: string;
  /** True when served from the client cache rather than a fresh request. */
  cached: boolean;
  /** True when this is the bundled offline fallback, not live data. */
  fallback: boolean;
  provenance: Provenance;
}

/** Thrown when an upstream payload doesn't match the expected shape. */
export class MacroParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MacroParseError';
  }
}

/** Thrown when the network request itself fails (offline, CORS, non-2xx). */
export class MacroFetchError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'http' | 'notFound',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MacroFetchError';
  }
}

// --- Pure helpers over a TimeSeries (rendered, never recomputed elsewhere) ---

/** Most recent observation that actually has a value (skips trailing NAs). */
export function latestObservation(ts: TimeSeries): Observation | null {
  for (let i = ts.observations.length - 1; i >= 0; i--) {
    const o = ts.observations[i];
    if (o && o.value != null) return o;
  }
  return null;
}

/** Slice to the last `years` annual points (client-side "only what we need"). */
export function clipToRecent(ts: TimeSeries, years: number): TimeSeries {
  if (years <= 0 || ts.observations.length <= years) return ts;
  return { ...ts, observations: ts.observations.slice(-years) };
}

/** Count of non-null observations — for empty-state decisions. */
export function valueCount(ts: TimeSeries): number {
  return ts.observations.reduce((n, o) => (o.value != null ? n + 1 : n), 0);
}
