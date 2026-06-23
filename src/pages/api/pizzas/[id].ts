import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/env';
import { rest } from '@/lib/supabase';
import { json, error, getBearer, readJson, fail } from '@/lib/http';
import { withCache, purge } from '@/lib/cache';
import { RecipeSchema } from '@/lib/recipe';

export const prerender = false;

interface PizzaRow {
  id: string;
  name: string | null;
  recipe: unknown;
  is_public: boolean;
}

/**
 * Lee una pizza por id. Con Bearer, RLS deja ver la privada propia; sin token,
 * sólo públicas. Sólo se cachea la respuesta pública (withCache ignora Authorization).
 */
export const GET: APIRoute = (ctx) =>
  withCache(ctx, async () => {
    const id = ctx.params.id;
    if (!id) return error('id requerido', 400);

    const jwt = getBearer(ctx.request);
    const { data, error: e } = await rest<PizzaRow[]>(
      getEnv(ctx.locals),
      `pizzas?id=eq.${id}&select=id,name,recipe,is_public&limit=1`,
      { jwt },
      'pizzas/[id] GET'
    );
    if (e) return fail(e);

    const row = data?.[0];
    if (!row) return error('No se encontró la pizza.', 404);

    const parsed = RecipeSchema.safeParse(row.recipe);
    if (!parsed.success) {
      return error(`Recipe inválido: ${parsed.error.issues[0]?.message ?? 'unknown'}`, 422);
    }

    const init = row.is_public
      ? { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } }
      : undefined;

    return json(
      { pizza: { id: row.id, name: row.name, recipe: parsed.data, is_public: row.is_public } },
      init
    );
  });

/**
 * Actualiza metadata editable (name/tags) y/o `is_public`. Si cambia la
 * visibilidad, purga el feed community (puede haber aparecido/desaparecido).
 * Body: `{ name?, tags?, is_public? }`.
 */
export const PATCH: APIRoute = async (ctx) => {
  const id = ctx.params.id;
  if (!id) return error('id requerido', 400);

  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const body = await readJson<{ name?: string; tags?: string[]; is_public?: boolean }>(ctx.request);
  if (!body) return error('JSON inválido', 400);

  const patch: { name?: string; tags?: string[]; is_public?: boolean } = {};
  if (typeof body.name === 'string') patch.name = body.name;
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (typeof body.is_public === 'boolean') patch.is_public = body.is_public;
  if (Object.keys(patch).length === 0) return error('Nada para actualizar', 400);

  const { error: e } = await rest(
    getEnv(ctx.locals),
    `pizzas?id=eq.${id}`,
    { method: 'PATCH', jwt, prefer: 'return=minimal', body: patch },
    'pizzas/[id] PATCH'
  );
  if (e) return fail(e);

  if (typeof patch.is_public === 'boolean') {
    await purge(ctx, '/api/pizzas/community');
  }

  return json({ ok: true });
};
