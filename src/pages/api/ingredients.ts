import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest } from '@/lib/supabase';
import { json, fail } from '@/lib/http';
import { withCache } from '@/lib/cache';

export const prerender = false;

/** Catálogo de ingredientes activos. Público y muy cacheable. */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const { data, error } = await rest<unknown[]>(
      getEnv(ctx.locals),
      'ingredients?select=id,name,category,color,price_cents,unit,step,default_qty,is_base,active&active=eq.true&order=category.asc,name.asc',
      {},
      'ingredients'
    );
    if (error) return fail(error);

    return json(
      { ingredients: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } }
    );
  });
