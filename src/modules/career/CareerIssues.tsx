import { useMemo } from 'react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IllustrativeTag } from '@/components/ui/Badge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { GroupedBars, type BarSeries, type GroupedBarsRow } from '@/components/charts/GroupedBars';
import { CHART } from '@/components/charts/chartTheme';
import { LEVELS, LEVEL_LABELS, type Level } from '@/domain/levels';
import type {
  CareerIssues as CareerIssuesData,
  OvertimeCell,
  RangeVsFirm,
} from '@/domain/types';
import { formatGndK, NA } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import { RangeRowsTable, RangeBarLegend, type RangeRow } from './RangeRowsTable';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** GND k formatter (0 decimals — these career figures are whole-ish thousands). */
const gnd = (v: number | null): string => formatGndK(v, 0);
/** GND m formatter for project-revenue (1 decimal). */
const gndM = (v: number | null): string => formatGndK(v, 1);
/**
 * Percent formatter for values that are ALREADY in percent units (e.g. 4 -> "4%"),
 * not ratios — so it must not multiply by 100 like `formatPct`.
 */
const percentValue = (v: number | null): string => (isNum(v) ? `${formatGndK(v, 1)}%` : NA);
/** Years formatter for progression. */
const years = (v: number | null): string => (isNum(v) ? `${formatGndK(v, 1)} yrs` : NA);

export function CareerIssues() {
  const career = useAppStore((s) => s.dataset.careerIssues);
  const yourFirmName = useAppStore((s) => s.dataset.meta.yourFirmName);

  if (!career) {
    return (
      <ModuleShell
        title="Additional Career Issues"
        subtitle="Progression, utilisation, targets and overtime practice"
        module={5}
      >
        <Card>
          <EmptyState
            title="No career-issues data"
            message="This section is sourced from the additional-career-issues appendix. Ingest a workbook that includes it to populate progression, utilisation and target benchmarks."
          />
        </Card>
      </ModuleShell>
    );
  }

  const items: TabItem[] = [
    { value: 'progression', label: 'Progression', content: <ProgressionTab career={career} yourFirmName={yourFirmName} /> },
    { value: 'starting', label: 'Starting & incentives', content: <StartingTab career={career} /> },
    { value: 'utilisation', label: 'Utilisation', content: <UtilisationTab career={career} /> },
    { value: 'targets', label: 'Sales & revenue targets', content: <TargetsTab career={career} /> },
    { value: 'salary-change', label: 'Expected change', content: <SalaryChangeTab career={career} /> },
    { value: 'overtime', label: 'Overtime / TOIL', content: <OvertimeTab career={career} /> },
  ];

  return (
    <ModuleShell
      title="Additional Career Issues"
      subtitle="Progression, utilisation, targets and overtime practice"
      module={5}
    >
      <Card
        title="Career-issues benchmarks"
        subtitle="Qualitative and structural benchmarks beyond cash compensation, drawn from the survey's additional-issues appendix."
        right={<IllustrativeTag />}
      >
        <p className="text-[0.8rem] leading-relaxed text-muted">
          This entire view is illustrative sample data — figures are representative of survey output
          rather than a published market dataset. Use it to frame discussion, not as a precise
          benchmark. {yourFirmName}&rsquo;s values are shown alongside the market range in each section.
        </p>
      </Card>

      <Card flush bodyClassName="px-5 py-4">
        <Tabs items={items} ariaLabel="Career-issue sections" />
      </Card>
    </ModuleShell>
  );
}

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

function ProgressionTab({ career, yourFirmName }: { career: CareerIssuesData; yourFirmName: string }) {
  const { progression } = career;

  const series: BarSeries[] = [
    { key: 'market', label: 'Market average', color: CHART.bandDark },
    { key: 'firm', label: yourFirmName, color: CHART.firm },
  ];

  const paceData: GroupedBarsRow[] = [
    { name: 'Typical', market: progression.averages.typical, firm: progression.yourFirm.typical },
    { name: 'Fast track', market: progression.averages.fast, firm: progression.yourFirm.fast },
    { name: 'Slow track', market: progression.averages.slow, firm: progression.yourFirm.slow },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card
        title="Time to Principal"
        subtitle="Total years across the full path — market average vs Your Firm, by progression pace."
      >
        <GroupedBars data={paceData} series={series} unit="GND_K" height={260} includeZero />
        <p className="mt-3 text-[0.75rem] leading-relaxed text-muted">
          Bars are total years to reach Principal. Your Firm reports a single uniform figure across
          all three paces; the market differentiates fast vs slow tracks.
        </p>
      </Card>

      <Card title="Typical years in level" subtitle="Average tenure before promotion at each career level.">
        <TableScroll className="rounded-lg border border-border">
          <Table>
            <THead>
              <TR>
                <TH className="bg-[#F0F2F6]">Level</TH>
                <TH align="right" className="border-l border-border">
                  Typical years in level
                </TH>
              </TR>
            </THead>
            <TBody>
              {LEVELS.map((level) => {
                const v = progression.perLevelTypical[level];
                return (
                  <TR key={level}>
                    <TD className="font-medium text-ink">{LEVEL_LABELS[level]}</TD>
                    <TD align="right" className="border-l border-border/60 tabular-nums">
                      {years(isNum(v) ? v : null)}
                    </TD>
                  </TR>
                );
              })}
              <TR className="bg-[#F4F6F9]">
                <TD className="font-semibold text-ink">Total (typical)</TD>
                <TD align="right" className="border-l border-border/60 font-semibold tabular-nums">
                  {years(sumLevels(progression.perLevelTypical))}
                </TD>
              </TR>
            </TBody>
          </Table>
        </TableScroll>
      </Card>
    </div>
  );
}

function sumLevels(rec: Record<Level, number>): number | null {
  let total = 0;
  let any = false;
  for (const level of LEVELS) {
    const v = rec[level];
    if (isNum(v)) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

/* ------------------------------------------------------------------ */
/* Starting salaries + sign-on / internships                           */
/* ------------------------------------------------------------------ */

function StartingTab({ career }: { career: CareerIssuesData }) {
  const { startingSalaries, signOnNote, internshipNote } = career;

  return (
    <div className="space-y-5">
      <Card title="Starting salaries" subtitle="Entry compensation by qualification — market vs Your Firm (GND k).">
        {startingSalaries.rows.length > 0 ? (
          <TableScroll className="rounded-lg border border-border">
            <Table>
              <THead>
                <TR>
                  <TH className="bg-[#F0F2F6]">Entry profile</TH>
                  <TH align="right" className="border-l border-border">
                    Market (GND k)
                  </TH>
                  <TH align="right">Your Firm (GND k)</TH>
                  <TH align="right" className="border-l border-border">
                    Δ vs market
                  </TH>
                </TR>
              </THead>
              <TBody>
                {startingSalaries.rows.map((row) => {
                  const delta = isNum(row.market) && isNum(row.yourFirm) ? row.yourFirm - row.market : null;
                  return (
                    <TR key={row.label}>
                      <TD className="whitespace-nowrap font-medium text-ink">{row.label}</TD>
                      <TD align="right" className="border-l border-border/60 tabular-nums text-ink-soft">
                        {gnd(row.market)}
                      </TD>
                      <TD align="right" className="tabular-nums font-semibold" style={{ color: CHART.firm }}>
                        {gnd(row.yourFirm)}
                      </TD>
                      <TD
                        align="right"
                        className="border-l border-border/60 tabular-nums"
                        style={delta != null ? { color: delta >= 0 ? CHART.green : CHART.red } : undefined}
                      >
                        {delta != null ? `${delta >= 0 ? '+' : '−'}${formatGndK(Math.abs(delta), 0)}` : NA}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableScroll>
        ) : (
          <EmptyState compact message="No starting-salary rows in this dataset." />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ProseCard title="Sign-on bonuses" note={signOnNote} />
        <ProseCard title="Summer internships" note={internshipNote} />
      </div>
    </div>
  );
}

function ProseCard({ title, note }: { title: string; note: string }) {
  return (
    <Card title={title} right={<IllustrativeTag />}>
      {note.trim().length > 0 ? (
        <p className="text-[0.85rem] leading-relaxed text-ink-soft">{note}</p>
      ) : (
        <p className="text-[0.85rem] text-muted">{NA}</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Utilisation                                                         */
/* ------------------------------------------------------------------ */

function UtilisationTab({ career }: { career: CareerIssuesData }) {
  const rows: RangeRow[] = career.utilisation.map((u) => ({
    label: LEVEL_LABELS[u.level],
    marketMin: u.marketMin,
    marketMax: u.marketMax,
    yourFirm: u.yourFirm,
  }));

  return (
    <Card
      title="Utilisation targets"
      subtitle="Billable-utilisation target band by level (%), with Your Firm marked against the market range."
    >
      {rows.length > 0 ? (
        <>
          <RangeRowsTable rows={rows} rowHeader="Level" unitLabel="%" format={percentValue} />
          <RangeBarLegend />
        </>
      ) : (
        <EmptyState compact message="No utilisation targets in this dataset." />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sales & project-revenue targets                                     */
/* ------------------------------------------------------------------ */

function TargetsTab({ career }: { career: CareerIssuesData }) {
  return (
    <div className="space-y-5">
      <TargetCard
        title="Sales targets"
        subtitle="Annual individual sales target band by level (GND k), Your Firm marked against the market range."
        unitLabel="GND k"
        format={gnd}
        targets={career.salesTargets}
      />
      <TargetCard
        title="Project revenue targets"
        subtitle="Per-project revenue target band by level (GND m), Your Firm marked against the market range."
        unitLabel="GND m"
        format={gndM}
        targets={career.projectRevenueTargets}
      />
    </div>
  );
}

function TargetCard({
  title,
  subtitle,
  unitLabel,
  format,
  targets,
}: {
  title: string;
  subtitle: string;
  unitLabel: string;
  format: (v: number | null) => string;
  targets: RangeVsFirm[];
}) {
  const rows: RangeRow[] = targets.map((t) => ({
    label: t.label,
    marketMin: t.marketMin,
    marketMax: t.marketMax,
    yourFirm: t.yourFirm,
  }));

  return (
    <Card title={title} subtitle={subtitle}>
      {rows.length > 0 ? (
        <>
          <RangeRowsTable rows={rows} rowHeader="Level" unitLabel={unitLabel} format={format} />
          <RangeBarLegend />
        </>
      ) : (
        <EmptyState compact message="No targets in this dataset." />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Expected base-salary change                                         */
/* ------------------------------------------------------------------ */

function SalaryChangeTab({ career }: { career: CareerIssuesData }) {
  const rows: RangeRow[] = career.expectedSalaryChange.map((e) => ({
    label: LEVEL_LABELS[e.level],
    marketMin: e.marketMin,
    marketMax: e.marketMax,
    yourFirm: e.yourFirm,
  }));

  return (
    <Card
      title="Expected base-salary change"
      subtitle="Anticipated base-salary movement over the next cycle by level (%), Your Firm vs the market range."
    >
      {rows.length > 0 ? (
        <>
          <RangeRowsTable rows={rows} rowHeader="Level" unitLabel="%" format={percentValue} />
          <RangeBarLegend />
        </>
      ) : (
        <EmptyState compact message="No expected-change figures in this dataset." />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Overtime / TOIL 2×2 matrix                                          */
/* ------------------------------------------------------------------ */

const OVERTIME_GROUPS = ['Non-managerial', 'Managerial'] as const;
const OVERTIME_KINDS = ['Overtime pay', 'Time off in lieu'] as const;

function OvertimeTab({ career }: { career: CareerIssuesData }) {
  const lookup = useMemo(() => {
    const map = new Map<string, OvertimeCell>();
    for (const cell of career.overtime) {
      map.set(`${cell.group}|${cell.kind}`, cell);
    }
    return map;
  }, [career.overtime]);

  return (
    <Card
      title="Overtime & time off in lieu"
      subtitle="Your Firm's stated practice by employee group and compensation type."
    >
      {career.overtime.length > 0 ? (
        <TableScroll className="rounded-lg border border-border">
          <Table>
            <THead>
              <TR>
                <TH className="bg-[#F0F2F6]">Group</TH>
                {OVERTIME_KINDS.map((kind) => (
                  <TH key={kind} align="left" className="border-l border-border">
                    {kind}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {OVERTIME_GROUPS.map((group) => (
                <TR key={group}>
                  <TD className="font-medium text-ink">{group}</TD>
                  {OVERTIME_KINDS.map((kind) => {
                    const cell = lookup.get(`${group}|${kind}`);
                    const value = cell?.yourFirm?.trim();
                    return (
                      <TD key={kind} className="border-l border-border/60 text-ink-soft">
                        {value ? value : <span className="text-muted">{NA}</span>}
                      </TD>
                    );
                  })}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : (
        <EmptyState compact message="No overtime / TOIL data in this dataset." />
      )}
    </Card>
  );
}
