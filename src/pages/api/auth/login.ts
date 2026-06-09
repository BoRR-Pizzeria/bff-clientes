import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, readJson } from '@/lib/http';

export const prerender = false;

/** Login. Body: `{ email, password }`. Devuelve `{ user, session }`. */
export const POST: APIRoute = async (ctx) => {
  const body = await readJson<{ email?: string; password?: string }>(ctx.request);
  if (!body?.email || !body?.password) return error('email y password requeridos', 400);

  const supabase = anonClient(getEnv(ctx.locals));
  const { data, error: e } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (e) return error(e.message, 400);

  return json({ user: data.user, session: data.session });
};
