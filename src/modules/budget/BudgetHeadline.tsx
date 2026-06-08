import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Unit } from '@/domain/components';
import type { BudgetResult } from '@/lib/benchmark';
import { formatCount, formatSignedValue, unitSuffix } from '@/lib/format';
import { cn } from '@/lib/cn';

interface BudgetHeadlineProps {
  sim: BudgetResult;
  unit: Unit;
  targetLabel: string;
  firmName: string;
  componentLabel: string;
}

type Direction = 'increase' | 'saving' | 'flat';

/** Negative budget = saving (green); positive = increase / cost (navy); zero = flat. */
function directionOf(value: number | null | undefined): Direction {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 'flat';
  return value < 0 ? 'saving' : 'increase';
}

// Increase = cost (neutral navy, not amber — amber is reserved for RAG status).
const DIRECTION_META: Record<Direction, { value: string; icon: ReactNode; chip: string; verb: string }> = {
  increase: {
    value: 'text-navy-700',
    icon: <ArrowUpRight size={16} strokeWidth={2.25} />,
    chip: 'bg-navy-500/10 text-navy-700',
    verb: 'Increase',
  },
  saving: {
    value: 'text-brand-green',
    icon: <ArrowDownRight size={16} strokeWidth={2.25} />,
    chip: 'bg-brand-green/10 text-brand-green',
    verb: 'Saving',
  },
  flat: {
    value: 'text-navy-700',
    icon: <Minus size={16} strokeWidth={2.25} />,
    chip: 'bg-[#EEF1F6] text-ink-soft',
    verb: 'On target',
  },
};

function Metric({
  label,
  value,
  unitLabel,
  direction,
  badge,
}: {
  label: string;
  value: string;
  unitLabel?: string;
  direction: Direction;
  badge?: ReactNode;
}) {
  const meta = DIRECTION_META[direction];
  return (
    <div className="min-w-0">
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('mt-1 flex items-baseline gap-1.5 whitespace-nowrap', meta.value)}>
        <span aria-hidden className="self-center">{meta.icon}</span>
        <span className="text-[1.85rem] font-semibold leading-none tabular-nums">{value}</span>
        {unitLabel && <span className="text-[0.85rem] font-semibold text-muted">{unitLabel}</span>}
      </div>
      {badge != null && <div className="mt-2">{badge}</div>}
    </div>
  );
}

function DirectionChip({ direction }: { direction: Direction }) {
  const meta = DIRECTION_META[direction];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium', meta.chip)}>
      {meta.verb}
    </span>
  );
}

export function BudgetHeadline({ sim, unit, targetLabel, firmName, componentLabel }: BudgetHeadlineProps) {
  const totalDir = directionOf(sim.total);
  const perHeadDir = directionOf(sim.perHead);
  const unitLabel = unit === 'RATIO' ? '' : unitSuffix(unit);

  return (
    <section className="animate-fade-in rounded-card border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-[0.95rem] font-semibold leading-tight text-ink">
          Cost to move {firmName} to the {targetLabel} percentile
        </h2>
        <p className="mt-0.5 text-[0.8rem] leading-snug text-muted">
          Total annualised {componentLabel.toLowerCase()} budget impact across all career levels, at the
          current target percentile. Negative values are savings; positive values are increases.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total budget impact"
          value={formatSignedValue(sim.total, unit, { decimals: unit === 'RATIO' ? 1 : 0, group: true })}
          unitLabel={unitLabel}
          direction={totalDir}
          badge={<DirectionChip direction={totalDir} />}
        />
        <Metric
          label="Per incumbent"
          value={formatSignedValue(sim.perHead, unit, { group: true })}
          unitLabel={unitLabel}
          direction={perHeadDir}
          badge={<DirectionChip direction={perHeadDir} />}
        />
        <div className="min-w-0">
          <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Incumbents covered</div>
          <div className="mt-1 text-[1.85rem] font-semibold leading-none tabular-nums text-navy-700">
            {formatCount(sim.totalIncumbents)}
          </div>
          <div className="mt-2 text-[0.72rem] text-muted">Across all five career levels</div>
        </div>
        <div className="min-w-0">
          <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">Target percentile</div>
          <div className="mt-1 text-[1.85rem] font-semibold leading-none tabular-nums text-navy-700">
            {targetLabel}
          </div>
          <div className="mt-2 text-[0.72rem] text-muted">Drives every figure live</div>
        </div>
      </div>
    </section>
  );
}
