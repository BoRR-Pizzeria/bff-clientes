/**
 * Cliente HTTP fino contra Supabase, sin `@supabase/supabase-js`.
 *
 * El BFF corre en Cloudflare Workers y sólo necesita hablar tres superficies de
 * Supabase por `fetch`: PostgREST (`/rest/v1`), RPC (`/rest/v1/rpc`) y GoTrue
 * (`/auth/v1`). Mantenerlo en `fetch` plano evita arrastrar el SDK (más liviano,
 * más Cloudflare-native) y deja explícito cada request.
 *
 * Cada llamada manda `apikey` + `Authorization: Bearer <jwt ?? anon>`; la RLS de
 * Supabase sigue siendo la autoridad. Los errores se sanitizan con el mismo
 * `sanitizeSupabaseError` que ya se usaba, así el cliente nunca ve detalles de
 * Postgres/GoTrue.
 */

import type { BffEnv } from '@/lib/env';
import { sanitizeSupabaseError, type SanitizedError } from '@/lib/errors';

export interface SbResult<T> {
  data: T | null;
  error: SanitizedError | null;
}

interface RestOpts {
  jwt?: string | null;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Header `Prefer` de PostgREST (p.ej. `return=representation`). */
  prefer?: string;
}

function baseHeaders(env: BffEnv, jwt?: string | null): Record<string, string> {
  return {
    apikey: env.PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${jwt ?? env.PUBLIC_SUPABASE_ANON_KEY}`,
  };
}

/** Lee el body de error (PostgREST o GoTrue) y lo convierte en SanitizedError. */
async function toError(res: Response, context: string): Promise<SanitizedError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* sin body JSON */
  }
  console.error(`[${context}]`, res.status, body);
  const b = (body ?? {}) as Record<string, unknown>;
  // PostgREST: { code, message, details, hint }. GoTrue: { msg | error_description | error, code }.
  const code = typeof b.code === 'string' ? b.code : undefined;
  const message =
    (b.message as string) ??
    (b.msg as string) ??
    (b.error_description as string) ??
    (b.error as string) ??
    '';
  const sanitized = sanitizeSupabaseError({ code, message });
  // Si el mapeo no reconoció nada pero el status HTTP es informativo, conservarlo.
  if (sanitized.status === 500 && res.status >= 400 && res.status < 500) {
    return { message: sanitized.message, status: res.status };
  }
  return sanitized;
}

/** Request a PostgREST. `path` ya incluye la query (`tabla?select=...`). */
export async function rest<T = unknown>(
  env: BffEnv,
  path: string,
  opts: RestOpts = {},
  context = 'rest'
): Promise<SbResult<T>> {
  const headers = baseHeaders(env, opts.jwt);
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.prefer) headers['Prefer'] = opts.prefer;

  let res: Response;
  try {
    res = await fetch(`${env.PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    console.error(`[${context}] fetch`, e);
    return { data: null, error: { message: 'No se pudo conectar con la base.', status: 502 } };
  }

  if (!res.ok) return { data: null, error: await toError(res, context) };
  if (res.status === 204) return { data: null, error: null };
  return { data: (await res.json()) as T, error: null };
}

/** Llama un RPC de Postgres (`/rest/v1/rpc/<fn>`). */
export function rpc<T = unknown>(
  env: BffEnv,
  fn: string,
  args: Record<string, unknown>,
  opts: { jwt?: string | null } = {},
  context = `rpc/${fn}`
): Promise<SbResult<T>> {
  return rest<T>(env, `rpc/${fn}`, { method: 'POST', body: args, jwt: opts.jwt }, context);
}

/** Request a GoTrue (`/auth/v1/...`). */
export async function gotrue<T = unknown>(
  env: BffEnv,
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT'; jwt?: string | null; body?: unknown } = {},
  context = 'auth'
): Promise<SbResult<T>> {
  const headers: Record<string, string> = { apikey: env.PUBLIC_SUPABASE_ANON_KEY };
  if (opts.jwt) headers['Authorization'] = `Bearer ${opts.jwt}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${env.PUBLIC_SUPABASE_URL}/auth/v1/${path}`, {
      method: opts.method ?? 'POST',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    console.error(`[${context}] fetch`, e);
    return { data: null, error: { message: 'No se pudo conectar con el servidor de auth.', status: 502 } };
  }

  if (!res.ok) return { data: null, error: await toError(res, context) };
  if (res.status === 204) return { data: null, error: null };
  return { data: (await res.json()) as T, error: null };
}

/**
 * Decodifica el claim `sub` (user id) de un JWT sin verificar la firma. La RLS de
 * Supabase sigue validando el token en cada query, así que acá sólo se usa para
 * filtrar (`user_id=eq.<sub>`) sin un round-trip extra a `/auth/v1/user`.
 */
export function jwtSub(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded)) as { sub?: string };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
