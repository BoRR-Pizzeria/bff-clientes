# BFFBORR — Backend For Frontend (gateway Cloudflare)

Gateway del ecosistema **BoRR** sobre **Cloudflare Pages + Workers**. **Todo** el tráfico del front pasa por acá: expone sólo endpoints de cliente, reenvía el JWT del usuario a Supabase (RLS intacto) y **maneja la cache** de forma nativa (Cache API).

Parte del split en 3 repos:
- **FFBORR** — front (Astro + React islands), llama a este BFF.
- **BFFBORR** — este repo (gateway).
- **BSBORR** — backend Supabase (schema/RLS/migraciones).

## Stack

Astro 5 (`output: 'server'`) + `@astrojs/cloudflare`. API pura: sin UI. Endpoints en `src/pages/api/*`.

## Endpoints

### Públicos (anon, cacheados con Cache API)
| Método | Ruta | Cache (s-maxage/SWR) |
|---|---|---|
| GET | `/api/health` | — |
| GET | `/api/ingredients` | 600 / 3600 |
| GET | `/api/pizzas/house` | 300 / 3600 |
| GET | `/api/pizzas/community` | 60 / 600 (purga al publicar) |
| GET | `/api/pizzas/:id` | 120 / 600 (sólo si es pública) |

### Auth (proxy a Supabase Auth)
`POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/refresh` · `GET /api/auth/session`

Login/refresh devuelven `{ user, session }`. El front guarda `session.access_token`/`refresh_token` y manda `Authorization: Bearer <access_token>` en el resto.

### User-scoped (requieren `Authorization: Bearer`)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/pizzas/mine` | pizzas del usuario |
| POST | `/api/pizzas` | crea pizza (valida `RecipeSchema`) |
| PATCH | `/api/pizzas/:id` | nombre/tags y/o `is_public` (purga cache community) |
| POST | `/api/orders` | crea pedido + items (totales los completan triggers DB) |

> `POST /api/orders` está implementado pero aún sin UI de carrito en el front (TODO de producto).

## Cache

Se usa la **Cache API** de Workers (`caches.default`) vía `src/lib/cache.ts`:
- Sólo cachea `GET` **sin** `Authorization`.
- Respeta el `Cache-Control` (`s-maxage`) que pone cada handler.
- `purge()` invalida el feed `community` cuando se publica/despublica una pizza.
- Limitación: el borrado de Cache API es por data center; el `s-maxage` corto acota el staleness. Mejora futura: cache-tags / versión en KV para purga global.

## Desarrollo

```bash
npm install
cp .env.example .env        # PUBLIC_SUPABASE_*  (inlineadas por Astro)
cp .env.example .dev.vars   # mismas vars para el runtime CF en dev (opcional)
npm run dev                 # http://localhost:4321
```

CORS: el origen permitido sale de `FRONT_ORIGIN` (wrangler `vars` / Pages env).

## Deploy

```bash
npm run deploy   # astro build + wrangler pages deploy ./dist
```

Setear en Pages → Settings → Environment variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `FRONT_ORIGIN` (origen real del front).
