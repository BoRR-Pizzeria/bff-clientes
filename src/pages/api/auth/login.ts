import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { gotrue } from '@/lib/supabase';
import { json, error, readJson, fail } from '@/lib/http';

export const prerender = false;

interface GoTrueSession {
  access_token?: string;
  user?: unknown;
  [k: string]: unknown;
}

/** Login. Body: `{ email, password }`. Devuelve `{ user, session }`. */
export const POST: APIRoute = async (ctx) => {
  const body = await readJson<{ email?: string; password?: string }>(ctx.request);
  if (!body?.email || !body?.password) return error('email y password requeridos', 400);

  const { data, error: e } = await gotrue<GoTrueSession>(
    getEnv(ctx.locals),
    'token?grant_type=password',
    { method: 'POST', body: { email: body.email, password: body.password } },
    'auth/login'
  );
  if (e) return fail(e);

  return json({ user: data?.user ?? null, session: data });
};
