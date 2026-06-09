import { defineMiddleware } from 'astro:middleware';
import { getEnv } from '@/lib/env';

/**
 * CORS para que el front (FFBORR, otro origen) pueda llamar al BFF.
 * Usamos Bearer tokens (no cookies), así que no hace falta allow-credentials.
 * El origen permitido sale de FRONT_ORIGIN (runtime de Cloudflare).
 */
export const onRequest = defineMiddleware(async (ctx, next) => {
  let origin = '*';
  try {
    origin = getEnv(ctx.locals).FRONT_ORIGIN;
  } catch {
    origin = '*';
  }

  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin !== '*') cors['Vary'] = 'Origin';

  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const res = await next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
});
