import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Scroll wrapper + base table. Sticky headers come from `<THead sticky>`. */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('scrollbar-thin overflow-auto', className)}>
      {children}
    </div>
  );
}

export function Table({
  children,
  className,
  caption,
}: {
  children: ReactNode;
  className?: string;
  /** Screen-reader-only caption describing the grid. */
  caption?: string;
}) {
  return (
    <table className={cn('w-full border-collapse text-[0.82rem] tnum', className)}>
      {caption && <caption className="sr-only">{caption}</caption>}
      {children}
    </table>
  );
}

interface THeadProps extends HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}
export function THead({ children, className, sticky, ...rest }: THeadProps) {
  return (
    <thead
      className={cn(
        'bg-[#F0F2F6] text-ink',
        sticky && 'sticky top-0 z-10',
        className,
      )}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={cn('[&>tr:nth-child(even)]:bg-[#FAFBFC]', className)}>{children}</tbody>;
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  highlight?: boolean;
}
export function TR({ children, className, highlight, ...rest }: TRProps) {
  return (
    <tr
      className={cn(
        'border-b border-border/70 last:border-b-0',
        highlight && 'bg-navy-500/5',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

type Align = 'left' | 'right' | 'center';
const alignClass: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  sticky?: boolean;
  /** Header association for screen readers. Defaults to 'col' (most headers). */
  scope?: 'col' | 'row';
}
export function TH({ children, className, align = 'left', sticky, scope = 'col', ...rest }: THProps) {
  return (
    <th
      scope={scope}
      className={cn(
        'whitespace-nowrap px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-soft',
        alignClass[align],
        sticky && 'sticky left-0 z-20 bg-[#F0F2F6]',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  sticky?: boolean;
  muted?: boolean;
}
export function TD({ children, className, align = 'left', sticky, muted, ...rest }: TDProps) {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-3 py-1.5',
        alignClass[align],
        muted ? 'text-muted' : 'text-ink',
        sticky && 'sticky left-0 z-10 bg-inherit font-medium',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
