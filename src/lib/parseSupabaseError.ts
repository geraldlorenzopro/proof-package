/**
 * parseSupabaseError — Helper para mapear PG error codes a mensajes
 * humanos + descripciones que el paralegal entiende.
 *
 * Round 9.32 (Mr. Lorenzo pre-Sprint C): cerramos Gap 2 del auto-save
 * audit. NextActionEditor + ResponsibleInlineEdit + cualquier otro
 * componente que persiste directo a Supabase (sin useCaseInlineEdit)
 * puede llamar este helper para tener consistencia con el resto de
 * los inline edits.
 *
 * PG codes cubiertos (SOC II Victoria gap #8 — granular errors):
 *   - 23514: CHECK constraint violation (valor no válido)
 *   - 42501: RLS denied (sin permiso)
 *   - 23505: duplicate key (registro duplicado)
 *   - 23502: NOT NULL violation (falta campo obligatorio)
 *   - 23503: FK violation (referencia rota)
 *   - default: mensaje genérico + raw error
 *
 * Uso:
 *   const { error } = await supabase.from(...).update(...);
 *   if (error) {
 *     const { userMsg, description } = parseSupabaseError(error);
 *     toast.error(userMsg, {
 *       description,
 *       action: { label: "Reintentar", onClick: () => retry() },
 *     });
 *   }
 */
import type { PostgrestError } from "@supabase/supabase-js";

export interface ParsedSupabaseError {
  userMsg: string;
  description: string;
  pgCode: string | null;
}

export function parseSupabaseError(err: PostgrestError | Error | unknown): ParsedSupabaseError {
  const pgCode = (err as any)?.code ?? null;
  const rawMessage = (err as any)?.message ?? String(err);

  switch (pgCode) {
    case "23514":
      return {
        userMsg: "Valor no válido",
        description: "El valor no cumple las reglas de negocio. Revisá la entrada.",
        pgCode,
      };
    case "42501":
      return {
        userMsg: "Sin permiso",
        description: "Tu rol no tiene permisos para esta acción. Hablá con un admin.",
        pgCode,
      };
    case "23505":
      return {
        userMsg: "Duplicado",
        description: "Ya existe un registro con esos datos.",
        pgCode,
      };
    case "23502":
      return {
        userMsg: "Falta un campo obligatorio",
        description: "Completá los campos requeridos antes de guardar.",
        pgCode,
      };
    case "23503":
      return {
        userMsg: "Referencia inválida",
        description: "Algún campo apunta a un registro que ya no existe.",
        pgCode,
      };
    default:
      return {
        userMsg: "No se pudo guardar",
        description: rawMessage || "Reintentá en unos segundos.",
        pgCode,
      };
  }
}
