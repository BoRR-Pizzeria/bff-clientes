import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { userClient } from '@/lib/supabase';
import { json, error, getBearer, supabaseError } from '@/lib/http';
import { RecipeSchema, type Recipe } from '@/lib/recipe';

export const prerender = false;

const FALLBACK_RECIPE: Recipe = { baseId: 'classic', size: 'M', items: [], version: 2 };

/** Pizzas del usuario autenticado (públicas y privadas; RLS las acota al dueño). */
export const GET: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const supabase = userClient(getEnv(ctx.locals), jwt);
  const { data: userData } = await supabase.auth.getUser(jwt);
  if (!userData.user) return error('Sesión inválida', 401);

  const { data, error: e } = await supabase
    .from('pizzas')
    .select('id, name, base_id, size, tags, preview_url, is_public, recipe, created_at')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(30);

  if (e) return supabaseError(e, 'pizzas/mine');

  const pizzas = (data ?? []).map((p) => {
    const parsed = RecipeSchema.safeParse(p.recipe);
    return { ...p, recipe: parsed.success ? parsed.data : FALLBACK_RECIPE };
  });

  return json({ pizzas });
};
