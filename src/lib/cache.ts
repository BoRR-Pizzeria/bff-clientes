import type { APIContext } from 'astro';

/**
 * Cache nativa de Cloudflare Workers (`caches.default`). Tipamos lo mínimo acá
 * para no acoplarnos a @cloudflare/workers-types ni chocar con el lib DOM.
 */
interface WorkersCache {
  match(req: Request | string): Promise<Response | undefined>;
  put(req: Request | string, res: Response): Promise<void>;
  delete(req: Request | string): Promise<boolean>;
}
interface WorkersCacheStorage {
  default: WorkersCache;
}
interface CfRuntime {
  caches?: WorkersCacheStorage;
  ctx?: { waitUntil(p: Promise<unknown>): void };
}

function runtime(locals: APIContext['locals']): CfRuntime | undefined {
  return locals?.runtime as unknown as CfRuntime | undefined;
}

/** Clave de cache estable a partir de una URL (sólo GET). */
function keyFor(url: string): Request {
  return new Request(url, { method: 'GET' });
}

/**
 * Envuelve un handler GET con la Cache API:
 *  - Sólo cachea GET sin `Authorization` (jamás respuestas user-scoped).
 *  - En HIT devuelve del edge; en MISS corre el handler y, si trae `Cache-Control`,
 *    lo guarda con `waitUntil` (sin bloquear la respuesta).
 */
export async function withCache(
  ctx: APIContext,
  handler: () => Promise<Response>
): Promise<Response> {
  const { request } = ctx;
  const rt = runtime(ctx.locals);
  const cacheable =
    request.method === 'GET' && !request.headers.get('Authorization') && !!rt?.caches;

  if (!cacheable || !rt?.caches) return handler();

  const cache = rt.caches.default;
  const key = keyFor(request.url);

  const hit = await cache.match(key);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set('CF-Cache-Status', 'HIT');
    return res;
  }

  const res = await handler();
  if (res.ok && res.headers.get('Cache-Control')) {
    const toStore = res.clone();
    if (rt.ctx?.waitUntil) rt.ctx.waitUntil(cache.put(key, toStore));
    else await cache.put(key, toStore);
  }
  res.headers.set('CF-Cache-Status', 'MISS');
  return res;
}

/**
 * Invalida una ruta cacheada (p.ej. `/api/pizzas/community` tras publicar).
 * Nota: la Cache API borra por data center, no global.
 */
export async function purge(ctx: APIContext, path: string): Promise<void> {
  const rt = runtime(ctx.locals);
  if (!rt?.caches) return;
  const origin = new URL(ctx.request.url).origin;
  await rt.caches.default.delete(keyFor(origin + path));
}
