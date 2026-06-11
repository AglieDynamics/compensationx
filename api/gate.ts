/**
 * Demo access gate — server side.
 *
 * POST   { username, password }  → validates against env creds, sets a signed
 *                                  httpOnly cookie, returns { ok }.
 * GET                            → reports { authenticated } from the cookie.
 * DELETE                         → clears the cookie (sign out).
 *
 * The cookie holds an HMAC of a fixed message, so `middleware.ts` can verify it
 * at the edge without shared state. The same Web Crypto signing runs in both
 * places, producing identical tokens. Credentials and the signing secret come
 * from env (DEMO_USERNAME / DEMO_PASSWORD / GATE_SECRET); the fallbacks keep the
 * demo working out of the box, but set GATE_SECRET in production so tokens
 * can't be forged.
 */

export const config = { runtime: 'edge' };

const COOKIE_NAME = 'cps_gate';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const TOKEN_MESSAGE = 'cps-demo-v1';

const DEMO_USERNAME = (process.env.DEMO_USERNAME ?? 'demo').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo';
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

/** Constant-time-ish string compare to avoid trivially leaking via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function setCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const expected = await sign(TOKEN_MESSAGE, GATE_SECRET);

  if (req.method === 'GET') {
    const token = readCookie(req, COOKIE_NAME);
    return json({ authenticated: !!token && safeEqual(token, expected) });
  }

  if (req.method === 'DELETE') {
    return new Response(null, { status: 204, headers: { 'Set-Cookie': clearCookie() } });
  }

  if (req.method === 'POST') {
    let username = '';
    let password = '';
    try {
      const body = (await req.json()) as { username?: unknown; password?: unknown };
      username = String(body.username ?? '').trim().toLowerCase();
      password = String(body.password ?? '');
    } catch {
      return json({ ok: false }, { status: 400 });
    }

    if (username === DEMO_USERNAME && safeEqual(password, DEMO_PASSWORD)) {
      return json({ ok: true }, { headers: { 'Set-Cookie': setCookie(expected) } });
    }
    return json({ ok: false }, { status: 401 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
