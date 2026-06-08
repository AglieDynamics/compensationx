import type { RagStatus } from '@/lib/benchmark';
import { cn } from '@/lib/cn';

const RAG_META: Record<RagStatus, { label: string; dot: string; text: string; bg: string }> = {
  green: { label: 'No action', dot: 'bg-brand-green', text: 'text-brand-green', bg: 'bg-brand-green/10' },
  amber: { label: 'Review', dot: 'bg-brand-amber', text: 'text-[#9A7212]', bg: 'bg-brand-amber/15' },
  red: { label: 'Action', dot: 'bg-brand-red', text: 'text-brand-red', bg: 'bg-brand-red/10' },
};

interface RagBadgeProps {
  status: RagStatus | null;
  label?: string;
  showDot?: boolean;
  className?: string;
}

export function RagBadge({ status, label, showDot = true, className }: RagBadgeProps) {
  if (!status) {
    return <span className={cn('text-xs text-muted', className)}>—</span>;
  }
  const meta = RAG_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        meta.bg,
        meta.text,
        className,
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />}
      {label ?? meta.label}
    </span>
  );
}

/** RAG legend used on worksheet/budget views. */
export function RagLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-xs text-muted', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand-green" /> No action (|Δ| ≤ 5%)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand-amber" /> Review (5–10%)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand-red" /> Action (&gt; 10%)
      </span>
    </div>
  );
}

export const RAG_HEX: Record<RagStatus, string> = {
  green: '#2E8B57',
  amber: '#E0A93B',
  red: '#C0392B',
};
