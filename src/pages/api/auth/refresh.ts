import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, readJson } from '@/lib/http';

export const prerender = false;

/** Refresca la sesión. Body: `{ refresh_token }`. Devuelve `{ user, session }`. */
export const POST: APIRoute = async (ctx) => {
  const body = await readJson<{ refresh_token?: string }>(ctx.request);
  if (!body?.refresh_token) return error('refresh_token requerido', 400);

  const supabase = anonClient(getEnv(ctx.locals));
  const { data, error: e } = await supabase.auth.refreshSession({
    refresh_token: body.refresh_token,
  });
  if (e) return error(e.message, 401);

  return json({ user: data.user, session: data.session });
};
