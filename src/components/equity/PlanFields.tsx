/**
 * Reusable, typed form fields for the Plan Designer — one component per input
 * kind (enum, multi-select, number, fraction, ordinal, boolean), plus the
 * numbered {@link DimensionSection} wrapper. Styling mirrors
 * JobPricingIntakeForm so the Designer reads like the rest of the app.
 */

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { MultiSelectChips } from '@/components/ui/MultiSelectChips';
import { enumOptions } from './equityLabels';

const inputCls =
  'h-8 w-full rounded-lg border border-border bg-card px-2.5 text-[0.82rem] text-ink placeholder:text-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {error ? (
        <span className="text-[0.68rem] font-medium text-brand-red">{error}</span>
      ) : hint ? (
        <span className="text-[0.66rem] leading-snug text-muted/80">{hint}</span>
      ) : null}
    </label>
  );
}

/** Single-choice enum → Select. */
export function EnumField<T extends string>({
  label,
  value,
  values,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (v: T) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <Select<T> ariaLabel={label} value={value} onChange={onChange} options={enumOptions(values)} />
    </Field>
  );
}

/** Multi-choice enum → chips. */
export function MultiField<T extends string>({
  label,
  selected,
  values,
  onToggle,
  hint,
  error,
}: {
  label: string;
  selected: T[];
  values: readonly T[];
  onToggle: (v: T) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <MultiSelectChips<T> ariaLabel={label} selected={selected} onToggle={onToggle} options={enumOptions(values)} />
    </Field>
  );
}

/** Plain number input. `integer` rounds and steps by 1. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  integer = false,
  hint,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  integer?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={inputCls}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          aria-label={label}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isNaN(n)) return;
            let next = integer ? Math.round(n) : n;
            if (min != null) next = Math.max(min, next);
            if (max != null) next = Math.min(max, next);
            onChange(next);
          }}
        />
        {suffix && <span className="shrink-0 text-[0.72rem] text-muted">{suffix}</span>}
      </div>
    </Field>
  );
}

/** A 0–1 fraction edited as a whole-number percent (e.g. 0.05 ↔ "5"). */
export function FractionField({
  label,
  value,
  onChange,
  step = 1,
  hint,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={inputCls}
          value={Number.isFinite(value) ? Math.round(value * 100) : ''}
          min={0}
          max={100}
          step={step}
          aria-label={label}
          onChange={(e) => {
            const pct = e.target.valueAsNumber;
            if (Number.isNaN(pct)) return;
            const clamped = Math.max(0, Math.min(100, Math.round(pct)));
            onChange(clamped / 100);
          }}
        />
        <span className="shrink-0 text-[0.72rem] text-muted">%</span>
      </div>
    </Field>
  );
}

/** Ordinal 1–5 → segmented control. */
export function OrdinalField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <Segmented<string>
        ariaLabel={label}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
      />
    </Field>
  );
}

/** Boolean → On/Off segmented. */
export function BoolField({
  label,
  value,
  onChange,
  onLabel = 'Yes',
  offLabel = 'No',
  hint,
  error,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <Segmented<'on' | 'off'>
        ariaLabel={label}
        value={value ? 'on' : 'off'}
        onChange={(v) => onChange(v === 'on')}
        options={[
          { value: 'on', label: onLabel },
          { value: 'off', label: offLabel },
        ]}
      />
    </Field>
  );
}

/** Numbered section card with a responsive field grid (matches the app idiom). */
export function DimensionSection({
  n,
  title,
  subtitle,
  right,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card title={`${String(n).padStart(2, '0')} · ${title}`} subtitle={subtitle} right={right}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Card>
  );
}
