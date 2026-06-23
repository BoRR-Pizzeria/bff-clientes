import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest, jwtSub } from '@/lib/supabase';
import { json, error, getBearer, readJson, fail } from '@/lib/http';
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

  const sub = jwtSub(jwt);
  if (!sub) return error('Sesión inválida', 401);

  const body = await readJson<{ recipe?: unknown }>(ctx.request);
  if (!body) return error('JSON inválido', 400);

  const parsed = RecipeSchema.safeParse(body.recipe);
  if (!parsed.success) {
    return error(`Recipe inválido: ${parsed.error.issues[0]?.message ?? 'desconocido'}`, 422);
  }

  const { data, error: e } = await rest<{ id: string }[]>(
    getEnv(ctx.locals),
    'pizzas?select=id',
    {
      method: 'POST',
      jwt,
      prefer: 'return=representation',
      body: {
        user_id: sub,
        origin: 'user',
        is_public: false,
        recipe: parsed.data,
        base_id: parsed.data.baseId,
        size: parsed.data.size,
      },
    },
    'pizzas/create'
  );
  if (e) return fail(e);

  const id = data?.[0]?.id;
  if (!id) return error('No se pudo guardar la pizza.', 500);

  return json({ id }, { status: 201 });
};
