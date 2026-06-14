/**
 * FAIR design-quality scorecard. Renders the four axes (1–5) with red/amber/green
 * banding and the per-factor rationale that the scoring engine exposes, so the
 * score is explainable rather than a black box.
 */

import { FAIR_AXES, FAIR_AXIS_LABELS } from '@/domain/equityPlan';
import type { PlanScore, ScoreBand } from '@/lib/equityScoring';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

const BAND_BADGE: Record<ScoreBand, 'green' | 'amber' | 'red'> = {
  green: 'green',
  amber: 'amber',
  red: 'red',
};

const BAND_BAR: Record<ScoreBand, string> = {
  green: 'bg-brand-green',
  amber: 'bg-brand-amber',
  red: 'bg-brand-red',
};

// Static class strings (no interpolation) so Tailwind's JIT keeps them.
const BAND_TEXT: Record<ScoreBand, string> = {
  green: 'text-brand-green',
  amber: 'text-[#9A7212]',
  red: 'text-brand-red',
};

const BAND_LABEL: Record<ScoreBand, string> = {
  green: 'Strong',
  amber: 'Adequate',
  red: 'At risk',
};

export function FairScoreBadge({ band, score, label }: { band: ScoreBand; score: number; label: string }) {
  return (
    <Badge variant={BAND_BADGE[band]} title={`${BAND_LABEL[band]} design`}>
      {label} {score}/5
    </Badge>
  );
}

export function OverallQualityBadge({ band, score }: { band: ScoreBand; score: number }) {
  return (
    <Badge variant={BAND_BADGE[band]} title={`${BAND_LABEL[band]} overall design`}>
      Design {score}/5 · {BAND_LABEL[band]}
    </Badge>
  );
}

export function FairScorecard({ score, showFactors = true }: { score: PlanScore; showFactors?: boolean }) {
  return (
    <div className="space-y-4">
      {FAIR_AXES.map((axis) => {
        const a = score.fair[axis];
        return (
          <div key={axis}>
            <div className="flex items-center justify-between">
              <span className="text-[0.82rem] font-semibold text-ink">{FAIR_AXIS_LABELS[axis]}</span>
              <span className={cn('text-[0.82rem] font-semibold tabular-nums', BAND_TEXT[a.band])}>{a.score}/5</span>
            </div>
            <div className="mt-1 flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={cn('h-1.5 flex-1 rounded-full', n <= a.score ? BAND_BAR[a.band] : 'bg-bg')}
                />
              ))}
            </div>
            {showFactors && (
              <ul className="mt-1.5 space-y-0.5">
                {a.factors.map((f, i) => (
                  <li key={`${axis}-${i}`} className="flex items-baseline justify-between gap-2 text-[0.7rem] text-muted">
                    <span className="truncate" title={f.detail}>
                      {f.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-soft">{f.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
