import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { LEVELS, LEVEL_LABELS, type Level } from '@/domain/levels';
import { JOB_FAMILIES } from '@/lib/assumptions';
import { employeeTemplateCsv, parseEmployeesData } from '@/lib/parseEmployees';
import { directComp, type Employee } from '@/domain/employee';
import { formatCount, formatGndK } from '@/lib/format';
import { useEmployeeStore } from '@/store/employeeStore';
import { cn } from '@/lib/cn';

const ROW_LIMIT = 60;

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Anchor must be in the DOM for the click to register in some browsers (Firefox).
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function EmployeesManager() {
  const dataset = useEmployeeStore((s) => s.dataset);
  const source = useEmployeeStore((s) => s.source);
  const setDataset = useEmployeeStore((s) => s.setDataset);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const resetToSynthetic = useEmployeeStore((s) => s.resetToSynthetic);

  const inputRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<{ ok: boolean; message: string } | null>(null);
  const [fLevel, setFLevel] = useState<'all' | Level>('all');
  const [fFamily, setFFamily] = useState<string>('all');

  const employees = dataset.employees;
  const filtered = useMemo(
    () =>
      employees.filter((e) => (fLevel === 'all' || e.level === fLevel) && (fFamily === 'all' || e.jobFamily === fFamily)),
    [employees, fLevel, fFamily],
  );

  const onUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        const result = parseEmployeesData(buf);
        if (result.employees.length > 0) {
          setDataset({ ...dataset, employees: result.employees, meta: { ...dataset.meta, provenance: 'MEASURED', count: result.employees.length, generatedFrom: 'upload' } }, 'custom');
        }
        setReport({ ok: result.employees.length > 0, message: [`Loaded ${result.count} employees.`, ...result.warnings].join(' ') });
      } catch {
        setReport({ ok: false, message: 'Could not read that file. Use the CSV template.' });
      }
    },
    [dataset, setDataset],
  );

  const byLevel = LEVELS.map((l) => ({ level: l, n: employees.filter((e) => e.level === l).length }));
  const avgBase = employees.length ? employees.reduce((a, e) => a + e.basePay, 0) / employees.length : 0;
  const totalDirect = employees.reduce((a, e) => a + directComp(e), 0);

  const kpis: KpiItem[] = [
    { label: 'Headcount', value: formatCount(employees.length), sub: byLevel.map((b) => `${b.level} ${b.n}`).join(' · '), accent: 'navy' },
    { label: 'Job families', value: formatCount(new Set(employees.map((e) => e.jobFamily)).size), accent: 'navy' },
    { label: 'Avg base pay', value: `${formatGndK(avgBase, 1)}`, sub: 'GND k / yr', accent: 'navy' },
    { label: 'Total direct comp', value: `${formatGndK(totalDirect, 0, true)}`, sub: 'GND k / yr', accent: 'navy' },
  ];

  return (
    <ModuleShell
      title="Employees & Job Architecture"
      subtitle="Internal employee records and job architecture — the prerequisite for pricing, ranges and the cockpit."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={source === 'custom' ? 'green' : 'amber'}>
          {source === 'custom' ? 'Uploaded / edited' : 'Synthetic seed (Assumed)'}
        </Badge>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-900">
          <Upload size={13} /> Upload employees
        </button>
        <button type="button" onClick={() => download('compbench-employees-template.csv', employeeTemplateCsv())} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700">
          <Download size={13} /> Template
        </button>
        <button type="button" onClick={resetToSynthetic} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-navy-500/40 hover:text-navy-700">
          <RotateCcw size={13} /> Reset to synthetic
        </button>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onUpload} className="sr-only" aria-label="Upload employees" />
        {report && <span className={cn('text-xs', report.ok ? 'text-brand-green' : 'text-[#9A7212]')}>{report.message}</span>}
      </div>

      <KpiStrip items={kpis} className="xl:grid-cols-4" />

      <Card
        title="Employee records"
        subtitle={`Edit base pay or performance inline (flips to custom). Showing ${Math.min(filtered.length, ROW_LIMIT)} of ${formatCount(filtered.length)}.`}
        right={
          <div className="flex items-center gap-2">
            <Select ariaLabel="Level" value={fLevel} onChange={(v) => setFLevel(v as 'all' | Level)} options={[{ value: 'all', label: 'All levels' }, ...LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))]} />
            <Select ariaLabel="Family" value={fFamily} onChange={setFFamily} options={[{ value: 'all', label: 'All families' }, ...JOB_FAMILIES.map((f) => ({ value: f, label: f }))]} />
          </div>
        }
        flush
      >
        <TableScroll>
          <Table caption="Employee records">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">ID</TH>
                <TH>Family</TH>
                <TH>Level</TH>
                <TH>Grade</TH>
                <TH>Geo</TH>
                <TH align="right" className="border-l border-border">Base pay</TH>
                <TH align="right">Bonus</TH>
                <TH align="center">Perf</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.slice(0, ROW_LIMIT).map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap font-medium text-ink">{e.displayName}</TD>
                  <TD className="text-ink-soft">{e.jobFamily}</TD>
                  <TD className="text-ink-soft">{e.level}</TD>
                  <TD className="text-ink-soft">{e.grade}</TD>
                  <TD className="text-ink-soft">{e.geography}</TD>
                  <TD align="right" className="border-l border-border/60">
                    <NumCell value={e.basePay} onChange={(v) => updateEmployee(e.id, { basePay: v })} />
                  </TD>
                  <TD align="right" className="tabular-nums text-muted">{formatGndK(e.bonusTarget ?? 0, 1)}</TD>
                  <TD align="center">
                    <PerfCell employee={e} onChange={(v) => updateEmployee(e.id, { performanceRating: v })} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>

      <Card title="Job architecture" subtitle="Benchmark match confidence feeds the Range Confidence Index." flush>
        <TableScroll>
          <Table caption="Job architecture">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">Job family</TH>
                <TH>Level</TH>
                <TH>Grade</TH>
                <TH>Geography</TH>
                <TH align="right" className="border-l border-border">Benchmark match</TH>
              </TR>
            </THead>
            <TBody>
              {dataset.jobArchitecture.map((j) => (
                <TR key={j.id}>
                  <TD className="font-medium text-ink">{j.jobFamily}</TD>
                  <TD className="text-ink-soft">{j.level}</TD>
                  <TD className="text-ink-soft">{j.grade}</TD>
                  <TD className="text-ink-soft">{j.geography}</TD>
                  <TD align="right" className="border-l border-border/60 tabular-nums">{(j.benchmarkMatchConfidence.value * 100).toFixed(0)}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>
    </ModuleShell>
  );
}

function NumCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = Number.parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      className="h-7 w-20 rounded-md border border-border bg-card px-1.5 text-right text-[0.78rem] tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
    />
  );
}

function PerfCell({ employee, onChange }: { employee: Employee; onChange: (v: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <select
      value={employee.performanceRating ?? 3}
      onChange={(e) => onChange(Number.parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5)}
      className="h-7 rounded-md border border-border bg-card px-1 text-[0.78rem] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}
