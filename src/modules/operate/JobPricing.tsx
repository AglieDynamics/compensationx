/**
 * Module A — Job Pricing (route /pricing).
 *
 * A 6-step pricing flow (Intake → Match → Price → Equity → Offer → Save) driven
 * by LOCAL state for the PricingIntake + PricingInputs, recomputing live via
 * priceRole(). All pricing/range/market math lives in @/lib/comp.ts +
 * @/lib/marketReference.ts; this module renders only — it never recomputes a
 * formula. The headline recommendation is always shown as an explained waterfall,
 * never an unqualified single number.
 */

import { useMemo, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { Waterfall, type WaterfallStep } from '@/components/charts/Waterfall';
import { OfferGauge } from '@/components/operate/OfferGauge';
import { LEVEL_LABELS } from '@/domain/levels';
import { LEVEL_TO_GRADE } from '@/lib/assumptions';
import type { PricingInputs, PricingIntake, PricingPosture, PricingCase } from '@/domain/structure';
import { POSTURE_PERCENTILE, priceRole, type EquityFlag, type PricingResult } from '@/lib/comp';
import { marketReference } from '@/lib/marketReference';
import { useCompContext } from '@/lib/compContext';
import { usePricingStore } from '@/store/pricingStore';
import { formatCompaRatio, formatGndK, formatPct, formatPercentileLabel, NA } from '@/lib/format';
import { JobPricingIntakeForm } from './JobPricingIntakeForm';
import { JobPricingSession } from './JobPricingSession';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Seed so the flow lights up immediately: Manager / Strategy / HQ / G4. */
const DEFAULT_INTAKE: PricingIntake = {
  title: 'Engagement Manager',
  hiringManager: '',
  level: 'M',
  jobFamily: 'Strategy',
  geography: 'HQ',
  grade: LEVEL_TO_GRADE.M,
  businessUnit: 'Consulting',
  replacement: true,
  mustHaveSkills: '',
};

const DEFAULT_INPUTS: PricingInputs = {
  posture: 'match',
  adjustmentPremium: 0,
  candidatePremium: 0,
  useStretch: false,
};

const STEPS = ['Intake', 'Match', 'Price', 'Equity', 'Offer', 'Save'] as const;

/** A premium stepper applied on top of the documented snapshot, carrying peer median for session analytics. */
type SavedCaseInput = Omit<PricingCase, 'id'> & {
  snapshot: PricingCase['snapshot'] & { peerMedian: number | null };
};

const FLAG_LABEL: Record<EquityFlag['kind'], string> = {
  compression: 'Compression',
  inversion: 'Inversion',
  'outlier-compa': 'Compa outlier',
  'exceeds-peer-average': 'Above peers',
};

export function JobPricing() {
  const ctx = useCompContext();
  const cases = usePricingStore((s) => s.cases);
  const saveCase = usePricingStore((s) => s.saveCase);
  const deleteCase = usePricingStore((s) => s.deleteCase);
  const recordOutcome = usePricingStore((s) => s.recordOutcome);

  const [intake, setIntake] = useState<PricingIntake>(DEFAULT_INTAKE);
  const [inputs, setInputs] = useState<PricingInputs>(DEFAULT_INPUTS);
  const [activeStep, setActiveStep] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  const result = useMemo<PricingResult>(
    () => priceRole(intake, inputs, ctx.surveyDataset, ctx.assumptions, ctx.employees, ctx.publishedStructure),
    [intake, inputs, ctx.surveyDataset, ctx.assumptions, ctx.employees, ctx.publishedStructure],
  );

  // Match confidence: average JobArchitecture benchmark match at this level (rendered, not recomputed).
  const matchConfidence = useMemo(() => {
    const rows = ctx.jobArchitecture.filter((j) => j.level === intake.level);
    if (rows.length === 0) return null;
    return rows.reduce((a, j) => a + j.benchmarkMatchConfidence.value, 0) / rows.length;
  }, [ctx.jobArchitecture, intake.level]);

  // Raw posture-percentile survey reference (before the manual adjustment premium), for the Match card.
  const posturePctile = useMemo(() => {
    const p = POSTURE_PERCENTILE[inputs.posture];
    const ref = marketReference(ctx.surveyDataset, ctx.assumptions, {
      level: intake.level,
      geography: intake.geography,
      jobFamily: intake.jobFamily,
      percentile: p,
    });
    return { percentile: p, ref };
  }, [inputs.posture, intake.level, intake.geography, intake.jobFamily, ctx.surveyDataset, ctx.assumptions]);

  const noSurveyMatch = !isNum(result.marketReference) && !isNum(posturePctile.ref?.value ?? null);

  const updateIntake = (patch: Partial<PricingIntake>) => {
    setIntake((prev) => ({ ...prev, ...patch }));
    setJustSaved(false);
  };
  const updateInputs = (patch: Partial<PricingInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
    setJustSaved(false);
  };

  const onSave = () => {
    const label =
      `${intake.title.trim() || LEVEL_LABELS[intake.level]} · ${intake.jobFamily} · ${intake.geography}`.slice(0, 80);
    const draft: SavedCaseInput = {
      label,
      intake,
      inputs,
      snapshot: {
        floor: result.floor,
        target: result.target,
        stretch: result.stretch,
        midpoint: result.midpoint,
        marketReference: result.marketReference,
        approval: result.approval,
        flagCount: result.flags.length,
        peerMedian: result.peers.median,
      },
      outcome: 'pending',
    };
    saveCase(draft);
    setJustSaved(true);
  };

  const kpis: KpiItem[] = [
    { label: 'Floor', value: formatGndK(result.floor, 1), sub: 'GND k · range floor', accent: 'green' },
    { label: 'Target', value: formatGndK(result.target, 1), sub: 'GND k · recommended', accent: 'navy' },
    { label: 'Stretch', value: formatGndK(result.stretch, 1), sub: 'GND k · ceiling', accent: 'amber' },
    {
      label: 'Target compa',
      value: formatCompaRatio(result.targetCompa),
      sub: 'target ÷ midpoint',
      accent: 'navy',
    },
    {
      label: 'Equity flags',
      value: String(result.flags.length),
      sub: result.approval === 'auto' ? 'auto-approve' : 'needs approval',
      accent: result.flags.length > 0 ? 'amber' : 'green',
    },
  ];

  const rationaleSteps: WaterfallStep[] = result.rationale.map((r) => ({
    label: r.label,
    value: r.value,
    kind: r.label === 'Offer target' ? 'total' : 'delta',
  }));

  const controls = (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Posture</span>
        <Segmented<PricingPosture>
          ariaLabel="Pricing posture"
          value={inputs.posture}
          onChange={(posture) => updateInputs({ posture })}
          options={[
            { value: 'lead', label: 'Lead' },
            { value: 'match', label: 'Match' },
            { value: 'lag', label: 'Lag' },
          ]}
        />
      </div>
      <PremiumStepper
        label="Adjustment premium"
        value={inputs.adjustmentPremium}
        onChange={(adjustmentPremium) => updateInputs({ adjustmentPremium })}
      />
      <PremiumStepper
        label="Candidate premium"
        value={inputs.candidatePremium}
        onChange={(candidatePremium) => updateInputs({ candidatePremium })}
      />
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Use stretch</span>
        <Segmented<'off' | 'on'>
          ariaLabel="Use stretch as target"
          value={inputs.useStretch ? 'on' : 'off'}
          onChange={(v) => updateInputs({ useStretch: v === 'on' })}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
        />
      </div>
    </>
  );

  return (
    <ModuleShell
      title="Job Pricing"
      subtitle="Turn a hiring request into a governed, explainable offer — Intake → Match → Price → Equity → Offer → Save."
      controls={controls}
    >
      <Stepper steps={STEPS} active={activeStep} onSelect={setActiveStep} />

      <KpiStrip items={kpis} className="xl:grid-cols-5" />

      {noSurveyMatch && (
        <EmptyState
          title="No survey reference for this role"
          message="This level / geography / family combination is not present in the survey. Pick a combination present in the Greenland sample, or add survey coverage in Inputs & Assumptions."
        />
      )}

      <Card
        title="1 · Hiring request intake"
        subtitle="Define the role. The level sets the grade band; family and geography drive the survey match."
      >
        <JobPricingIntakeForm intake={intake} onChange={updateIntake} />
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card
          title="2 · Benchmark match"
          subtitle="Matched survey reference at the posture percentile, with the manual adjustment premium."
          right={posturePctile.ref ? <ProvenanceChip provenance={posturePctile.ref.provenance} /> : undefined}
        >
          <div className="space-y-3">
            <MatchRow
              label={`Survey ${formatPercentileLabel(posturePctile.percentile)} (${inputs.posture})`}
              value={formatGndK(posturePctile.ref?.value ?? null, 2)}
              unit="GND k"
            />
            <MatchRow
              label={`Adjustment premium ${formatSignedPctLabel(inputs.adjustmentPremium)}`}
              value={formatGndK(result.marketReference, 2)}
              unit="GND k"
              emphasize
            />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <div className="text-[0.72rem] font-semibold uppercase tracking-wide text-muted">Match confidence</div>
                <div className="text-[0.7rem] text-muted">Benchmark match at {LEVEL_LABELS[intake.level]} (from job architecture)</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold tabular-nums text-navy-700">
                  {isNum(matchConfidence) ? formatPct(matchConfidence, 0) : NA}
                </div>
              </div>
            </div>
            {!result.usedStructure && (
              <p className="text-[0.7rem] text-muted">
                No published grade for {intake.grade} / {LEVEL_LABELS[intake.level]} — pricing off the adjusted survey reference. Publish a band in{' '}
                <span className="font-medium text-ink-soft">Ranges Designer</span> to anchor the range.
              </p>
            )}
          </div>
        </Card>

        <Card
          title="3 · Offer card"
          subtitle="Floor / Target / Stretch over the grade range, with market and peer markers."
          right={
            <div className="flex items-center gap-2">
              <Badge variant={result.approval === 'auto' ? 'green' : 'amber'}>
                {result.approval === 'auto' ? 'Auto-approve' : 'Needs approval'}
              </Badge>
              <ProvenanceChip provenance={result.provenance} />
            </div>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Headline label="Floor" value={result.floor} accent="text-brand-green" />
            <Headline label="Target" value={result.target} accent="text-navy-700" strong />
            <Headline label="Stretch" value={result.stretch} accent="text-[#9A7212]" />
          </div>
          <div className="mt-4">
            <OfferGauge result={result} />
          </div>
        </Card>
      </div>

      <Card
        title="4 · Rationale"
        subtitle="Every adjustment from market reference to the final offer target — never an unqualified single number."
        right={<ProvenanceChip provenance={result.provenance} />}
      >
        {rationaleSteps.length > 0 ? (
          <Waterfall steps={rationaleSteps} unit="GND_K" height={260} />
        ) : (
          <EmptyState compact message="No rationale to plot — add a survey-covered role above." />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <Card
          title="5 · Equity guardrails"
          subtitle="Internal-equity flags raised against the peer cohort for this exact role."
        >
          {result.flags.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-brand-green/40 bg-brand-green/5 px-3 py-2.5 text-[0.82rem] text-brand-green">
              <Check size={15} />
              No equity flags — offer sits inside policy bands for this cohort.
            </div>
          ) : (
            <ul className="space-y-2">
              {result.flags.map((f) => (
                <li
                  key={f.kind}
                  className="flex items-start gap-2.5 rounded-lg border border-brand-amber/40 bg-brand-amber/5 px-3 py-2 text-[0.82rem] text-ink"
                >
                  <Badge variant="amber" className="mt-0.5 shrink-0">{FLAG_LABEL[f.kind]}</Badge>
                  <span className="leading-snug text-ink-soft">{f.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Peer cohort"
          subtitle={`Same level / family / geography${ctx.hasEmployees ? '' : ' — no employees loaded'}.`}
        >
          {result.peers.count === 0 ? (
            <EmptyState
              compact
              title="No peers for this cohort"
              message={
                ctx.hasEmployees
                  ? 'No current employees match this exact level / family / geography. Pricing still works survey-only.'
                  : 'Load employee records in Employees & Job Architecture to surface peer comparisons.'
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <PeerStat label="Peers" value={String(result.peers.count)} />
              <PeerStat label="Peer median" value={formatGndK(result.peers.median, 1)} />
              <PeerStat label="Peer compa" value={formatCompaRatio(result.peers.medianCompa)} />
              <PeerStat label="P25" value={formatGndK(result.peers.p25, 1)} />
              <PeerStat label="P75" value={formatGndK(result.peers.p75, 1)} />
              <PeerStat label="Max" value={formatGndK(result.peers.max, 1)} />
            </div>
          )}
        </Card>
      </div>

      <Card
        title="6 · Save case"
        subtitle="Capture this priced offer as a session case to compare and track outcomes."
        right={
          <button
            type="button"
            onClick={onSave}
            disabled={!isNum(result.target)}
            className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={13} /> Save case
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.82rem] text-ink-soft">
          <span>
            Target <span className="font-semibold tabular-nums text-navy-700">{formatGndK(result.target, 1)}</span> GND k
          </span>
          <span>
            Approval{' '}
            <span className="font-semibold">{result.approval === 'auto' ? 'auto' : 'needs approval'}</span>
          </span>
          <span>
            Flags <span className="font-semibold tabular-nums">{result.flags.length}</span>
          </span>
          {justSaved && (
            <span className="inline-flex items-center gap-1 text-brand-green">
              <Check size={14} /> Saved to session
            </span>
          )}
        </div>
      </Card>

      <JobPricingSession cases={cases} onDelete={deleteCase} onRecordOutcome={recordOutcome} />
    </ModuleShell>
  );
}

// ---------------------------------------------------------------------------

function Stepper({
  steps,
  active,
  onSelect,
}: {
  steps: readonly string[];
  active: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav aria-label="Pricing steps" className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(i)}
          aria-current={i === active ? 'step' : undefined}
          className={
            i === active
              ? 'inline-flex items-center gap-1.5 rounded-full bg-navy-700 px-3 py-1 text-xs font-semibold text-white'
              : 'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700'
          }
        >
          <span className={`tabular-nums ${i === active ? 'text-white/80' : 'text-muted'}`}>{i + 1}</span>
          {s}
        </button>
      ))}
    </nav>
  );
}

function PremiumStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // Whole-percent steps; clamped to a sane hiring band. value is a fraction.
  const pct = Math.round(value * 100);
  const set = (next: number) => onChange(Math.min(50, Math.max(-25, next)) / 100);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="inline-flex h-8 items-center rounded-lg border border-border bg-card">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => set(pct - 1)}
          className="flex h-full w-7 items-center justify-center text-ink-soft hover:text-navy-700"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-[0.82rem] font-semibold tabular-nums text-ink">
          {pct > 0 ? '+' : ''}
          {pct}%
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => set(pct + 1)}
          className="flex h-full w-7 items-center justify-center text-ink-soft hover:text-navy-700"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MatchRow({
  label,
  value,
  unit,
  emphasize,
}: {
  label: string;
  value: string;
  unit: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.82rem] text-ink-soft">{label}</span>
      <span className={`tabular-nums ${emphasize ? 'text-lg font-semibold text-navy-700' : 'text-[0.92rem] font-medium text-ink'}`}>
        {value} <span className="text-[0.7rem] font-normal text-muted">{unit}</span>
      </span>
    </div>
  );
}

function Headline({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: number | null;
  accent: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-card px-3 py-2.5">
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 tabular-nums ${accent} ${strong ? 'text-2xl font-bold' : 'text-xl font-semibold'}`}>
        {formatGndK(value, 1)}
        <span className="ml-1 text-[0.7rem] font-normal text-muted">GND k</span>
      </div>
    </div>
  );
}

function PeerStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

/** "+5%" / "−3%" / "0%" label for a fraction. */
function formatSignedPctLabel(fraction: number): string {
  const pct = Math.round(fraction * 100);
  if (pct === 0) return '+0%';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}
