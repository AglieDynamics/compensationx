/**
 * Demo access gate. Holds a single boolean — whether the visitor has entered the
 * shared demo credentials — and persists it to localStorage so a sign-in survives
 * refreshes for the duration of the demo session.
 *
 * NOTE: This is a client-side gate for a public demo, not real authentication.
 * The credentials live in the bundle and the check runs in the browser, so it
 * only keeps casual visitors out — it is not a security boundary.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { track } from '@vercel/analytics';

/** Shared demo credentials. Intentionally trivial — this gates a public demo. */
const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo';

interface AuthState {
  authenticated: boolean;
  /** Returns true and unlocks the platform when the demo credentials match. */
  signIn: (username: string, password: string) => boolean;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authenticated: false,
      signIn: (username, password) => {
        const ok =
          username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
        if (ok) {
          set({ authenticated: true });
          track('demo_signin');
        }
        return ok;
      },
      signOut: () => set({ authenticated: false }),
    }),
    {
      name: 'cps-demo-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ authenticated: state.authenticated }),
    },
  ),
);
