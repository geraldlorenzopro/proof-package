/**
 * useCasePeekData — Carga notas + tareas + alertas del case para el peek panel.
 *
 * Diseño Lovable: el peek debe resolver el 70% de queries telefónicas
 * sin abrir el case-engine completo. Por eso solo trae lo mínimo:
 *   - 3 últimas notas
 *   - 3 tareas pendientes activas
 *   - El case YA viene del parent (no re-fetch)
 *
 * Si el usuario quiere más detalle → "Abrir expediente completo".
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "./useDemoData";

export interface PeekNote {
  id: string;
  body: string;
  author_name: string;
  created_at: string;
}

export interface PeekTask {
  id: string;
  title: string;
  due_date: string | null;
  task_type: string | null;
  priority: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
}

interface State {
  notes: PeekNote[];
  tasks: PeekTask[];
  /** Round 9.19: count de notas que el user NO puede ver (visibility gate). */
  hiddenNotesCount: number;
  loading: boolean;
}

const DEMO_NOTES: PeekNote[] = [
  { id: "n1", body: "Cliente trae documentos viernes. Falta traducción certificada del acta del padre.", author_name: "Gerald", created_at: new Date().toISOString() },
  { id: "n2", body: "Llamé a Ada Translations, traducción lista lunes 19/05 confirmado.", author_name: "María P.", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "n3", body: "RFE recibido. USCIS pide bona fide marriage evidence + 90 days.", author_name: "Gerald", created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
];

const DEMO_TASKS: PeekTask[] = [
  { id: "t1", title: "Subir affidavit traducido del padre", due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), task_type: "document_upload", priority: "high", assigned_to: "demo-gl", assigned_to_name: "Gerald" },
  { id: "t2", title: "Preparar declaración bona fide (3 testigos)", due_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10), task_type: "review_required", priority: "high", assigned_to: "demo-mp", assigned_to_name: "María P." },
  { id: "t3", title: "Confirmar fotos compartidas con cliente", due_date: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), task_type: "client_contact", priority: "normal", assigned_to: "demo-gl", assigned_to_name: "Gerald" },
];

export function useCasePeekData(caseId: string | null): State {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({ notes: [], tasks: [], hiddenNotesCount: 0, loading: true });

  useEffect(() => {
    if (!caseId) {
      setState({ notes: [], tasks: [], hiddenNotesCount: 0, loading: false });
      return;
    }
    if (demoMode) {
      // Demo: simulamos 2 notas privadas para demo de la UI compliance.
      setState({ notes: DEMO_NOTES, tasks: DEMO_TASKS, hiddenNotesCount: 2, loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const [notesRes, tasksRes, hiddenRes] = await Promise.all([
        supabase
          .from("case_notes" as any)
          .select("id, body, created_at, author_id, profiles:author_id(full_name)")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("case_tasks" as any)
          .select("id, title, due_date, task_type, priority, assigned_to, profiles:assigned_to(full_name)")
          .eq("case_id", caseId)
          .eq("status", "pending")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(3),
        // Round 9.19: RPC SECURITY DEFINER count de notas que el user NO puede ver.
        supabase.rpc("count_hidden_notes" as any, { p_case_id: caseId }),
      ]);

      if (cancelled) return;

      const notes: PeekNote[] = !notesRes.error && notesRes.data
        ? (notesRes.data as any[]).map((n: any) => ({
            id: n.id,
            body: n.body || "",
            author_name: n.profiles?.full_name || "Staff",
            created_at: n.created_at,
          }))
        : [];

      const tasks: PeekTask[] = !tasksRes.error && tasksRes.data
        ? (tasksRes.data as any[]).map((t: any) => ({
            id: t.id,
            title: t.title || "",
            due_date: t.due_date,
            task_type: t.task_type,
            priority: t.priority,
            assigned_to: t.assigned_to,
            assigned_to_name: t.profiles?.full_name || null,
          }))
        : [];

      const hiddenNotesCount = (!hiddenRes.error && typeof hiddenRes.data === "number") ? hiddenRes.data : 0;
      setState({ notes, tasks, hiddenNotesCount, loading: false });
    })();

    return () => { cancelled = true; };
  }, [caseId, demoMode]);

  return state;
}
