/**
 * Pulse Survey view-model: aggregate long-format responses into GCC vs Non-GCC
 * tallies per section. Pure and deterministic — the UI only renders.
 */

import type { PulseDataset } from '@/domain/types';

export interface PulseTally {
  label: string;
  gcc: number;
  nonGcc: number;
}

export interface PulseSectionSummary {
  section: string;
  gcc: number;
  nonGcc: number;
  total: number;
  tallies: PulseTally[];
}

export interface PulseSummary {
  gcc: number;
  nonGcc: number;
  total: number;
  sections: PulseSectionSummary[];
}

interface SectionAcc {
  gcc: number;
  nonGcc: number;
  byResponse: Map<string, { gcc: number; nonGcc: number }>;
}

/** Top-N distinct responses to surface per section (by combined count). */
const TOP_RESPONSES = 8;

export function buildPulseSummary(pulse: PulseDataset): PulseSummary {
  const sectionMap = new Map<string, SectionAcc>();
  let gcc = 0;
  let nonGcc = 0;

  for (const r of pulse.responses) {
    const isGcc = r.area === 'GCC';
    if (isGcc) gcc += 1;
    else nonGcc += 1;

    let acc = sectionMap.get(r.section);
    if (!acc) {
      acc = { gcc: 0, nonGcc: 0, byResponse: new Map() };
      sectionMap.set(r.section, acc);
    }
    if (isGcc) acc.gcc += 1;
    else acc.nonGcc += 1;

    let t = acc.byResponse.get(r.response);
    if (!t) {
      t = { gcc: 0, nonGcc: 0 };
      acc.byResponse.set(r.response, t);
    }
    if (isGcc) t.gcc += 1;
    else t.nonGcc += 1;
  }

  const sections: PulseSectionSummary[] = pulse.sections.map((section) => {
    const acc = sectionMap.get(section);
    if (!acc) return { section, gcc: 0, nonGcc: 0, total: 0, tallies: [] };
    const tallies: PulseTally[] = [...acc.byResponse.entries()]
      .map(([label, c]) => ({ label, gcc: c.gcc, nonGcc: c.nonGcc }))
      .sort((a, b) => b.gcc + b.nonGcc - (a.gcc + a.nonGcc))
      .slice(0, TOP_RESPONSES);
    return { section, gcc: acc.gcc, nonGcc: acc.nonGcc, total: acc.gcc + acc.nonGcc, tallies };
  });

  return { gcc, nonGcc, total: gcc + nonGcc, sections };
}
