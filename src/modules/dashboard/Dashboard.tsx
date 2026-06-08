import { useMemo } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import {
  ComponentSegmented,
  LevelChips,
  PeriodToggle,
  TargetPercentileControl,
  WeightingToggle,
} from '@/components/layout/Filters';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { EmptyState } from '@/components/ui/EmptyState';
import { DerivedTag } from '@/components/ui/Badge';
import { RangeChart, type RangePoint } from '@/components/charts/RangeChart';
import { DistributionBars } from '@/components/charts/DistributionBars';
import { PercentileTable } from './PercentileTable';
import { LEVEL_LABELS_SHORT, LEVELS, subLevelLabel, subLevelsOf, type SubLevel } from '@/domain/levels';
import { COMPONENT_LABELS } from '@/domain/components';
import {
  deviationPct,
  overallCompaRatio,
  quartileBox,
  ragStatus,
  tmpAt,
} from '@/lib/benchmark';
import { formatCompaRatio, formatCount, formatPercentileLabel } from '@/lib/format';
import { useActiveTable, useAppStore } from '@/store/useAppStore';

export function Dashboard() {
  const meta = useAppStore((s) => s.dataset.meta);
  const distribution = useAppStore((s) => s.dataset.distribution);
  const weighting = useAppStore((s) => s.weighting);
  const period = useAppStore((s) => s.period);
  const component = useAppStore((s) => s.component);
  const levels = useAppStore((s) => s.levels);
  const tmp = useAppStore((s) => s.targetPercentile);
  const table = useActiveTable();

  const subLevels = useMemo<SubLevel[]>(
    () => LEVELS.filter((l) => levels.includes(l)).flatMap((l) => [...subLevelsOf(l)]),
    [levels],
  );

  const rangeData = useMemo<RangePoint[]>(() => {
    if (!table) return [];
    return subLevels
      .map((sl) => {
        const row = table.rows[sl];
        if (!row) return null;
        const box = quartileBox(row);
        const firm = row.firm.median;
        const tmpVal = tmpAt(row, tmp);
        return {
          name: subLevelLabel(sl),
          min: box.min,
          q1: box.q1,
          median: box.median,
          q3: box.q3,
          max: box.max,
          firm,
          tmp: tmpVal,
          rag: ragStatus(deviationPct(firm, tmpVal)),
        } satisfies RangePoint;
      })
      .filter((d): d is RangePoint => d !== null);
  }, [table, subLevels, tmp]);

  const overall = table ? overallCompaRatio(table, tmp) : null;

  const kpis: KpiItem[] = [
    { label: 'Participating firms', value: formatCount(meta.participatingFirms), accent: 'navy' },
    { label: 'Market incumbents', value: formatCount(meta.marketIncumbents), accent: 'navy' },
    { label: 'Your Firm incumbents', value: formatCount(meta.yourFirmIncumbents), accent: 'navy' },
    { label: 'Target percentile', value: formatPercentileLabel(tmp), accent: 'navy' },
    {
      label: 'Overall compa-ratio',
      value: overall != null ? formatCompaRatio(overall) : '—',
      sub: overall != null ? `vs market ${formatPercentileLabel(tmp)}` : 'Headcount-weighted',
      // Informational ratio, not a RAG signal — keep it brand-navy (avoid amber overload).
      accent: 'navy',
    },
  ];

  const distRows = LEVELS.map((l) => ({
    label: LEVEL_LABELS_SHORT[l],
    firm: distribution.firm[l],
    market: distribution.market[l],
  }));

  const componentLabel = COMPONENT_LABELS[component];
  const subtitle = `${componentLabel} · ${weighting === 'FIRM' ? 'Firm-weighted' : 'Incumbent-weighted'} · ${period === 'TARGET' ? `${meta.reportYear} target` : `${meta.reportYear - 1} actual`}`;

  return (
    <ModuleShell
      title="Summary Dashboard"
      subtitle={subtitle}
      module={1}
      controls={
        <>
          <WeightingToggle />
          <PeriodToggle />
          <ComponentSegmented />
          <LevelChips />
          <TargetPercentileControl />
        </>
      }
    >
      <KpiStrip items={kpis} />

      <Card
        title={`Market range by sublevel — ${componentLabel}`}
        subtitle="Market range (min–max whisker, 25th–75th box, median tick) with Your Firm and target percentile overlaid."
        right={table?.derived ? <DerivedTag title={table.note} /> : undefined}
      >
        {table ? (
          <RangeChart data={rangeData} unit={table.unit} targetLabel={formatPercentileLabel(tmp)} />
        ) : (
          <EmptyState message={`No ${componentLabel} data for ${weighting === 'FIRM' ? 'firm' : 'incumbent'}-weighted ${period.toLowerCase()}. Ingest the source workbook to populate this combination.`} />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Percentile-differentiated benchmark"
          subtitle="Your Firm max/median/min against the market percentile curve."
        >
          {table && subLevels.length > 0 ? (
            <PercentileTable table={table} subLevels={subLevels} targetPercentile={tmp} />
          ) : (
            <EmptyState compact message="No data for this selection." />
          )}
        </Card>

        <Card
          title="Incumbent distribution"
          subtitle="Your Firm vs market headcount by level."
        >
          <DistributionBars rows={distRows} />
        </Card>
      </div>
    </ModuleShell>
  );
}
