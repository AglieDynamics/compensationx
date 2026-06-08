import { useMemo } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { WeightingToggle } from '@/components/layout/Filters';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { EmptyState } from '@/components/ui/EmptyState';
import { DerivedTag, IllustrativeTag } from '@/components/ui/Badge';
import { unitOf, WEIGHTING_LABELS } from '@/domain/components';
import { formatMultiplier, formatSignedPct } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import {
  buildBoxSection,
  buildGrowthRows,
  buildYoYSection,
  growthBand,
  SUMMARY_BOX_COMPONENTS,
} from './summaryModel';
import { BoxPairChart } from './BoxPairChart';
import { YoYChart } from './YoYChart';
import { GrowthBars, GrowthBandBadge } from './GrowthBars';

/** Headline component for the YoY card (Basic Salary drives the executive read). */
const HEADLINE_COMPONENT = 'BASIC_SALARY' as const;

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Mean of the finite values, or null when none are finite. */
function meanOf(values: (number | null)[]): number | null {
  const nums = values.filter(isNum);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function ExecutiveSummary() {
  const dataset = useAppStore((s) => s.dataset);
  const meta = useAppStore((s) => s.dataset.meta);
  const weighting = useAppStore((s) => s.weighting);

  const boxSections = useMemo(
    () => SUMMARY_BOX_COMPONENTS.map((c) => buildBoxSection(dataset, weighting, c)),
    [dataset, weighting],
  );
  const headlineYoY = useMemo(
    () => buildYoYSection(dataset, weighting, HEADLINE_COMPONENT),
    [dataset, weighting],
  );
  const growthRows = useMemo(() => buildGrowthRows(dataset, weighting), [dataset, weighting]);

  const avgYoY = headlineYoY.source !== 'none' ? meanOf(headlineYoY.rows.map((r) => r.pct)) : null;
  const basicGrowth = growthRows.find((r) => r.component === 'BASIC_SALARY') ?? null;
  const tccGrowth = growthRows.find((r) => r.component === 'TCC') ?? null;

  const kpis: KpiItem[] = [
    { label: 'Report scope', value: `${meta.country} ${meta.reportYear}`, sub: meta.currency, accent: 'navy' },
    {
      label: 'Basic Salary YoY',
      value: headlineYoY.source !== 'none' ? formatSignedPct(avgYoY) : '—',
      sub: headlineYoY.source === 'live' ? `Avg across levels · vs ${headlineYoY.prevYear}` : 'Reference median',
      accent: isNum(avgYoY) && avgYoY > 0 ? 'green' : 'default',
    },
    {
      label: 'Basic Salary growth',
      value: basicGrowth ? formatMultiplier(basicGrowth.value) : '—',
      sub: 'Entry → top market midpoint',
      // Growth is informational (not a RAG signal) — keep it neutral navy.
      accent: 'navy',
    },
    {
      label: 'TCC growth',
      value: tccGrowth ? formatMultiplier(tccGrowth.value) : '—',
      sub: tccGrowth?.illustrative ? 'Illustrative reference' : 'Entry → top',
      accent: 'default',
    },
    {
      label: 'Salary forecast',
      value: formatSignedPct(meta.salaryForecastPct),
      sub: `${meta.reportYear} market outlook`,
      accent: 'navy',
    },
  ];

  const weightLabel = WEIGHTING_LABELS[weighting];
  const subtitle = `Target vs actual ranges, year-on-year movement and pay growth · ${weightLabel}`;

  return (
    <ModuleShell
      title="Executive Summary"
      subtitle={subtitle}
      module={3}
      controls={<WeightingToggle />}
    >
      <KpiStrip items={kpis} className="xl:grid-cols-5" />

      {/* A — Target vs Actual box charts per component */}
      <Card
        title="Target vs actual pay ranges"
        subtitle="Market five-number summary (5th–95th whisker, 25th–75th box, median) by career level — current-year target against prior-year actual."
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
          {boxSections.map((section) => (
            <div key={section.component} className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
                <h3 className="text-[0.82rem] font-semibold text-ink">{section.label}</h3>
                {section.present && section.derived ? <DerivedTag title={section.note} /> : null}
              </div>
              {section.present && section.unit ? (
                <BoxPairChart rows={section.rows} unit={section.unit} />
              ) : (
                <EmptyState
                  compact
                  message={`No ${section.label.toLowerCase()} target/actual tables in the ${weightLabel.toLowerCase()} sample.`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* B — YoY median comparison */}
      <Card
        title={`Year-on-year median change — ${headlineYoY.label}`}
        subtitle={`${headlineYoY.prevYear} actual vs ${headlineYoY.currentYear} target market medians, with the per-level % change.`}
        right={
          headlineYoY.source === 'live' && headlineYoY.derived ? (
            <DerivedTag title="Prior-year medians derived from published YoY figures" />
          ) : headlineYoY.source === 'reference' && headlineYoY.illustrative ? (
            <IllustrativeTag />
          ) : undefined
        }
      >
        <YoYChart section={headlineYoY} unit={unitOf(headlineYoY.component)} />
      </Card>

      {/* C — Growth-factor bars */}
      <Card
        title="Pay growth factor by component"
        subtitle="Top-rung market midpoint over entry-rung midpoint (Principal vs Analyst). Methodology bands: limited <8×, solid 8–11×, strong >11×."
        right={basicGrowth ? <GrowthBandBadge band={growthBand(basicGrowth.value)} /> : undefined}
      >
        {growthRows.length > 0 ? (
          <GrowthBars rows={growthRows} />
        ) : (
          <EmptyState compact message="No growth factors available for this selection." />
        )}
      </Card>
    </ModuleShell>
  );
}
