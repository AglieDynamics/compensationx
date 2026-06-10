import { Link, NavLink } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from './nav';

export function SideNav() {
  const source = useAppStore((s) => s.source);
  const country = useAppStore((s) => s.dataset.meta.country);

  return (
    <aside className="flex h-screen w-[232px] shrink-0 flex-col border-r border-border bg-navy-900 text-white">
      <Link to="/app" className="flex items-center gap-2.5 px-5 py-5">
        <img
          src="/logo.png"
          alt="Crypto Payscale"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-lg"
        />
        <div className="leading-tight">
          <div className="text-[0.95rem] font-semibold tracking-tight">Crypto Payscale</div>
          <div className="text-[0.68rem] text-white/55">Workforce capital allocation</div>
        </div>
      </Link>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item, i) => {
          const prevGroup = i > 0 ? NAV_ITEMS[i - 1]?.group : undefined;
          const showHeader = item.group !== prevGroup;
          const Icon = item.icon;
          return (
            <div key={item.path}>
              {showHeader && (
                <div className="px-3 pb-1 pt-3 text-[0.62rem] font-semibold uppercase tracking-wider text-white/35">
                  {item.group}
                </div>
              )}
              <NavLink
                to={item.path}
                end={item.path === '/app'}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-colors',
                    isActive ? 'bg-navy-500 text-white shadow-sm' : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                  )
                }
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[0.7rem] text-white/55">
        <div className="flex items-center justify-between">
          <span>Active dataset</span>
          <span className={cn('font-semibold', source === 'uploaded' ? 'text-brand-green' : 'text-blue-400')}>
            {source === 'uploaded' ? 'Uploaded' : country}
          </span>
        </div>
      </div>
    </aside>
  );
}
