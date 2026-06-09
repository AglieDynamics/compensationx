/**
 * Inputs & Assumptions subsystem (§2B). Holds the net-new inputs the salary
 * survey lacks: per-segment overrides (manual entry / upload) and editable
 * global assumptions. Resolution to Valued inputs (with provenance) is pure.
 *
 * Persisted to localStorage behind a mounted guard (skipHydration + rehydrate).
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LEVELS, type Level } from '@/domain/levels';
import type { Granularity, OrgRow } from '@/domain/segment';
import type { Provenance } from '@/lib/provenance';
import {
  DEFAULT_ASSUMPTIONS,
  type GlobalAssumptions,
  ILLUSTRATIVE_FLEX_COST,
  ILLUSTRATIVE_VALUE_PER_HEAD,
  resolveSegmentInputs,
  type ResolvedInputsByLevel,
  type SegmentInputKey,
  type SegmentInputs,
} from '@/lib/assumptions';

type Overrides = Record<string, Partial<SegmentInputs>>;
type ProvenanceMap = Record<string, Partial<Record<SegmentInputKey, Provenance>>>;

interface InputsState {
  assumptions: GlobalAssumptions;
  overrides: Overrides;
  provenance: ProvenanceMap;
  granularity: Granularity;
  orgMapping: OrgRow[] | null;
  hasHydrated: boolean;

  setAssumption: <K extends keyof GlobalAssumptions>(key: K, value: GlobalAssumptions[K]) => void;
  resetAssumptions: () => void;
  setSegmentInput: (segId: string, key: SegmentInputKey, value: number | null, provenance?: Provenance) => void;
  resetSegmentInputs: () => void;
  loadValueData: (byLevel: Partial<Record<Level, number>>, provenance: Provenance) => void;
  loadIllustrativeValueData: () => void;
  loadIllustrativeFlexCost: () => void;
  clearValueData: () => void;
  setGranularity: (g: Granularity) => void;
  setOrgMapping: (rows: OrgRow[] | null) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useInputsStore = create<InputsState>()(
  persist(
    (set) => ({
      assumptions: { ...DEFAULT_ASSUMPTIONS },
      overrides: {},
      provenance: {},
      granularity: 'level',
      orgMapping: null,
      hasHydrated: false,

      setAssumption: (key, value) =>
        set((s) => ({ assumptions: { ...s.assumptions, [key]: value } })),
      resetAssumptions: () => set({ assumptions: { ...DEFAULT_ASSUMPTIONS } }),

      setSegmentInput: (segId, key, value, provenance = 'ENTERED') =>
        set((s) => {
          const ov = { ...(s.overrides[segId] ?? {}) };
          const pr = { ...(s.provenance[segId] ?? {}) };
          if (value === null || !Number.isFinite(value)) {
            delete ov[key];
            delete pr[key];
          } else {
            ov[key] = value;
            pr[key] = provenance;
          }
          return {
            overrides: { ...s.overrides, [segId]: ov },
            provenance: { ...s.provenance, [segId]: pr },
          };
        }),

      resetSegmentInputs: () => set({ overrides: {}, provenance: {} }),

      loadValueData: (byLevel, provenance) =>
        set((s) => {
          const overrides = { ...s.overrides };
          const provMap = { ...s.provenance };
          for (const level of LEVELS) {
            const val = byLevel[level];
            if (typeof val !== 'number' || !Number.isFinite(val)) continue;
            overrides[level] = { ...(overrides[level] ?? {}), valuePerHead: val };
            provMap[level] = { ...(provMap[level] ?? {}), valuePerHead: provenance };
          }
          return { overrides, provenance: provMap };
        }),

      loadIllustrativeValueData: () =>
        set((s) => {
          const overrides = { ...s.overrides };
          const provMap = { ...s.provenance };
          for (const level of LEVELS) {
            overrides[level] = { ...(overrides[level] ?? {}), valuePerHead: ILLUSTRATIVE_VALUE_PER_HEAD[level] };
            provMap[level] = { ...(provMap[level] ?? {}), valuePerHead: 'ASSUMED' };
          }
          return { overrides, provenance: provMap };
        }),

      loadIllustrativeFlexCost: () =>
        set((s) => {
          const overrides = { ...s.overrides };
          const provMap = { ...s.provenance };
          for (const level of LEVELS) {
            const fc = ILLUSTRATIVE_FLEX_COST[level];
            overrides[level] = {
              ...(overrides[level] ?? {}),
              overtimeSpendPerHead: fc.overtimePerHead,
              contingentCostTotal: fc.contingentTotal,
            };
            provMap[level] = {
              ...(provMap[level] ?? {}),
              overtimeSpendPerHead: 'ASSUMED',
              contingentCostTotal: 'ASSUMED',
            };
          }
          return { overrides, provenance: provMap };
        }),

      clearValueData: () =>
        set((s) => {
          const overrides: Overrides = {};
          const provMap: ProvenanceMap = {};
          for (const [segId, ov] of Object.entries(s.overrides)) {
            const next = { ...ov };
            delete next.valuePerHead;
            delete next.productivityIndex;
            overrides[segId] = next;
          }
          for (const [segId, pr] of Object.entries(s.provenance)) {
            const next = { ...pr };
            delete next.valuePerHead;
            delete next.productivityIndex;
            provMap[segId] = next;
          }
          return { overrides, provenance: provMap };
        }),

      setGranularity: (granularity) => set({ granularity }),
      setOrgMapping: (orgMapping) => set({ orgMapping }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-inputs',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        assumptions: s.assumptions,
        overrides: s.overrides,
        provenance: s.provenance,
        granularity: s.granularity,
        orgMapping: s.orgMapping,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

/** Resolve every level's inputs to Valued (with provenance). Memoized on the raw slices. */
export function useResolvedInputsByLevel(): ResolvedInputsByLevel {
  const assumptions = useInputsStore((s) => s.assumptions);
  const overrides = useInputsStore((s) => s.overrides);
  const provenance = useInputsStore((s) => s.provenance);
  return useMemo(() => {
    const out = {} as ResolvedInputsByLevel;
    for (const level of LEVELS) {
      out[level] = resolveSegmentInputs(level, overrides[level], provenance[level], assumptions);
    }
    return out;
  }, [assumptions, overrides, provenance]);
}

/** Whether any value-per-head data has been provided (drives Lens 2/3 empty-states). */
export function useHasValueData(): boolean {
  const overrides = useInputsStore((s) => s.overrides);
  return useMemo(
    () => LEVELS.some((l) => typeof overrides[l]?.valuePerHead === 'number'),
    [overrides],
  );
}
