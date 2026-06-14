import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { BrandLockup } from './BrandLockup';

/**
 * Mobile-only header. Sits above the scrolling content as a flex sibling (not
 * inside the scroll container), so per-module sticky headers still pin correctly
 * beneath it. Hidden on lg+ where the side rail is always visible.
 */
export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-navy-900 px-3 text-white lg:hidden">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Menu size={20} strokeWidth={2} />
      </button>
      <Link to="/app" className="inline-flex">
        <BrandLockup logoHeight={26} fontSize={15} />
      </Link>
    </header>
  );
}
