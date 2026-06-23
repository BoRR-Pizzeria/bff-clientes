import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { gotrue } from '@/lib/supabase';
import { json, error, readJson, fail } from '@/lib/http';

export const prerender = false;

interface GoTrueSession {
  user?: unknown;
  [k: string]: unknown;
}

/** Refresca la sesión. Body: `{ refresh_token }`. Devuelve `{ user, session }`. */
export const POST: APIRoute = async (ctx) => {
  const body = await readJson<{ refresh_token?: string }>(ctx.request);
  if (!body?.refresh_token) return error('refresh_token requerido', 400);

  const { data, error: e } = await gotrue<GoTrueSession>(
    getEnv(ctx.locals),
    'token?grant_type=refresh_token',
    { method: 'POST', body: { refresh_token: body.refresh_token } },
    'auth/refresh'
  );
  if (e) return fail(e);

  return json({ user: data?.user ?? null, session: data });
};
