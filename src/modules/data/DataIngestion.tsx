import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, RotateCcw, Upload } from 'lucide-react';
import { ModuleShell } from '@/components/layout/ModuleShell';
import { Card } from '@/components/ui/Card';
import { KpiStrip, type KpiItem } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { COMPONENT_LABELS } from '@/domain/components';
import { allPresentComponents } from '@/domain/types';
import { formatCount } from '@/lib/format';
import { parseWorkbookData, type ParseReport } from '@/lib/parseWorkbook';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { describeCombo, EXPECTED_TABS, friendlyParseError } from './ingestionLabels';
import { MacroContext } from './MacroContext';

type Status =
  | { kind: 'idle' }
  | { kind: 'parsing'; fileName: string }
  | { kind: 'success'; fileName: string }
  | { kind: 'error'; fileName: string; message: string };

const ACCEPT = '.xlsx,.xls';

export function DataIngestion() {
  const meta = useAppStore((s) => s.dataset.meta);
  const dataset = useAppStore((s) => s.dataset);
  const source = useAppStore((s) => s.source);
  const setActiveDataset = useAppStore((s) => s.setActiveDataset);
  const resetToSeed = useAppStore((s) => s.resetToSeed);

  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [report, setReport] = useState<ParseReport | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const ingestFile = useCallback(
    async (file: File) => {
      setStatus({ kind: 'parsing', fileName: file.name });
      try {
        const buffer = await file.arrayBuffer();
        const result = parseWorkbookData(buffer);
        setActiveDataset(result.dataset, 'uploaded', result.report);
        setReport(result.report);
        setStatus({ kind: 'success', fileName: file.name });
      } catch (err) {
        setReport(null);
        setStatus({ kind: 'error', fileName: file.name, message: friendlyParseError(err) });
      }
    },
    [setActiveDataset],
  );

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so the same file can be re-selected after an error.
      e.target.value = '';
      if (file) void ingestFile(file);
    },
    [ingestFile],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void ingestFile(file);
    },
    [ingestFile],
  );

  const onReset = useCallback(() => {
    resetToSeed();
    setReport(null);
    setStatus({ kind: 'idle' });
  }, [resetToSeed]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const components = [...allPresentComponents(dataset)];
  const componentLabels = components.map((c) => COMPONENT_LABELS[c]);
  const isUploaded = source === 'uploaded';
  const parsing = status.kind === 'parsing';

  const kpis: KpiItem[] = [
    { label: 'Country', value: meta.country || '—', accent: 'navy' },
    { label: 'Report year', value: String(meta.reportYear), accent: 'navy' },
    { label: 'Currency', value: meta.currency || '—', accent: 'navy' },
    { label: 'Participating firms', value: formatCount(meta.participatingFirms), accent: 'navy' },
    {
      label: 'Components loaded',
      value: formatCount(components.length),
      sub: components.length > 0 ? componentLabels.join(' · ') : 'None',
      accent: components.length > 0 ? 'green' : 'default',
    },
  ];

  return (
    <ModuleShell
      title="Data Ingestion"
      subtitle="Upload a Vencon-format workbook to replace the Greenland sample across every module."
      module={6}
    >
      <KpiStrip items={kpis} />

      <Card title="Active dataset scope" subtitle="Headcounts and provenance backing every benchmark in the app.">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <ScopeFact label="Market incumbents" value={formatCount(meta.marketIncumbents)} />
          <ScopeFact label="Your Firm incumbents" value={formatCount(meta.yourFirmIncumbents)} />
          <ScopeFact label="Your Firm" value={meta.yourFirmName || '—'} />
          <ScopeFact
            label="Components loaded"
            value={
              components.length > 0
                ? `${formatCount(components.length)} (${componentLabels.join(', ')})`
                : 'None'
            }
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Upload + reset */}
        <Card
          className="lg:col-span-2"
          title="Source workbook"
          subtitle="Drag-and-drop or browse for a .xlsx / .xls export. The whole app updates on a successful parse."
          right={
            <Badge variant={isUploaded ? 'green' : 'navy'}>
              {isUploaded ? 'Uploaded data' : 'Greenland sample'}
            </Badge>
          }
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
              dragActive ? 'border-navy-500 bg-navy-500/5' : 'border-border bg-bg/60',
              parsing && 'opacity-70',
            )}
          >
            <span className="text-muted">
              <Upload size={26} strokeWidth={1.5} />
            </span>
            <p className="text-sm font-medium text-ink-soft">
              {parsing ? 'Reading workbook…' : 'Drop a workbook here'}
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-muted">
              Expected: a Vencon consultant-salary-survey export with one tab per
              weighting × period × component.
            </p>
            <button
              type="button"
              onClick={openPicker}
              disabled={parsing}
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors',
                'hover:bg-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <FileUp size={14} strokeWidth={2} />
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              onChange={onInputChange}
              className="sr-only"
              aria-label="Upload workbook"
            />
          </div>

          {status.kind === 'success' && (
            <StatusNote tone="success" icon={<CheckCircle2 size={15} strokeWidth={2} />}>
              <span className="font-medium text-ink">{status.fileName}</span> ingested — the active
              scope chip and every module now reflect this workbook.
            </StatusNote>
          )}
          {status.kind === 'error' && (
            <StatusNote tone="error" icon={<AlertTriangle size={15} strokeWidth={2} />}>
              <span className="font-medium text-ink">{status.fileName}</span> — {status.message}
            </StatusNote>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs text-muted">
              Current source:{' '}
              <span className="font-semibold text-ink-soft">
                {isUploaded ? 'Uploaded workbook' : 'Greenland sample (built-in)'}
              </span>
            </p>
            <button
              type="button"
              onClick={onReset}
              disabled={!isUploaded || parsing}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors',
                'hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <RotateCcw size={13} strokeWidth={2} />
              Reset to Greenland sample
            </button>
          </div>
        </Card>

        {/* Expected format reference */}
        <Card
          title="Expected tab naming"
          subtitle="Tabs are matched by name. Prefixes: t- = target, a- = actual; Firm-weighted / Incu-weighted set the weighting."
        >
          <ul className="space-y-2.5">
            {EXPECTED_TABS.map((tab) => (
              <li key={tab.name} className="text-xs leading-snug">
                <code className="rounded bg-[#EEF1F6] px-1.5 py-0.5 font-mono text-[0.72rem] text-ink">
                  {tab.name}
                </code>
                <span className="mt-0.5 block text-muted">{tab.meaning}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-[0.72rem] leading-relaxed text-muted">
            Unrecognised tabs are ignored. In the Greenland sample only Basic Salary ·
            Firm-weighted · Target is reported directly; every other combination shows an
            empty-state until ingested.
          </p>
        </Card>
      </div>

      {/* Parse / validation report */}
      <Card
        title="Validation report"
        subtitle="Coverage and warnings from the most recent upload."
      >
        {report ? (
          <ParseReportView report={report} />
        ) : (
          <EmptyState
            compact
            title="No upload yet"
            message="Upload a workbook to see which tabs were recognised, which combinations loaded, and any warnings."
          />
        )}
      </Card>

      <MacroContext />
    </ModuleShell>
  );
}

function ScopeFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function StatusNote({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'error';
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-snug',
        tone === 'success'
          ? 'border-brand-green/30 bg-brand-green/5 text-ink-soft'
          : 'border-brand-red/30 bg-brand-red/5 text-ink-soft',
      )}
    >
      <span className={cn('mt-px shrink-0', tone === 'success' ? 'text-brand-green' : 'text-brand-red')}>
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

function ParseReportView({ report }: { report: ParseReport }) {
  const stats: { label: string; value: string }[] = [
    { label: 'Tabs found', value: formatCount(report.tabsFound) },
    { label: 'Component tabs', value: formatCount(report.componentTabs) },
    { label: 'Combos loaded', value: formatCount(report.combosLoaded.length) },
    { label: 'Warnings', value: formatCount(report.warnings.length) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-bg/50 px-3 py-2">
            <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">
              {s.label}
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-[0.78rem] font-semibold text-ink-soft">Combinations loaded</h3>
        {report.combosLoaded.length > 0 ? (
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {report.combosLoaded.map((combo) => {
              const parts = describeCombo(combo);
              return (
                <li
                  key={combo}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                >
                  <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 text-brand-green" />
                  <span className="font-medium text-ink">{parts.component}</span>
                  <span className="text-muted">·</span>
                  <span className="text-ink-soft">{parts.weighting}</span>
                  <span className="text-muted">·</span>
                  <span className="text-ink-soft">{parts.period}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">
            No component combinations were recognised in this workbook.
          </p>
        )}
      </div>

      {report.warnings.length > 0 && (
        <div>
          <h3 className="text-[0.78rem] font-semibold text-ink-soft">Warnings</h3>
          <ul className="mt-2 space-y-1.5">
            {report.warnings.map((w, i) => (
              <li
                key={`${i}-${w}`}
                className="flex items-start gap-2 rounded-md border border-brand-amber/30 bg-brand-amber/10 px-2.5 py-1.5 text-xs leading-snug text-[#9A7212]"
              >
                <AlertTriangle size={13} strokeWidth={2} className="mt-px shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
