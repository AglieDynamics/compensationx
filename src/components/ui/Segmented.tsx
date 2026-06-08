import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5',
        className,
      )}
    >
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
          title={opt.title ?? (opt.disabled ? 'No data for this selection' : undefined)}
          className={cn(
            'rounded-[6px] font-medium text-ink-soft transition-colors',
            'data-[state=on]:bg-card data-[state=on]:text-navy-700 data-[state=on]:shadow-sm',
            'hover:text-navy-700 disabled:cursor-not-allowed disabled:text-muted/50 disabled:hover:text-muted/50',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[0.82rem]',
          )}
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
