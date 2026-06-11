/**
 * Gate wrapper for every platform route. Renders the demo {@link Login} screen
 * until the visitor has entered the shared credentials, then hands off to the
 * {@link AppLayout} shell. Used as the parent route element so all app surfaces
 * inherit the gate.
 */

import { AppLayout } from '@/App';
import { useAuthStore } from '@/store/authStore';
import { Login } from './Login';

export function RequireAuth() {
  const authenticated = useAuthStore((s) => s.authenticated);
  if (!authenticated) return <Login />;
  return <AppLayout />;
}
