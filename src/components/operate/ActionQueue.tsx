import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import type { Provenance } from '@/lib/provenance';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHART } from '@/components/charts/chartTheme';
import { cn } from '@/lib/cn';

export interface ScoreDriver {
  label: string;
  /** Normalized 0..1 sub-score. */
  score: number;
  /** Weight applied (0..1). */
  weight: number;
}

export interface ActionItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Overall score 0..100. */
  score: number;
  drivers: ScoreDriver[];
  badge?: { label: string; tone: 'navy' | 'green' | 'amber' | 'red' };
  rightValue?: string;
  provenance?: Provenance;
}

const TONE: Record<NonNullable<ActionItem['badge']>['tone'], string> = {
  navy: 'bg-navy-500/10 text-navy-700',
  green: 'bg-brand-green/10 text-brand-green',
  amber: 'bg-brand-amber/15 text-[#9A7212]',
  red: 'bg-brand-red/10 text-brand-red',
};

/**
 * Ranked, governance-by-exception action queue with expandable score breakdown
 * (§3 C5). Every recommendation exposes its drivers — explainable, not ML.
 */
export function ActionQueue({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  if (items.length === 0) return <EmptyState compact message="No actions to recommend for this selection." />;
  const max = Math.max(1, ...items.map((i) => i.score));

  return (
    <div className="divide-y divide-border">
      {items.map((item, rank) => {
        const expanded = open === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : item.id)}
              className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-bg/60"
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted">{rank + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{item.title}</span>
                  {item.badge && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[0.64rem] font-semibold', TONE[item.badge.tone])}>{item.badge.label}</span>
                  )}
                  {item.provenance && <ProvenanceChip provenance={item.provenance} showDot={false} />}
                </div>
                {item.subtitle && <div className="truncate text-[0.72rem] text-muted">{item.subtitle}</div>}
              </div>
              <div className="hidden w-32 items-center gap-2 sm:flex">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full" style={{ width: `${(item.score / max) * 100}%`, background: CHART.firm }} />
                </div>
                <span className="w-7 text-right text-xs font-semibold tabular-nums text-ink">{Math.round(item.score)}</span>
              </div>
              {item.rightValue && <span className="w-24 text-right text-xs font-semibold tabular-nums text-ink-soft">{item.rightValue}</span>}
              <ChevronDown size={15} className={cn('shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
            </button>
            {expanded && (
              <div className="space-y-1.5 px-9 pb-3 pt-1">
                {item.drivers.map((d) => (
                  <div key={d.label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2">
                    <span className="truncate text-[0.72rem] text-muted" title={`weight ${Math.round(d.weight * 100)}%`}>{d.label}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, d.score * 100))}%`, background: CHART.blue400 }} />
                    </div>
                    <span className="text-right text-[0.7rem] tabular-nums text-ink-soft">{(d.score * d.weight * 100).toFixed(0)}</span>
                  </div>
                ))}
                <p className="pt-1 text-[0.68rem] text-muted">Score = Σ (sub-score × weight) × 100. Rule/statistics-based; ML upgrade is platform-track.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
