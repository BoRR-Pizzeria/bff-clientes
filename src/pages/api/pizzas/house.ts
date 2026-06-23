import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest } from '@/lib/supabase';
import { json, fail } from '@/lib/http';
import { withCache } from '@/lib/cache';

export const prerender = false;

const COLUMNS = 'id,name,base_id,size,recipe,tags,preview_url,price_cents';

/**
 * Pizzas de la casa. Lee la vista `pizzas_house_feed` (BSBORR migración 0006),
 * que ya filtra origin='house'/públicas/no borradas y calcula `price_cents` en
 * el back — el BFF sólo proxea una query.
 */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const { data, error } = await rest<unknown[]>(
      getEnv(ctx.locals),
      `pizzas_house_feed?select=${COLUMNS}&order=created_at.asc`,
      {},
      'pizzas/house'
    );
    if (error) return fail(error);

    return json(
      { pizzas: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
    );
  });
