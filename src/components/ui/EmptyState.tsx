import { Database } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title?: string;
  message?: ReactNode;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title = 'No data for this selection',
  message = 'Ingest the source workbook to populate this view, or switch to a combination present in the Greenland sample.',
  icon,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-bg/60 text-center',
        compact ? 'gap-1.5 px-4 py-6' : 'gap-2 px-6 py-12',
        className,
      )}
    >
      <span className="text-muted/70">{icon ?? <Database size={compact ? 18 : 24} strokeWidth={1.5} />}</span>
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {message != null && <p className="max-w-sm text-xs leading-relaxed text-muted">{message}</p>}
    </div>
  );
}
