/**
 * Provenance system (§2C) — the credibility engine.
 *
 * Every input carries a provenance. A derived metric inherits the WEAKEST
 * provenance among its inputs (MEASURED > ENTERED > ASSUMED). This is how the
 * platform stays honest: a figure modeled entirely on defaults says so.
 */

export type Provenance = 'MEASURED' | 'ENTERED' | 'ASSUMED';

export interface Valued<T = number> {
  value: T;
  provenance: Provenance;
  note?: string;
}

const RANK: Record<Provenance, number> = { MEASURED: 3, ENTERED: 2, ASSUMED: 1 };

/**
 * Weakest provenance among the provided (non-null) provenances.
 * With no inputs at all, defaults to ASSUMED (a value with no tracked basis is,
 * at best, an assumption).
 */
export function weakest(...ps: (Provenance | null | undefined)[]): Provenance {
  let worst: Provenance | null = null;
  for (const p of ps) {
    if (!p) continue;
    if (worst === null || RANK[p] < RANK[worst]) worst = p;
  }
  return worst ?? 'ASSUMED';
}

/** Weakest provenance across a set of Valued inputs (nulls ignored). */
export function provenanceOf(...vs: (Valued<unknown> | null | undefined)[]): Provenance {
  return weakest(...vs.map((v) => v?.provenance ?? null));
}

export function valued<T>(value: T, provenance: Provenance, note?: string): Valued<T> {
  return note === undefined ? { value, provenance } : { value, provenance, note };
}

export const PROVENANCE_META: Record<
  Provenance,
  { label: string; description: string; color: string; bg: string; text: string }
> = {
  MEASURED: {
    label: 'Measured',
    description: 'From your uploaded data',
    color: '#2E8B57',
    bg: 'bg-brand-green/10',
    text: 'text-brand-green',
  },
  ENTERED: {
    label: 'Entered',
    description: 'Manually entered',
    color: '#2E5C9A',
    bg: 'bg-navy-500/10',
    text: 'text-navy-700',
  },
  ASSUMED: {
    label: 'Assumed',
    description: 'Default assumption — add data to sharpen',
    color: '#E0A93B',
    bg: 'bg-brand-amber/15',
    text: 'text-[#9A7212]',
  },
};

export const PROVENANCE_ORDER: readonly Provenance[] = ['MEASURED', 'ENTERED', 'ASSUMED'];
