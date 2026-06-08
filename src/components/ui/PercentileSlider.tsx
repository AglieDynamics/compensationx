import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/cn';
import { formatPercentileLabel } from '@/lib/format';

interface PercentileSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
}

export function PercentileSlider({
  value,
  onChange,
  min = 0.05,
  max = 0.95,
  step = 0.05,
  label = 'Target percentile',
  className,
}: PercentileSliderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && <span className="whitespace-nowrap text-xs font-medium text-muted">{label}</span>}
      <Slider.Root
        className="relative flex h-5 w-40 touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={(vals) => {
          const v = vals[0];
          if (typeof v === 'number') onChange(Math.round(v * 100) / 100);
        }}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-band-light">
          <Slider.Range className="absolute h-full rounded-full bg-navy-500" />
        </Slider.Track>
        <Slider.Thumb
          className="block h-4 w-4 rounded-full border-2 border-navy-500 bg-white shadow-pop transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/40"
        />
      </Slider.Root>
      <span className="min-w-[3.25rem] rounded-md bg-navy-700 px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-white">
        {formatPercentileLabel(value)}
      </span>
    </div>
  );
}
