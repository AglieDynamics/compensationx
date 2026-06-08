/**
 * Module 7 — Pulse Survey (STRETCH).
 *
 * Long-format conflict-impact responses, compared GCC vs Non-GCC per section.
 * Activates when a workbook with a "Raw Data" sheet is ingested; otherwise a
 * tidy empty-state. No fabricated data — everything renders from dataset.pulse.
 */

import { useMemo } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { CHART } from '@/components/charts/chartTheme';
import { formatCount, formatPct } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import { buildPulseSummary, type PulseSectionSummary } from './pulseModel';
import { PulseBars } from './PulseBars';

export function PulseSurvey() {
  const pulse = useAppStore((s) => s.dataset.pulse);
  const summary = useMemo(() => (pulse ? buildPulseSummary(pulse) : null), [pulse]);

  if (!summary || summary.total === 0) {
    return (
      <ModuleShell title="Pulse Survey" subtitle="GCC vs Non-GCC conflict-impact responses" module={7}>
        <EmptyState
          title="No pulse data loaded"
          message="The Pulse module activates when a workbook containing a long-format “Raw Data” sheet (Area · Section · Question · Response) is ingested. Upload one in Data Ingestion to populate this view."
        />
      </ModuleShell>
    );
  }

  const kpis: KpiItem[] = [
    { label: 'Total responses', value: formatCount(summary.total), accent: 'navy' },
    {
      label: 'GCC responses',
      value: formatCount(summary.gcc),
      sub: formatPct(summary.total ? summary.gcc / summary.total : 0, 0),
      accent: 'navy',
    },
    {
      label: 'Non-GCC responses',
      value: formatCount(summary.nonGcc),
      sub: formatPct(summary.total ? summary.nonGcc / summary.total : 0, 0),
      accent: 'navy',
    },
    { label: 'Sections', value: formatCount(summary.sections.length), accent: 'navy' },
  ];

  const tabs: TabItem[] = summary.sections.map((section) => ({
    value: section.section,
    label: section.section,
    content: <SectionCard section={section} />,
  }));

  return (
    <ModuleShell
      title="Pulse Survey"
      subtitle="GCC vs Non-GCC conflict-impact responses, by section"
      module={7}
    >
      <KpiStrip items={kpis} className="xl:grid-cols-4" />
      <Card
        title="Section breakdown"
        subtitle="Response distribution per section, compared between GCC and Non-GCC respondents."
      >
        <Tabs items={tabs} ariaLabel="Pulse survey sections" />
      </Card>
    </ModuleShell>
  );
}

function SectionCard({ section }: { section: PulseSectionSummary }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART.firm }} />
          GCC <span className="font-semibold text-ink">{formatCount(section.gcc)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART.blue400 }} />
          Non-GCC <span className="font-semibold text-ink">{formatCount(section.nonGcc)}</span>
        </span>
        <span>
          Total <span className="font-semibold text-ink">{formatCount(section.total)}</span> responses
        </span>
      </div>
      <PulseBars tallies={section.tallies} />
    </div>
  );
}
