import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import type { BffEnv } from '@/lib/env';

// El BFF no persiste sesión: cada request trae (o no) su propio JWT.
const AUTH_OPTS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Cliente anónimo — para reads públicos (RLS permite `anon`). */
export function anonClient(env: BffEnv): SupabaseClient<Database> {
  return createClient<Database>(
    env.PUBLIC_SUPABASE_URL,
    env.PUBLIC_SUPABASE_ANON_KEY,
    AUTH_OPTS
  );
}

/**
 * Cliente con el JWT del usuario reenviado en `Authorization`.
 * No usamos service-role: RLS sigue aplicando como ese usuario.
 */
export function userClient(env: BffEnv, jwt: string): SupabaseClient<Database> {
  return createClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    ...AUTH_OPTS,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
