import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  /** Anchor id, e.g. so a stepper can scroll the card into view. */
  id?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove body padding (e.g. for full-bleed tables). */
  flush?: boolean;
}

export function Card({ id, title, subtitle, right, children, className, bodyClassName, flush }: CardProps) {
  const hasHeader = title != null || subtitle != null || right != null;
  return (
    <section
      id={id}
      className={cn(
        'rounded-card border border-border bg-card shadow-card',
        'animate-fade-in',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title != null && (
              <h2 className="text-[0.95rem] font-semibold leading-tight text-ink">{title}</h2>
            )}
            {subtitle != null && (
              <p className="mt-0.5 text-[0.8rem] leading-snug text-muted">{subtitle}</p>
            )}
          </div>
          {right != null && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn(flush ? '' : 'px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}
