# bff-clientes

BFF de la app de clientes de BoRR: Worker de Cloudflare (Astro `output: 'server'`, API pura, sin UI). Es un **adaptador**: autentica, reenvía el JWT a Supabase por `fetch` plano (sin SDK) y cachea con la Cache API. La lógica de dominio vive en los RPCs de `backend-supabase` — no acá.

## Documentación

- Lo que describe **este repo** (endpoints, cache, auth del gateway) va en su README; si crece, en `docs/` con índice.
- Lo **transversal** (arquitectura, dominios, flujos, ADRs, convenciones) va en [.github/docs](https://github.com/BoRR-Pizzeria/.github/blob/main/docs/README.md). Regla completa en [`convenciones.md`](https://github.com/BoRR-Pizzeria/.github/blob/main/docs/convenciones.md).
- Decisiones que condicionan este repo: [ADR-0003 (un BFF por aplicación)](https://github.com/BoRR-Pizzeria/.github/blob/main/docs/adr/0003-un-bff-por-aplicacion.md) y [ADR-0004 (lógica en RPCs)](https://github.com/BoRR-Pizzeria/.github/blob/main/docs/adr/0004-logica-de-dominio-en-rpcs.md).

## Skills y MCP

- MCP en [`.mcp.json`](./.mcp.json): `cloudflare-docs`, `cloudflare-bindings`, `supabase`, `postman` — el dominio de este repo es Cloudflare-native.
- El BFF debe seguir siendo Cloudflare-native: Workers/Pages, Cache API, sin Express ni servidores propios.

## Convenciones

- Commits: Conventional Commits con cuerpo en español, sin trailers de atribución.
- Ramas: `feature/* → develop → staging → production`, siempre vía PR.
