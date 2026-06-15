/**
 * Macroeconomic context viewer (spike) — additive section on /data.
 *
 * Pulls ONE World Bank WDI series at a time directly from DBnomics (Class A, no
 * key, CORS-friendly), renders it with a recharts line + KPIs + a provenance
 * footer, and degrades gracefully (loading / error / offline-fallback). No store
 * yet and no proxy — those are later slices. All fetch/normalize logic lives in
 * @/lib/macro; this component only renders.
 */

import { useCallback, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Database, Download, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHART } from '@/components/charts/chartTheme';
import {
  fetchDbnomicsSeries,
  INDICATOR_PRESETS,
  type IndicatorPreset,
  MACRO_COUNTRIES,
} from '@/lib/macro/dbnomics';
import { clipToRecent, latestObservation, MacroFetchError, type TimeSeries, valueCount } from '@/lib/macro/timeSeries';
import { FALLBACK_SERIES } from '@/lib/macro/fallback';
import { cn } from '@/lib/cn';

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

const RANGES = [
  { value: '10', label: '10y' },
  { value: '20', label: '20y' },
  { value: 'all', label: 'All' },
] as const;

function formatValue(v: number): string {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v);
}

function countryName(iso3: string): string {
  return MACRO_COUNTRIES.find((c) => c.iso3 === iso3)?.name ?? iso3;
}

export function MacroContext() {
  const [indicatorCode, setIndicatorCode] = useState<string>(INDICATOR_PRESETS[0]!.indicatorCode);
  const [iso3, setIso3] = useState<string>('USA');
  const [range, setRange] = useState<string>('20');
  const [series, setSeries] = useState<TimeSeries | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const indicator = INDICATOR_PRESETS.find((i) => i.indicatorCode === indicatorCode) ?? INDICATOR_PRESETS[0]!;

  const pull = useCallback(
    async (preset: IndicatorPreset, country: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus({ kind: 'loading' });
      try {
        const ts = await fetchDbnomicsSeries(preset, country, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setSeries(ts);
        setStatus({ kind: 'idle' });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof MacroFetchError && err.kind === 'network'
            ? 'Could not reach DBnomics — you may be offline or the request was blocked.'
            : err instanceof Error
              ? err.message
              : 'Unexpected error pulling the series.';
        setStatus({ kind: 'error', message });
      }
    },
    [],
  );

  const onFetch = () => void pull(indicator, iso3);
  const showFallback = () => {
    setSeries(FALLBACK_SERIES);
    setStatus({ kind: 'idle' });
  };

  const view = series ? clipToRecent(series, range === 'all' ? 0 : Number(range)) : null;
  const latest = view ? latestObservation(view) : null;

  return (
    <Card
      title="03 · Macroeconomic context"
      subtitle="Pull a real reference series (inflation, output, labor) from DBnomics → World Bank WDI."
      right={
        series ? (
          <Badge variant={series.fallback ? 'amber' : series.cached ? 'neutral' : 'green'}>
            {series.fallback ? 'Fallback' : series.cached ? 'Cached' : 'Live'}
          </Badge>
        ) : (
          <Badge variant="outline">DBnomics</Badge>
        )
      }
    >
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <Labelled label="Indicator">
          <Select
            ariaLabel="Indicator"
            value={indicatorCode}
            onChange={setIndicatorCode}
            options={INDICATOR_PRESETS.map((i) => ({ value: i.indicatorCode, label: i.label }))}
          />
        </Labelled>
        <Labelled label="Country">
          <Select
            ariaLabel="Country"
            value={iso3}
            onChange={setIso3}
            options={MACRO_COUNTRIES.map((c) => ({ value: c.iso3, label: c.name }))}
          />
        </Labelled>
        <Labelled label="Range">
          <Segmented<string> ariaLabel="Range" value={range} onChange={setRange} options={RANGES.map((r) => ({ ...r }))} />
        </Labelled>
        <button
          type="button"
          onClick={onFetch}
          disabled={status.kind === 'loading'}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-700 px-3 text-[0.8rem] font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} /> {status.kind === 'loading' ? 'Fetching…' : 'Fetch series'}
        </button>
      </div>

      {/* Body states */}
      <div className="mt-5">
        {status.kind === 'loading' && (
          <div className="flex h-48 items-center justify-center text-[0.85rem] text-muted">Fetching {indicator.label}…</div>
        )}

        {status.kind === 'error' && (
          <div className="rounded-lg border border-brand-red/30 bg-brand-red/5 p-4">
            <div className="flex items-start gap-2 text-[0.85rem] text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-red" />
              <div>
                <p className="font-medium text-brand-red">Couldn’t load the series</p>
                <p className="mt-0.5 text-muted">{status.message}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button type="button" onClick={onFetch} className="rounded-md border border-border bg-card px-2.5 py-1 text-[0.78rem] font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700">
                    Retry
                  </button>
                  <button type="button" onClick={showFallback} className="rounded-md border border-border bg-card px-2.5 py-1 text-[0.78rem] font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700">
                    Show offline fallback
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {status.kind === 'idle' && !view && (
          <EmptyState
            icon={<Database size={22} />}
            title="No series loaded"
            message="Choose an indicator and country, then Fetch series to pull live data from DBnomics."
          />
        )}

        {status.kind === 'idle' && view && (
          <SeriesView ts={view} latest={latest} />
        )}
      </div>
    </Card>
  );
}

function SeriesView({ ts, latest }: { ts: TimeSeries; latest: ReturnType<typeof latestObservation> }) {
  const count = valueCount(ts);
  const first = ts.observations[0]?.period ?? '—';
  const last = ts.observations[ts.observations.length - 1]?.period ?? '—';

  const kpis: KpiItem[] = [
    {
      label: 'Latest value',
      value: latest ? `${formatValue(latest.value as number)}` : '—',
      sub: latest ? `${ts.unit} · ${latest.period}` : 'no value',
      accent: 'navy',
    },
    { label: 'Coverage', value: `${count}`, sub: `points · ${first}–${last}`, accent: 'default' },
    { label: 'Frequency', value: ts.frequency, sub: ts.providerCode + ' ' + ts.datasetCode, accent: 'default' },
  ];

  const chartData = ts.observations.map((o) => ({ period: o.period, value: o.value }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[0.9rem] font-semibold text-ink">{ts.seriesName}</h3>
        <p className="text-[0.76rem] text-muted">{countryName(ts.country)} · {ts.country}</p>
      </div>

      <KpiStrip items={kpis} className="sm:grid-cols-3" />

      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatValue(v)} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const v = payload[0]?.value;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] shadow-pop">
                    <div className="font-semibold text-ink">{String(label)}</div>
                    <div className="text-muted">
                      {typeof v === 'number' ? `${formatValue(v)} ${ts.unit}` : 'no data (NA)'}
                    </div>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="value" stroke={CHART.firm} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Provenance footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[0.72rem] text-muted">
        <span className="font-medium text-ink-soft">{ts.provenance.sourceLabel}</span>
        <span>License: {ts.provenance.license}</span>
        <span>Retrieved: {new Date(ts.retrievedAt).toLocaleDateString()}</span>
        <span className={cn('inline-flex items-center gap-1', ts.fallback ? 'text-[#9A7212]' : 'text-brand-green')}>
          {ts.fallback ? 'Offline fallback' : ts.cached ? 'From cache' : 'Live pull'}
        </span>
        <a
          href={ts.provenance.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 font-medium text-navy-700 hover:underline"
        >
          View on DBnomics <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}
