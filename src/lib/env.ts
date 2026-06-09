import type { APIContext } from 'astro';

export interface BffEnv {
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  FRONT_ORIGIN: string;
}

/**
 * Las vars PUBLIC_ las inlinea Vite SÓLO con acceso estático
 * (`import.meta.env.PUBLIC_FOO`); un acceso dinámico `import.meta.env[key]`
 * no se reemplaza. Por eso se resuelven una a una acá.
 */
function fromImportMeta(key: keyof BffEnv): string | undefined {
  switch (key) {
    case 'PUBLIC_SUPABASE_URL':
      return import.meta.env.PUBLIC_SUPABASE_URL;
    case 'PUBLIC_SUPABASE_ANON_KEY':
      return import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    default:
      // FRONT_ORIGIN no es PUBLIC_: vive sólo en el runtime de Cloudflare.
      return undefined;
  }
}

/**
 * Prioriza el runtime de Cloudflare (Pages env / wrangler vars, disponible en
 * prod y en dev vía platformProxy) y cae a import.meta.env para las PUBLIC_.
 */
function read(locals: APIContext['locals'], key: keyof BffEnv): string | undefined {
  const runtimeEnv = locals?.runtime?.env as Record<string, string | undefined> | undefined;
  return runtimeEnv?.[key] ?? fromImportMeta(key);
}

export function getEnv(locals: APIContext['locals']): BffEnv {
  const url = read(locals, 'PUBLIC_SUPABASE_URL');
  const anonKey = read(locals, 'PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error(
      '[bff] PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_ANON_KEY no configuradas'
    );
  }
  return {
    PUBLIC_SUPABASE_URL: url,
    PUBLIC_SUPABASE_ANON_KEY: anonKey,
    FRONT_ORIGIN: read(locals, 'FRONT_ORIGIN') ?? '*',
  };
}
