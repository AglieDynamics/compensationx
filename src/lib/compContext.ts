/**
 * Shared v3 compensation-operations context. Centralises the survey dataset,
 * assumptions, employees + job architecture, and the active/published structures
 * so Pricing, Ranges Designer and the Cockpit all read from one place.
 */

import { useMemo } from 'react';
import type { Component, Period, Weighting } from '@/domain/components';
import type { Employee, JobArchitecture } from '@/domain/employee';
import type { Dataset } from '@/domain/types';
import type { StructureDesign } from '@/domain/structure';
import type { GlobalAssumptions } from '@/lib/assumptions';
import { buildStructure, mapEmployees, type EmployeeMapping, type Structure } from '@/lib/comp';
import { useAppStore } from '@/store/useAppStore';
import { useInputsStore } from '@/store/inputsStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useActiveStructureDesign, usePublishedStructureDesign } from '@/store/structureStore';

export interface CompContext {
  surveyDataset: Dataset;
  assumptions: GlobalAssumptions;
  weighting: Weighting;
  period: Period;
  component: Component;
  employees: Employee[];
  jobArchitecture: JobArchitecture[];
  hasEmployees: boolean;
  activeDesign: StructureDesign;
  activeStructure: Structure;
  publishedStructure: Structure | null;
  /** Employees mapped against the published structure (the firm-wide reference). */
  mappings: EmployeeMapping[];
}

export function useCompContext(): CompContext {
  const surveyDataset = useAppStore((s) => s.dataset);
  const weighting = useAppStore((s) => s.weighting);
  const period = useAppStore((s) => s.period);
  const component = useAppStore((s) => s.component);
  const assumptions = useInputsStore((s) => s.assumptions);
  const empDataset = useEmployeeStore((s) => s.dataset);
  const activeDesign = useActiveStructureDesign();
  const publishedDesign = usePublishedStructureDesign();

  const ctx = useMemo(
    () => ({ ds: surveyDataset, assumptions, weighting, period, component }),
    [surveyDataset, assumptions, weighting, period, component],
  );

  const activeStructure = useMemo(
    () => buildStructure(activeDesign, ctx, empDataset.jobArchitecture),
    [activeDesign, ctx, empDataset.jobArchitecture],
  );

  const publishedStructure = useMemo(
    () => (publishedDesign ? buildStructure(publishedDesign, ctx, empDataset.jobArchitecture) : null),
    [publishedDesign, ctx, empDataset.jobArchitecture],
  );

  const referenceStructure = publishedStructure ?? activeStructure;
  const mappings = useMemo(
    () => mapEmployees(empDataset.employees, referenceStructure),
    [empDataset.employees, referenceStructure],
  );

  return {
    surveyDataset,
    assumptions,
    weighting,
    period,
    component,
    employees: empDataset.employees,
    jobArchitecture: empDataset.jobArchitecture,
    hasEmployees: empDataset.employees.length > 0,
    activeDesign,
    activeStructure,
    publishedStructure,
    mappings,
  };
}
