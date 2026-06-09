import { z } from 'zod';

/**
 * Recipe v2 — modelo basado en el diseño BoRR.
 *
 * Una receta es una lista ordenada de items. Cada item es:
 *  - `kind: 'ing'` con `ingredientId` + `qty` (y opcionalmente `unit: 'g'`)
 *  - `kind: 'stage'` el divisor del horno: lo que está antes (más arriba en
 *     la lista visual) se cocina; lo que está después se agrega al final.
 *
 * El orden semántico es:
 *  - índice 0 = items "frescos" agregados después del horno
 *  - el `stage` divide la lista
 *  - índices después del stage = se cocinan
 *
 * (Coincide con cómo el editor del diseño los muestra: "lo de abajo del horno
 *  va antes de la cocción · arriba, se agrega al final".)
 */

export const IngItemSchema = z.object({
  kind: z.literal('ing'),
  ingredientId: z.string(),
  qty: z.number().positive().max(2000),
  unit: z.enum(['unit', 'g']).optional(),
});

export const StageItemSchema = z.object({
  kind: z.literal('stage'),
});

export const RecipeItemSchema = z.discriminatedUnion('kind', [
  IngItemSchema,
  StageItemSchema,
]);

export const RecipeSchema = z.object({
  baseId: z.string(),
  size: z.enum(['S', 'M', 'L']),
  items: z.array(RecipeItemSchema).max(50),
  version: z.literal(2),
});

export type IngItem = z.infer<typeof IngItemSchema>;
export type StageItem = z.infer<typeof StageItemSchema>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;

export const DEFAULT_BASE = 'classic';

export function newRecipe(): Recipe {
  return {
    baseId: DEFAULT_BASE,
    size: 'M',
    items: [
      { kind: 'stage' },
      { kind: 'ing', ingredientId: 'mozza', qty: 1 },
      { kind: 'ing', ingredientId: 'salsa', qty: 1 },
    ],
    version: 2,
  };
}
