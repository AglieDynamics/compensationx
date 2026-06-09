import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from '@/components/layout/SideNav';
import { useAppStore } from '@/store/useAppStore';
import { useInputsStore } from '@/store/inputsStore';
import { useScenarioStore } from '@/store/scenarioStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useStructureStore } from '@/store/structureStore';
import { usePricingStore } from '@/store/pricingStore';

/** Root layout: fixed side nav + scrolling content area. */
export function AppLayout() {
  // Mounted guard: only read persisted state after the first client render.
  useEffect(() => {
    void useAppStore.persist.rehydrate();
    void useInputsStore.persist.rehydrate();
    void useScenarioStore.persist.rehydrate();
    void useEmployeeStore.persist.rehydrate();
    void useStructureStore.persist.rehydrate();
    void usePricingStore.persist.rehydrate();
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
