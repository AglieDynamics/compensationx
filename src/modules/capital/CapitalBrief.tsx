import { useMemo } from 'react';
import { Printer, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { type KpiItem } from '@/components/ui/Kpi';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ProvenanceChip, ProvenanceLegend, ModeledBanner } from '@/components/ui/ProvenanceChip';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { CapitalControls } from '@/components/capital/CapitalControls';
import { useCapitalContext } from '@/lib/capitalContext';
import { PERIOD_LABELS, WEIGHTING_LABELS } from '@/domain/components';
import { DEFAULT_ASSUMPTIONS } from '@/lib/assumptions';
import { useInputsStore } from '@/store/inputsStore';
import { QUADRANT_META, ZONE_META } from '@/lib/capital';
import { PROVENANCE_META } from '@/lib/provenance';
import {
  formatCount,
  formatGndK,
  formatPercentileLabel,
  formatSignedGndK,
  formatSignedPct,
} from '@/lib/format';
import {
  ACTION_META,
  assumptionFootnotes,
  type BriefHeadline,
  buildBriefModel,
} from './capitalBriefModel';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * Print rules scoped to this view. Hides the shared app chrome (side nav, sticky
 * filter bar) and the page scroll clipping so the brief prints as a clean
 * one-pager — including the assumptions footer. Kept local; no shared file edits.
 */
const PRINT_CSS = `
@media print {
  aside { display: none !important; }
  .sticky.top-0.z-30 { display: none !important; }
  main { overflow: visible !important; height: auto !important; }
  html, body { background: #fff !important; }
  @page { margin: 14mm; }
}
`;

/** A KPI with an optional Baseline→Scenario delta line. */
interface HeadlineKpi extends KpiItem {
  key: keyof BriefHeadline;
}

export function CapitalBrief() {
  const ctx = useCapitalContext();
  const bases = ctx.scenarioBases ?? ctx.baseline;
  const loadIllustrativeValueData = useInputsStore((s) => s.loadIllustrativeValueData);

  const model = useMemo(
    () => buildBriefModel(bases, ctx.inputs, ctx.assumptions, ctx.targetPercentile),
    [bases, ctx.inputs, ctx.assumptions, ctx.targetPercentile],
  );

  // Baseline reference for scenario deltas — only when a scenario is active.
  const baselineModel = useMemo(
    () =>
      ctx.scenario
        ? buildBriefModel(ctx.baseline, ctx.inputs, ctx.assumptions, ctx.targetPercentile)
        : null,
    [ctx.scenario, ctx.baseline, ctx.inputs, ctx.assumptions, ctx.targetPercentile],
  );

  const footnotes = useMemo(
    () => assumptionFootnotes(ctx.assumptions, DEFAULT_ASSUMPTIONS),
    [ctx.assumptions],
  );

  const h = model.headline;
  const hb = baselineModel?.headline ?? null;
  const onScenario = ctx.scenario != null;
  const target = formatPercentileLabel(ctx.targetPercentile);

  const delta = (key: keyof BriefHeadline): number | null =>
    hb ? (h[key] as number) - (hb[key] as number) : null;

  const headlineKpis: HeadlineKpi[] = [
    {
      key: 'capitalRequired',
      label: 'Capital required',
      value: `${formatGndK(h.capitalRequired, 0, true)}`,
      sub: `GND k · move Protect & Invest to ${target}`,
      accent: 'navy',
    },
    {
      key: 'coiAvoided',
      label: 'Cost of inaction avoided',
      value: `${formatGndK(h.coiAvoided, 0, true)}`,
      sub: `GND k · total leakage over ${ctx.assumptions.coiHorizon}-yr horizon`,
      accent: 'red',
    },
    {
      key: 'valueProtected',
      label: 'Retention value protected',
      value: `${formatGndK(h.valueProtected, 0, true)}`,
      sub: 'GND k · of which (attrition component of CoI)',
      accent: 'green',
    },
    {
      key: 'falseSavingsRecoverable',
      label: 'False savings recoverable',
      value: `${formatGndK(h.falseSavingsRecoverable, 0, true)}`,
      sub: 'GND k · overtime + contingent reappearing',
      accent: 'amber',
    },
  ];

  const flaggedRows = model.rows.filter((r) => r.action === 'PROTECT_INVEST');
  const allModeled = model.provenance === 'ASSUMED';

  // No salary data at all → nothing to brief on. Guard the whole page.
  const hasAnyDeviation = model.rows.some((r) => isNum(r.deviationPct));

  return (
    <ModuleShell
      title="Capital Allocation Brief"
      subtitle="The synthesis — every lens on one set of bases, converged into a single action ledger."
      controls={
        <>
          <CapitalControls showComponent={false} showTargetPercentile />
        </>
      }
    >
      {/*
        Scoped print stylesheet. The app chrome (side nav + sticky filter bar) lives
        in shared layout files this module may not edit, so we neutralise it for print
        from here via stable, unique selectors. Result: printing emits only the brief.
      */}
      <style>{PRINT_CSS}</style>

      {/* Screen-only action bar (hidden in print). */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted">
          {onScenario ? (
            <Badge variant="navy">Scenario: {ctx.scenario?.name}</Badge>
          ) : (
            <Badge variant="outline">Baseline</Badge>
          )}
          {!onScenario && (
            <span>Create a scenario to see Baseline → Scenario deltas on the headline numbers.</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[0.8rem] font-medium text-ink-soft transition-colors hover:border-navy-500/40 hover:text-navy-700"
        >
          <Printer size={14} /> Export / Print
        </button>
      </div>

      {/* Print-only document header (hidden on screen). */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold text-ink">Capital Allocation Brief</h1>
        <p className="mt-0.5 text-[0.8rem] text-muted">
          {onScenario ? `Scenario: ${ctx.scenario?.name}` : 'Baseline'} · target {target} percentile ·
          {' '}
          {WEIGHTING_LABELS[ctx.weighting]} · {PERIOD_LABELS[ctx.period]}
        </p>
      </div>

      {allModeled && (
        <ModeledBanner
          className="print:hidden"
          message="This brief is modeled on default assumptions. Add data in Inputs & Assumptions to sharpen — every figure's basis is in the footer."
        />
      )}

      {!hasAnyDeviation ? (
        <Card title="No market positions available" subtitle="The brief needs firm-vs-market pay positions to act on.">
          <EmptyState
            title="No pay positions for this selection"
            message="Switch to a weighting / period present in the sample, or ingest the source workbook."
          />
        </Card>
      ) : (
        <>
          {/* ---- Headline numbers ---- */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[0.95rem] font-semibold text-ink">Headline numbers</h2>
              {onScenario && (
                <span className="text-[0.72rem] text-muted">Δ vs Baseline shown per figure</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {headlineKpis.map((k) => {
                const d = onScenario ? delta(k.key) : null;
                // Downward movement is favourable for capital required & CoI &
                // false savings; upward is favourable for value protected. A
                // negligible move (<0.5 GND k after rounding) reads as neutral.
                const moved = isNum(d) && Math.abs(d) >= 0.5;
                const good = moved
                  ? k.key === 'valueProtected'
                    ? (d as number) > 0
                    : (d as number) < 0
                  : null;
                return (
                  <div key={k.key} className="rounded-card border border-border bg-card px-4 py-3 shadow-card print:shadow-none">
                    <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{k.label}</div>
                    <div
                      className={`mt-1 text-2xl font-semibold leading-none tabular-nums ${
                        k.accent === 'navy'
                          ? 'text-navy-700'
                          : k.accent === 'green'
                            ? 'text-brand-green'
                            : k.accent === 'red'
                              ? 'text-brand-red'
                              : 'text-[#9A7212]'
                      }`}
                    >
                      {k.value}
                    </div>
                    <div className="mt-1 text-[0.72rem] text-muted">{k.sub}</div>
                    {isNum(d) && (
                      <div
                        className={`mt-1.5 text-[0.72rem] font-semibold tabular-nums ${
                          good === null ? 'text-muted' : good ? 'text-brand-green' : 'text-brand-red'
                        }`}
                      >
                        {formatSignedGndK(d, 0, true)} GND k vs Baseline
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- Action ledger ---- */}
          <Card
            title="Action ledger"
            subtitle="One recommended action per level — derived from value density where present, else pay position, retention leverage and leakage."
            right={<ProvenanceChip provenance={model.provenance} />}
            flush
          >
            <TableScroll>
              <Table caption="Per-level capital-allocation action ledger" className="min-w-[1040px]">
                <THead sticky>
                  <TR>
                    <TH className="bg-[#F0F2F6]">Level</TH>
                    <TH align="center" className="border-l border-border">Action</TH>
                    <TH align="right" className="border-l border-border">Pay vs market</TH>
                    <TH align="center">Value density</TH>
                    <TH align="center">Pay-productivity</TH>
                    <TH align="right" title="Convexity Opportunity Index (0–100)">Convexity</TH>
                    <TH align="right" title="Cost-of-inaction net position">Inaction net</TH>
                    <TH align="right">Pay to target</TH>
                    <TH className="border-l border-border">Rationale</TH>
                    <TH align="center">Basis</TH>
                  </TR>
                </THead>
                <TBody>
                  {model.rows.map((r) => (
                    <TR key={r.level}>
                      <TD className="whitespace-nowrap font-medium text-ink">
                        {r.label}
                        <span className="ml-1.5 text-[0.66rem] text-muted">{formatCount(r.headcount)} hc</span>
                      </TD>
                      <TD align="center" className="border-l border-border/60">
                        <Badge variant={ACTION_META[r.action].tone}>{ACTION_META[r.action].label}</Badge>
                      </TD>
                      <TD align="right" className={`border-l border-border/60 tabular-nums ${r.underMarket ? 'text-brand-red' : 'text-ink'}`}>
                        {formatSignedPct(r.deviationPct, 0)}
                      </TD>
                      <TD align="center" className="tabular-nums">
                        {r.quadrant ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: QUADRANT_META[r.quadrant].color }} />
                            <span className="text-[0.72rem] text-ink-soft">{QUADRANT_META[r.quadrant].label}</span>
                          </span>
                        ) : (
                          <span className="text-[0.72rem] text-muted">n/a</span>
                        )}
                      </TD>
                      <TD align="center" className="tabular-nums">
                        {r.frontierZone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: ZONE_META[r.frontierZone].color }} />
                            <span className="text-[0.72rem] text-ink-soft">{ZONE_META[r.frontierZone].label}</span>
                          </span>
                        ) : (
                          <span className="text-[0.72rem] text-muted">n/a</span>
                        )}
                      </TD>
                      <TD align="right" className="tabular-nums text-ink">
                        {isNum(r.coiIndex) ? Math.round(r.coiIndex) : 'n/a'}
                      </TD>
                      <TD align="right" className={`tabular-nums ${isNum(r.coiNet) && r.coiNet < 0 ? 'text-brand-red font-semibold' : 'text-ink'}`}>
                        {r.underMarket ? formatSignedGndK(r.coiNet, 0, true) : '—'}
                      </TD>
                      <TD align="right" className="tabular-nums text-ink">
                        {r.action === 'PROTECT_INVEST' && isNum(r.payToTarget) && r.payToTarget > 0
                          ? formatGndK(r.payToTarget, 0, true)
                          : '—'}
                      </TD>
                      <TD className="border-l border-border/60 max-w-[22rem] whitespace-normal text-[0.78rem] leading-snug text-ink-soft">
                        {r.rationale}
                        {r.falseSavings && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-brand-red/10 px-1.5 py-0.5 text-[0.64rem] font-semibold text-brand-red">
                            false saving
                          </span>
                        )}
                      </TD>
                      <TD align="center">
                        <ProvenanceChip provenance={r.provenance} showDot={false} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          </Card>

          {/* ---- Where capital goes (flagged summary) ---- */}
          <Card
            title="Where capital should go"
            subtitle={`${formatCount(h.flaggedCount)} segment${h.flaggedCount === 1 ? '' : 's'} flagged Protect & Invest — the priority deployment.`}
          >
            {flaggedRows.length > 0 ? (
              <ul className="space-y-2">
                {flaggedRows.map((r) => (
                  <li
                    key={r.level}
                    className="flex items-start gap-2.5 rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2"
                  >
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-green" />
                    <span className="text-sm text-ink-soft">
                      <span className="font-semibold text-ink">{r.label}</span>
                      {isNum(r.payToTarget) && r.payToTarget > 0 ? (
                        <>
                          {' '}— deploy{' '}
                          <span className="font-semibold text-navy-700">{formatGndK(r.payToTarget, 0, true)} GND&nbsp;k</span>{' '}
                          to reach {target}.
                        </>
                      ) : (
                        <> — already at/above target; protect via non-pay levers.</>
                      )}{' '}
                      <span className="text-muted">{r.rationale}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted">
                No segments flagged Protect &amp; Invest at the {target} target. Pay positions are at or above market with
                adequate retention leverage — capital is better held than deployed.
              </p>
            )}
          </Card>

          {!model.hasValueData && (
            <Card
              className="print:hidden"
              title="Sharpen with value data"
              subtitle="Value-density quadrants and the pay-productivity frontier need value-per-head — actions currently derive from pay position, retention leverage and leakage."
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadIllustrativeValueData()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-700 px-3.5 text-[0.82rem] font-medium text-white transition-colors hover:bg-navy-900"
                >
                  Load illustrative value data
                </button>
                <Link
                  to="/capital/inputs"
                  className="inline-flex items-center gap-1 text-[0.82rem] font-medium text-navy-700 hover:underline"
                >
                  Inputs &amp; Assumptions <ArrowRight size={13} />
                </Link>
              </div>
            </Card>
          )}

          {/* ---- Assumptions & provenance footer (must appear in print) ---- */}
          <footer className="rounded-card border border-border bg-card px-5 py-4 shadow-card print:mt-6 print:break-inside-avoid print:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[0.9rem] font-semibold text-ink">Assumptions &amp; provenance</h2>
              <ProvenanceLegend className="hidden sm:flex print:flex" />
            </div>
            <p className="mt-1 text-[0.76rem] leading-snug text-muted">
              Every figure in this brief inherits the weakest provenance among its inputs. The defaults below (Appendix&nbsp;A)
              are <span className="font-medium text-[#9A7212]">Assumed</span> until you enter or upload data, at which point the
              dependent figures flip to <span className="font-medium text-navy-700">Entered</span> /{' '}
              <span className="font-medium text-brand-green">Measured</span>. Per-segment value &amp; attrition bases are tagged
              in the ledger&apos;s Basis column.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {footnotes.map((f) => {
                const meta = PROVENANCE_META[f.basis];
                return (
                  <div key={f.label} className="flex flex-col">
                    <dt className="text-[0.68rem] uppercase tracking-wide text-muted">{f.label}</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[0.84rem] font-semibold tabular-nums text-ink">{f.value}</span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium leading-tight"
                        style={{ background: `${meta.color}1A`, color: meta.color }}
                        title={meta.description}
                      >
                        {meta.label}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 border-t border-border pt-2 text-[0.72rem] text-muted">
              Basis: {WEIGHTING_LABELS[ctx.weighting]} medians · {PERIOD_LABELS[ctx.period]} period ·
              {' '}Target {target} percentile · {ctx.assumptions.coiHorizon}-yr cost-of-inaction horizon
              {onScenario ? ` · Scenario "${ctx.scenario?.name}" vs Baseline` : ' · Baseline'}.
            </p>
          </footer>
        </>
      )}
    </ModuleShell>
  );
}
