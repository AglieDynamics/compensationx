import { formatCount, formatPct } from '@/lib/format';
import { CHART } from './chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';

export interface DistributionRow {
  label: string;
  firm: number;
  market: number;
}

interface DistributionBarsProps {
  rows: DistributionRow[];
}

/**
 * Your-Firm vs Market incumbent distribution by level (§ Module 1).
 * Rendered as deterministic CSS bars — counts and shares always legible,
 * never any NaN/zero-height chart artifacts.
 */
export function DistributionBars({ rows }: DistributionBarsProps) {
  const firmTotal = rows.reduce((a, r) => a + r.firm, 0);
  const marketTotal = rows.reduce((a, r) => a + r.market, 0);
  if (firmTotal === 0 && marketTotal === 0) {
    return <EmptyState compact message="No incumbent counts available." />;
  }
  const maxShare = Math.max(
    ...rows.map((r) => Math.max(firmTotal ? r.firm / firmTotal : 0, marketTotal ? r.market / marketTotal : 0)),
    0.01,
  );

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const firmShare = firmTotal ? r.firm / firmTotal : 0;
        const marketShare = marketTotal ? r.market / marketTotal : 0;
        return (
          <div key={r.label} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
            <span className="text-xs font-medium text-ink-soft">{r.label}</span>
            <div className="space-y-1">
              <Bar
                color={CHART.firm}
                label="Firm"
                width={(firmShare / maxShare) * 100}
                count={r.firm}
                share={firmShare}
              />
              <Bar
                color={CHART.bandDark}
                label="Market"
                width={(marketShare / maxShare) * 100}
                count={r.market}
                share={marketShare}
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-1 text-[0.72rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART.firm }} /> Your Firm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART.bandDark }} /> Market
        </span>
      </div>
    </div>
  );
}

function Bar({
  color,
  label,
  width,
  count,
  share,
}: {
  color: string;
  label: string;
  width: number;
  count: number;
  share: number;
}) {
  const w = Math.max(0, Math.min(100, width));
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[0.68rem] text-muted">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-[3px] bg-bg">
        <div
          className="flex h-full items-center rounded-[3px] px-1.5 text-[0.68rem] font-semibold text-white"
          style={{ width: `${Math.max(w, 8)}%`, background: color }}
        >
          {formatCount(count)}
        </div>
      </div>
      <span className="w-12 shrink-0 text-right text-[0.68rem] tabular-nums text-muted">{formatPct(share, 0)}</span>
    </div>
  );
}
