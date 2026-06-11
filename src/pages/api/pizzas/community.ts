import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { anonClient } from '@/lib/supabase';
import { json, error, supabaseError } from '@/lib/http';
import { withCache } from '@/lib/cache';
import { enrichPizzas } from '@/lib/borr/pricing';

export const prerender = false;

/**
 * Feed público de pizzas de usuarios.
 *
 * `pizzas.user_id` referencia `auth.users(id)`, no `public.profiles(id)`, así que
 * PostgREST no puede embeber `profiles(...)` (PGRST200). Se resuelve con un segundo
 * query a la view `profiles_public` por los user_ids del batch y merge en memoria.
 */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const supabase = anonClient(getEnv(ctx.locals));

    const [pizzasRes, basesRes, ingsRes] = await Promise.all([
      supabase
        .from('pizzas')
        .select('id, name, base_id, size, recipe, tags, preview_url, created_at, user_id')
        .eq('origin', 'user')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('pizza_bases').select('id, price_cents'),
      supabase.from('ingredients').select('id, price_cents, unit'),
    ]);

    if (pizzasRes.error || basesRes.error || ingsRes.error) {
      return supabaseError(
        pizzasRes.error ?? basesRes.error ?? ingsRes.error,
        'pizzas/community'
      );
    }

    const userIds = Array.from(
      new Set((pizzasRes.data ?? []).map((p) => p.user_id).filter((id): id is string => !!id))
    );

    const profileMap = new Map<string, { username: string }>();
    if (userIds.length > 0) {
      // `profiles_public` (view, migración 0005) todavía no está en los types generados.
      const fromAny = supabase.from.bind(supabase) as unknown as (
        table: string
      ) => ReturnType<typeof supabase.from>;
      const { data: profs } = (await fromAny('profiles_public')
        .select('id, username')
        .in('id', userIds)) as { data: { id: string; username: string }[] | null };
      for (const p of profs ?? []) profileMap.set(p.id, { username: p.username });
    }

    const withProfiles = (pizzasRes.data ?? []).map((p) => ({
      ...p,
      profiles: p.user_id ? profileMap.get(p.user_id) ?? null : null,
    }));

    const pizzas = enrichPizzas(withProfiles, basesRes.data ?? [], ingsRes.data ?? []);

    return json(
      { pizzas },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } }
    );
  });
