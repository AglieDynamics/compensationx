import type { ReactNode } from 'react';
import { ScopeChip } from './ScopeChip';
import { cn } from '@/lib/cn';

interface TopFilterBarProps {
  title: string;
  subtitle?: string;
  module?: number;
  controls?: ReactNode;
  className?: string;
}

/** Sticky per-module header: title + scope chip, with an optional filter row. */
export function TopFilterBar({ title, subtitle, module, controls, className }: TopFilterBarProps) {
  return (
    <div className={cn('z-30 border-b border-border bg-bg/85 backdrop-blur-sm lg:sticky lg:top-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            {module != null && (
              <span className="rounded-md bg-navy-700 px-1.5 py-0.5 text-[0.62rem] font-bold tracking-wide text-white">
                {module.toString().padStart(2, '0')}
              </span>
            )}
            <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
          </div>
          {subtitle && <p className="mt-0.5 text-[0.82rem] text-muted">{subtitle}</p>}
        </div>
        <ScopeChip />
      </div>
      {controls && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 pb-3 sm:px-6">{controls}</div>
      )}
    </div>
  );
}
