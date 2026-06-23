import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { gotrue } from '@/lib/supabase';
import { json, error, getBearer } from '@/lib/http';

export const prerender = false;

/** Whoami: valida el Bearer contra GoTrue y devuelve `{ user }`. */
export const GET: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const { data, error: e } = await gotrue<unknown>(
    getEnv(ctx.locals),
    'user',
    { method: 'GET', jwt },
    'auth/session'
  );
  if (e || !data) return error('Sesión inválida', 401);

  return json({ user: data });
};
