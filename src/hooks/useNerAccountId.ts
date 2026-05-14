/**
 * useNerAccountId — resolución canónica del account_id activo.
 *
 * Centraliza el pattern duplicado en N páginas que leen
 * `sessionStorage["ner_hub_data"]` o queryean account_members.
 *
 * Orden de resolución:
 *   1. Demo mode (`?demo=true`) → demoAccountId si fue inyectado, sino null
 *   2. sessionStorage cache (`ner_hub_data.account_id`) — populated en HubPage
 *      al pasar el handshake. Es el account_id "activo" canónico para esta
 *      sesión (importa cuando el user pertenece a N firmas y eligió una).
 *   3. Query a `account_members` (limit 1, fallback no autoritativo)
 *
 * Por qué el cache de sessionStorage es preferido al query directo:
 *   - Un user puede ser paralegal en 3 firmas. El query `.limit(1)` retorna
 *     UNA al azar. El sessionStorage contiene la firma que el user eligió
 *     al entrar al hub (o la que GHL handshake autorizó).
 *
 * Devuelve:
 *   - accountId: UUID string | null
 *   - source: de dónde vino ('demo' | 'cache' | 'query' | 'none')
 *   - loading: true mientras resuelve
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoData";

export interface NerAccountIdResult {
  accountId: string | null;
  source: "demo" | "cache" | "query" | "none";
  loading: boolean;
}

/** Sentinel para demo mode (NO es UUID válido — no debe llegar a Supabase). */
export const DEMO_ACCOUNT_ID = "demo-account-mendez";

function readCachedAccountId(): string | null {
  try {
    const raw = sessionStorage.getItem("ner_hub_data");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.account_id === "string" ? parsed.account_id : null;
  } catch {
    return null;
  }
}

export function useNerAccountId(): NerAccountIdResult {
  const demoMode = useDemoMode();
  const [state, setState] = useState<NerAccountIdResult>(() => {
    if (demoMode) {
      return { accountId: DEMO_ACCOUNT_ID, source: "demo", loading: false };
    }
    const cached = readCachedAccountId();
    if (cached) {
      return { accountId: cached, source: "cache", loading: false };
    }
    return { accountId: null, source: "none", loading: true };
  });

  useEffect(() => {
    // Si ya resolvimos por demo o cache, no hacer query
    if (state.source !== "none") return;
    if (demoMode) {
      setState({ accountId: DEMO_ACCOUNT_ID, source: "demo", loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setState({ accountId: null, source: "none", loading: false });
        return;
      }
      const { data } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        const id = (data?.account_id as string | undefined) ?? null;
        setState({ accountId: id, source: id ? "query" : "none", loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [demoMode, state.source]);

  return state;
}

/** Helper sincrónico para módulos no-React (ej. analytics.ts). */
export function getCachedNerAccountId(): string | null {
  return readCachedAccountId();
}

/** True si el accountId es el sentinel de demo (no consultar Supabase con él). */
export function isDemoAccountId(id: string | null): boolean {
  return id === DEMO_ACCOUNT_ID;
}
