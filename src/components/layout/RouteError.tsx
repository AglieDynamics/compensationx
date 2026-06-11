/**
 * Fallback shown when a route element throws during render (or a lazy chunk
 * fails to load). Wired as the router's `errorElement` so a crash in one module
 * degrades to a recoverable panel instead of a blank white screen. Renders
 * standalone — it does not assume the app shell mounted.
 */

import { Link, useRouteError } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';

export function RouteError() {
  const error = useRouteError();
  // Surface the message in dev/console without leaking a stack into the UI.
  if (error) console.error('Route error:', error);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-6 py-12 text-ink">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
          <AlertTriangle size={22} strokeWidth={1.75} />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-muted">
          This view hit an unexpected error. Your data is safe — reloading usually clears it.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="group flex items-center gap-1.5 rounded-lg bg-navy-500 px-4 py-2 text-[0.84rem] font-semibold text-white transition-colors hover:bg-navy-700"
          >
            <RotateCw size={14} className="transition-transform group-hover:rotate-90" />
            Reload
          </button>
          <Link
            to="/app"
            className="rounded-lg border border-border bg-card px-4 py-2 text-[0.84rem] font-medium text-ink-soft transition-colors hover:bg-bg"
          >
            Back to Control Tower
          </Link>
        </div>
      </div>
    </div>
  );
}
