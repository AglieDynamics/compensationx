import { type Provenance, PROVENANCE_META, PROVENANCE_ORDER } from '@/lib/provenance';
import { cn } from '@/lib/cn';

interface ProvenanceChipProps {
  provenance: Provenance;
  label?: string;
  showDot?: boolean;
  className?: string;
  title?: string;
}

/** Credibility chip: Measured / Entered / Assumed (§2C). */
export function ProvenanceChip({ provenance, label, showDot = true, className, title }: ProvenanceChipProps) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      title={title ?? meta.description}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium leading-tight',
        meta.bg,
        meta.text,
        className,
      )}
    >
      {showDot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />}
      {label ?? meta.label}
    </span>
  );
}

/** Legend for the three provenance levels. */
export function ProvenanceLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted', className)}>
      <span className="font-medium text-ink-soft">Provenance:</span>
      {PROVENANCE_ORDER.map((p) => {
        const meta = PROVENANCE_META[p];
        return (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
            {meta.label} — {meta.description}
          </span>
        );
      })}
    </div>
  );
}

/** Banner shown when a whole view is computed entirely on default assumptions. */
export function ModeledBanner({ message, className }: { message?: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-dashed border-brand-amber/50 bg-brand-amber/5 px-3 py-2 text-[0.78rem] text-[#9A7212]',
        className,
      )}
    >
      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-amber" />
      <span>{message ?? 'Modeled on default assumptions. Add data in Inputs & Assumptions to sharpen.'}</span>
    </div>
  );
}
