import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest } from '@/lib/supabase';
import { json, fail } from '@/lib/http';
import { withCache } from '@/lib/cache';

export const prerender = false;

/**
 * Sucursales activas. Público y cacheable. El front lo usa para resolver el
 * `shop_id` del pedido (antes no había forma de obtener una sucursal desde el BFF).
 */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const { data, error } = await rest<unknown[]>(
      getEnv(ctx.locals),
      'shops?active=eq.true&select=id,name,address&order=name.asc',
      {},
      'shops'
    );
    if (error) return fail(error);

    return json(
      { shops: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
    );
  });
