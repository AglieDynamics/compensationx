/**
 * Edge gate for the platform. Runs only on app paths (see `config.matcher`) and
 * never on the public landing, static assets, or /api — so a bug here can slow
 * the demo at worst, never lock out the marketing site. A direct load or refresh
 * of a platform URL without a valid `cps_gate` cookie is redirected to the
 * landing; the cookie is minted by /api/gate after a successful sign-in.
 *
 * Note: this guards server-rendered access to platform URLs. In-app client-side
 * navigation is additionally gated by RequireAuth. Because the landing and app
 * share one public bundle, this raises the bar for casual access rather than
 * hiding the (non-sensitive) demo code itself.
 */

import { next } from '@vercel/edge';

export const config = {
  matcher: [
    '/app',
    '/pricing',
    '/structure',
    '/employees',
    '/dashboard',
    '/worksheet',
    '/summary',
    '/budget',
    '/career',
    '/data',
    '/pulse',
    '/capital/:path*',
  ],
};

const COOKIE_NAME = 'cps_gate';
const TOKEN_MESSAGE = 'cps-demo-v1';
const GATE_SECRET = process.env.GATE_SECRET ?? 'cps-demo-insecure-fallback-secret';

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function middleware(req: Request): Promise<Response> {
  const token = readCookie(req, COOKIE_NAME);
  if (token) {
    const expected = await sign(TOKEN_MESSAGE, GATE_SECRET);
    if (safeEqual(token, expected)) return next();
  }

  const url = new URL(req.url);
  url.pathname = '/';
  url.search = '?locked=1';
  return Response.redirect(url, 307);
}
