/**
 * Appendix B — Additional Career Issues sample values (§6 Module 5).
 *
 * These figures are illustrative sample data drawn from the methodology brief
 * (not parsed from the Appendix A Excel fixture). The UI tags them accordingly.
 */

import type { CareerIssues } from '@/domain/types';

export const CAREER_ISSUES_SEED: CareerIssues = {
  illustrative: true,
  progression: {
    illustrative: true,
    averages: { typical: 18.6, fast: 13.4, slow: 20.7 },
    yourFirm: { typical: 15.5, fast: 15.5, slow: 15.5 },
    perLevelTypical: { An: 3.6, As: 3.8, M: 3.4, SM: 3.6, Pr: 4.3 },
  },
  startingSalaries: {
    illustrative: true,
    rows: [
      { label: 'Analyst — Bachelor', market: 46, yourFirm: 45 },
      { label: 'Analyst — Master', market: 64, yourFirm: 67 },
      { label: 'Associate — MBA', market: 79, yourFirm: 89 },
    ],
  },
  signOnNote:
    'Offered by 16 firms. Your Firm: Analyst 2.8–6.5, Associate 7.5–11.4 (GND k); payback 1–2 years.',
  internshipNote:
    '17 firms offer summer internships. Your Firm: Analyst 5.8–8.5 / month, Associate ~12 / month; length 8–12 weeks.',
  utilisation: [
    { level: 'An', marketMin: 60, marketMax: 95, yourFirm: 62 },
    { level: 'As', marketMin: 60, marketMax: 93, yourFirm: 65 },
    { level: 'M', marketMin: 62, marketMax: 100, yourFirm: 87 },
    { level: 'SM', marketMin: 71, marketMax: 100, yourFirm: 94 },
    { level: 'Pr', marketMin: 68, marketMax: 95, yourFirm: 75 },
  ],
  salesTargets: [
    { label: 'Analyst', marketMin: 250, marketMax: 550, yourFirm: null },
    { label: 'Associate', marketMin: 550, marketMax: 3328, yourFirm: 1000 },
    { label: 'Manager', marketMin: 1250, marketMax: 3328, yourFirm: 1350 },
    { label: 'Senior Manager', marketMin: 1250, marketMax: 3328, yourFirm: 3000 },
    { label: 'Principal', marketMin: 2300, marketMax: 5200, yourFirm: null },
  ],
  projectRevenueTargets: [
    { label: 'Associate', marketMin: 1, marketMax: 2, yourFirm: null },
    { label: 'Manager', marketMin: 3, marketMax: 4, yourFirm: 5.8 },
    { label: 'Senior Manager', marketMin: 5, marketMax: 10, yourFirm: null },
    { label: 'Principal', marketMin: 7, marketMax: 17, yourFirm: 12 },
  ],
  expectedSalaryChange: [
    { level: 'An', marketMin: 1.0, marketMax: 6.7, yourFirm: 4.0 },
    { level: 'As', marketMin: 1.2, marketMax: 6.0, yourFirm: 2.2 },
    { level: 'M', marketMin: 1.4, marketMax: 6.0, yourFirm: 5.4 },
    { level: 'SM', marketMin: 1.4, marketMax: 6.9, yourFirm: 4.1 },
    { level: 'Pr', marketMin: 1.4, marketMax: 6.7, yourFirm: 5.4 },
  ],
  overtime: [
    { group: 'Non-managerial', kind: 'Overtime pay', yourFirm: 'Offered 1.5×' },
    { group: 'Non-managerial', kind: 'Time off in lieu', yourFirm: 'Offered 1.5×' },
    { group: 'Managerial', kind: 'Overtime pay', yourFirm: 'Offered 1.5×' },
    { group: 'Managerial', kind: 'Time off in lieu', yourFirm: 'Offered 1.5×' },
  ],
};
