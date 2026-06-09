/**
 * v3 workforce-economics metric pack (§3 C4, Appendix C). Pure, guarded.
 * Revenue/finance-dependent metrics return null (→ empty-state) when the input
 * is absent — never fabricated.
 */

import type { Employee } from '@/domain/employee';
import { directComp } from '@/domain/employee';
import type { GlobalAssumptions } from '@/lib/assumptions';
import type { Provenance } from '@/lib/provenance';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

export interface EconomicsInputs {
  /** Total annual revenue (GND k). null → revenue metrics empty-state. */
  totalRevenue: number | null;
  /** Non-labor operating expense (GND k). null → HCROI empty-state. */
  nonLaborOpex: number | null;
}

export interface EconomicsMetrics {
  headcount: number;
  totalFte: number;
  directCompTotal: number;
  directCompPerFte: number | null;
  avgSalaryPerFte: number | null;
  benefits: number;
  totalWorkforceCost: number; // loaded
  twcPerFte: number | null;
  benefitsShare: number | null;
  revenuePerEmployee: number | null;
  hcroi: number | null;
  payEfficiencyRatio: number | null;
  revenueProvenance: Provenance;
}

export function computeEconomics(
  employees: Employee[],
  assumptions: GlobalAssumptions,
  inputs: EconomicsInputs,
): EconomicsMetrics {
  const headcount = employees.length;
  const totalFte = employees.reduce((a, e) => a + (isNum(e.fte) ? e.fte : 1), 0);
  const directCompTotal = employees.reduce((a, e) => a + directComp(e), 0);
  const baseTotal = employees.reduce((a, e) => a + e.basePay, 0);
  const benefits = directCompTotal * assumptions.employerContributionPct;
  const totalWorkforceCost = directCompTotal + benefits; // overtime/contingent/tech default 0

  const twcPerFte = totalFte > 0 ? totalWorkforceCost / totalFte : null;
  const revenuePerEmployee = isNum(inputs.totalRevenue) && headcount > 0 ? inputs.totalRevenue / headcount : null;
  const hcroi =
    isNum(inputs.totalRevenue) && isNum(inputs.nonLaborOpex) && totalWorkforceCost > 0
      ? (inputs.totalRevenue - inputs.nonLaborOpex) / totalWorkforceCost
      : null;
  const payEfficiencyRatio =
    isNum(revenuePerEmployee) && isNum(twcPerFte) && twcPerFte > 0 ? revenuePerEmployee / twcPerFte : null;

  return {
    headcount,
    totalFte,
    directCompTotal,
    directCompPerFte: totalFte > 0 ? directCompTotal / totalFte : null,
    avgSalaryPerFte: totalFte > 0 ? baseTotal / totalFte : null,
    benefits,
    totalWorkforceCost,
    twcPerFte,
    benefitsShare: totalWorkforceCost > 0 ? benefits / totalWorkforceCost : null,
    revenuePerEmployee,
    hcroi,
    payEfficiencyRatio,
    revenueProvenance: isNum(inputs.totalRevenue) ? 'ENTERED' : 'ASSUMED',
  };
}
