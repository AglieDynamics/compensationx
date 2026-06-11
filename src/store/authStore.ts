/**
 * Demo access gate (client side). Holds whether the visitor has unlocked the
 * platform and persists it to localStorage so a sign-in survives refreshes.
 *
 * Sign-in is validated by the server (/api/gate), which sets a signed httpOnly
 * cookie that `middleware.ts` enforces on direct platform loads. If that endpoint
 * is unavailable (local `vite dev`, or a function outage) we fall back to a
 * client-side credential check so the demo keeps working — the edge middleware
 * is the real boundary either way. The persisted boolean is reconciled against
 * the server cookie on mount by RequireAuth.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { track } from '@vercel/analytics';

/** Fallback demo credentials, used only when /api/gate is unreachable. */
const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo';

interface AuthState {
  authenticated: boolean;
  /** Validates credentials (server-first, client fallback). Resolves true on success. */
  signIn: (username: string, password: string) => Promise<boolean>;
  /** Clears the local flag and the server cookie. */
  signOut: () => void;
  /** Reconcile the local flag with the server's view of the cookie. */
  setAuthenticated: (value: boolean) => void;
}

function clientCheck(username: string, password: string): boolean {
  return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authenticated: false,
      signIn: async (username, password) => {
        try {
          const res = await fetch('/api/gate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          if (res.ok) {
            set({ authenticated: true });
            track('demo_signin');
            return true;
          }
          // 401 = server rejected the credentials; trust it.
          if (res.status === 401) return false;
          // Any other status (404/5xx): fall through to the local check.
        } catch {
          // Network error / endpoint missing: fall through to the local check.
        }
        const ok = clientCheck(username, password);
        if (ok) {
          set({ authenticated: true });
          track('demo_signin');
        }
        return ok;
      },
      signOut: () => {
        set({ authenticated: false });
        void fetch('/api/gate', { method: 'DELETE' }).catch(() => {});
      },
      setAuthenticated: (value) => set({ authenticated: value }),
    }),
    {
      name: 'cps-demo-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ authenticated: state.authenticated }),
    },
  ),
);
