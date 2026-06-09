import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, getBearer } from '@/lib/http';

export const prerender = false;

/** Whoami: valida el Bearer y devuelve `{ user }`. */
export const GET: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const supabase = anonClient(getEnv(ctx.locals));
  const { data, error: e } = await supabase.auth.getUser(jwt);
  if (e || !data.user) return error('Sesión inválida', 401);

  return json({ user: data.user });
};
