import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode, DEMO_CASES } from "@/hooks/useDemoData";

export type PipelineStageKey =
  | "uscis"
  | "nvc"
  | "embajada"
  | "admin-processing"
  | "aprobado"
  | "negado"
  | "sin-clasificar";

export interface PipelineCase {
  id: string;
  client_name: string;
  client_profile_id: string | null;
  case_type: string | null;
  pipeline_stage: string | null;
  process_stage: PipelineStageKey | null;
  file_number: string | null;
  status: string | null;
  assigned_to: string | null;
  updated_at: string | null;
  stage_entered_at: string | null;
  created_at: string | null;
  priority_date: string | null;
  uscis_receipt_numbers: any;
  nvc_case_number: string | null;
  interview_date: string | null;
  emb_interview_date: string | null;
  cas_interview_date: string | null;
  case_tags_array: string[] | null;
  open_tasks_count?: number;
  overdue_tasks_count?: number;
  days_in_stage?: number;
  next_due_date?: string | null;
}

export interface PipelineColumn {
  key: PipelineStageKey;
  label: string;
  description: string;
  icon: string;
  accent: string;
  cases: PipelineCase[];
}

// Columnas oficiales del Pipeline Dashboard (Fase 1 roadmap).
// Mapean directamente a la enum process_stage ya existente en BD.
// USCIS / NVC / Embajada = pipeline activo. Resto = estados finales/laterales.
export const PIPELINE_COLUMNS: Array<Omit<PipelineColumn, "cases">> = [
  {
    key: "uscis",
    label: "USCIS",
    description: "Petición en proceso",
    icon: "🏛️",
    accent: "from-blue-500/80 to-blue-600/80",
  },
  {
    key: "nvc",
    label: "NVC",
    description: "Visa Center",
    icon: "📋",
    accent: "from-amber-500/80 to-amber-600/80",
  },
  {
    key: "embajada",
    label: "Embajada",
    description: "Entrevista consular",
    icon: "🏛️",
    accent: "from-orange-500/80 to-orange-600/80",
  },
  {
    key: "admin-processing",
    label: "Proceso Admin",
    description: "221(g) / revisión",
    icon: "⚖️",
    accent: "from-purple-500/80 to-purple-600/80",
  },
  {
    key: "aprobado",
    label: "Aprobado",
    description: "Caso resuelto",
    icon: "✅",
    accent: "from-emerald-500/80 to-emerald-600/80",
  },
  {
    key: "negado",
    label: "Negado",
    description: "Requiere acción",
    icon: "❌",
    accent: "from-rose-500/80 to-rose-600/80",
  },
];

function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function classify(c: PipelineCase): PipelineStageKey {
  if (c.process_stage && (PIPELINE_COLUMNS as any).some((col: any) => col.key === c.process_stage)) {
    return c.process_stage;
  }
  // Si process_stage no está set, derivar de señales existentes.
  const tags = c.case_tags_array || [];
  if (tags.some(t => /aprobada|aprobado/i.test(t))) return "aprobado";
  if (tags.some(t => /negada|negado/i.test(t))) return "negado";
  if (tags.some(t => /221g/i.test(t))) return "admin-processing";
  if (c.emb_interview_date || c.cas_interview_date) return "embajada";
  if (c.nvc_case_number) return "nvc";
  const r = c.uscis_receipt_numbers;
  if (r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0))) return "uscis";
  return "sin-clasificar";
}

export function useCasePipeline(accountId: string | null) {
  const demoMode = useDemoMode();
  const [cases, setCases] = useState<PipelineCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // DEMO MODE — devolver casos mock realistas (Méndez Immigration Law)
    if (demoMode) {
      const mockCases: PipelineCase[] = DEMO_CASES.map(c => ({
        id: c.id,
        client_name: c.client_name,
        client_profile_id: c.client_profile_id,
        case_type: c.case_type,
        pipeline_stage: c.pipeline_stage,
        process_stage: c.process_stage,
        file_number: c.uscis_receipt || c.nvc_case_number || c.file_number,
        status: c.status,
        assigned_to: c.assigned_to,
        updated_at: new Date(Date.now() - c.days_since_activity * 86400000).toISOString(),
        stage_entered_at: new Date(Date.now() - c.days_since_activity * 86400000).toISOString(),
        created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
        priority_date: null,
        uscis_receipt_numbers: c.uscis_receipt ? [c.uscis_receipt] : null,
        nvc_case_number: c.nvc_case_number,
        interview_date: c.interview_date,
        emb_interview_date: c.emb_interview_date,
        cas_interview_date: null,
        case_tags_array: null,
        open_tasks_count: c.open_tasks,
        overdue_tasks_count: c.overdue_tasks,
        days_in_stage: c.days_since_activity,
        next_due_date: c.next_due_iso,
      }));
      setCases(mockCases);
      setLoading(false);
      return;
    }

    if (!accountId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: casesData, error: casesErr } = await supabase
        .from("client_cases")
        .select(`
          id, client_name, client_profile_id, case_type, pipeline_stage, process_stage,
          file_number, status, assigned_to, updated_at, stage_entered_at, created_at,
          priority_date, uscis_receipt_numbers, nvc_case_number,
          interview_date, emb_interview_date, cas_interview_date, case_tags_array
        `)
        .eq("account_id", accountId)
        .not("status", "eq", "completed")
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (casesErr) {
        setError(casesErr.message);
        setLoading(false);
        return;
      }

      const ids = (casesData || []).map(c => c.id);
      const tasksByCase: Record<string, { open: number; overdue: number; nextDue: string | null }> = {};

      if (ids.length > 0) {
        const { data: tasks } = await supabase
          .from("case_tasks")
          .select("case_id, status, due_date")
          .in("case_id", ids)
          .neq("status", "completed")
          .neq("status", "archived");

        const today = new Date().toISOString().slice(0, 10);
        for (const t of (tasks || []) as any[]) {
          if (!t.case_id) continue;
          const slot = tasksByCase[t.case_id] || { open: 0, overdue: 0, nextDue: null };
          slot.open += 1;
          if (t.due_date && t.due_date < today) slot.overdue += 1;
          if (t.due_date && (!slot.nextDue || t.due_date < slot.nextDue)) slot.nextDue = t.due_date;
          tasksByCase[t.case_id] = slot;
        }
      }

      const enriched: PipelineCase[] = (casesData || []).map((c: any) => ({
        ...c,
        open_tasks_count: tasksByCase[c.id]?.open || 0,
        overdue_tasks_count: tasksByCase[c.id]?.overdue || 0,
        next_due_date: tasksByCase[c.id]?.nextDue || null,
        days_in_stage: daysSince(c.stage_entered_at || c.updated_at),
      }));

      setCases(enriched);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [accountId, demoMode]);

  const columns: PipelineColumn[] = useMemo(() => {
    return PIPELINE_COLUMNS.map(col => ({
      ...col,
      cases: cases.filter(c => classify(c) === col.key),
    }));
  }, [cases]);

  const unclassifiedCount = useMemo(
    () => cases.filter(c => classify(c) === "sin-clasificar").length,
    [cases]
  );

  return { cases, columns, loading, error, unclassifiedCount };
}
