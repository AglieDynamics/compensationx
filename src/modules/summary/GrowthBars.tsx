/**
 * Growth-factor bars: entry-to-top market midpoint multiplier per component.
 * Values are multipliers (formatMultiplier) on a shared linear scale. The §5
 * methodology bands (limited <8× / solid 8–11× / strong >11×) are shown as
 * neutral reference guides and a caption — NOT as a pass/fail colour, so a
 * healthy 3.6× is never mis-presented as a warning. Deterministic CSS geometry.
 */

import { CHART } from '@/components/charts/chartTheme';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge, IllustrativeTag } from '@/components/ui/Badge';
import { formatMultiplier } from '@/lib/format';
import { GROWTH_BAND_LABEL, type GrowthBand, type GrowthRow } from './summaryModel';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Methodology thresholds (solid band lower/upper) shown as faint vertical guides. */
const THRESHOLD_SOLID_MIN = 8;
const THRESHOLD_SOLID_MAX = 11;
const THRESHOLDS: readonly { value: number; label: string }[] = [
  { value: THRESHOLD_SOLID_MIN, label: '8×' },
  { value: THRESHOLD_SOLID_MAX, label: '11×' },
];

interface GrowthBarsProps {
  rows: GrowthRow[];
}

export function GrowthBars({ rows }: GrowthBarsProps) {
  const values = rows.map((r) => r.value).filter(isNum);
  if (values.length === 0) {
    return <EmptyState compact message="No growth factors available for this selection." />;
  }
  // Shared scale: 0 .. max(values, top threshold) so the reference bands are always visible.
  const scaleMax = Math.max(...values, THRESHOLD_SOLID_MAX) * 1.08;

  return (
    <div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const v = r.value;
          const width = isNum(v) ? Math.max((v / scaleMax) * 100, 2) : 0;
          return (
            <div key={r.component} className="grid grid-cols-[7rem_1fr_3.2rem] items-center gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <span className="truncate">{r.label}</span>
              </span>
              <div className="relative h-6 overflow-hidden rounded-[3px] bg-bg">
                {THRESHOLDS.map((t) => (
                  <span
                    key={t.value}
                    className="absolute top-0 h-full w-px bg-border"
                    style={{ left: `${(t.value / scaleMax) * 100}%` }}
                    aria-hidden
                  />
                ))}
                <div
                  className="flex h-full items-center rounded-[3px] px-2 text-[0.7rem] font-semibold text-white"
                  style={{ width: `${width}%`, background: CHART.firm }}
                >
                  {isNum(v) && width > 14 ? formatMultiplier(v) : ''}
                </div>
              </div>
              <span className="text-right text-xs font-semibold tabular-nums text-ink">
                {formatMultiplier(v)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          {rows.map((r) =>
            r.illustrative ? (
              <span key={r.component} className="inline-flex items-center gap-1.5 text-[0.7rem] text-muted">
                <span className="font-medium text-ink-soft">{r.label}</span>
                <IllustrativeTag />
              </span>
            ) : null,
          )}
        </div>
        <span className="text-[0.7rem] text-muted">
          Methodology bands:{' '}
          <span className="font-medium text-ink-soft">
            {GROWTH_BAND_LABEL.limited} · {GROWTH_BAND_LABEL.solid} · {GROWTH_BAND_LABEL.strong}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Inline growth-band chip — neutral styling (informational, not a RAG signal). */
export function GrowthBandBadge({ band }: { band: GrowthBand | null }) {
  if (!band) return <span className="text-xs text-muted">—</span>;
  return <Badge variant="outline">{GROWTH_BAND_LABEL[band]}</Badge>;
}
