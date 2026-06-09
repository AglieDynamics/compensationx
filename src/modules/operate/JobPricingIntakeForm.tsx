/**
 * Module A — hiring-request intake form (§3 Module A, step 1).
 * Pure controlled inputs over a local PricingIntake; no compute lives here.
 */

import type { ReactNode } from 'react';
import { Select } from '@/components/ui/Select';
import { LEVELS, LEVEL_LABELS, type Level } from '@/domain/levels';
import { GEOGRAPHIES, JOB_FAMILIES, LEVEL_TO_GRADE } from '@/lib/assumptions';
import type { PricingIntake } from '@/domain/structure';

interface IntakeFormProps {
  intake: PricingIntake;
  onChange: (patch: Partial<PricingIntake>) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

const textCls =
  'h-8 rounded-lg border border-border bg-card px-2.5 text-[0.82rem] text-ink placeholder:text-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30';

/** Intake form. Changing the level resets the grade to that level's default band. */
export function JobPricingIntakeForm({ intake, onChange }: IntakeFormProps) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Role title">
        <input
          className={textCls}
          value={intake.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Engagement Manager"
          aria-label="Role title"
        />
      </Field>

      <Field label="Hiring manager">
        <input
          className={textCls}
          value={intake.hiringManager}
          onChange={(e) => onChange({ hiringManager: e.target.value })}
          placeholder="e.g. A. Director"
          aria-label="Hiring manager"
        />
      </Field>

      <Field label="Business unit">
        <input
          className={textCls}
          value={intake.businessUnit}
          onChange={(e) => onChange({ businessUnit: e.target.value })}
          placeholder="e.g. Consulting"
          aria-label="Business unit"
        />
      </Field>

      <Field label="Career level">
        <Select<Level>
          ariaLabel="Career level"
          value={intake.level}
          onChange={(level) => onChange({ level, grade: LEVEL_TO_GRADE[level] })}
          options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
        />
      </Field>

      <Field label="Job family">
        <Select
          ariaLabel="Job family"
          value={intake.jobFamily}
          onChange={(jobFamily) => onChange({ jobFamily })}
          options={JOB_FAMILIES.map((f) => ({ value: f, label: f }))}
        />
      </Field>

      <Field label="Geography">
        <Select
          ariaLabel="Geography"
          value={intake.geography}
          onChange={(geography) => onChange({ geography })}
          options={GEOGRAPHIES.map((g) => ({ value: g, label: g }))}
        />
      </Field>

      <Field label="Grade band">
        <input
          className={textCls}
          value={intake.grade}
          onChange={(e) => onChange({ grade: e.target.value })}
          aria-label="Grade band"
        />
      </Field>

      <Field label="Replacement">
        <Select<'replacement' | 'new'>
          ariaLabel="Replacement or new headcount"
          value={intake.replacement ? 'replacement' : 'new'}
          onChange={(v) => onChange({ replacement: v === 'replacement' })}
          options={[
            { value: 'replacement', label: 'Backfill / replacement' },
            { value: 'new', label: 'New headcount' },
          ]}
        />
      </Field>

      <Field label="Must-have skills">
        <input
          className={textCls}
          value={intake.mustHaveSkills}
          onChange={(e) => onChange({ mustHaveSkills: e.target.value })}
          placeholder="e.g. SQL, pricing strategy"
          aria-label="Must-have skills"
        />
      </Field>
    </div>
  );
}
