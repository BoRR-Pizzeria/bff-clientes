import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { gotrue } from '@/lib/supabase';
import { json, fail } from '@/lib/http';

export const prerender = false;

interface GoTrueSession {
  user?: unknown;
  [k: string]: unknown;
}

/**
 * Sign-in anónimo. GoTrue lo expone como un `signup` con body vacío y devuelve
 * una sesión para un usuario con `is_anonymous=true` (auth.uid() real). Habilita
 * pedir sin login: el front llama acá y usa el JWT resultante para `POST /api/orders`.
 *
 * Requiere `enable_anonymous_sign_ins=true` en Supabase (config.toml local; en
 * cloud, Auth → Providers → Anonymous). Si está deshabilitado, GoTrue responde 422.
 */
export const POST: APIRoute = async (ctx) => {
  const { data, error: e } = await gotrue<GoTrueSession>(
    getEnv(ctx.locals),
    'signup',
    { method: 'POST', body: {} },
    'auth/anon'
  );
  if (e) return fail(e);

  return json({ user: data?.user ?? null, session: data });
};
