# BFFBORR — Backend For Frontend (gateway Cloudflare)

Gateway del ecosistema **BoRR** sobre **Cloudflare Pages + Workers**. **Todo** el tráfico del front pasa por acá: expone sólo endpoints de cliente, reenvía el JWT del usuario a Supabase (RLS intacto) y **maneja la cache** de forma nativa (Cache API).

Parte del split en 3 repos:
- **FFBORR** — front (Astro + React islands), llama a este BFF.
- **BFFBORR** — este repo (gateway).
- **BSBORR** — backend Supabase (schema/RLS/migraciones).

## Stack

Astro 5 (`output: 'server'`) + `@astrojs/cloudflare`. API pura: sin UI. Endpoints en `src/pages/api/*`.

**Sin `@supabase/supabase-js`**: el BFF habla con Supabase por `fetch` plano (PostgREST `/rest/v1`, RPC `/rest/v1/rpc`, GoTrue `/auth/v1`) vía `src/lib/supabase.ts` (`rest` / `rpc` / `gotrue` / `jwtSub`). Más liviano y Cloudflare-native; la RLS sigue siendo la autoridad.

## Endpoints

### Públicos (anon, cacheados con Cache API)
| Método | Ruta | Cache (s-maxage/SWR) |
|---|---|---|
| GET | `/api/health` | — |
| GET | `/api/ingredients` | 600 / 3600 |
| GET | `/api/shops` | 300 / 3600 |
| GET | `/api/pizzas/house` | 300 / 3600 |
| GET | `/api/pizzas/community` | 60 / 600 (purga al publicar) |
| GET | `/api/pizzas/:id` | 120 / 600 (sólo si es pública) |

`/api/pizzas/house` y `/api/pizzas/community` leen las vistas `pizzas_house_feed` / `pizzas_community_feed` (BSBORR 0006): `price_cents` y autor vienen calculados del back, el BFF sólo proxea una query.

### Auth (proxy a Supabase Auth)
`POST /api/auth/signup` · `POST /api/auth/anon` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/refresh` · `GET /api/auth/session`

Login/refresh/anon devuelven `{ user, session }`. El front guarda `session.access_token`/`refresh_token` y manda `Authorization: Bearer <access_token>` en el resto. `/api/auth/anon` crea una sesión anónima (Supabase anonymous sign-in) para pedir sin login.

### User-scoped (requieren `Authorization: Bearer`)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/pizzas/mine` | pizzas del usuario |
| POST | `/api/pizzas` | crea pizza (valida `RecipeSchema`) |
| PATCH | `/api/pizzas/:id` | nombre/tags y/o `is_public` (purga cache community) |
| POST | `/api/orders` | crea pedido vía RPC `place_order` (precio server-side, atómico) |

> `POST /api/orders` acepta usuario logueado **o anónimo** (el front hace `/api/auth/anon` antes de pedir). El cliente manda `{ shop_id, items:[{ pizza_id?, qty, recipe_snapshot }], notes? }`; el `unit_price_cents` lo calcula el back desde cada `recipe_snapshot`. La forma de pago queda como TODO (`payment_method` nullable).

## Cache

Se usa la **Cache API** de Workers (`caches.default`) vía `src/lib/cache.ts`:
- Sólo cachea `GET` **sin** `Authorization`.
- Respeta el `Cache-Control` (`s-maxage`) que pone cada handler.
- `purge()` invalida el feed `community` cuando se publica/despublica una pizza.
- Limitación: el borrado de Cache API es por data center; el `s-maxage` corto acota el staleness. Mejora futura: cache-tags / versión en KV para purga global.

## Desarrollo (malla ZeroTier)

Topología local sobre ZeroTier (IPs fijas):

```
Front 10.144.0.3:4322  ──PUBLIC_BFF_URL──►  BFF 10.144.0.2:8788  ──SUPABASE_URL──►  Supa 10.144.0.1:54321
   (FFBORR, astro dev)                     (este repo, wrangler)                  (supabase CLI: data+auth)
```

```bash
npm install
cp .env.example .env        # PUBLIC_SUPABASE_*  (inlineadas en astro build)
cp .env.example .dev.vars   # mismas vars para el runtime CF (wrangler)
npm run dev:zt              # astro build + wrangler pages dev ./dist --ip 0.0.0.0 --port 8788
```

`dev:zt` corre en el **runtime real de Cloudflare (workerd)**, así que el Cache API
(`caches.default`) funciona de verdad. `--ip 0.0.0.0` lo hace alcanzable en
`10.144.0.2:8788` desde la malla. Para iterar sin cache, `npm run dev` (astro dev, Node).

- **Supabase**: `PUBLIC_SUPABASE_URL=http://10.144.0.1:54321` + anon key del CLI (ver `.env.example`).
- **CORS**: `FRONT_ORIGIN=http://10.144.0.3:4322` (en `wrangler.jsonc` → `vars`, y en `.dev.vars`).

## Deploy

```bash
npm run deploy   # astro build + wrangler pages deploy ./dist
```

Setear en Pages → Settings → Environment variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `FRONT_ORIGIN` (origen real del front).
