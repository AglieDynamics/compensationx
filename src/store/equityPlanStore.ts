/**
 * Incentive / synthetic-equity plan store (Synthetic Equity module).
 *
 * Dedicated persisted store, following the same template as `pricingStore` /
 * `structureStore` (own localStorage key, `seq` counter, deferred hydration
 * behind a mounted guard). It deliberately does NOT touch `compbench-store`, so
 * the global filter context carries zero migration risk. Seeded with one plan
 * per archetype on first run; once the user saves/deletes, their set persists.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EquityPlanDefinition } from '@/domain/equityPlan';
import { SEED_EQUITY_PLANS } from '@/data/equityPlans.seed';

/** Max plans selectable for side-by-side comparison (keeps the radar readable). */
export const MAX_COMPARE = 4;

interface EquityPlanState {
  plans: EquityPlanDefinition[];
  /** Ids selected for the Comparison view. */
  compareIds: string[];
  seq: number;
  hasHydrated: boolean;

  /** Upsert a plan by id; marks it ENTERED (user-authored). */
  savePlan: (plan: EquityPlanDefinition) => void;
  /** Clone an existing plan under a new id; returns the new id (or null if absent). */
  duplicatePlan: (id: string) => string | null;
  deletePlan: (id: string) => void;
  /** Add/remove a plan from the comparison selection (capped at MAX_COMPARE). */
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  /** Restore the seed set (discards custom plans). */
  resetToSeed: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useEquityPlanStore = create<EquityPlanState>()(
  persist(
    (set, get) => ({
      plans: SEED_EQUITY_PLANS,
      compareIds: [],
      seq: 1,
      hasHydrated: false,

      savePlan: (plan) =>
        set((s) => {
          const next: EquityPlanDefinition = { ...plan, provenance: 'ENTERED' };
          const exists = s.plans.some((p) => p.id === plan.id);
          return {
            plans: exists ? s.plans.map((p) => (p.id === plan.id ? next : p)) : [next, ...s.plans],
          };
        }),

      duplicatePlan: (id) => {
        const src = get().plans.find((p) => p.id === id);
        if (!src) return null;
        const newId = `plan-${get().seq}`;
        set((s) => ({
          plans: [{ ...src, id: newId, name: `${src.name} (copy)` }, ...s.plans],
          seq: s.seq + 1,
        }));
        return newId;
      },

      deletePlan: (id) =>
        set((s) => ({
          plans: s.plans.filter((p) => p.id !== id),
          compareIds: s.compareIds.filter((c) => c !== id),
        })),

      toggleCompare: (id) =>
        set((s) => {
          if (s.compareIds.includes(id)) return { compareIds: s.compareIds.filter((c) => c !== id) };
          if (s.compareIds.length >= MAX_COMPARE) return s; // at cap — ignore
          return { compareIds: [...s.compareIds, id] };
        }),

      clearCompare: () => set({ compareIds: [] }),

      resetToSeed: () => set({ plans: SEED_EQUITY_PLANS, compareIds: [] }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-equity-plans',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ plans: s.plans, compareIds: s.compareIds, seq: s.seq }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

// --- Selector hooks ---------------------------------------------------------

export function usePlanById(id: string | undefined): EquityPlanDefinition | undefined {
  return useEquityPlanStore((s) => (id ? s.plans.find((p) => p.id === id) : undefined));
}

export function useHasPlans(): boolean {
  return useEquityPlanStore((s) => s.plans.length > 0);
}

/** Resolve the comparison selection to plans, preserving selection order. */
export function useComparePlans(): EquityPlanDefinition[] {
  const plans = useEquityPlanStore((s) => s.plans);
  const compareIds = useEquityPlanStore((s) => s.compareIds);
  return useMemo(
    () => compareIds.map((id) => plans.find((p) => p.id === id)).filter((p): p is EquityPlanDefinition => !!p),
    [plans, compareIds],
  );
}
