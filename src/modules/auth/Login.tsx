/**
 * Demo access gate screen. Shown in place of the platform shell whenever a
 * visitor reaches an app route without having entered the shared demo
 * credentials (see {@link useAuthStore}). On success the store flips to
 * authenticated and the requested route renders.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const ok = await signIn(username, password);
    setSubmitting(false);
    if (!ok) setError(true);
    // On success the gate unmounts and the protected route renders.
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-navy-900 px-6 py-12 text-white">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Crypto Payscale"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg"
          />
          <div className="leading-tight">
            <div className="text-[1rem] font-semibold tracking-tight">Crypto Payscale</div>
            <div className="text-[0.7rem] text-white/55">Workforce capital allocation</div>
          </div>
        </Link>

        <div className="rounded-card border border-white/10 bg-white/[0.03] p-7 shadow-pop">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-500/40 text-blue-400">
              <Lock size={16} strokeWidth={2} />
            </span>
            <div>
              <h1 className="text-[1.05rem] font-semibold tracking-tight">Demo access</h1>
              <p className="text-[0.72rem] text-white/55">Sign in to explore the platform</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[0.72rem] font-medium uppercase tracking-wider text-white/55">
                Username
              </span>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(false);
                }}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[0.9rem] text-white placeholder-white/30 outline-none transition-colors focus:border-blue-400 focus:bg-white/[0.06]"
                placeholder="demo"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.72rem] font-medium uppercase tracking-wider text-white/55">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[0.9rem] text-white placeholder-white/30 outline-none transition-colors focus:border-blue-400 focus:bg-white/[0.06]"
                placeholder="••••"
              />
            </label>

            {error && (
              <p className="text-[0.78rem] font-medium text-rag-amber">
                Incorrect username or password.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-navy-500 px-4 py-2.5 text-[0.88rem] font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Entering…' : 'Enter demo'}
              {!submitting && (
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </form>
        </div>

        <Link
          to="/"
          className="mt-5 inline-block text-[0.78rem] text-white/45 transition-colors hover:text-white/70"
        >
          ← Back to site
        </Link>
      </div>
    </div>
  );
}
