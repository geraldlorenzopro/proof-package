/**
 * useMyActions — Hub Inicio v7 Zona 7 ("Mis acciones")
 *
 * Cuenta tareas pendientes asignadas al usuario actual, agrupadas por
 * task_type (FIRMAR / RFE / LLAMADAS / etc). Devuelve los 3 buckets
 * principales para el widget.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActionKind = "firmar" | "rfe" | "llamadas" | "revisar" | "documentos";

export interface ActionBucket {
  kind: ActionKind;
  label: string;
  count: number;
}

interface State {
  buckets: ActionBucket[];
  total: number;
  loading: boolean;
}

const MAP: Record<ActionKind, { label: string; types: string[] }> = {
  firmar: { label: "FIRMAR", types: ["signature_required"] },
  rfe: { label: "RFE", types: ["rfe_response"] },
  llamadas: { label: "LLAMADAS", types: ["client_contact"] },
  revisar: { label: "REVISAR", types: ["review_required"] },
  documentos: { label: "DOCUMENTOS", types: ["document_upload"] },
};

export function useMyActions(accountId: string | null, userId: string | null): State {
  const [state, setState] = useState<State>({ buckets: [], total: 0, loading: true });

  useEffect(() => {
    if (!accountId || !userId) {
      setState({ buckets: [], total: 0, loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("case_tasks" as any)
        .select("task_type")
        .eq("account_id", accountId)
        .eq("assigned_to", userId)
        .not("status", "in", "(completed,archived)");

      if (cancelled) return;

      const counts: Record<ActionKind, number> = {
        firmar: 0, rfe: 0, llamadas: 0, revisar: 0, documentos: 0,
      };

      if (!error && data) {
        for (const row of data as any[]) {
          const t = row.task_type as string;
          for (const [kind, conf] of Object.entries(MAP)) {
            if (conf.types.includes(t)) {
              counts[kind as ActionKind] += 1;
              break;
            }
          }
        }
      }

      const ordered: ActionKind[] = ["firmar", "rfe", "llamadas", "revisar", "documentos"];
      const buckets = ordered
        .map(k => ({ kind: k, label: MAP[k].label, count: counts[k] }))
        .sort((a, b) => b.count - a.count);

      setState({
        buckets,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId, userId]);

  return state;
}
