/**
 * First-run onboarding state. Tracks whether the visitor has seen the welcome
 * tour, persisted to localStorage so it shows once per browser. Persistence
 * hydrates synchronously on the client (like the auth gate), so the first render
 * already knows whether to show the tour — no flash.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OnboardingState {
  /** True once the visitor has finished or skipped the welcome tour. */
  completed: boolean;
  /** Mark the tour done (finished or skipped). */
  complete: () => void;
  /** Re-open the tour on demand (e.g. from the "Replay tour" control). */
  restart: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      complete: () => set({ completed: true }),
      restart: () => set({ completed: false }),
    }),
    {
      name: 'cps-onboarding',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ completed: state.completed }),
    },
  ),
);
