import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, supabaseError } from '@/lib/http';
import { withCache } from '@/lib/cache';
import { enrichPizzas } from '@/lib/borr/pricing';

export const prerender = false;

/** Pizzas de la casa (origin='house', públicas). */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const supabase = anonClient(getEnv(ctx.locals));

    const [pizzasRes, basesRes, ingsRes] = await Promise.all([
      supabase
        .from('pizzas')
        .select('id, name, base_id, size, recipe, tags, preview_url')
        .eq('origin', 'house')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase.from('pizza_bases').select('id, price_cents'),
      supabase.from('ingredients').select('id, price_cents, unit'),
    ]);

    if (pizzasRes.error || basesRes.error || ingsRes.error) {
      return supabaseError(
        pizzasRes.error ?? basesRes.error ?? ingsRes.error,
        'pizzas/house'
      );
    }

    const pizzas = enrichPizzas(pizzasRes.data ?? [], basesRes.data ?? [], ingsRes.data ?? []);

    return json(
      { pizzas },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
    );
  });
