import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { json, getBearer } from '@/lib/http';

export const prerender = false;

/**
 * Cierra sesión: revoca el token en GoTrue (best-effort) llamando al endpoint
 * de logout con el Bearer del usuario. El front igualmente descarta sus tokens.
 */
export const POST: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (jwt) {
    const env = getEnv(ctx.locals);
    try {
      await fetch(`${env.PUBLIC_SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: env.PUBLIC_SUPABASE_ANON_KEY,
        },
      });
    } catch {
      // best-effort: si falla, el token expira solo y el front ya lo borró.
    }
  }
  return json({ ok: true });
};
