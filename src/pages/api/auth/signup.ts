import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, readJson, supabaseError } from '@/lib/http';

export const prerender = false;

/** Registro. Body: `{ email, password }`. Devuelve `{ user, session }`. */
export const POST: APIRoute = async (ctx) => {
  const body = await readJson<{ email?: string; password?: string }>(ctx.request);
  if (!body?.email || !body?.password) return error('email y password requeridos', 400);

  const supabase = anonClient(getEnv(ctx.locals));
  const { data, error: e } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
  });
  if (e) return supabaseError(e, 'auth/signup');

  return json({ user: data.user, session: data.session });
};
