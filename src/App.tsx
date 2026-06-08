import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from '@/components/layout/SideNav';
import { useAppStore } from '@/store/useAppStore';

/** Root layout: fixed side nav + scrolling content area. */
export function AppLayout() {
  // Mounted guard: only read persisted state after the first client render.
  useEffect(() => {
    void useAppStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-ink">
      <SideNav />
      <main className="scrollbar-thin relative flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
