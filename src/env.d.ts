/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Bindings/vars expuestos por el runtime de Cloudflare (Pages env, wrangler vars).
type CfEnv = {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  FRONT_ORIGIN?: string;
};

type Runtime = import('@astrojs/cloudflare').Runtime<CfEnv>;
declare namespace App {
  interface Locals extends Runtime {}
}
