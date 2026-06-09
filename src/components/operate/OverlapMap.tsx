import { AlertTriangle } from 'lucide-react';
import type { GradeRange } from '@/lib/comp';
import { STRUCTURE } from '@/lib/assumptions';
import { formatPct } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

interface OverlapMapProps {
  grades: GradeRange[];
}

type State = 'gap' | 'healthy' | 'excessive';

function stateOf(overlap: number): State {
  if (overlap < 0) return 'gap';
  if (overlap > STRUCTURE.overlapExcessiveThreshold) return 'excessive';
  return 'healthy';
}
const STATE_META: Record<State, { label: string; color: string; bg: string }> = {
  gap: { label: 'Gap (no overlap)', color: '#C0392B', bg: 'bg-brand-red/10' },
  healthy: { label: 'Healthy', color: '#2E8B57', bg: 'bg-brand-green/10' },
  // Darker amber (#9A7212) for WCAG-legible text/badge; bright amber is fill-only elsewhere.
  excessive: { label: 'Excessive (>50%)', color: '#9A7212', bg: 'bg-brand-amber/15' },
};

/** Overlap between consecutive grades with gap / excessive flags (§3 B1). */
export function OverlapMap({ grades }: OverlapMapProps) {
  const pairs = grades.slice(0, -1).map((g, i) => ({ from: g, to: grades[i + 1]!, overlap: g.overlapWithNext }));
  if (pairs.length === 0) return <EmptyState compact message="Need ≥2 grades to compute overlap." />;

  return (
    <div className="space-y-2">
      {pairs.map(({ from, to, overlap }) => {
        const state = isNum(overlap) ? stateOf(overlap) : null;
        const meta = state ? STATE_META[state] : null;
        return (
          <div key={from.grade} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/50 px-3 py-2">
            <span className="text-xs font-medium text-ink-soft">
              {from.grade} → {to.grade}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums" style={{ color: meta?.color }}>
                {isNum(overlap) ? formatPct(overlap, 0) : 'n/a'}
              </span>
              {meta && (
                <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.66rem] font-semibold', meta.bg)} style={{ color: meta.color }}>
                  {state !== 'healthy' && <AlertTriangle size={10} />}
                  {meta.label}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
