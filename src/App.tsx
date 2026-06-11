import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SideNav } from '@/components/layout/SideNav';
import { MobileTopBar } from '@/components/layout/MobileTopBar';
import { useAppStore } from '@/store/useAppStore';
import { useInputsStore } from '@/store/inputsStore';
import { useScenarioStore } from '@/store/scenarioStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useStructureStore } from '@/store/structureStore';
import { usePricingStore } from '@/store/pricingStore';

/**
 * Root layout: side nav + scrolling content area. The nav is a static rail on
 * desktop (lg+) and an off-canvas drawer on mobile, toggled from the top bar.
 */
export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Mounted guard: only read persisted state after the first client render.
  useEffect(() => {
    void useAppStore.persist.rehydrate();
    void useInputsStore.persist.rehydrate();
    void useScenarioStore.persist.rehydrate();
    void useEmployeeStore.persist.rehydrate();
    void useStructureStore.persist.rehydrate();
    void usePricingStore.persist.rehydrate();
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-ink">
      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onMenu={() => setNavOpen(true)} />
        <main className="scrollbar-thin relative flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
