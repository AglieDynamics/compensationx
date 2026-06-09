/**
 * Job-pricing case store (§3 Module A). Holds saved pricing cases feeding the
 * session analytics (no ATS integration). Persisted behind a mounted guard.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PricingCase } from '@/domain/structure';

interface PricingState {
  cases: PricingCase[];
  seq: number;
  hasHydrated: boolean;

  saveCase: (c: Omit<PricingCase, 'id'>) => string;
  deleteCase: (id: string) => void;
  recordOutcome: (id: string, outcome: PricingCase['outcome']) => void;
  setHasHydrated: (v: boolean) => void;
}

export const usePricingStore = create<PricingState>()(
  persist(
    (set, get) => ({
      cases: [],
      seq: 1,
      hasHydrated: false,

      saveCase: (c) => {
        const id = `case-${get().seq}`;
        set((s) => ({ cases: [{ ...c, id }, ...s.cases], seq: s.seq + 1 }));
        return id;
      },
      deleteCase: (id) => set((s) => ({ cases: s.cases.filter((c) => c.id !== id) })),
      recordOutcome: (id, outcome) =>
        set((s) => ({ cases: s.cases.map((c) => (c.id === id ? { ...c, outcome } : c)) })),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-pricing',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ cases: s.cases, seq: s.seq }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
