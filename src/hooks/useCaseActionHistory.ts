/**
 * useCaseActionHistory — Fetch del audit trail de pasos completados de un caso.
 *
 * Round 9.23 (Mr. Lorenzo opción A+C):
 *   Una vez aplicada migration 20260606060000, esta tabla es append-only.
 *   El hook fetcha los últimos N pasos completados ordenados desc.
 *
 * Demo mode: retorna mocks realistas para mostrar el patrón visual sin BD.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "./useDemoData";

export interface CompletedAction {
  id: string;
  case_id: string;
  completed_by_user_id: string | null;
  completed_by_name: string | null;
  action_key: string;
  action_label: string;
  action_detail: string | null;
  was_custom: boolean;
  due_date_at_completion: string | null;
  completed_at: string;
  case_stage_at_completion: string | null;
  case_status_at_completion: string | null;
}

interface State {
  history: CompletedAction[];
  loading: boolean;
}

// Demo data — 3 pasos completados con narrativa realista de inmigración.
const DEMO_HISTORY: CompletedAction[] = [
  {
    id: "h-1",
    case_id: "demo-case",
    completed_by_user_id: "demo-u-vanessa",
    completed_by_name: "Vanessa Rivera",
    action_key: "call_client_followup",
    action_label: "Llamar a cliente para recordar entrega de docs",
    action_detail: "Cliente trae certificado de nacimiento + 2 affidavits viernes",
    was_custom: false,
    due_date_at_completion: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    completed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    case_stage_at_completion: "uscis",
    case_status_at_completion: "in_progress",
  },
  {
    id: "h-2",
    case_id: "demo-case",
    completed_by_user_id: "demo-u-vanessa",
    completed_by_name: "Vanessa Rivera",
    action_key: "review_evidence",
    action_label: "Revisar evidencia bona fide marriage",
    action_detail: null,
    was_custom: false,
    due_date_at_completion: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    completed_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    case_stage_at_completion: "uscis",
    case_status_at_completion: "in_progress",
  },
  {
    id: "h-3",
    case_id: "demo-case",
    completed_by_user_id: "demo-u-carmen",
    completed_by_name: "Carmen Báez",
    action_key: "submit_uscis",
    action_label: "Enviar I-130 a USCIS lockbox Chicago",
    action_detail: "Tracking USPS: 9405511234567890",
    was_custom: false,
    due_date_at_completion: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    completed_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    case_stage_at_completion: "uscis",
    case_status_at_completion: "in_progress",
  },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCaseActionHistory(caseId: string | null, refreshKey: number = 0): State {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({ history: [], loading: true });

  useEffect(() => {
    if (!caseId) {
      setState({ history: [], loading: false });
      return;
    }
    if (demoMode || !UUID_RE.test(caseId)) {
      setState({ history: DEMO_HISTORY, loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("case_action_history" as any)
        .select("*")
        .eq("case_id", caseId)
        .order("completed_at", { ascending: false })
        .limit(10);

      if (cancelled) return;
      if (error) {
        // Si la migration no está aplicada, error 404 — degradamos gracefully.
        setState({ history: [], loading: false });
        return;
      }
      setState({ history: (data as any) || [], loading: false });
    })();

    return () => { cancelled = true; };
  }, [caseId, demoMode, refreshKey]);

  return state;
}

/**
 * Marca el next_action actual como completado.
 * Llamable desde NextActionChip (botón ✓).
 *
 * En demo o sin UUID válido: log mocked, no persiste.
 * En real: llama RPC complete_case_action() atómico.
 */
export async function completeNextAction(
  caseId: string,
  snapshot: {
    action_key: string;
    action_label: string;
    action_detail?: string | null;
    was_custom?: boolean;
    due_date?: string | null;
  },
  isDemo: boolean = false
): Promise<{ ok: boolean; error?: string; historyId?: string }> {
  if (isDemo || !UUID_RE.test(caseId)) {
    return { ok: true, historyId: `demo-history-${Date.now()}` };
  }

  const { data, error } = await supabase.rpc("complete_case_action" as any, {
    p_case_id: caseId,
    p_snapshot: snapshot,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, historyId: data as string };
}
