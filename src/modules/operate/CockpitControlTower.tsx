/**
 * C1 — Control Tower (default tab). Enterprise KPI strip computed from
 * computeEconomics + the firm-wide employee mappings, editable finance inputs
 * (local state, default null → revenue metrics show an assumption/empty-state),
 * three under-market "risk pocket" callouts, three scenario tiles, and the
 * templated board narrative (heuristics.narrative).
 */

import { useMemo } from 'react';
import { ArrowRight, ClipboardList, Layers, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CompContext } from '@/lib/compContext';
import { costToPolicy } from '@/lib/comp';
import { computeEconomics } from '@/lib/economics';
import { marketReference } from '@/lib/marketReference';
import { narrative } from '@/lib/heuristics';
import { useActiveScenario } from '@/store/scenarioStore';
import { JOB_FAMILIES } from '@/lib/assumptions';
import { LEVELS, LEVEL_LABELS_SHORT } from '@/domain/levels';
import { formatCompaRatio, formatCount, formatGndK, formatPct, formatSignedPct } from '@/lib/format';
import { HEURISTIC_LABEL, isNum, mean } from './cockpitShared';

interface Props {
  ctx: CompContext;
  hasPublished: boolean;
  totalRevenue: number | null;
  nonLaborOpex: number | null;
  onRevenue: (v: number | null) => void;
  onOpex: (v: number | null) => void;
}

interface RiskPocket {
  key: string;
  family: string;
  level: string;
  headcount: number;
  gapPct: number; // negative = under market
  avgPay: number;
  marketRef: number;
}

export function CockpitControlTower({
  ctx,
  hasPublished,
  totalRevenue,
  nonLaborOpex,
  onRevenue,
  onOpex,
}: Props) {
  const scenario = useActiveScenario();

  const econ = useMemo(
    () => computeEconomics(ctx.employees, ctx.assumptions, { totalRevenue, nonLaborOpex }),
    [ctx.employees, ctx.assumptions, totalRevenue, nonLaborOpex],
  );

  const cost = useMemo(() => costToPolicy(ctx.mappings, 1.0), [ctx.mappings]);

  // Firm-wide average compa-ratio (employee-weighted) from the mappings.
  const avgCompa = useMemo(() => mean(ctx.mappings.map((m) => m.compaRatio)), [ctx.mappings]);

  // Firm-wide "market compa ratio": avg employee pay / market reference (median),
  // weighted across present family×level segments by headcount.
  const marketCompa = useMemo(() => {
    let num = 0;
    let den = 0;
    for (const family of JOB_FAMILIES) {
      for (const level of LEVELS) {
        const emps = ctx.employees.filter((e) => e.jobFamily === family && e.level === level);
        if (emps.length === 0) continue;
        const ref = marketReference(ctx.surveyDataset, ctx.assumptions, { level, jobFamily: family, percentile: 0.5 });
        if (!ref || !isNum(ref.value) || ref.value === 0) continue;
        const avgPay = emps.reduce((a, e) => a + e.basePay, 0) / emps.length;
        num += (avgPay / ref.value) * emps.length;
        den += emps.length;
      }
    }
    return den > 0 ? num / den : null;
  }, [ctx.employees, ctx.surveyDataset, ctx.assumptions]);

  // Risk pockets — most under-market family×level segments by absolute headcount-weighted gap.
  const riskPockets = useMemo<RiskPocket[]>(() => {
    const out: RiskPocket[] = [];
    for (const family of JOB_FAMILIES) {
      for (const level of LEVELS) {
        const emps = ctx.employees.filter((e) => e.jobFamily === family && e.level === level);
        if (emps.length < 3) continue; // ignore tiny segments
        const ref = marketReference(ctx.surveyDataset, ctx.assumptions, { level, jobFamily: family, percentile: 0.5 });
        if (!ref || !isNum(ref.value) || ref.value === 0) continue;
        const avgPay = emps.reduce((a, e) => a + e.basePay, 0) / emps.length;
        const gapPct = (avgPay - ref.value) / ref.value;
        if (gapPct < -0.02) {
          out.push({
            key: `${family}-${level}`,
            family,
            level: LEVEL_LABELS_SHORT[level],
            headcount: emps.length,
            gapPct,
            avgPay,
            marketRef: ref.value,
          });
        }
      }
    }
    // Most severe (most negative gap, weighted by headcount) first.
    return out
      .sort((a, b) => a.gapPct * a.headcount - b.gapPct * b.headcount)
      .slice(0, 3);
  }, [ctx.employees, ctx.surveyDataset, ctx.assumptions]);

  const underMarketGroups = useMemo(() => {
    let count = 0;
    for (const family of JOB_FAMILIES) {
      for (const level of LEVELS) {
        const emps = ctx.employees.filter((e) => e.jobFamily === family && e.level === level);
        if (emps.length === 0) continue;
        const ref = marketReference(ctx.surveyDataset, ctx.assumptions, { level, jobFamily: family, percentile: 0.5 });
        if (!ref || !isNum(ref.value) || ref.value === 0) continue;
        const avgPay = emps.reduce((a, e) => a + e.basePay, 0) / emps.length;
        if (avgPay < ref.value * 0.98) count += 1;
      }
    }
    return count;
  }, [ctx.employees, ctx.surveyDataset, ctx.assumptions]);

  const narrativeLines = useMemo(
    () =>
      narrative({
        headcount: econ.headcount,
        avgCompaRatio: avgCompa,
        belowMinCount: cost.belowMinCount,
        aboveMaxCount: cost.aboveMaxCount,
        underMarketGroups,
        topRiskFamily: riskPockets[0]?.family ?? null,
        hcroi: econ.hcroi,
        benefitsShare: econ.benefitsShare,
      }),
    [econ, avgCompa, cost, underMarketGroups, riskPockets],
  );

  const kpis: KpiItem[] = [
    {
      label: 'Headcount',
      value: formatCount(econ.headcount),
      sub: `${formatCount(econ.totalFte)} FTE`,
      accent: 'navy',
    },
    {
      label: 'Avg compa-ratio',
      value: formatCompaRatio(avgCompa),
      sub: 'vs published midpoints',
      // Informational ratio, not a RAG signal — keep neutral navy (avoid amber overload).
      accent: 'navy',
    },
    {
      label: 'Market compa-ratio',
      value: formatCompaRatio(marketCompa),
      sub: 'pay vs survey median',
      accent: 'navy',
    },
    {
      label: 'Direct comp / FTE',
      value: formatGndK(econ.directCompPerFte, 1),
      sub: 'GND k · base+bonus+allow',
      accent: 'navy',
    },
    {
      label: 'Total workforce cost',
      value: formatGndK(econ.totalWorkforceCost, 0, true),
      sub: 'GND k · loaded',
      accent: 'navy',
    },
    {
      label: 'Benefits share',
      value: formatPct(econ.benefitsShare, 0),
      sub: 'of loaded cost',
      accent: 'navy',
    },
    {
      label: 'Revenue / employee',
      value: isNum(econ.revenuePerEmployee) ? formatGndK(econ.revenuePerEmployee, 0, true) : '—',
      sub: isNum(econ.revenuePerEmployee) ? 'GND k' : 'add revenue below',
      // Empty-state is neutral, not a warning.
      accent: isNum(econ.revenuePerEmployee) ? 'navy' : 'default',
    },
    {
      label: 'HCROI',
      value: isNum(econ.hcroi) ? `${econ.hcroi.toFixed(2)}×` : '—',
      sub: isNum(econ.hcroi) ? '(rev − opex) / TWC' : 'add revenue + opex',
      accent: isNum(econ.hcroi) ? 'green' : 'default',
    },
    {
      label: 'Pay efficiency',
      value: isNum(econ.payEfficiencyRatio) ? `${econ.payEfficiencyRatio.toFixed(2)}×` : '—',
      sub: isNum(econ.payEfficiencyRatio) ? 'rev/emp ÷ TWC/FTE' : 'add revenue',
      accent: isNum(econ.payEfficiencyRatio) ? 'green' : 'default',
    },
    {
      label: 'Cost to minimum',
      value: formatGndK(cost.costToMinimum, 0, true),
      sub: `GND k · ${formatCount(cost.belowMinCount)} green-circle`,
      accent: cost.belowMinCount ? 'amber' : 'green',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={hasPublished ? 'green' : 'amber'}>
          {hasPublished ? 'Published structure' : 'Draft structure (publish in Ranges Designer)'}
        </Badge>
        <ProvenanceChip provenance={ctx.employees.length ? 'MEASURED' : 'ASSUMED'} label="Employee population" />
        {scenario && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-navy-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-navy-700"
            title="Cockpit KPIs use measured employee pay. Scenarios re-price the survey segments — see the Capital Allocation Brief."
          >
            <Layers size={12} /> Scenario {scenario.name} · survey lenses
          </span>
        )}
      </div>

      <KpiStrip items={kpis} className="xl:grid-cols-5" />

      <FinanceInputs
        totalRevenue={totalRevenue}
        nonLaborOpex={nonLaborOpex}
        onRevenue={onRevenue}
        onOpex={onOpex}
        revenueProvenance={econ.revenueProvenance}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          title="Risk pockets"
          subtitle="Largest under-market family×level groups (headcount-weighted gap)."
          right={<ProvenanceChip provenance="ASSUMED" />}
          className="xl:col-span-2"
        >
          {riskPockets.length === 0 ? (
            <EmptyState compact message="No material under-market pockets at the current pay levels." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {riskPockets.map((p) => (
                <div key={p.key} className="rounded-card border border-brand-amber/40 bg-brand-amber/[0.05] px-4 py-3">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-[#9A7212]">
                    {p.family} · {p.level}
                  </div>
                  <div className="mt-1 text-2xl font-semibold leading-none tabular-nums text-brand-red">
                    {formatSignedPct(p.gapPct, 0)}
                  </div>
                  <div className="mt-1 text-[0.72rem] text-muted">
                    {formatCount(p.headcount)} heads · pay {formatGndK(p.avgPay, 0)} vs market {formatGndK(p.marketRef, 0)} GND k
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[0.68rem] text-muted">{HEURISTIC_LABEL}</p>
        </Card>

        <Card title="Scenarios" subtitle="Model pay moves and structures, then return here.">
          <div className="space-y-2.5">
            <ScenarioTile
              to="/capital/brief"
              icon={<ClipboardList size={15} />}
              title="Capital Allocation Brief"
              subtitle="Baseline vs scenario, ranked moves and cost of inaction."
            />
            <ScenarioTile
              to="/structure"
              icon={<Ruler size={15} />}
              title="Ranges Designer"
              subtitle="Re-anchor midpoints, test spread, publish a new structure."
            />
            <ScenarioTile
              to="/capital/inputs"
              icon={<Layers size={15} />}
              title="Inputs & Scenarios"
              subtitle="Edit assumptions and build a what-if pay scenario."
            />
          </div>
        </Card>
      </div>

      <Card
        title="Board commentary"
        subtitle="Templated narrative from the cockpit metrics — not generated by a language model."
        right={<ProvenanceChip provenance="ASSUMED" />}
      >
        <ul className="space-y-2">
          {narrativeLines.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[0.84rem] leading-relaxed text-ink-soft">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.68rem] text-muted">{HEURISTIC_LABEL}</p>
      </Card>
    </div>
  );
}

function FinanceInputs({
  totalRevenue,
  nonLaborOpex,
  onRevenue,
  onOpex,
  revenueProvenance,
}: {
  totalRevenue: number | null;
  nonLaborOpex: number | null;
  onRevenue: (v: number | null) => void;
  onOpex: (v: number | null) => void;
  revenueProvenance: 'MEASURED' | 'ENTERED' | 'ASSUMED';
}) {
  return (
    <Card
      title="Finance inputs"
      subtitle="Optional. Unlocks Revenue/Employee, HCROI and Pay Efficiency. Held in this session only."
      right={<ProvenanceChip provenance={revenueProvenance} />}
    >
      <div className="flex flex-wrap items-end gap-5">
        <NumberField
          label="Total annual revenue"
          unit="GND k"
          value={totalRevenue}
          onChange={onRevenue}
          placeholder="e.g. 500000"
        />
        <NumberField
          label="Non-labor operating expense"
          unit="GND k"
          value={nonLaborOpex}
          onChange={onOpex}
          placeholder="e.g. 200000"
        />
        {!isNum(totalRevenue) && (
          <p className="max-w-xs text-[0.72rem] leading-relaxed text-muted">
            Revenue-dependent KPIs stay blank until you enter revenue here — they are never fabricated.
          </p>
        )}
      </div>
    </Card>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="inline-flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value === null ? '' : value}
          placeholder={placeholder}
          onChange={(e) => {
            const v = Number.parseFloat(e.target.value);
            onChange(e.target.value === '' || !Number.isFinite(v) ? null : v);
          }}
          className="h-8 w-40 rounded-lg border border-border bg-card px-2.5 text-right text-[0.82rem] tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
        />
        <span className="text-[0.72rem] text-muted">{unit}</span>
      </span>
    </label>
  );
}

function ScenarioTile({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-card border border-border bg-card px-3.5 py-3 transition-colors hover:border-navy-500/40"
    >
      <span className="mt-0.5 text-navy-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[0.84rem] font-semibold text-ink">
          {title}
          <ArrowRight size={13} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-navy-500" />
        </span>
        <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted">{subtitle}</span>
      </span>
    </Link>
  );
}
