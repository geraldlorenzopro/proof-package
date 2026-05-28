/**
 * usePipelineStats — Hub Inicio Pipeline widget.
 *
 * Cuenta casos activos por etapa del pipeline canónico, mismo modelo que
 * /hub/cases Kanban (process_stage post migration 20260528170000).
 *
 * BUCKETS canonical alineados con useCasePipeline.ts:
 *   uscis | nvc | embajada (Consular) | court | ice | aprobado
 *
 * Antes (Hub v7): mapeaba pipeline_stage con strings legacy (intake/consulta/
 * contrato/rfe) que NO matcheaban los pipeline_stage modernos
 * ('cuestionario-pendiente', 'documentos-pendientes', etc.) → todos caían
 * en 'intake' default. Inconsistencia detectada en smoke test 2026-05-28.
 *
 * Ahora: lee directo de process_stage (canonical post-court+ice) y muestra
 * el mismo conteo que el Kanban de /hub/cases.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode, DEMO_PULSE } from "./useDemoData";

export type PipelineBucket = "uscis" | "nvc" | "embajada" | "court" | "ice" | "aprobado";

export interface PipelineStat {
  bucket: PipelineBucket;
  label: string;
  count: number;
}

interface State {
  stats: PipelineStat[];
  totalActive: number;
  loading: boolean;
}

const BUCKETS: { bucket: PipelineBucket; label: string }[] = [
  { bucket: "uscis",    label: "USCIS" },
  { bucket: "nvc",      label: "NVC" },
  { bucket: "embajada", label: "CONSULAR" },
  { bucket: "court",    label: "CORTE" },
  { bucket: "ice",      label: "ICE" },
  { bucket: "aprobado", label: "APROB. 30D" },
];

function classifyProcessStage(stage: string | null): PipelineBucket | null {
  if (!stage) return null;
  const s = stage.toLowerCase();
  if (s === "uscis" || s === "admin-processing") return "uscis";
  if (s === "nvc") return "nvc";
  if (s === "embajada" || s === "consular") return "embajada";
  if (s === "court") return "court";
  if (s === "ice") return "ice";
  if (s === "aprobado") return "aprobado";
  // 'negado' y otros no van al pipeline activo
  return null;
}

export function usePipelineStats(accountId: string | null): State {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({ stats: [], totalActive: 0, loading: true });

  useEffect(() => {
    if (demoMode) {
      const demoCounts: Record<PipelineBucket, number> = {
        uscis: 98,
        nvc: 18,
        embajada: 12,
        court: 4,
        ice: 1,
        aprobado: 14,
      };
      const stats = BUCKETS.map(b => ({ ...b, count: demoCounts[b.bucket] }));
      const totalActive = DEMO_PULSE.active_cases;
      setState({ stats, totalActive, loading: false });
      return;
    }
    if (!accountId) {
      setState({ stats: BUCKETS.map(b => ({ ...b, count: 0 })), totalActive: 0, loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [activeRes, approvedRes] = await Promise.all([
        supabase
          .from("client_cases")
          .select("process_stage, status")
          .eq("account_id", accountId)
          .not("status", "in", "(completed,archived,cancelled)"),
        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("process_stage", "aprobado")
          .gte("updated_at", monthAgo),
      ]);

      if (cancelled) return;

      const counts = new Map<PipelineBucket, number>(BUCKETS.map(b => [b.bucket, 0]));
      if (!activeRes.error && activeRes.data) {
        for (const row of activeRes.data as any[]) {
          const b = classifyProcessStage(row.process_stage);
          // 'aprobado' se cuenta aparte con ventana 30d
          if (b && b !== "aprobado") counts.set(b, (counts.get(b) ?? 0) + 1);
        }
      }
      counts.set("aprobado", approvedRes.count ?? 0);

      const totalActive = (activeRes.data ?? []).filter((r: any) => {
        const b = classifyProcessStage(r.process_stage);
        return b !== null && b !== "aprobado";
      }).length;

      setState({
        stats: BUCKETS.map(b => ({ ...b, count: counts.get(b.bucket) ?? 0 })),
        totalActive,
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId, demoMode]);

  return state;
}
