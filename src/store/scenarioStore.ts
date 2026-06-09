/**
 * Scenario engine (§2D). A Scenario = a set of proposed per-level pay moves
 * layered on the Baseline. Lenses compute Baseline vs Scenario and show deltas.
 * Persisted to localStorage behind a mounted guard.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Level } from '@/domain/levels';
import type { ScenarioMove } from '@/lib/capital';

export interface Scenario {
  id: string;
  name: string;
  moves: Partial<Record<Level, ScenarioMove>>;
}

interface ScenarioState {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  seq: number;
  hasHydrated: boolean;

  createScenario: (name?: string) => string;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;
  duplicateScenario: (id: string) => string | null;
  setActiveScenario: (id: string | null) => void;
  setMove: (id: string, level: Level, move: ScenarioMove | null) => void;
  resetToBaseline: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useScenarioStore = create<ScenarioState>()(
  persist(
    (set, get) => ({
      scenarios: [],
      activeScenarioId: null,
      seq: 1,
      hasHydrated: false,

      createScenario: (name) => {
        const id = `scn-${get().seq}`;
        set((s) => ({
          scenarios: [...s.scenarios, { id, name: name ?? `Scenario ${s.seq}`, moves: {} }],
          activeScenarioId: id,
          seq: s.seq + 1,
        }));
        return id;
      },

      renameScenario: (id, name) =>
        set((s) => ({ scenarios: s.scenarios.map((sc) => (sc.id === id ? { ...sc, name } : sc)) })),

      deleteScenario: (id) =>
        set((s) => ({
          scenarios: s.scenarios.filter((sc) => sc.id !== id),
          activeScenarioId: s.activeScenarioId === id ? null : s.activeScenarioId,
        })),

      duplicateScenario: (id) => {
        const src = get().scenarios.find((sc) => sc.id === id);
        if (!src) return null;
        const newId = `scn-${get().seq}`;
        set((s) => ({
          scenarios: [...s.scenarios, { id: newId, name: `${src.name} (copy)`, moves: { ...src.moves } }],
          activeScenarioId: newId,
          seq: s.seq + 1,
        }));
        return newId;
      },

      setActiveScenario: (activeScenarioId) => set({ activeScenarioId }),

      setMove: (id, level, move) =>
        set((s) => ({
          scenarios: s.scenarios.map((sc) => {
            if (sc.id !== id) return sc;
            const moves = { ...sc.moves };
            if (move === null) delete moves[level];
            else moves[level] = move;
            return { ...sc, moves };
          }),
        })),

      resetToBaseline: () => set({ activeScenarioId: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-scenarios',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ scenarios: s.scenarios, activeScenarioId: s.activeScenarioId, seq: s.seq }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

/** The active scenario object (or null when on Baseline). */
export function useActiveScenario(): Scenario | null {
  const id = useScenarioStore((s) => s.activeScenarioId);
  const scenarios = useScenarioStore((s) => s.scenarios);
  return useMemo(() => scenarios.find((sc) => sc.id === id) ?? null, [scenarios, id]);
}
