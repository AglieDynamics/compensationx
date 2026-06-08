/**
 * Local presentation helpers for the Data Ingestion module.
 *
 * Pure, deterministic label/formatting helpers — no math (all benchmarking math
 * lives in @/lib/benchmark.ts; this module performs none). Kept inside the module
 * directory so it never collides with shared files.
 */

import type { Component, Period, Weighting } from '@/domain/components';
import { COMPONENT_LABELS, WEIGHTING_LABELS, PERIOD_LABELS } from '@/domain/components';

/** Parse a "WEIGHTING/PERIOD/COMPONENT" combo key (as emitted by ParseReport.combosLoaded). */
export interface ComboParts {
  weighting: string;
  period: string;
  component: string;
}

const WEIGHTING_VALUES = new Set<string>(['FIRM', 'INCUMBENT']);
const PERIOD_VALUES = new Set<string>(['TARGET', 'ACTUAL']);

function isWeighting(v: string): v is Weighting {
  return WEIGHTING_VALUES.has(v);
}

function isPeriod(v: string): v is Period {
  return PERIOD_VALUES.has(v);
}

function isComponent(v: string): v is Component {
  return v in COMPONENT_LABELS;
}

/**
 * Turn a raw combo key ("FIRM/TARGET/BASIC_SALARY") into human-readable parts.
 * Unknown tokens are passed through verbatim so nothing is ever silently dropped.
 */
export function describeCombo(key: string): ComboParts {
  const [w = '', p = '', c = ''] = key.split('/');
  return {
    weighting: isWeighting(w) ? WEIGHTING_LABELS[w] : w || '—',
    period: isPeriod(p) ? PERIOD_LABELS[p] : p || '—',
    component: isComponent(c) ? COMPONENT_LABELS[c] : c || '—',
  };
}

/** Example tab names users should expect in a Vencon-format workbook (§4.2). */
export const EXPECTED_TABS: { name: string; meaning: string }[] = [
  { name: 'Basic Salary Firm-weighted', meaning: 'Basic Salary · Firm-weighted · Target' },
  { name: 't-Bonus % Firm-weighted', meaning: 'Bonus % · Firm-weighted · Target' },
  { name: 'a-TCC Incu-weighted', meaning: 'TCC · Incumbent-weighted · Actual (prior year)' },
  { name: 't-TCC Incu-weighted', meaning: 'TCC · Incumbent-weighted · Target' },
];

/** Friendly, never-raw error message derived from a thrown parse error. */
export function friendlyParseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lc = raw.toLowerCase();
  if (lc.includes('password') || lc.includes('encrypted')) {
    return 'This workbook appears to be password-protected. Remove protection in Excel and try again.';
  }
  if (lc.includes('zip') || lc.includes('central directory') || lc.includes('end of central')) {
    return 'This file does not look like a valid .xlsx/.xls workbook. Please export a fresh copy from Excel and re-upload.';
  }
  return 'We could not read this workbook. Make sure it is an unmodified Vencon-format .xlsx/.xls export and try again.';
}
