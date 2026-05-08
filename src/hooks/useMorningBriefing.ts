/**
 * useMorningBriefing — el "wow factor" del HubDashboard.
 *
 * Consume el edge function hub-morning-briefing que genera prosa narrativa
 * con Claude (Haiku 4.5) basada en RFEs próximos + citas + aprobaciones +
 * tareas urgentes. Menciona clientes por NOMBRE.
 *
 * Cache 30 min (1 briefing por sesión razonable). Refetch on window focus
 * desactivado para no quemar Claude calls innecesarios.
 *
 * Si el edge function falla, retorna data null y el componente usa su
 * fallback v1 derivado de KPIs.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BRIEFING_FUNCTION_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-morning-briefing`;

export type BriefingChipSeverity = "critical" | "high" | "medium" | "low";

export interface BriefingChip {
  label: string;
  severity: BriefingChipSeverity;
  href: string;
  client_name?: string;
}

export interface MorningBriefingResponse {
  greeting: string;
  briefing_text: string;
  chips: BriefingChip[];
  meta: {
    rfes_due_week: number;
    appointments_today: number;
    approvals_week: number;
    priority_tasks: number;
    generated_at: string;
    fallback_used: boolean;
  };
}

async function fetchMorningBriefing(
  accountId: string | null
): Promise<MorningBriefingResponse | null> {
  if (!accountId) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const resp = await fetch(BRIEFING_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ account_id: accountId }),
  });

  if (!resp.ok) {
    return null;
  }

  return resp.json();
}

export function useMorningBriefing(accountId: string | null) {
  return useQuery({
    queryKey: ["morning-briefing", accountId],
    queryFn: () => fetchMorningBriefing(accountId),
    enabled: !!accountId,
    staleTime: 30 * 60 * 1000, // 30 min
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
