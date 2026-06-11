import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, supabaseError } from '@/lib/http';
import { withCache } from '@/lib/cache';

export const prerender = false;

/** Catálogo de ingredientes activos. Público y muy cacheable. */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const supabase = anonClient(getEnv(ctx.locals));
    const { data, error: e } = await supabase
      .from('ingredients')
      .select('id, name, category, color, price_cents, unit, step, default_qty, is_base, active')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (e) return supabaseError(e, 'ingredients');

    return json(
      { ingredients: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } }
    );
  });
