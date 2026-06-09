import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import type { Provenance } from '@/lib/provenance';
import { cn } from '@/lib/cn';

interface ConfidenceMeterProps {
  score: number | null; // 0..100
  provenance?: Provenance;
  label?: string;
  className?: string;
}

// Bar fill (bright) vs text (WCAG-legible darker amber for the mid band).
function bandFill(score: number): string {
  if (score >= 75) return '#2E8B57';
  if (score >= 50) return '#E0A93B';
  return '#C0392B';
}
function bandText(score: number): string {
  if (score >= 75) return '#2E8B57';
  if (score >= 50) return '#9A7212';
  return '#C0392B';
}

/** 0–100 confidence meter (extends the v2 provenance system, §3 B). */
export function ConfidenceMeter({ score, provenance, label, className }: ConfidenceMeterProps) {
  const valid = typeof score === 'number' && Number.isFinite(score);
  const v = valid ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[0.72rem] font-medium text-ink-soft">{label ?? 'Confidence'}</span>
        <span className="flex items-center gap-1.5">
          {valid && <span className="text-xs font-semibold tabular-nums" style={{ color: bandText(v) }}>{Math.round(v)}</span>}
          {provenance && <ProvenanceChip provenance={provenance} showDot={false} />}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${v}%`, background: bandFill(v) }} />
      </div>
    </div>
  );
}
