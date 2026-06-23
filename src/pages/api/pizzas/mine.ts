import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest, jwtSub } from '@/lib/supabase';
import { json, error, getBearer, fail } from '@/lib/http';
import { RecipeSchema, type Recipe } from '@/lib/recipe';

export const prerender = false;

const FALLBACK_RECIPE: Recipe = { baseId: 'classic', size: 'M', items: [], version: 2 };

interface MineRow {
  recipe: unknown;
  [k: string]: unknown;
}

/** Pizzas del usuario autenticado (públicas y privadas; RLS las acota al dueño). */
export const GET: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const sub = jwtSub(jwt);
  if (!sub) return error('Sesión inválida', 401);

  const { data, error: e } = await rest<MineRow[]>(
    getEnv(ctx.locals),
    `pizzas?user_id=eq.${sub}&deleted_at=is.null&select=id,name,base_id,size,tags,preview_url,is_public,recipe,created_at&order=created_at.desc&limit=30`,
    { jwt },
    'pizzas/mine'
  );
  if (e) return fail(e);

  const pizzas = (data ?? []).map((p) => {
    const parsed = RecipeSchema.safeParse(p.recipe);
    return { ...p, recipe: parsed.success ? parsed.data : FALLBACK_RECIPE };
  });

  return json({ pizzas });
};
