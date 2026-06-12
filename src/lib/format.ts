/**
 * Deterministic display formatting (GND k / % / signed / counts).
 *
 * No locale ambiguity: counts use an explicit en-US grouping formatter.
 * Missing / non-finite values always degrade to a placeholder, never "NaN".
 */

import type { Unit } from '@/domain/components';

/** Placeholder rendered for missing / non-numeric values. */
export const NA = 'n/a';

const COUNT_FMT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const groupFmtCache = new Map<number, Intl.NumberFormat>();
function groupFmt(decimals: number): Intl.NumberFormat {
  let f = groupFmtCache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals });
    groupFmtCache.set(decimals, f);
  }
  return f;
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Fixed-decimal then trim trailing zeros (44.30 -> "44.3", 167.00 -> "167"). */
function trimmed(n: number, maxDecimals: number, group = false): string {
  if (group) return groupFmt(maxDecimals).format(n); // grouped + trailing-zero trimmed
  const fixed = n.toFixed(maxDecimals);
  if (fixed.indexOf('.') === -1) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

/** GND thousands, up to `decimals` places, trailing zeros trimmed. */
export function formatGndK(value: number | null | undefined, decimals = 2, group = false): string {
  if (!isNum(value)) return NA;
  return trimmed(value, decimals, group);
}

/** Ratio (e.g. 0.18) rendered as a percentage (e.g. "18%"). */
export function formatPct(ratio: number | null | undefined, decimals = 1): string {
  if (!isNum(ratio)) return NA;
  return `${trimmed(ratio * 100, decimals)}%`;
}

/** Signed GND thousands ("+9.58", "-10.16"). Rounds-to-zero never shows a sign. */
export function formatSignedGndK(value: number | null | undefined, decimals = 2, group = false): string {
  if (!isNum(value)) return NA;
  const body = trimmed(Math.abs(value), decimals, group);
  const sign = body === '0' ? '' : value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${body}`;
}

/** Signed percentage ("+3.2%", "−10.0%"). Rounds-to-zero never shows a sign. */
export function formatSignedPct(ratio: number | null | undefined, decimals = 1): string {
  if (!isNum(ratio)) return NA;
  const body = trimmed(Math.abs(ratio) * 100, decimals);
  const sign = body === '0' ? '' : ratio > 0 ? '+' : ratio < 0 ? '−' : '';
  return `${sign}${body}%`;
}

/** Compa-ratio, always two decimals ("1.03"). */
export function formatCompaRatio(value: number | null | undefined): string {
  if (!isNum(value)) return NA;
  return value.toFixed(2);
}

/** Integer count with thousands grouping ("5,067"). */
export function formatCount(value: number | null | undefined): string {
  if (!isNum(value)) return NA;
  return COUNT_FMT.format(Math.round(value));
}

/** "×3.6" style growth-factor label. */
export function formatMultiplier(value: number | null | undefined, decimals = 1): string {
  if (!isNum(value)) return NA;
  return `×${trimmed(value, decimals)}`;
}

/** Dispatch on unit: GND k or ratio-as-percent. */
export function formatValue(
  value: number | null | undefined,
  unit: Unit,
  opts?: { decimals?: number; group?: boolean },
): string {
  if (unit === 'RATIO') return formatPct(value, opts?.decimals ?? 1);
  return formatGndK(value, opts?.decimals ?? 2, opts?.group ?? false);
}

/** Signed value in the component's unit. */
export function formatSignedValue(
  value: number | null | undefined,
  unit: Unit,
  opts?: { decimals?: number; group?: boolean },
): string {
  if (unit === 'RATIO') return formatSignedPct(value, opts?.decimals ?? 1);
  return formatSignedGndK(value, opts?.decimals ?? 2, opts?.group ?? false);
}

/** Unit suffix for axis labels. */
export function unitSuffix(unit: Unit): string {
  return unit === 'RATIO' ? '%' : 'GND k';
}

const ORDINAL_SUFFIX = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

/** Percentile (0.05) -> "5th". */
export function formatPercentileLabel(p: number): string {
  if (!Number.isFinite(p)) return NA;
  const n = Math.round(p * 100);
  return `${n}${ORDINAL_SUFFIX(n)}`;
}

/** Percentile (0.5) -> "50%". */
export function formatPercentilePct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
