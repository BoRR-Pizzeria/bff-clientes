// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// BFFBORR es una API pura (gateway): no hay páginas ni UI, sólo endpoints
// bajo src/pages/api/* corriendo como SSR en Cloudflare (Pages + Workers).
// Por eso output: 'server' (todo dinámico) y no cargamos react/tailwind/sitemap.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
});
