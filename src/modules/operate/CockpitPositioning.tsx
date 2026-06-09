/**
 * C2 — Job-Family Positioning Console. A sortable / filterable table by
 * family×level converging employees + survey + structure: headcount, internal
 * midpoint, avg pay, market reference, compa-ratio, market compa-ratio, avg range
 * penetration and a recommended action. Filter chips narrow to below-market,
 * over-market-low-performer, red/green-circle and compression segments. The
 * Module D anomaly flags (heuristics.anomalyFlags) surface alongside.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { RagBadge } from '@/components/ui/RagBadge';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CompContext } from '@/lib/compContext';
import type { Structure } from '@/lib/comp';
import { marketReference } from '@/lib/marketReference';
import { anomalyFlags, type AnomalyFlag } from '@/lib/heuristics';
import { JOB_FAMILIES } from '@/lib/assumptions';
import { LEVELS, type Level, LEVEL_LABELS_SHORT } from '@/domain/levels';
import { formatCompaRatio, formatCount, formatGndK, formatPct } from '@/lib/format';
import { cn } from '@/lib/cn';
import { HEURISTIC_LABEL, isNum, mean } from './cockpitShared';

interface Props {
  ctx: CompContext;
  structure: Structure;
}

interface PositioningRow {
  key: string;
  family: string;
  level: Level;
  headcount: number;
  midpoint: number | null;
  avgPay: number | null;
  marketRef: number | null;
  compaRatio: number | null;
  marketCompa: number | null;
  avgPenetration: number | null;
  belowMin: number;
  aboveMax: number;
  lowPerfOverMarket: number;
  action: 'raise' | 'review' | 'hold';
}

type SortKey = 'family' | 'headcount' | 'compaRatio' | 'marketCompa' | 'avgPenetration' | 'gap';
type FilterChip = 'all' | 'below-market' | 'over-market-low-perf' | 'green-circle' | 'red-circle' | 'compression';

const CHIPS: { value: FilterChip; label: string }[] = [
  { value: 'all', label: 'All segments' },
  { value: 'below-market', label: 'Below market' },
  { value: 'over-market-low-perf', label: 'Over-market low performers' },
  { value: 'green-circle', label: 'Green-circle (below min)' },
  { value: 'red-circle', label: 'Red-circle (above max)' },
  { value: 'compression', label: 'Compression' },
];

export function CockpitPositioning({ ctx, structure }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('gap');
  const [asc, setAsc] = useState(false);
  const [chip, setChip] = useState<FilterChip>('all');

  const flags = useMemo(
    () => anomalyFlags(ctx.mappings, ctx.employees, structure.grades.map((g) => ({ grade: g.grade, midpoint: g.midpoint }))),
    [ctx.mappings, ctx.employees, structure],
  );
  const compressionSubjects = useMemo(
    () => new Set(flags.filter((f) => f.kind === 'compression').map((f) => f.subject)),
    [flags],
  );

  const rows = useMemo<PositioningRow[]>(() => {
    const out: PositioningRow[] = [];
    for (const family of JOB_FAMILIES) {
      for (const level of LEVELS) {
        const segMappings = ctx.mappings.filter(
          (m) => m.employee.jobFamily === family && m.employee.level === level,
        );
        if (segMappings.length === 0) continue;
        const emps = segMappings.map((m) => m.employee);
        const grade = structure.grades.find((g) => g.level === level) ?? null;
        const midpoint = grade?.midpoint ?? null;
        const ref = marketReference(ctx.surveyDataset, ctx.assumptions, { level, jobFamily: family, percentile: 0.5 });
        const marketRef = ref?.value ?? null;
        const avgPay = mean(emps.map((e) => e.basePay));
        const compaRatio = mean(segMappings.map((m) => m.compaRatio));
        const marketCompa = isNum(avgPay) && isNum(marketRef) && marketRef > 0 ? avgPay / marketRef : null;
        const avgPenetration = mean(segMappings.map((m) => m.rangePenetration));
        const belowMin = segMappings.filter((m) => m.belowMin).length;
        const aboveMax = segMappings.filter((m) => m.aboveMax).length;
        const lowPerfOverMarket = segMappings.filter(
          (m) => (m.employee.performanceRating ?? 3) <= 2 && isNum(m.compaRatio) && m.compaRatio > 1.05,
        ).length;

        const action: PositioningRow['action'] = isNum(marketCompa)
          ? marketCompa < 0.95
            ? 'raise'
            : marketCompa > 1.1 || lowPerfOverMarket > 0
              ? 'review'
              : 'hold'
          : 'hold';

        out.push({
          key: `${family}-${level}`,
          family,
          level,
          headcount: emps.length,
          midpoint,
          avgPay,
          marketRef,
          compaRatio,
          marketCompa,
          avgPenetration,
          belowMin,
          aboveMax,
          lowPerfOverMarket,
          action,
        });
      }
    }
    return out;
  }, [ctx.mappings, ctx.surveyDataset, ctx.assumptions, structure]);

  const segmentHasCompression = useMemo(() => {
    const set = new Set<string>();
    for (const m of ctx.mappings) {
      if (compressionSubjects.has(m.employee.id)) set.add(`${m.employee.jobFamily}-${m.employee.level}`);
    }
    return set;
  }, [ctx.mappings, compressionSubjects]);

  const filtered = useMemo(() => {
    const matchChip = (r: PositioningRow): boolean => {
      switch (chip) {
        case 'below-market':
          return isNum(r.marketCompa) && r.marketCompa < 0.97;
        case 'over-market-low-perf':
          return r.lowPerfOverMarket > 0;
        case 'green-circle':
          return r.belowMin > 0;
        case 'red-circle':
          return r.aboveMax > 0;
        case 'compression':
          return segmentHasCompression.has(r.key);
        default:
          return true;
      }
    };
    const gapOf = (r: PositioningRow): number => (isNum(r.marketCompa) ? r.marketCompa : 999);
    const sorted = [...rows].filter(matchChip).sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'family':
          cmp = a.family.localeCompare(b.family) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
          break;
        case 'headcount':
          cmp = a.headcount - b.headcount;
          break;
        case 'compaRatio':
          cmp = (a.compaRatio ?? -1) - (b.compaRatio ?? -1);
          break;
        case 'marketCompa':
          cmp = (a.marketCompa ?? -1) - (b.marketCompa ?? -1);
          break;
        case 'avgPenetration':
          cmp = (a.avgPenetration ?? -1) - (b.avgPenetration ?? -1);
          break;
        case 'gap':
          cmp = gapOf(a) - gapOf(b);
          break;
      }
      return asc ? cmp : -cmp;
    });
    return sorted;
  }, [rows, chip, sortKey, asc, segmentHasCompression]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === 'family');
    }
  };

  const sortHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'right') => (
    <button
      type="button"
      onClick={() => onSort(key)}
      className={cn('inline-flex items-center gap-1 hover:text-navy-700', align === 'right' ? 'flex-row-reverse' : '')}
    >
      {label}
      {sortKey === key && (asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  );

  const columns: Column<PositioningRow>[] = [
    { key: 'seg', header: sortHeader('Family · Level', 'family', 'left'), align: 'left', render: (r) => (
      <span className="font-medium text-ink">{r.family} · {LEVEL_LABELS_SHORT[r.level]}</span>
    ) },
    { key: 'hc', header: sortHeader('Heads', 'headcount'), align: 'right', render: (r) => <span className="tabular-nums">{formatCount(r.headcount)}</span> },
    { key: 'mid', header: 'Midpoint', align: 'right', render: (r) => <span className="tabular-nums text-muted">{formatGndK(r.midpoint, 1)}</span> },
    { key: 'pay', header: 'Avg pay', align: 'right', render: (r) => <span className="tabular-nums">{formatGndK(r.avgPay, 1)}</span> },
    { key: 'mkt', header: 'Market ref', align: 'right', render: (r) => <span className="tabular-nums text-muted">{formatGndK(r.marketRef, 1)}</span> },
    { key: 'compa', header: sortHeader('Compa', 'compaRatio'), align: 'right', render: (r) => <span className="tabular-nums font-medium">{formatCompaRatio(r.compaRatio)}</span> },
    { key: 'mcompa', header: sortHeader('Mkt compa', 'marketCompa'), align: 'right', render: (r) => (
      <span className={cn('tabular-nums font-medium', isNum(r.marketCompa) && r.marketCompa < 0.95 ? 'text-brand-red' : isNum(r.marketCompa) && r.marketCompa > 1.1 ? 'text-[#9A7212]' : 'text-ink')}>
        {formatCompaRatio(r.marketCompa)}
      </span>
    ) },
    { key: 'pen', header: sortHeader('Avg pen.', 'avgPenetration'), align: 'right', render: (r) => <span className="tabular-nums text-muted">{formatPct(r.avgPenetration, 0)}</span> },
    { key: 'circ', header: 'Circles', align: 'center', render: (r) => (
      <span className="inline-flex items-center gap-1 text-[0.72rem] tabular-nums">
        {r.belowMin > 0 && <span className="rounded bg-brand-amber/15 px-1.5 py-0.5 text-[#9A7212]" title="green-circle (below min)">G {r.belowMin}</span>}
        {r.aboveMax > 0 && <span className="rounded bg-brand-red/10 px-1.5 py-0.5 text-brand-red" title="red-circle (above max)">R {r.aboveMax}</span>}
        {r.belowMin === 0 && r.aboveMax === 0 && <span className="text-muted">—</span>}
      </span>
    ) },
    { key: 'action', header: 'Action', align: 'center', render: (r) => (
      <RagBadge
        status={r.action === 'raise' ? 'red' : r.action === 'review' ? 'amber' : 'green'}
        label={r.action === 'raise' ? 'Raise to market' : r.action === 'review' ? 'Review' : 'Hold'}
      />
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setChip(c.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[0.74rem] font-medium transition-colors',
              chip === c.value
                ? 'border-navy-500 bg-navy-500/10 text-navy-700'
                : 'border-border bg-card text-muted hover:border-navy-500/40 hover:text-navy-700',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card
        title="Job-family positioning"
        subtitle={`Family×level convergence of employees, survey and structure. ${formatCount(filtered.length)} of ${formatCount(rows.length)} segments.`}
        right={<ProvenanceChip provenance="MEASURED" label="Employees" />}
        flush
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState compact title="No segments match this filter" message="Clear the filter chip to see all family×level segments." />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.key}
            maxHeight={520}
            highlightRow={(r) => r.action === 'raise'}
          />
        )}
      </Card>

      <Card
        title="Anomaly flags"
        subtitle="Statistical outliers (z-score + IQR within family×level×geo), compression and midpoint-progression inconsistencies."
        right={<ProvenanceChip provenance="ASSUMED" />}
      >
        <AnomalyList flags={flags} />
        <p className="mt-3 text-[0.68rem] text-muted">{HEURISTIC_LABEL}</p>
      </Card>
    </div>
  );
}

function AnomalyList({ flags }: { flags: AnomalyFlag[] }) {
  const [showAll, setShowAll] = useState(false);
  if (flags.length === 0) {
    return <EmptyState compact message="No statistical anomalies detected in the current population." />;
  }
  const visible = showAll ? flags : flags.slice(0, 8);
  return (
    <div>
      <ul className="divide-y divide-border">
        {visible.map((f) => (
          <li key={`${f.kind}-${f.subject}`} className="flex items-start gap-3 py-2">
            <span
              className={cn(
                'mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.64rem] font-semibold',
                f.severity === 'red' ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-amber/15 text-[#9A7212]',
              )}
            >
              {f.severity === 'red' ? 'High' : 'Watch'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.82rem] font-medium text-ink">{f.label}</div>
              <div className="text-[0.72rem] leading-snug text-muted">{f.message}</div>
            </div>
            {isNum(f.statistic) && (
              <span className="shrink-0 text-[0.72rem] tabular-nums text-ink-soft" title="triggering statistic">
                {f.metric === 'compression' || f.metric === 'progression'
                  ? `${(f.statistic * 100).toFixed(0)}%`
                  : `z ${f.statistic.toFixed(1)}`}
              </span>
            )}
          </li>
        ))}
      </ul>
      {flags.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-[0.74rem] font-semibold text-navy-500 hover:text-navy-700"
        >
          {showAll ? 'Show fewer' : `Show all ${flags.length} flags`}
        </button>
      )}
    </div>
  );
}
