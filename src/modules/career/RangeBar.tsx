import { CHART } from '@/components/charts/chartTheme';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

interface RangeBarProps {
  /** Lower bound of the market band. */
  marketMin: number | null;
  /** Upper bound of the market band. */
  marketMax: number | null;
  /** Your Firm marker; null renders the band only. */
  yourFirm: number | null;
  /** Shared scale floor so multiple rows align to one axis. */
  scaleMin: number;
  /** Shared scale ceiling so multiple rows align to one axis. */
  scaleMax: number;
  /** Format a value for the marker/label. */
  format: (v: number | null) => string;
}

/**
 * A horizontal mini range visual: the market min–max band as a filled track with
 * a Your Firm tick overlaid. Deterministic — all geometry derives from the
 * shared [scaleMin, scaleMax] axis, so rows in a column stay aligned.
 */
export function RangeBar({ marketMin, marketMax, yourFirm, scaleMin, scaleMax, format }: RangeBarProps) {
  const span = scaleMax - scaleMin;
  const pct = (v: number): number => {
    if (span <= 0) return 0;
    const raw = ((v - scaleMin) / span) * 100;
    return Math.min(100, Math.max(0, raw));
  };

  const hasBand = isNum(marketMin) && isNum(marketMax) && marketMax >= marketMin;
  const bandLeft = hasBand ? pct(marketMin) : 0;
  const bandWidth = hasBand ? Math.max(pct(marketMax) - bandLeft, 0.75) : 0;
  // Only flag the firm as "outside" when a real band exists to compare against;
  // a missing band is unknown, not an exception.
  const firmOutsideBand =
    hasBand && isNum(yourFirm) && isNum(marketMin) && isNum(marketMax)
      ? yourFirm < marketMin || yourFirm > marketMax
      : false;

  return (
    <div className="relative h-6 w-full select-none">
      {/* Baseline track */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      {/* Market band */}
      {hasBand && (
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm"
          style={{
            left: `${bandLeft}%`,
            width: `${bandWidth}%`,
            background: CHART.bandLight,
            border: `1px solid ${CHART.bandDark}`,
          }}
        />
      )}
      {/* Your Firm marker */}
      {isNum(yourFirm) && (
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct(yourFirm)}%` }}
          title={`Your Firm: ${format(yourFirm)}`}
        >
          <span
            className="block h-3.5 w-[3px] rounded-full"
            style={{ background: firmOutsideBand ? CHART.amber : CHART.firm }}
          />
        </div>
      )}
    </div>
  );
}

/** Compute a shared [min, max] scale across a set of range rows, with light padding. */
export function rangeScale(
  rows: { marketMin: number | null; marketMax: number | null; yourFirm: number | null }[],
): { min: number; max: number } {
  const vals: number[] = [];
  for (const r of rows) {
    if (isNum(r.marketMin)) vals.push(r.marketMin);
    if (isNum(r.marketMax)) vals.push(r.marketMax);
    if (isNum(r.yourFirm)) vals.push(r.yourFirm);
  }
  if (vals.length === 0) return { min: 0, max: 1 };
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    return { min: lo - pad, max: hi + pad };
  }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;
  return { min: lo, max: hi };
}
