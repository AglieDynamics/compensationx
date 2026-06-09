import { useMemo } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { PercentileSlider } from '@/components/ui/PercentileSlider';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { Waterfall, type WaterfallStep } from '@/components/charts/Waterfall';
import { MidpointLadder } from '@/components/operate/MidpointLadder';
import { OverlapMap } from '@/components/operate/OverlapMap';
import { PositioningGrid } from '@/components/operate/PositioningGrid';
import { ConfidenceMeter } from '@/components/operate/ConfidenceMeter';
import { LEVELS } from '@/domain/levels';
import type { ProgressionMethod } from '@/domain/structure';
import { JOB_FAMILIES } from '@/lib/assumptions';
import {
  costToPolicy,
  equityTensionScore,
  mapEmployees,
  structureDebt,
  talentScarcityPremium,
} from '@/lib/comp';
import { marketReference } from '@/lib/marketReference';
import { useCompContext } from '@/lib/compContext';
import { useStructureStore } from '@/store/structureStore';
import { formatCount, formatGndK, formatPct, formatPercentileLabel } from '@/lib/format';
import { weakest } from '@/lib/provenance';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function RangesDesigner() {
  const ctx = useCompContext();
  const structures = useStructureStore((s) => s.structures);
  const activeId = useStructureStore((s) => s.activeId);
  const setActive = useStructureStore((s) => s.setActive);
  const updateStructure = useStructureStore((s) => s.updateStructure);
  const publishStructure = useStructureStore((s) => s.publishStructure);
  const createStructure = useStructureStore((s) => s.createStructure);

  const design = ctx.activeDesign;
  const structure = ctx.activeStructure;

  // Map employees against the structure being designed.
  const mappings = useMemo(() => mapEmployees(ctx.employees, structure), [ctx.employees, structure]);
  const cost = useMemo(() => costToPolicy(mappings, 1.0), [mappings]);
  const greenCircle = cost.belowMinCount;
  const debt = useMemo(
    () => structureDebt(mappings, structure, ctx.assumptions, greenCircle),
    [mappings, structure, ctx.assumptions, greenCircle],
  );

  const overallConfidence = useMemo(() => {
    const cs = structure.grades.map((g) => g.confidence).filter(isNum);
    return cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null;
  }, [structure]);
  const confidenceProvenance = weakest(...structure.grades.map((g) => g.confidenceProvenance));

  // Per-family equity tension (market-implied vs internal-progression-implied midpoints).
  const equityRows = useMemo(() => {
    const internalMids = structure.grades.map((g) => g.midpoint).filter(isNum);
    const internalAvg = internalMids.length ? internalMids.reduce((a, b) => a + b, 0) / internalMids.length : null;
    return JOB_FAMILIES.map((family) => {
      const marketMids = LEVELS.map(
        (l) => marketReference(ctx.surveyDataset, ctx.assumptions, { level: l, percentile: design.anchorPercentile, jobFamily: family })?.value ?? null,
      ).filter(isNum);
      const marketAvg = marketMids.length ? marketMids.reduce((a, b) => a + b, 0) / marketMids.length : null;
      return { family, tension: equityTensionScore(marketAvg, internalAvg), marketAvg, internalAvg };
    });
  }, [structure, design.anchorPercentile, ctx.surveyDataset, ctx.assumptions]);

  // Talent scarcity premium (vs the benchmark base posture).
  const scarcity = useMemo(() => {
    const perFamily = JOB_FAMILIES.map((family) => {
      const heads = ctx.employees.filter((e) => e.jobFamily === family).length;
      const internalAvg = structure.grades.map((g) => g.midpoint).filter(isNum).reduce((a, b) => a + b, 0) / Math.max(1, structure.grades.filter((g) => isNum(g.midpoint)).length);
      const baseAvg = LEVELS.map((l) => marketReference(ctx.surveyDataset, ctx.assumptions, { level: l, percentile: design.anchorPercentile })?.value ?? null).filter(isNum).reduce((a, b, _, arr) => a + b / arr.length, 0);
      return { family, familyMidpoint: internalAvg, basePostureMidpoint: baseAvg, headcount: heads };
    });
    return talentScarcityPremium(perFamily);
  }, [structure, design.anchorPercentile, ctx.employees, ctx.surveyDataset, ctx.assumptions]);

  const markers = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const g of structure.grades) m[g.grade] = ctx.employees.filter((e) => e.grade === g.grade).map((e) => e.basePay);
    return m;
  }, [structure, ctx.employees]);

  const debtSteps: WaterfallStep[] = [
    { label: 'Catch-up', value: debt.catchUp, kind: 'delta' },
    { label: 'Green-circle', value: debt.greenCirclePenalty, kind: 'delta' },
    { label: 'Total debt', value: debt.total, kind: 'total' },
  ];

  const kpis: KpiItem[] = [
    { label: 'Grades', value: formatCount(structure.grades.length), sub: design.type === 'broadbands' ? 'broadbands' : 'traditional', accent: 'navy' },
    { label: 'Below minimum', value: formatCount(cost.belowMinCount), sub: 'green-circle', accent: cost.belowMinCount ? 'amber' : 'green' },
    { label: 'Above maximum', value: formatCount(cost.aboveMaxCount), sub: 'red-circle', accent: cost.aboveMaxCount ? 'red' : 'green' },
    { label: 'Cost to minimum', value: `${formatGndK(cost.costToMinimum, 0, true)}`, sub: 'GND k', accent: 'navy' },
    { label: 'Structure debt', value: `${formatGndK(debt.total, 0, true)}`, sub: `GND k · ${ctx.assumptions.coiHorizon}-yr deferral`, accent: 'amber' },
  ];

  const controls = (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Structure</span>
        <div className="flex items-center gap-1.5">
          <Select ariaLabel="Structure" value={activeId} onChange={setActive} options={structures.map((s) => ({ value: s.id, label: s.name + (s.published ? ' ●' : '') }))} />
          <button type="button" onClick={() => createStructure(design)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[0.78rem] font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700">
            <Plus size={13} /> New
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Progression</span>
        <Segmented<ProgressionMethod>
          ariaLabel="Progression"
          value={design.progression}
          onChange={(v) => updateStructure(design.id, { progression: v })}
          options={[{ value: 'benchmark', label: 'Benchmark' }, { value: 'fixed', label: 'Fixed' }, { value: 'regression', label: 'Regression' }]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Spread</span>
        <PercentileSlider label="" value={design.spread} min={0.2} max={1.0} step={0.05} onChange={(v) => updateStructure(design.id, { spread: v })} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{design.progression === 'fixed' ? 'Step' : 'Anchor pctile'}</span>
        {design.progression === 'fixed' ? (
          <PercentileSlider label="" value={design.fixedStep} min={0.05} max={0.4} step={0.01} onChange={(v) => updateStructure(design.id, { fixedStep: v })} />
        ) : (
          <PercentileSlider label="" value={design.anchorPercentile} onChange={(v) => updateStructure(design.id, { anchorPercentile: v })} />
        )}
      </div>
    </>
  );

  return (
    <ModuleShell title="Compensation Ranges Designer" subtitle="Design, test and publish the salary structure" controls={controls}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={design.published ? 'green' : 'neutral'}>{design.published ? 'Published' : 'Draft'}</Badge>
          <span className="text-xs text-muted">
            {design.progression === 'benchmark'
              ? `Benchmark-anchored at the ${formatPercentileLabel(design.anchorPercentile)} survey percentile`
              : design.progression === 'fixed'
                ? `Fixed ${formatPct(design.fixedStep, 0)} progression`
                : 'Regression-smoothed midpoints'}{' '}
            · spread {formatPct(design.spread, 0)}
          </span>
        </div>
        {!design.published && (
          <button type="button" onClick={() => publishStructure(design.id)} className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-900">
            <CheckCircle2 size={13} /> Publish structure
          </button>
        )}
      </div>

      <KpiStrip items={kpis} className="xl:grid-cols-5" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Midpoint ladder" subtitle="Grade min–max bands with the midpoint tick and employee positions." right={<ProvenanceChip provenance={confidenceProvenance} />}>
          <MidpointLadder grades={structure.grades} markers={markers} />
        </Card>
        <Card title="Grade overlap" subtitle="Overlap between consecutive grades; gaps and excessive (>50%) overlap are flagged.">
          <OverlapMap grades={structure.grades} />
        </Card>
      </div>

      <Card title="Employee positioning & impact" subtitle="Compa-ratio × range penetration; green-circle (below min) and red-circle (above max) clusters.">
        <PositioningGrid mappings={mappings} />
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Range Confidence Index" subtitle="Weighted data-freshness, provider agreement, benchmark match and architecture stability.">
          <ConfidenceMeter score={overallConfidence} provenance={confidenceProvenance} label="Overall" />
          <div className="mt-3 space-y-2">
            {structure.grades.map((g) => (
              <div key={g.grade} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-soft">{g.grade} · {g.level}</span>
                <span className="font-semibold tabular-nums text-ink">{isNum(g.confidence) ? Math.round(g.confidence) : '—'}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Equity tension by family" subtitle="Market-implied vs internal-progression-implied midpoints (0 = aligned).">
          <div className="space-y-2.5">
            {equityRows.map((r) => (
              <div key={r.family} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
                <span className="text-xs font-medium text-ink-soft">{r.family}</span>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.tension ?? 0)}%`, background: (r.tension ?? 0) > 15 ? '#E0A93B' : '#2E8B57' }} />
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-ink">{isNum(r.tension) ? Math.round(r.tension) : '—'}</span>
              </div>
            ))}
            <p className="pt-1 text-[0.68rem] text-muted">Talent scarcity premium: <span className="font-semibold text-ink">{formatGndK(scarcity, 0, true)} GND k</span> (strategic pay above base market posture).</p>
          </div>
        </Card>

        <Card title="Cost of Structure Debt" subtitle={`Deferring maintenance ${ctx.assumptions.coiHorizon} years adds catch-up cost as midpoints drift with inflation.`} right={<ProvenanceChip provenance="ASSUMED" />}>
          <Waterfall steps={debtSteps} unit="GND_K" height={220} />
        </Card>
      </div>

      <Card title="Cost-to-policy" subtitle="Three measures of the spend required to bring employees to policy.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CostStat label="Cost to minimum" value={cost.costToMinimum} note={`${cost.belowMinCount} below min`} />
          <CostStat label="Cost to policy midpoint (95%)" value={cost.costToPolicyMidpoint} note="raise to 0.95 × midpoint" />
          <CostStat label="Cost to target compa (100%)" value={cost.costToTargetCompa} note="raise to the midpoint" />
        </div>
      </Card>
    </ModuleShell>
  );
}

function CostStat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-card border border-border bg-card px-4 py-3">
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-navy-700">{formatGndK(value, 0, true)} <span className="text-sm font-normal text-muted">GND k</span></div>
      <div className="mt-1 text-[0.72rem] text-muted">{note}</div>
    </div>
  );
}
