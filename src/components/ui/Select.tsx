import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  placeholder,
}: SelectProps<T>) {
  return (
    <RSelect.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <RSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-[0.82rem] font-medium text-ink',
          'hover:border-navy-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30',
          'data-[placeholder]:text-muted',
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown size={14} className="text-muted" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 overflow-hidden rounded-lg border border-border bg-card shadow-pop"
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-3 text-[0.82rem] text-ink',
                  'data-[highlighted]:bg-navy-500/10 data-[highlighted]:outline-none',
                  'data-[disabled]:cursor-not-allowed data-[disabled]:text-muted/50',
                )}
              >
                <RSelect.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check size={13} className="text-navy-500" />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
