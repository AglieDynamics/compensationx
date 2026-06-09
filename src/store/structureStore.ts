/**
 * Salary-structure design store (§3 Module B). Holds design parameters; the
 * computed structure (midpoints/ranges) is derived in comp.ts. One structure is
 * "published" = the active reference used by Pricing and the Cockpit.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StructureDesign } from '@/domain/structure';
import { defaultStructureDesign } from '@/lib/comp';

interface StructureState {
  structures: StructureDesign[];
  activeId: string;
  seq: number;
  hasHydrated: boolean;

  createStructure: (from?: StructureDesign) => string;
  updateStructure: (id: string, patch: Partial<StructureDesign>) => void;
  setMidpointOverride: (id: string, grade: string, value: number | null) => void;
  publishStructure: (id: string) => void;
  deleteStructure: (id: string) => void;
  setActive: (id: string) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useStructureStore = create<StructureState>()(
  persist(
    (set, get) => ({
      structures: [defaultStructureDesign()],
      activeId: 'default',
      seq: 1,
      hasHydrated: false,

      createStructure: (from) => {
        const id = `struct-${get().seq}`;
        const base = from ?? defaultStructureDesign();
        set((s) => ({
          structures: [...s.structures, { ...base, id, name: `Structure ${s.seq}`, published: false }],
          activeId: id,
          seq: s.seq + 1,
        }));
        return id;
      },

      updateStructure: (id, patch) =>
        set((s) => ({ structures: s.structures.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),

      setMidpointOverride: (id, grade, value) =>
        set((s) => ({
          structures: s.structures.map((st) => {
            if (st.id !== id) return st;
            const midpointOverrides = { ...st.midpointOverrides };
            if (value === null || !Number.isFinite(value)) delete midpointOverrides[grade];
            else midpointOverrides[grade] = value;
            return { ...st, midpointOverrides };
          }),
        })),

      // Exactly one published structure at a time.
      publishStructure: (id) =>
        set((s) => ({ structures: s.structures.map((st) => ({ ...st, published: st.id === id })) })),

      deleteStructure: (id) =>
        set((s) => {
          const structures = s.structures.filter((st) => st.id !== id);
          return {
            structures: structures.length ? structures : [defaultStructureDesign()],
            activeId: s.activeId === id ? (structures[0]?.id ?? 'default') : s.activeId,
          };
        }),

      setActive: (activeId) => set({ activeId }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-structures',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ structures: s.structures, activeId: s.activeId, seq: s.seq }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

export function useActiveStructureDesign(): StructureDesign {
  const structures = useStructureStore((s) => s.structures);
  const activeId = useStructureStore((s) => s.activeId);
  return useMemo(
    () => structures.find((st) => st.id === activeId) ?? structures[0] ?? defaultStructureDesign(),
    [structures, activeId],
  );
}

export function usePublishedStructureDesign(): StructureDesign | null {
  const structures = useStructureStore((s) => s.structures);
  return useMemo(() => structures.find((st) => st.published) ?? null, [structures]);
}
