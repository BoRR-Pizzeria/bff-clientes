/** Helpers de respuesta JSON y extracción de auth para los endpoints. */

import type { SanitizedError } from './errors';

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

/** Extrae el access_token de `Authorization: Bearer <token>`. */
export function getBearer(request: Request): string | null {
  const h = request.headers.get('Authorization');
  if (!h) return null;
  const [scheme, token] = h.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/** Parsea el body JSON, devolviendo null si es inválido. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Convierte un `SanitizedError` del cliente Supabase en una Response. */
export function fail(e: SanitizedError): Response {
  return error(e.message, e.status);
}
