/**
 * First-run welcome tour. A four-step carousel that orients new visitors around
 * the platform's closed loop — price work, benchmark it against the market, then
 * cost the gap — which also teaches the nav groups (Operate · Benchmarking ·
 * Capital Allocation). Shown once per browser (see {@link useOnboardingStore});
 * replayable from the side nav.
 *
 * Dependency-free and accessible: a labelled modal dialog, Escape to skip, an
 * initial focus target, and a focus trap scoped to the dialog.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  Hourglass,
  LineChart,
  Tags,
  X,
  type LucideIcon,
} from 'lucide-react';
import { track } from '@vercel/analytics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { cn } from '@/lib/cn';

interface TourStep {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  /** Concrete destinations in this area, so visitors know where to click next. */
  highlights: string[];
}

const STEPS: TourStep[] = [
  {
    icon: Gauge,
    eyebrow: 'Welcome',
    title: 'Turn market data into governed pay decisions',
    body: 'Crypto Payscale prices every hire, designs every range, and shows the cost of every gap — in one closed loop. A sample dataset (Greenland) is already loaded, so you can explore everything right now.',
    highlights: ['Control Tower unifies the whole picture', 'Swap in your own data anytime'],
  },
  {
    icon: Tags,
    eyebrow: 'Operate',
    title: 'Price the work and structure pay',
    body: 'Start from the roles you hire for. Price a job against the market, design salary ranges around it, and keep your employee population and architecture in one place.',
    highlights: ['Job Pricing', 'Ranges Designer', 'Employees & Architecture'],
  },
  {
    icon: LineChart,
    eyebrow: 'Benchmarking',
    title: 'See exactly where pay sits vs the market',
    body: 'Compare base, bonus and total comp to market percentiles across every level. Read it on the dashboard, drill into the worksheet, or hand an executive summary to leadership.',
    highlights: ['Summary Dashboard', 'Benchmark Worksheet', 'Executive Summary'],
  },
  {
    icon: Hourglass,
    eyebrow: 'Capital Allocation',
    title: 'Cost the gap and the ROI of closing it',
    body: 'Model what pay gaps cost you and where the next dollar earns the most — convexity, value density, the pay-productivity frontier, and the cost of inaction.',
    highlights: ['Cost of Inaction', 'Pay-Productivity Frontier', 'Capital Allocation Brief'],
  },
];

const ACCENT = ['text-navy-500', 'text-brand-green', 'text-navy-500', 'text-brand-amber'] as const;

export function WelcomeTour() {
  const completed = useOnboardingStore((s) => s.completed);
  const complete = useOnboardingStore((s) => s.complete);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const isLast = step === STEPS.length - 1;

  const finish = useCallback(
    (destination?: string) => {
      // Reaching the final CTA completes the tour; anything else is a skip.
      track('tour_finished', { outcome: destination ? 'completed' : 'skipped', step: step + 1 });
      complete();
      if (destination) navigate(destination);
    },
    [complete, navigate, step],
  );

  // Focus the primary action when the tour opens or the step changes, and keep
  // focus inside the dialog (Escape skips, Tab cycles within the modal).
  useEffect(() => {
    if (completed) return;
    primaryRef.current?.focus();
  }, [completed, step]);

  useEffect(() => {
    if (completed) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        finish();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href]',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [completed, finish]);

  if (completed) return null;

  const current = STEPS[step];
  if (!current) return null;
  const Icon = current.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Click on the backdrop (not the card) skips the tour.
        if (e.target === e.currentTarget) finish();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-md overflow-hidden rounded-card bg-card shadow-pop"
      >
        <button
          type="button"
          onClick={() => finish()}
          aria-label="Skip tour"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
        >
          <X size={16} strokeWidth={2} />
        </button>

        {/* Branded header band */}
        <div className="bg-navy-900 px-7 pb-6 pt-7 text-white">
          <span
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08]',
              ACCENT[step] ?? 'text-navy-500',
            )}
          >
            <Icon size={22} strokeWidth={1.75} />
          </span>
        </div>

        {/* Step content — keyed on step so it re-runs the fade on change */}
        <div key={step} className="animate-fade-in px-7 pb-6 pt-5">
          <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-navy-500">
            {current.eyebrow}
          </div>
          <h2 id={titleId} className="mt-1 text-lg font-semibold leading-snug tracking-tight text-ink">
            {current.title}
          </h2>
          <p id={bodyId} className="mt-2 text-[0.86rem] leading-relaxed text-ink-soft">
            {current.body}
          </p>
          <ul className="mt-4 space-y-1.5">
            {current.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2 text-[0.82rem] text-muted">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-navy-500" />
                {h}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer: progress dots + navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-7 py-4">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-5 bg-navy-500' : 'w-1.5 bg-band-light',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-[0.84rem] font-medium text-muted transition-colors hover:bg-bg hover:text-ink"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {isLast ? (
              <button
                ref={primaryRef}
                type="button"
                onClick={() => finish('/app')}
                className="rounded-lg bg-navy-500 px-4 py-2 text-[0.84rem] font-semibold text-white transition-colors hover:bg-navy-700"
              >
                Start exploring
              </button>
            ) : (
              <button
                ref={primaryRef}
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="group flex items-center gap-1.5 rounded-lg bg-navy-500 px-4 py-2 text-[0.84rem] font-semibold text-white transition-colors hover:bg-navy-700"
              >
                Next
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
