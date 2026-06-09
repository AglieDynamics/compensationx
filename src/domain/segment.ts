/**
 * Segment & Org dimension (§2A) — the unit of analysis for every v2 lens.
 *
 * Default Segment = career level, so all lenses work on the Greenland seed on
 * day one. An optional org mapping (headcount → unit) refines to unit / level×unit.
 */

import { LEVEL_LABELS, LEVELS, type Level } from './levels';

export type Granularity = 'level' | 'unit' | 'level×unit';

export interface Segment {
  /** Stable id, e.g. "M" or "M::DataPractice". */
  id: string;
  level: Level;
  unit?: string;
  jobFamily?: string;
  label: string;
}

/** A single row of an org-headcount mapping (uploaded). */
export interface OrgRow {
  level: Level;
  unit: string;
  headcount: number;
  jobFamily?: string;
}

export function levelSegment(level: Level): Segment {
  return { id: level, level, label: LEVEL_LABELS[level] };
}

function compositeId(level: Level, unit: string): string {
  return `${level}::${unit}`;
}

/**
 * Enumerate segments at the requested granularity. With no org mapping only
 * `level` is available; `unit` / `level×unit` return [] so the UI can prompt for
 * an org-mapping upload.
 */
export function enumerateSegments(granularity: Granularity, orgMapping?: OrgRow[]): Segment[] {
  if (granularity === 'level') return LEVELS.map(levelSegment);
  if (!orgMapping || orgMapping.length === 0) return [];

  if (granularity === 'unit') {
    const units = new Map<string, Level>();
    for (const r of orgMapping) if (!units.has(r.unit)) units.set(r.unit, r.level);
    return [...units.entries()].map(([unit, level]) => ({
      id: unit,
      level,
      unit,
      label: unit,
    }));
  }

  // level×unit
  const seen = new Set<string>();
  const segments: Segment[] = [];
  for (const r of orgMapping) {
    const id = compositeId(r.level, r.unit);
    if (seen.has(id)) continue;
    seen.add(id);
    segments.push({
      id,
      level: r.level,
      unit: r.unit,
      jobFamily: r.jobFamily,
      label: `${LEVEL_LABELS[r.level]} · ${r.unit}`,
    });
  }
  return segments;
}

/** Whether a granularity is available given the current org mapping. */
export function granularityAvailable(granularity: Granularity, orgMapping?: OrgRow[]): boolean {
  if (granularity === 'level') return true;
  return !!orgMapping && orgMapping.length > 0;
}
