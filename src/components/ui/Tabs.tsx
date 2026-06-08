import * as RTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  className?: string;
  listClassName?: string;
  ariaLabel?: string;
}

export function Tabs({ items, defaultValue, className, listClassName, ariaLabel }: TabsProps) {
  const first = items[0]?.value;
  return (
    <RTabs.Root defaultValue={defaultValue ?? first} className={cn('w-full', className)}>
      <RTabs.List
        aria-label={ariaLabel}
        className={cn(
          'scrollbar-thin mb-4 flex gap-1 overflow-x-auto border-b border-border',
          listClassName,
        )}
      >
        {items.map((item) => (
          <RTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[0.82rem] font-medium text-muted transition-colors',
              'hover:text-ink-soft',
              'data-[state=active]:border-navy-500 data-[state=active]:text-navy-700',
            )}
          >
            {item.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((item) => (
        <RTabs.Content
          key={item.value}
          value={item.value}
          className="animate-fade-in focus:outline-none"
        >
          {item.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
