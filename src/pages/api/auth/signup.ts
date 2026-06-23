import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { gotrue } from '@/lib/supabase';
import { json, error, readJson, fail } from '@/lib/http';

export const prerender = false;

interface GoTrueSignup {
  access_token?: string;
  user?: unknown;
  [k: string]: unknown;
}

/**
 * Registro. Body: `{ email, password }`. Devuelve `{ user, session }`.
 * Con confirmación de email activada, GoTrue devuelve el user sin access_token
 * (session: null); sin confirmación, devuelve la sesión completa.
 */
export const POST: APIRoute = async (ctx) => {
  const body = await readJson<{ email?: string; password?: string }>(ctx.request);
  if (!body?.email || !body?.password) return error('email y password requeridos', 400);

  const { data, error: e } = await gotrue<GoTrueSignup>(
    getEnv(ctx.locals),
    'signup',
    { method: 'POST', body: { email: body.email, password: body.password } },
    'auth/signup'
  );
  if (e) return fail(e);

  const hasSession = typeof data?.access_token === 'string';
  return json({ user: hasSession ? data?.user : data, session: hasSession ? data : null });
};
