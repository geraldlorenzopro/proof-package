/**
 * useFeatureFlag — sistema de feature flags por firma.
 *
 * Permite release gradual de features:
 *   - Mr. Lorenzo activa features por firma desde /admin/features
 *   - Frontend wrap con <FeatureFlag slug="x"> para mostrar/ocultar
 *
 * Estados de un feature (en tabla feature_flags):
 *   - planned      → nadie lo ve
 *   - in_dev       → nadie lo ve (código en main pero OFF)
 *   - beta         → solo firmas con override.enabled=true
 *   - live         → todas las firmas
 *   - deprecated   → nadie lo ve
 *
 * Spec completa en .ai/master/features.md
 *
 * FALLBACK GRACEFUL:
 *   Si la tabla feature_flags no existe (migration no aplicada todavía),
 *   el hook retorna `false` para todas las features nuevas, permitiendo
 *   que el código viejo siga funcionando sin breaking changes.
 *
 * CACHE:
 *   30 min stale, 1 hora gc — refetch on window focus desactivado.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 30 * 60 * 1000; // 30 min
const CACHE_TIME = 60 * 60 * 1000; // 1 hora

export interface FeatureFlag {
  slug: string;
  name: string;
  description: string | null;
  status: "planned" | "in_dev" | "beta" | "live" | "deprecated";
  required_tier: "essential" | "professional" | "elite" | "enterprise";
  default_for_new_firms: boolean;
  category: string | null;
  phase: number | null;
}

/**
 * Hook para verificar si la firma tiene un feature activo.
 *
 * Implementación:
 *   1. Resuelve account_id del usuario actual
 *   2. Llama a la SQL function `account_has_feature(account_id, slug)`
 *   3. Cache 30 min
 *   4. Fallback a `false` si:
 *      - No hay sesión
 *      - No hay account_id
 *      - La función SQL no existe (migration pendiente)
 *      - Error de red
 *
 * @param slug - el slug del feature (ej: "pipeline-dashboard")
 * @returns true si la firma tiene acceso, false si no o si está cargando
 */
export function useFeatureFlag(slug: string | null | undefined): boolean {
  const { data } = useQuery({
    queryKey: ["feature-flag", slug],
    queryFn: async () => {
      if (!slug) return false;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Resolver account_id del usuario
      const { data: member } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!member?.account_id) return false;

      // Llamar a función SQL account_has_feature
      const { data: result, error } = await (supabase.rpc as any)("account_has_feature", {
        p_account_id: member.account_id,
        p_feature_slug: slug,
      });

      // Fallback graceful si la función no existe (migration pendiente)
      if (error) {
        if (error.message?.includes("does not exist") ||
            error.message?.includes("function") ||
            error.code === "42883") {
          // Función SQL no existe — return false (no break el código viejo)
          return false;
        }
        console.warn(`[useFeatureFlag] Error checking ${slug}:`, error);
        return false;
      }

      return result === true;
    },
    enabled: !!slug,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return data === true;
}

/**
 * Hook para listar todos los features visibles a la firma actual.
 * Útil para construir páginas como /admin/features o dashboards de
 * "qué features tengo activos".
 */
export function useAllFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("phase", { ascending: true });

      if (error) {
        if (error.message?.includes("does not exist")) {
          return [] as FeatureFlag[];
        }
        throw error;
      }

      return (data || []) as FeatureFlag[];
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: false,
  });
}
