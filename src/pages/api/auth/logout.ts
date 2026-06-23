import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { gotrue } from '@/lib/supabase';
import { json, getBearer } from '@/lib/http';

export const prerender = false;

/**
 * Cierra sesión: revoca el token en GoTrue (best-effort) con el Bearer del
 * usuario. El front igualmente descarta sus tokens, así que si esto falla, el
 * access_token expira solo.
 */
export const POST: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (jwt) {
    await gotrue(getEnv(ctx.locals), 'logout', { method: 'POST', jwt }, 'auth/logout');
  }
  return json({ ok: true });
};
