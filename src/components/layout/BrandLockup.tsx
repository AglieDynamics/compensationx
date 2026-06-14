import { cn } from '@/lib/cn';

/**
 * Brand lockup — matched 1:1 to the landing header (`.brand` in landing.css):
 * the `/landing/logo.png` mark + the "CryptoPayScale" wordmark in Sora 700 with
 * "Crypto" white and "PayScale" cyan (#22b6f5). Sora is loaded globally in
 * index.html. Reused across the app shell (side nav, mobile bar, login) so the
 * platform brand is identical to the landing.
 */
export function BrandLockup({ className, logoHeight = 34, fontSize = 17 }: { className?: string; logoHeight?: number; fontSize?: number }) {
  return (
    <span className={cn('flex items-center gap-[11px] text-white', className)}>
      <img
        src="/landing/logo.png"
        alt="CryptoPayScale logo"
        className="w-auto shrink-0 object-contain"
        style={{ height: logoHeight }}
      />
      <span className="font-bold tracking-[-0.01em]" style={{ fontFamily: "'Sora', sans-serif", fontSize }}>
        Crypto<span style={{ color: '#22b6f5' }}>PayScale</span>
      </span>
    </span>
  );
}
