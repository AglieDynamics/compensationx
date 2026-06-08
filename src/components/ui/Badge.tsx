import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'neutral' | 'navy' | 'green' | 'amber' | 'red' | 'outline';

const VARIANTS: Record<Variant, string> = {
  neutral: 'bg-[#EEF1F6] text-ink-soft',
  navy: 'bg-navy-700 text-white',
  green: 'bg-brand-green/10 text-brand-green',
  amber: 'bg-brand-amber/15 text-[#9A7212]',
  red: 'bg-brand-red/10 text-brand-red',
  outline: 'border border-border bg-card text-ink-soft',
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  title?: string;
}

export function Badge({ children, variant = 'neutral', className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium leading-tight',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small "illustrative sample" tag used wherever data is not from the source workbook. */
export function IllustrativeTag({ className }: { className?: string }) {
  return (
    <Badge variant="amber" className={className} title="Illustrative sample — not from the source workbook">
      Illustrative
    </Badge>
  );
}

/** "Derived" tag for synthesised tables (e.g. prior-year from published YoY medians). */
export function DerivedTag({ className, title }: { className?: string; title?: string }) {
  return (
    <Badge variant="amber" className={className} title={title ?? 'Derived — not reported directly in the source'}>
      Derived
    </Badge>
  );
}
