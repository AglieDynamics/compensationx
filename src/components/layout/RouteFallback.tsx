import { Loader2 } from 'lucide-react';

/** Lightweight suspense fallback for lazily-loaded module routes. */
export function RouteFallback() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center text-muted">
      <Loader2 size={22} className="animate-spin" strokeWidth={2} />
    </div>
  );
}
