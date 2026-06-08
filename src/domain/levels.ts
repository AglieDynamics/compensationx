/**
 * Career levels & sublevels (§3.1).
 *
 * 5-tier path. Each level has 3 sublevels + an aggregate, plus a single
 * `Overall` roll-up. The 20 canonical sublevels (excluding Overall) drive
 * chart x-axes and table columns.
 */

export const LEVELS = ['An', 'As', 'M', 'SM', 'Pr'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  An: 'Analyst',
  As: 'Associate',
  M: 'Manager',
  SM: 'Senior Manager',
  Pr: 'Principal',
};

export const LEVEL_LABELS_SHORT: Record<Level, string> = {
  An: 'Analyst',
  As: 'Associate',
  M: 'Manager',
  SM: 'Sr Manager',
  Pr: 'Principal',
};

/** Canonical sublevel order — the 20 sublevels used as chart axis & table columns. */
export const SUBLEVELS_20 = [
  'An1', 'An2', 'An3', 'An',
  'As1', 'As2', 'As3', 'As',
  'M1', 'M2', 'M3', 'M',
  'SM1', 'SM2', 'SM3', 'SM',
  'Pr1', 'Pr2', 'Pr3', 'Pr',
] as const;

/** All sublevels including the Overall roll-up. */
export const SUBLEVELS = [...SUBLEVELS_20, 'Overall'] as const;

export type SubLevel = (typeof SUBLEVELS)[number];
export type SubLevel20 = (typeof SUBLEVELS_20)[number];

const AGGREGATE_SET: ReadonlySet<string> = new Set<SubLevel>(['An', 'As', 'M', 'SM', 'Pr', 'Overall']);

const LEVEL_TO_SUBLEVELS: Record<Level, readonly [SubLevel, SubLevel, SubLevel, SubLevel]> = {
  An: ['An1', 'An2', 'An3', 'An'],
  As: ['As1', 'As2', 'As3', 'As'],
  M: ['M1', 'M2', 'M3', 'M'],
  SM: ['SM1', 'SM2', 'SM3', 'SM'],
  Pr: ['Pr1', 'Pr2', 'Pr3', 'Pr'],
};

/** The four sublevels of a level: three rungs followed by the aggregate. */
export function subLevelsOf(level: Level): readonly [SubLevel, SubLevel, SubLevel, SubLevel] {
  return LEVEL_TO_SUBLEVELS[level];
}

/** The three non-aggregate rungs of a level (e.g. An -> [An1, An2, An3]). */
export function rungsOf(level: Level): readonly [SubLevel, SubLevel, SubLevel] {
  const [a, b, c] = LEVEL_TO_SUBLEVELS[level];
  return [a, b, c];
}

/** The aggregate sublevel for a level (e.g. An -> 'An'). */
export function aggregateOf(level: Level): SubLevel {
  return level as SubLevel;
}

/** Whether a sublevel is an aggregate (level roll-up) or the Overall roll-up. */
export function isAggregate(subLevel: SubLevel): boolean {
  return AGGREGATE_SET.has(subLevel);
}

const SUBLEVEL_TO_LEVEL: Record<string, Level> = (() => {
  const map: Record<string, Level> = {};
  for (const level of LEVELS) {
    for (const sl of subLevelsOf(level)) {
      map[sl] = level;
    }
  }
  return map;
})();

/** The owning level for a sublevel, or null for `Overall`. */
export function levelOf(subLevel: SubLevel): Level | null {
  return SUBLEVEL_TO_LEVEL[subLevel] ?? null;
}

/** Short display label for a sublevel (identity for rungs; full level name for aggregates). */
export function subLevelLabel(subLevel: SubLevel): string {
  if (subLevel === 'Overall') return 'Overall';
  const level = levelOf(subLevel);
  if (level && isAggregate(subLevel)) return LEVEL_LABELS_SHORT[level];
  return subLevel;
}

/** Index of a sublevel within the canonical 20 (or -1 for Overall). */
export function subLevelIndex(subLevel: SubLevel): number {
  return (SUBLEVELS_20 as readonly string[]).indexOf(subLevel);
}
