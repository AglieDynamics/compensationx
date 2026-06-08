/**
 * Single source of truth for the active dataset + filter selections.
 *
 * Persistence: filters (always) and an uploaded dataset (only when source is
 * 'uploaded') are written to localStorage. Hydration is deferred behind a
 * mounted guard (`skipHydration` + manual rehydrate in an effect) so the first
 * render is deterministic and never touches storage during module evaluation.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Component, Period, Weighting } from '@/domain/components';
import { LEVELS, type Level } from '@/domain/levels';
import {
  availableComponents,
  type Dataset,
  selectTable,
  type ComponentTable,
} from '@/domain/types';
import { buildSeedDataset } from '@/data/seed';
import greenland from '@/data/greenland.json';
import type { ParseReport } from '@/lib/parseWorkbook';

export type DatasetSource = 'seed' | 'uploaded';

/** Minimal structural validation so a corrupt/partial persisted dataset can't crash the app. */
function isValidDataset(ds: unknown): ds is Dataset {
  if (!ds || typeof ds !== 'object') return false;
  const d = ds as Partial<Dataset>;
  return (
    !!d.meta &&
    typeof d.meta.country === 'string' &&
    Array.isArray(d.tables) &&
    !!d.distribution &&
    typeof d.distribution === 'object'
  );
}

function defaultDataset(): Dataset {
  try {
    const ds = greenland as unknown as Dataset;
    if (isValidDataset(ds) && ds.tables.length > 0) return ds;
  } catch {
    /* fall through to runtime-built seed */
  }
  return buildSeedDataset();
}

/** Keep only valid, in-canonical-order levels; never allow an empty selection. */
function sanitizeLevels(levels: unknown): Level[] {
  if (!Array.isArray(levels)) return [...LEVELS];
  const next = LEVELS.filter((l) => levels.includes(l));
  return next.length > 0 ? next : [...LEVELS];
}

interface AppState {
  dataset: Dataset;
  source: DatasetSource;
  parseSummary: string | null;
  hasHydrated: boolean;

  weighting: Weighting;
  period: Period;
  component: Component;
  levels: Level[];
  targetPercentile: number;

  setWeighting: (w: Weighting) => void;
  setPeriod: (p: Period) => void;
  setComponent: (c: Component) => void;
  setLevels: (levels: Level[]) => void;
  toggleLevel: (level: Level) => void;
  setTargetPercentile: (p: number) => void;
  setActiveDataset: (ds: Dataset, source: DatasetSource, report?: ParseReport) => void;
  resetToSeed: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      dataset: defaultDataset(),
      source: 'seed',
      parseSummary: null,
      hasHydrated: false,

      weighting: 'FIRM',
      period: 'TARGET',
      component: 'BASIC_SALARY',
      levels: [...LEVELS],
      targetPercentile: 0.5,

      setWeighting: (weighting) => set({ weighting }),
      setPeriod: (period) => set({ period }),
      setComponent: (component) => set({ component }),
      setLevels: (levels) => set({ levels }),
      toggleLevel: (level) =>
        set((s) => {
          const has = s.levels.includes(level);
          const next = has ? s.levels.filter((l) => l !== level) : [...s.levels, level];
          // Never allow an empty selection — keep at least one level.
          return { levels: next.length ? LEVELS.filter((l) => next.includes(l)) : s.levels };
        }),
      setTargetPercentile: (targetPercentile) => set({ targetPercentile }),
      setActiveDataset: (dataset, source, report) =>
        set({
          dataset,
          source,
          parseSummary: report
            ? `${report.combosLoaded.length} combos · ${report.componentTabs} component tabs`
            : null,
        }),
      resetToSeed: () =>
        set({ dataset: buildSeedDataset(), source: 'seed', parseSummary: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-store',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        source: s.source,
        weighting: s.weighting,
        period: s.period,
        component: s.component,
        levels: s.levels,
        targetPercentile: s.targetPercentile,
        parseSummary: s.parseSummary,
        ...(s.source === 'uploaded' ? { dataset: s.dataset } : {}),
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p) return current;
        // Only trust a persisted dataset when it was an upload AND it still validates.
        const trustUpload = p.source === 'uploaded' && isValidDataset(p.dataset);
        return {
          ...current,
          ...p,
          dataset: trustUpload ? (p.dataset as Dataset) : current.dataset,
          source: trustUpload ? 'uploaded' : 'seed',
          levels: sanitizeLevels(p.levels),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// --- Selector hooks (read-only, keep components free of dataset plumbing) ---

export function useActiveTable(): ComponentTable | undefined {
  return useAppStore((s) => selectTable(s.dataset, s.weighting, s.period, s.component));
}

export function useAvailableComponents(): Set<Component> {
  return useAppStore((s) => availableComponents(s.dataset, s.weighting, s.period));
}

export function tableFor(
  ds: Dataset,
  weighting: Weighting,
  period: Period,
  component: Component,
): ComponentTable | undefined {
  return selectTable(ds, weighting, period, component);
}
