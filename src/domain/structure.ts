/**
 * v3 structure-design + pricing state/input types (§3 Modules A & B).
 * Pure data shapes; the math lives in src/lib/comp.ts.
 */

import type { Level } from './levels';

export interface GradeDef {
  grade: string;
  level: Level;
}

export type ProgressionMethod = 'fixed' | 'benchmark' | 'regression';
export type StructureType = 'grades' | 'broadbands';

export interface StructureDesign {
  id: string;
  name: string;
  type: StructureType;
  progression: ProgressionMethod;
  fixedStep: number; // for 'fixed'
  anchorPercentile: number; // for 'benchmark' / 'regression'
  spread: number; // S
  grades: GradeDef[]; // ordered, junior → senior
  midpointOverrides: Record<string, number>; // grade → manual midpoint
  published: boolean;
}

export type PricingPosture = 'lead' | 'match' | 'lag';

export interface PricingIntake {
  title: string;
  hiringManager: string;
  level: Level;
  jobFamily: string;
  geography: string;
  grade: string;
  businessUnit: string;
  replacement: boolean;
  mustHaveSkills: string;
}

export interface PricingInputs {
  posture: PricingPosture;
  adjustmentPremium: number; // fraction, close-not-exact survey match
  candidatePremium: number; // fraction, scarcity / skill
  useStretch: boolean;
}

export interface PricingCaseSnapshot {
  floor: number | null;
  target: number | null;
  stretch: number | null;
  midpoint: number | null;
  marketReference: number | null;
  approval: 'auto' | 'needs-approval';
  flagCount: number;
  /** Peer median at save time, for offer-to-peer session analytics. */
  peerMedian?: number | null;
}

export interface PricingCase {
  id: string;
  label: string;
  intake: PricingIntake;
  inputs: PricingInputs;
  snapshot: PricingCaseSnapshot;
  outcome: 'pending' | 'accepted' | 'declined';
  /**
   * Optional link to an incentive / synthetic-equity plan attached at the equity
   * step. Additive — older cases simply omit it.
   */
  equityPlanId?: string;
}
