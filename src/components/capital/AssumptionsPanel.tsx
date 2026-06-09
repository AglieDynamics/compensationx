import { RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import { DEFAULT_ASSUMPTIONS, type GlobalAssumptions } from '@/lib/assumptions';
import { useInputsStore } from '@/store/inputsStore';
import { cn } from '@/lib/cn';

interface FieldDef {
  key: keyof GlobalAssumptions;
  label: string;
  unit: string;
  scale: number; // display = value * scale
  step: number;
  min: number;
  max: number;
  group: 'Retention' | 'Productivity' | 'Cost' | 'Time';
  hint: string;
}

const FIELDS: FieldDef[] = [
  { key: 'retentionRmax', label: 'Max retention (Rmax)', unit: '%', scale: 100, step: 1, min: 50, max: 100, group: 'Retention', hint: 'Ceiling retention at high pay.' },
  { key: 'retentionK', label: 'Attrition sensitivity (k)', unit: '', scale: 1, step: 0.5, min: 1, max: 20, group: 'Retention', hint: 'Steepness of the retention curve.' },
  { key: 'retentionP0', label: 'Inflection (p0)', unit: 'pctile', scale: 100, step: 1, min: 5, max: 95, group: 'Retention', hint: 'Pay percentile where returns peak.' },
  { key: 'haircutSlope', label: 'Haircut slope', unit: '', scale: 1, step: 0.05, min: 0, max: 2, group: 'Productivity', hint: 'Productivity drag per unit of under-market gap.' },
  { key: 'haircutCap', label: 'Haircut cap', unit: '%', scale: 100, step: 1, min: 0, max: 50, group: 'Productivity', hint: 'Maximum productivity drag.' },
  { key: 'employerContributionPct', label: 'Employer contribution', unit: '%', scale: 100, step: 1, min: 0, max: 60, group: 'Cost', hint: 'Benefits / employer contribution × TCC.' },
  { key: 'flexibleLoadThreshold', label: 'False-savings threshold', unit: '%', scale: 100, step: 1, min: 0, max: 50, group: 'Cost', hint: '(Overtime + contingent) / TWC that flags false savings.' },
  { key: 'salaryInflation', label: 'Salary inflation', unit: '%', scale: 100, step: 0.5, min: 0, max: 25, group: 'Time', hint: 'Annual market drift (catch-up premium).' },
  { key: 'coiHorizon', label: 'Cost-of-inaction horizon', unit: 'yrs', scale: 1, step: 1, min: 1, max: 10, group: 'Time', hint: 'Projection window for leakage.' },
  { key: 'discountRate', label: 'Discount rate', unit: '%', scale: 100, step: 0.5, min: 0, max: 20, group: 'Time', hint: 'Present-value discount for future leakage.' },
];

const GROUPS: FieldDef['group'][] = ['Retention', 'Productivity', 'Cost', 'Time'];

export function AssumptionsPanel({ className }: { className?: string }) {
  const assumptions = useInputsStore((s) => s.assumptions);
  const setAssumption = useInputsStore((s) => s.setAssumption);
  const resetAssumptions = useInputsStore((s) => s.resetAssumptions);

  const editedCount = FIELDS.filter((f) => assumptions[f.key] !== DEFAULT_ASSUMPTIONS[f.key]).length;

  return (
    <Card
      title="Assumptions"
      subtitle="Appendix-A defaults. Edits flip dependent figures to “Entered”. Reset restores the documented defaults."
      right={
        <div className="flex items-center gap-2">
          {editedCount > 0 && <ProvenanceChip provenance="ENTERED" label={`${editedCount} edited`} />}
          <button
            type="button"
            onClick={resetAssumptions}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.72rem] font-medium text-ink-soft transition-colors hover:border-navy-500/40 hover:text-navy-700"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      }
      className={className}
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {GROUPS.map((group) => (
          <div key={group} className="space-y-2.5">
            <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{group}</div>
            {FIELDS.filter((f) => f.group === group).map((f) => {
              const edited = assumptions[f.key] !== DEFAULT_ASSUMPTIONS[f.key];
              const display = Math.round(assumptions[f.key] * f.scale * 100) / 100;
              return (
                <label key={f.key} className="block" title={f.hint}>
                  <span className="mb-0.5 flex items-center justify-between text-[0.72rem] text-ink-soft">
                    <span>{f.label}</span>
                    {edited && <span className="h-1.5 w-1.5 rounded-full bg-navy-500" />}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={display}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      onChange={(e) => {
                        const raw = Number.parseFloat(e.target.value);
                        if (Number.isFinite(raw)) {
                          const clamped = Math.min(f.max, Math.max(f.min, raw));
                          setAssumption(f.key, clamped / f.scale);
                        }
                      }}
                      className={cn(
                        'h-7 w-full rounded-md border bg-card px-2 text-[0.8rem] tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30',
                        edited ? 'border-navy-500/50' : 'border-border',
                      )}
                    />
                    {f.unit && <span className="w-9 shrink-0 text-[0.68rem] text-muted">{f.unit}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
