import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ProvenanceLegend } from '@/components/ui/ProvenanceChip';
import { AssumptionsPanel } from '@/components/capital/AssumptionsPanel';
import { ScenarioEditor } from '@/components/capital/ScenarioEditor';
import { LEVELS, LEVEL_LABELS, type Level } from '@/domain/levels';
import { INPUT_META, type SegmentInputKey } from '@/lib/assumptions';
import { PROVENANCE_META, type Provenance } from '@/lib/provenance';
import { inputTemplateCsv, type InputTemplate, parseInputsData } from '@/lib/parseInputs';
import { useInputsStore, useResolvedInputsByLevel } from '@/store/inputsStore';
import { cn } from '@/lib/cn';

const FIELD: Record<SegmentInputKey, { scale: number; unit: string }> = {
  baselineAttritionPct: { scale: 100, unit: '%' },
  replacementCostMultiple: { scale: 1, unit: '×' },
  valuePerHead: { scale: 1, unit: 'k' },
  productivityIndex: { scale: 1, unit: '' },
  overtimeSpendPerHead: { scale: 1, unit: 'k' },
  contingentCostTotal: { scale: 1, unit: 'k' },
  employerContributionPct: { scale: 100, unit: '%' },
};
const COLUMNS: SegmentInputKey[] = [
  'baselineAttritionPct',
  'replacementCostMultiple',
  'valuePerHead',
  'productivityIndex',
  'overtimeSpendPerHead',
  'contingentCostTotal',
  'employerContributionPct',
];
const PERCENT_KEYS: SegmentInputKey[] = ['baselineAttritionPct', 'employerContributionPct'];

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InputsAssumptions() {
  const resolved = useResolvedInputsByLevel();
  const setSegmentInput = useInputsStore((s) => s.setSegmentInput);
  const loadIllustrativeValueData = useInputsStore((s) => s.loadIllustrativeValueData);
  const loadIllustrativeFlexCost = useInputsStore((s) => s.loadIllustrativeFlexCost);
  const clearValueData = useInputsStore((s) => s.clearValueData);
  const resetSegmentInputs = useInputsStore((s) => s.resetSegmentInputs);

  const inputRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<{ ok: boolean; message: string } | null>(null);

  const onUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        const result = parseInputsData(buf);
        for (const entry of result.entries) {
          const v = PERCENT_KEYS.includes(entry.key) && entry.value > 1 ? entry.value / 100 : entry.value;
          setSegmentInput(entry.level, entry.key, v, 'MEASURED');
        }
        const msg = result.entries.length
          ? `Loaded ${result.entries.length} values across ${result.levelsFound.length} levels (${result.columns.length} inputs).`
          : 'No values loaded.';
        setReport({ ok: result.entries.length > 0, message: [msg, ...result.warnings].join(' ') });
      } catch {
        setReport({ ok: false, message: 'Could not read that file. Use a CSV/XLSX from the templates below.' });
      }
    },
    [setSegmentInput],
  );

  return (
    <ModuleShell
      title="Inputs & Assumptions"
      subtitle="The net-new inputs the salary survey lacks — entered, uploaded, or modeled on defaults."
    >
      <ProvenanceLegend />
      <AssumptionsPanel />

      <Card
        title="Per-segment inputs"
        subtitle="Edit any cell (flips to Entered). Empty a cell to revert to the Appendix-A default. Value-per-head has no default — provide it to unlock Value Density & the Frontier."
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionButton icon={<Sparkles size={12} />} onClick={loadIllustrativeValueData}>Illustrative value</ActionButton>
            <ActionButton icon={<Sparkles size={12} />} onClick={loadIllustrativeFlexCost}>Illustrative flex cost</ActionButton>
            <ActionButton icon={<X size={12} />} onClick={clearValueData}>Clear value</ActionButton>
            <ActionButton icon={<RotateCcw size={12} />} onClick={resetSegmentInputs}>Reset all</ActionButton>
          </div>
        }
        flush
      >
        <TableScroll>
          <Table caption="Per-segment workforce-capital inputs by career level">
            <THead sticky>
              <TR>
                <TH className="bg-[#F0F2F6]">Level</TH>
                {COLUMNS.map((key) => {
                  const meta = INPUT_META.find((m) => m.key === key)!;
                  return (
                    <TH key={key} align="right" className="border-l border-border" title={meta.hint}>
                      {meta.label}
                      <span className="ml-1 font-normal text-muted">{FIELD[key].unit}</span>
                    </TH>
                  );
                })}
              </TR>
            </THead>
            <TBody>
              {LEVELS.map((level) => (
                <TR key={level}>
                  <TD className="whitespace-nowrap font-medium text-ink">{LEVEL_LABELS[level]}</TD>
                  {COLUMNS.map((key) => (
                    <TD key={key} align="right" className="border-l border-border/60">
                      <InputCell
                        level={level}
                        inputKey={key}
                        resolvedValue={cellValue(resolved, level, key)}
                        provenance={cellProvenance(resolved, level, key)}
                        onSet={setSegmentInput}
                      />
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      </Card>

      <Card
        title="Templates & upload"
        subtitle="Download a CSV template, fill it with your actuals, and re-import (loaded as Measured)."
        right={
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-900"
          >
            <Upload size={13} /> Upload inputs
          </button>
        }
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onUpload} className="sr-only" aria-label="Upload inputs" />
        <div className="flex flex-wrap items-center gap-2">
          {(['value', 'attrition', 'cost'] as InputTemplate[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => download(`compbench-${t}-template.csv`, inputTemplateCsv(t))}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium capitalize text-ink-soft hover:border-navy-500/40 hover:text-navy-700"
            >
              <Download size={13} /> {t} template
            </button>
          ))}
        </div>
        {report && <p className={cn('mt-3 text-xs', report.ok ? 'text-brand-green' : 'text-[#9A7212]')}>{report.message}</p>}
      </Card>

      <ScenarioEditor />
    </ModuleShell>
  );
}

function cellValue(resolved: ReturnType<typeof useResolvedInputsByLevel>, level: Level, key: SegmentInputKey): number | null {
  const r = resolved[level][key];
  return r ? r.value : null;
}
function cellProvenance(resolved: ReturnType<typeof useResolvedInputsByLevel>, level: Level, key: SegmentInputKey): Provenance | null {
  const r = resolved[level][key];
  return r ? r.provenance : null;
}

function InputCell({
  level,
  inputKey,
  resolvedValue,
  provenance,
  onSet,
}: {
  level: Level;
  inputKey: SegmentInputKey;
  resolvedValue: number | null;
  provenance: Provenance | null;
  onSet: (segId: string, key: SegmentInputKey, value: number | null, provenance?: Provenance) => void;
}) {
  const { scale } = FIELD[inputKey];
  const display = resolvedValue === null ? '' : String(Math.round(resolvedValue * scale * 1000) / 1000);
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {provenance && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: PROVENANCE_META[provenance].color }}
          title={PROVENANCE_META[provenance].label}
        />
      )}
      <input
        type="number"
        value={display}
        onChange={(e) => {
          const raw = Number.parseFloat(e.target.value);
          onSet(level, inputKey, Number.isFinite(raw) ? raw / scale : null, 'ENTERED');
        }}
        className="h-7 w-16 rounded-md border border-border bg-card px-1.5 text-right text-[0.78rem] tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
      />
    </span>
  );
}

function ActionButton({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[0.72rem] font-medium text-ink-soft transition-colors hover:border-navy-500/40 hover:text-navy-700"
    >
      {icon}
      {children}
    </button>
  );
}
