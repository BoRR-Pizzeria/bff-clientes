/**
 * Sanitización centralizada de errores de Supabase.
 *
 * Reglas:
 *  - El mensaje real (con detalles de Postgres / GoTrue) se loggea internamente.
 *  - Al cliente sólo llega un mensaje genérico + el HTTP status correcto.
 */

interface PostgrestLike {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/** Códigos Postgres y PostgREST → respuesta segura para el cliente.
 *
 * Fuentes:
 *  - PostgreSQL SQLSTATE: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *  - PostgREST error codes: https://docs.postgrest.org/en/v12/references/errors.html
 */
const POSTGREST_MAP: Record<string, { message: string; status: number }> = {
  // ── Clase 23: Integrity Constraint Violation ─────────────────────────────
  // PostgREST mapea 23503 y 23505 a 409; 23502/23514 caen en "other" → 400.
  '23505': { message: 'Ya existe un registro con esos datos.', status: 409 },          // unique_violation
  '23503': { message: 'Referencia inválida: el recurso relacionado no existe.', status: 409 }, // foreign_key_violation
  '23502': { message: 'Faltan campos obligatorios.', status: 400 },                    // not_null_violation
  '23514': { message: 'Los datos no cumplen las restricciones requeridas.', status: 400 }, // check_violation
  // ── Clase 40: Transaction Rollback ───────────────────────────────────────
  '40001': { message: 'Error interno del servidor.', status: 500 },                    // serialization_failure / deadlock
  // ── Clase 42: Insufficient Privilege ─────────────────────────────────────
  // PostgREST devuelve 403 si autenticado, 401 si anónimo. Usamos 403 (el
  // cliente BFF siempre envía un JWT cuando se requieren permisos).
  '42501': { message: 'No tienes permiso para realizar esta acción.', status: 403 },   // insufficient_privilege
  // ── PostgREST: Group 1 – Api Request ─────────────────────────────────────
  PGRST116: { message: 'Recurso no encontrado.', status: 404 },   // 406 en PostgREST pero 404 es más semántico para el cliente
  PGRST204: { message: 'Parámetro de columna no válido.', status: 400 }, // columna inexistente en ?columns=
  // ── PostgREST: Group 3 – JWT ──────────────────────────────────────────────
  PGRST301: { message: 'Sesión expirada.', status: 401 },         // JWT inválido o expirado
  PGRST302: { message: 'No autenticado.', status: 401 },          // rol anónimo deshabilitado
};

/** Patrones de mensajes de GoTrue Auth → respuesta segura para el cliente.
 *
 * GoTrue no expone un enum de códigos de error estables; los mensajes provienen
 * del código fuente: https://github.com/supabase/auth (internal/api/errors.go).
 * Los patrones se mantienen en minúsculas para coincidir con la flag /i.
 */
const AUTH_PATTERNS: Array<{ test: RegExp; message: string; status: number }> = [
  { test: /invalid login credentials/i, message: 'Credenciales incorrectas.', status: 401 },
  {
    test: /email not confirmed/i,
    message: 'Confirma tu email antes de iniciar sesión.',
    status: 403,
  },
  { test: /already registered/i, message: 'El usuario ya existe.', status: 409 },
  {
    test: /password should be at least/i,
    message: 'La contraseña no cumple los requisitos mínimos.',
    status: 400,
  },
  {
    test: /invalid refresh token|jwt expired|token is expired/i,
    message: 'Sesión expirada.',
    status: 401,
  },
];

export interface SanitizedError {
  message: string;
  status: number;
}

/** SQLSTATE de Postgres/PostgREST: 5 caracteres alfanuméricos en mayúsculas
 * (p.ej. `23505`, `PGRST116`). Los códigos de GoTrue Auth (`user_already_exists`,
 * `invalid_credentials`, etc.) son snake_case y nunca matchean este patrón —
 * así se distingue un PostgrestError de un AuthError, que también tiene `code`.
 */
const SQLSTATE_RE = /^[0-9A-Z]+$/;

/**
 * Convierte un error de Supabase (PostgrestError o AuthError) en un mensaje
 * seguro para el cliente y loggea los detalles internamente.
 *
 * @param e     - El error capturado (PostgrestError, AuthError, o unknown).
 * @param context - Identificador del endpoint para el log (p.ej. 'pizzas/[id] PATCH').
 */
export function sanitizeSupabaseError(e: unknown): SanitizedError {
  if (!e) {
    return { message: 'Error interno del servidor.', status: 500 };
  }

  const err = e as PostgrestLike;

  // PostgrestError: `code` es un SQLSTATE/código PostgREST (mayúsculas/dígitos).
  // AuthError también tiene `code` (snake_case, p.ej. `user_already_exists`):
  // cae al chequeo por mensaje de abajo.
  if (typeof err.code === 'string' && SQLSTATE_RE.test(err.code)) {
    return POSTGREST_MAP[err.code] ?? { message: 'Error interno del servidor.', status: 500 };
  }

  // AuthError: tiene `message` pero sin código de Postgres
  if (typeof err.message === 'string') {
    for (const pattern of AUTH_PATTERNS) {
      if (pattern.test.test(err.message)) {
        return { message: pattern.message, status: pattern.status };
      }
    }
    return { message: 'Error de autenticación.', status: 400 };
  }

  return { message: 'Error interno del servidor.', status: 500 };
}
