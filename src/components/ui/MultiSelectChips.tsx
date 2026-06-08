import { cn } from '@/lib/cn';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectChipsProps<T extends string> {
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function MultiSelectChips<T extends string>({
  options,
  selected,
  onToggle,
  ariaLabel,
  className,
}: MultiSelectChipsProps<T>) {
  const selectedSet = new Set(selected);
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map((opt) => {
        const on = selectedSet.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              on
                ? 'border-navy-500 bg-navy-500 text-white shadow-sm'
                : 'border-border bg-card text-ink-soft hover:border-navy-500/40 hover:text-navy-700',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
