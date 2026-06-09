/**
 * Shared types + helpers for the Module C cockpit tabs. Keeps the per-tab files
 * focused; no compute here beyond trivial guards (the math lives in the libs).
 */

import type { CompContext } from '@/lib/compContext';
import type { Structure } from '@/lib/comp';

export interface TabBaseProps {
  ctx: CompContext;
  structure: Structure;
}

export const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Visible scope label required on every heuristic / statistics-based feature. */
export const HEURISTIC_LABEL = 'Rule/statistics-based; ML upgrade is platform-track.';

export function mean(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
