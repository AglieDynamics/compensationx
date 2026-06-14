/**
 * Display helpers for the incentive-plan enums. SCREAMING_SNAKE values are the
 * stored source of truth; these turn them into readable labels (with acronyms
 * preserved) for selects, chips and badges.
 */

import type { SelectOption } from '@/components/ui/Select';

const ACRONYMS = new Set(['KPI', 'KPIS', 'CIC', 'IPO', 'DCF', 'EBITDA', 'FMV', 'RWA', 'KYC', 'BU', 'EV']);

/** "CHANGE_IN_CONTROL_UNITS" → "Change In Control Units"; preserves known acronyms. */
export function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((w) => (ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Map an `as const` enum array to Select/Segmented options with humanized labels. */
export function enumOptions<T extends string>(values: readonly T[]): SelectOption<T>[] {
  return values.map((value) => ({ value, label: humanizeEnum(value) }));
}
