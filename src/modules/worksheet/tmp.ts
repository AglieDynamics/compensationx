/**
 * Worksheet-local Target Market Percentile (TMP) model.
 *
 * Pure plumbing — NO benchmarking math lives here. It only resolves which
 * percentile applies to a given level (one overall value, or a per-level
 * override) so the rendering blocks can pass it to `marketValueAtPercentile`
 * and friends in `@/lib/benchmark`.
 */

import { LEVELS, levelOf, type Level, type SubLevel } from '@/domain/levels';

export type TmpMode = 'overall' | 'perLevel';

export interface TmpState {
  mode: TmpMode;
  /** Applies to every level when mode === 'overall'. */
  overall: number;
  /** Per-level percentile overrides, used when mode === 'perLevel'. */
  perLevel: Record<Level, number>;
}

/** Seed a fresh TMP state from the global target percentile. */
export function initTmpState(seed: number): TmpState {
  const perLevel = {} as Record<Level, number>;
  for (const level of LEVELS) perLevel[level] = seed;
  return { mode: 'overall', overall: seed, perLevel };
}

/** The percentile that applies to a given sublevel (resolved via its owning level). */
export function tmpForSubLevel(state: TmpState, subLevel: SubLevel): number {
  const level = levelOf(subLevel);
  if (state.mode === 'overall' || level === null) return state.overall;
  return state.perLevel[level] ?? state.overall;
}
