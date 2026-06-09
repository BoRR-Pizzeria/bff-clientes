import type { Database } from '@/types/db';
import type { Recipe, RecipeItem } from '@/lib/recipe';

type PizzaRow = Pick<
  Database['public']['Tables']['pizzas']['Row'],
  'id' | 'name' | 'base_id' | 'size' | 'recipe' | 'tags' | 'preview_url'
>;
type BaseRow = Pick<Database['public']['Tables']['pizza_bases']['Row'], 'id' | 'price_cents'>;
type IngRow = Pick<
  Database['public']['Tables']['ingredients']['Row'],
  'id' | 'price_cents' | 'unit'
>;

export interface EnrichedPizza {
  id: string;
  name: string | null;
  base_id: string | null;
  size: 'S' | 'M' | 'L';
  tags: string[];
  preview_url: string | null;
  recipe: Recipe;
  price_cents: number;
}

/**
 * Calcula el precio de una receta sumando: base + cada ítem (qty × price unitario).
 * Para `unit='g'`, el precio del ingrediente es por 100g, así que se divide.
 */
export function computePriceCents(
  recipe: Recipe,
  baseById: Map<string, BaseRow>,
  ingById: Map<string, IngRow>
): number {
  let total = 0;

  const base = baseById.get(recipe.baseId);
  if (base) total += base.price_cents;

  for (const it of recipe.items as RecipeItem[]) {
    if (it.kind !== 'ing') continue;
    const ing = ingById.get(it.ingredientId);
    if (!ing) continue;
    if (ing.unit === 'g') {
      total += Math.round((ing.price_cents * it.qty) / 100);
    } else {
      total += ing.price_cents * it.qty;
    }
  }

  return total;
}

export function enrichPizzas<T extends PizzaRow & { profiles?: unknown }>(
  pizzas: T[],
  bases: BaseRow[],
  ings: IngRow[]
): (Omit<T, 'recipe'> & { recipe: Recipe; price_cents: number })[] {
  const baseById = new Map(bases.map((b) => [b.id, b]));
  const ingById = new Map(ings.map((i) => [i.id, i]));

  return pizzas.map((p) => {
    const recipe = (p.recipe ?? { baseId: 'classic', size: 'M', items: [], version: 2 }) as Recipe;
    return {
      ...p,
      recipe,
      price_cents: computePriceCents(recipe, baseById, ingById),
    };
  });
}
