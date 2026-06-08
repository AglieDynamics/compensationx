import type { ReactNode } from 'react';
import { TopFilterBar } from './TopFilterBar';
import { cn } from '@/lib/cn';

interface ModuleShellProps {
  title: string;
  subtitle?: string;
  module?: number;
  controls?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

/** Standard module frame: sticky header + filter row + padded content. */
export function ModuleShell({ title, subtitle, module, controls, children, contentClassName }: ModuleShellProps) {
  return (
    <div className="min-h-full">
      <TopFilterBar title={title} subtitle={subtitle} module={module} controls={controls} />
      <div className={cn('mx-auto max-w-[1500px] space-y-5 px-6 py-5', contentClassName)}>{children}</div>
    </div>
  );
}
