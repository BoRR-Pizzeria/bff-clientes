import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { userClient } from '@/lib/supabase';
import { json, error, getBearer, readJson, supabaseError } from '@/lib/http';
import { RecipeSchema } from '@/lib/recipe';

export const prerender = false;

/**
 * Crea una pizza del usuario autenticado a partir de un Recipe validado.
 * `is_public` arranca en false — la publicación se hace luego con PATCH.
 * Body: `{ recipe: Recipe }`.
 */
export const POST: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const body = await readJson<{ recipe?: unknown }>(ctx.request);
  if (!body) return error('JSON inválido', 400);

  const parsed = RecipeSchema.safeParse(body.recipe);
  if (!parsed.success) {
    return error(`Recipe inválido: ${parsed.error.issues[0]?.message ?? 'desconocido'}`, 422);
  }

  const supabase = userClient(getEnv(ctx.locals), jwt);
  const { data: userData } = await supabase.auth.getUser(jwt);
  if (!userData.user) return error('Sesión inválida', 401);

  const { data, error: e } = await supabase
    .from('pizzas')
    .insert({
      user_id: userData.user.id,
      origin: 'user',
      is_public: false,
      recipe: parsed.data,
      base_id: parsed.data.baseId,
      size: parsed.data.size,
    })
    .select('id')
    .single();

  if (e) return supabaseError(e, 'pizzas/create');
  if (!data) return error('No se pudo guardar la pizza.', 500);

  return json({ id: data.id }, { status: 201 });
};
