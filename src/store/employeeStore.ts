/**
 * Employee + Job-Architecture store (§2). Default = synthetic seed (employees.json).
 * Manual edits / uploads flip to 'custom' and persist; "Reset to synthetic" reverts.
 * Persisted behind a mounted guard.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Employee, EmployeeDataset } from '@/domain/employee';
import employeesJson from '@/data/employees.json';

export type EmployeeSource = 'synthetic' | 'custom';

function syntheticDataset(): EmployeeDataset {
  return employeesJson as unknown as EmployeeDataset;
}

function isValidDataset(ds: unknown): ds is EmployeeDataset {
  if (!ds || typeof ds !== 'object') return false;
  const d = ds as Partial<EmployeeDataset>;
  return Array.isArray(d.employees) && Array.isArray(d.jobArchitecture);
}

interface EmployeeState {
  dataset: EmployeeDataset;
  source: EmployeeSource;
  hasHydrated: boolean;

  setDataset: (ds: EmployeeDataset, source: EmployeeSource) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  addEmployee: (e: Employee) => void;
  removeEmployee: (id: string) => void;
  resetToSynthetic: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useEmployeeStore = create<EmployeeState>()(
  persist(
    (set) => ({
      dataset: syntheticDataset(),
      source: 'synthetic',
      hasHydrated: false,

      setDataset: (dataset, source) => set({ dataset, source }),

      updateEmployee: (id, patch) =>
        set((s) => ({
          source: 'custom',
          dataset: {
            ...s.dataset,
            meta: { ...s.dataset.meta, provenance: s.dataset.meta.provenance === 'ASSUMED' ? 'ASSUMED' : s.dataset.meta.provenance },
            employees: s.dataset.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        })),

      addEmployee: (e) =>
        set((s) => ({ source: 'custom', dataset: { ...s.dataset, employees: [...s.dataset.employees, e] } })),

      removeEmployee: (id) =>
        set((s) => ({ source: 'custom', dataset: { ...s.dataset, employees: s.dataset.employees.filter((e) => e.id !== id) } })),

      resetToSynthetic: () => set({ dataset: syntheticDataset(), source: 'synthetic' }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'compbench-employees',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        source: s.source,
        ...(s.source === 'custom' ? { dataset: s.dataset } : {}),
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<EmployeeState> | undefined;
        if (!p) return current;
        const trust = p.source === 'custom' && isValidDataset(p.dataset);
        return {
          ...current,
          ...p,
          dataset: trust ? (p.dataset as EmployeeDataset) : current.dataset,
          source: trust ? 'custom' : 'synthetic',
        };
      },
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

export function useHasEmployees(): boolean {
  return useEmployeeStore((s) => s.dataset.employees.length > 0);
}
