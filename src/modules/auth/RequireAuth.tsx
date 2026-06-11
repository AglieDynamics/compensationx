/**
 * Gate wrapper for every platform route. Renders the demo {@link Login} screen
 * until the visitor has unlocked the platform, then hands off to the
 * {@link AppLayout} shell. Used as the parent route element so all app surfaces
 * inherit the gate.
 *
 * On mount it reconciles the persisted client flag with the server's view of the
 * gate cookie (/api/gate), so a stale/expired session resolves to the login
 * screen and a valid cookie unlocks without re-entering credentials. If the
 * endpoint is unavailable (local dev), the persisted flag stands.
 */

import { useEffect } from 'react';
import { AppLayout } from '@/App';
import { useAuthStore } from '@/store/authStore';
import { Login } from './Login';

export function RequireAuth() {
  const authenticated = useAuthStore((s) => s.authenticated);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gate')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { authenticated?: unknown } | null) => {
        if (cancelled || !data || typeof data.authenticated !== 'boolean') return;
        setAuthenticated(data.authenticated);
      })
      .catch(() => {
        /* endpoint unavailable — keep the persisted flag */
      });
    return () => {
      cancelled = true;
    };
  }, [setAuthenticated]);

  if (!authenticated) return <Login />;
  return <AppLayout />;
}
