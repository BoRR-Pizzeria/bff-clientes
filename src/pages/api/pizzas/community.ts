import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest } from '@/lib/supabase';
import { json, fail } from '@/lib/http';
import { withCache } from '@/lib/cache';

export const prerender = false;

const COLUMNS = 'id,name,base_id,size,recipe,tags,preview_url,price_cents,created_at,author_username';

interface CommunityRow {
  author_username: string | null;
  [k: string]: unknown;
}

/**
 * Feed público de pizzas de usuarios. Lee la vista `pizzas_community_feed`
 * (BSBORR migración 0006), que ya trae `price_cents` calculado y el autor
 * (`author_username`, join a `profiles_public`) — adiós al merge de perfiles y a
 * los queries extra de catálogo que hacía antes el BFF.
 *
 * Se remapea `author_username` → `profiles: { username }` para no cambiar el
 * contrato que ya consume el front.
 */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const { data, error } = await rest<CommunityRow[]>(
      getEnv(ctx.locals),
      `pizzas_community_feed?select=${COLUMNS}&order=created_at.desc&limit=30`,
      {},
      'pizzas/community'
    );
    if (error) return fail(error);

    const pizzas = (data ?? []).map(({ author_username, ...rest }) => ({
      ...rest,
      profiles: author_username ? { username: author_username } : null,
    }));

    return json(
      { pizzas },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } }
    );
  });
