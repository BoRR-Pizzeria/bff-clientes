import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { userClient } from '@/lib/supabase';
import { json, error, getBearer, readJson, supabaseError } from '@/lib/http';
import type { Database } from '@/types/db';

export const prerender = false;

const OrderItemSchema = z.object({
  pizza_id: z.string().uuid().nullable().optional(),
  qty: z.number().int().positive().max(99),
  unit_price_cents: z.number().int().nonnegative(),
  // snapshot del recipe al momento de pedir (la DB lo guarda como Json)
  recipe_snapshot: z.unknown(),
});

const OrderSchema = z.object({
  shop_id: z.string().uuid(),
  address_id: z.string().uuid().nullable().optional(),
  // El enum real vive en la DB; se valida allá (un valor inválido devuelve error).
  payment_method: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(OrderItemSchema).min(1).max(50),
});

type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

/**
 * Crea un pedido + sus items. Totales (`total_cents`, `line_total_cents`) los
 * completan triggers en la DB. RLS exige `user_id = auth.uid()`.
 *
 * NOTA: endpoint listo en el BFF pero todavía sin UI de carrito en el front.
 */
export const POST: APIRoute = async (ctx) => {
  const jwt = getBearer(ctx.request);
  if (!jwt) return error('No autenticado', 401);

  const body = await readJson<unknown>(ctx.request);
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return error(`Pedido inválido: ${parsed.error.issues[0]?.message ?? 'desconocido'}`, 422);
  }

  const supabase = userClient(getEnv(ctx.locals), jwt);
  const { data: userData } = await supabase.auth.getUser(jwt);
  if (!userData.user) return error('Sesión inválida', 401);

  const { items, ...header } = parsed.data;
  const subtotal = items.reduce((s, it) => s + it.unit_price_cents * it.qty, 0);

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .insert({
      user_id: userData.user.id,
      shop_id: header.shop_id,
      address_id: header.address_id ?? null,
      payment_method: (header.payment_method ?? null) as PaymentMethod | null,
      notes: header.notes ?? null,
      subtotal_cents: subtotal,
    })
    .select('id')
    .single();

  if (oErr) return supabaseError(oErr, 'orders/create');
  if (!order) return error('No se pudo crear el pedido.', 500);

  const rows: OrderItemInsert[] = items.map((it) => ({
    order_id: order.id,
    pizza_id: it.pizza_id ?? null,
    qty: it.qty,
    unit_price_cents: it.unit_price_cents,
    recipe_snapshot: it.recipe_snapshot as OrderItemInsert['recipe_snapshot'],
  }));

  const { error: iErr } = await supabase.from('order_items').insert(rows);
  if (iErr) return supabaseError(iErr, 'orders/items');

  return json({ id: order.id }, { status: 201 });
};
