import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { rpc } from '@/lib/supabase';
import { json, error, getBearer, readJson, fail } from '@/lib/http';

export const prerender = false;

const OrderItemSchema = z.object({
  pizza_id: z.string().uuid().nullable().optional(),
  qty: z.number().int().positive().max(99),
  // snapshot del recipe al momento de pedir; el back calcula el precio desde acá.
  recipe_snapshot: z.unknown(),
});

const OrderSchema = z.object({
  shop_id: z.string().uuid(),
  address_id: z.string().uuid().nullable().optional(),
  // El enum real vive en la DB; un valor inválido devuelve error desde el RPC.
  payment_method: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(OrderItemSchema).min(1).max(50),
});

/**
 * Crea un pedido vía el RPC transaccional `place_order` (BSBORR migración 0006):
 * inserta orders + order_items en una sola transacción y calcula
 * `unit_price_cents` server-side desde cada `recipe_snapshot` (no confía en el
 * cliente). Funciona con usuario logueado o anónimo (su JWT tiene role=authenticated).
 */
export const POST: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const body = await readJson<unknown>(ctx.request);
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return error(`Pedido inválido: ${parsed.error.issues[0]?.message ?? 'desconocido'}`, 422);
  }

  const { shop_id, address_id, payment_method, notes, items } = parsed.data;

  const { data, error: e } = await rpc<string>(
    getEnv(ctx.locals),
    'place_order',
    {
      p_shop_id: shop_id,
      p_address_id: address_id ?? null,
      p_payment_method: payment_method ?? null,
      p_notes: notes ?? null,
      p_items: items,
    },
    { jwt },
    'orders/create'
  );
  if (e) return fail(e);
  if (!data) return error('No se pudo crear el pedido.', 500);

  return json({ id: data }, { status: 201 });
};
