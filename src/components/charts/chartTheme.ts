/** Shared chart constants (§7 chart conventions). */

export const CHART = {
  navy900: '#15233F',
  navy700: '#1F3864',
  firm: '#2E5C9A', // Your Firm line / markers
  blue400: '#4F7FC4',
  tmp: '#2E8B57', // Target percentile dashed line
  bandLight: '#D9DEE7', // 75th–max / box fill
  bandDark: '#8A93A5', // whisker / box stroke
  grid: '#E5E8EE',
  axis: '#6B7280',
  green: '#2E8B57',
  amber: '#E0A93B',
  red: '#C0392B',
  positive: '#2E8B57',
  negative: '#C0392B',
} as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Compute a padded numeric domain from a set of values, guarding against empty
 * input (returns a safe [0, 1] so axes never collapse to NaN).
 *
 * `includeZero` anchors the floor at 0 for non-negative bar charts (no negative
 * padding below the axis), while still extending below 0 when the data itself is
 * negative (e.g. diverging bars).
 */
export function paddedDomain(
  values: (number | null | undefined)[],
  opts?: { padFraction?: number; includeZero?: boolean },
): [number, number] {
  const nums = values.filter(isNum);
  if (nums.length === 0) return [0, 1];
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (opts?.includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    return [lo - pad, hi + pad];
  }
  const pad = (hi - lo) * (opts?.padFraction ?? 0.08);
  // Don't pad below a zero floor (keeps non-negative bars anchored to the axis).
  const loOut = opts?.includeZero && lo === 0 ? 0 : lo - pad;
  return [loOut, hi + pad];
}

/** Nice axis tick formatter for GND k (integers) or ratios (percent). */
export function axisTickFormatter(unit: 'GND_K' | 'RATIO') {
  return (v: number): string => {
    if (!isNum(v)) return '';
    if (unit === 'RATIO') return `${Math.round(v * 100)}%`;
    return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
  };
}
