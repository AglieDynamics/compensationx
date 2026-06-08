/**
 * Module 2 — Benchmark Worksheet.
 *
 * Reproduces the five interrelated Vencon worksheet blocks for the chosen
 * component × weighting × period:
 *   1. Your Firm's Data
 *   2. Positioning & Compa-Ratios
 *   3. Market Statistics
 *   4. Market Percentile Matrix
 *   5. Interactive market-range chart
 *
 * Shared filters (weighting/period/component) stay in the global store; the
 * Target Market Percentile is edited locally (overall or per-level) so the
 * compa-ratios, deltas, RAG and dashed target line all recompute live.
 */

import { useMemo, useState } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import {
  ComponentSegmented,
  PeriodToggle,
  WeightingToggle,
} from '@/components/layout/Filters';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { RagLegend } from '@/components/ui/RagBadge';
import { DerivedTag } from '@/components/ui/Badge';
import { RangeChart, type RangePoint } from '@/components/charts/RangeChart';
import { LEVELS, subLevelLabel, subLevelsOf, type SubLevel } from '@/domain/levels';
import { COMPONENT_LABELS } from '@/domain/components';
import {
  deviationPct,
  marketValueAtPercentile,
  quartileBox,
  ragStatus,
} from '@/lib/benchmark';
import { formatPercentileLabel } from '@/lib/format';
import { useActiveTable, useAppStore } from '@/store/useAppStore';
import { TmpEditor } from './TmpEditor';
import { FirmDataTable } from './FirmDataTable';
import { PositioningTable } from './PositioningTable';
import { MarketStatsTable } from './MarketStatsTable';
import { PercentileMatrix } from './PercentileMatrix';
import { initTmpState, tmpForSubLevel, type TmpState } from './tmp';

export function Worksheet() {
  const meta = useAppStore((s) => s.dataset.meta);
  const weighting = useAppStore((s) => s.weighting);
  const period = useAppStore((s) => s.period);
  const component = useAppStore((s) => s.component);
  const seedPercentile = useAppStore((s) => s.targetPercentile);
  const table = useActiveTable();

  const [tmpState, setTmpState] = useState<TmpState>(() => initTmpState(seedPercentile));

  // The worksheet always benchmarks the full ladder of 20 sublevels.
  const subLevels = useMemo<SubLevel[]>(
    () => LEVELS.flatMap((l) => [...subLevelsOf(l)]),
    [],
  );

  const rangeData = useMemo<RangePoint[]>(() => {
    if (!table) return [];
    return subLevels
      .map((sl) => {
        const row = table.rows[sl];
        if (!row) return null;
        const box = quartileBox(row);
        const firm = row.firm.median;
        const tmpVal = marketValueAtPercentile(row.percentiles, tmpForSubLevel(tmpState, sl));
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
  }, [table, subLevels, tmpState]);

  const componentLabel = COMPONENT_LABELS[component];
  const weightingLabel = weighting === 'FIRM' ? 'Firm-weighted' : 'Incumbent-weighted';
  const periodLabel = period === 'TARGET' ? `${meta.reportYear} target` : `${meta.reportYear - 1} actual`;
  const subtitle = `${componentLabel} · ${weightingLabel} · ${periodLabel}`;

  const targetSummary =
    tmpState.mode === 'overall'
      ? formatPercentileLabel(tmpState.overall)
      : 'per level';

  if (!table) {
    return (
      <ModuleShell
        title="Benchmark Worksheet"
        subtitle={subtitle}
        module={2}
        controls={<WorksheetControls tmpState={tmpState} onTmpChange={setTmpState} />}
      >
        <Card
          title={`${componentLabel} worksheet`}
          subtitle="The five worksheet blocks render once this combination is present."
        >
          <EmptyState
            message={`No ${componentLabel} data for ${weightingLabel.toLowerCase()} ${period.toLowerCase()}. Switch weighting, period or component — or ingest the source workbook to populate this combination.`}
          />
        </Card>
      </ModuleShell>
    );
  }

  const derivedTag = table.derived ? <DerivedTag title={table.note} /> : undefined;

  const tableTabs: TabItem[] = [
    {
      value: 'firm',
      label: "Your Firm's Data",
      content: <FirmDataTable table={table} subLevels={subLevels} />,
    },
    {
      value: 'positioning',
      label: 'Positioning & Compa-Ratios',
      content: (
        <div className="space-y-3">
          <PositioningTable table={table} subLevels={subLevels} tmpState={tmpState} />
          <RagLegend />
        </div>
      ),
    },
    {
      value: 'market',
      label: 'Market Statistics',
      content: <MarketStatsTable table={table} subLevels={subLevels} />,
    },
    {
      value: 'matrix',
      label: 'Percentile Matrix',
      content: <PercentileMatrix table={table} subLevels={subLevels} />,
    },
  ];

  return (
    <ModuleShell
      title="Benchmark Worksheet"
      subtitle={subtitle}
      module={2}
      controls={<WorksheetControls tmpState={tmpState} onTmpChange={setTmpState} />}
    >
      <Card
        title={`Market range by sublevel — ${componentLabel}`}
        subtitle="Market box-and-whisker (5th–95th) with Your Firm median and the target percentile overlaid. Editing the target moves the dashed line and recolours the firm markers live."
        right={derivedTag}
      >
        <RangeChart
          data={rangeData}
          unit={table.unit}
          targetLabel={targetSummary}
        />
      </Card>

      <Card
        title="Worksheet detail"
        subtitle="All five blocks for the selected component. Positioning, deltas and compa-ratios track the target percentile above."
        right={derivedTag}
        bodyClassName="px-5 py-4"
      >
        <Tabs items={tableTabs} ariaLabel="Worksheet detail blocks" />
      </Card>
    </ModuleShell>
  );
}

function WorksheetControls({
  tmpState,
  onTmpChange,
}: {
  tmpState: TmpState;
  onTmpChange: (next: TmpState) => void;
}) {
  return (
    <>
      <WeightingToggle />
      <PeriodToggle />
      <ComponentSegmented />
      <TmpEditor state={tmpState} onChange={onTmpChange} />
    </>
  );
}
