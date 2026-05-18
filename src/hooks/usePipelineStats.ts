/**
 * usePipelineStats — Hub Inicio v7 Zona 6
 *
 * Cuenta casos activos por etapa del pipeline canónico, para renderizar
 * la barra horizontal "Tu negocio de un vistazo".
 *
 * Mapping de pipeline_stage → bucket visible:
 *   intake | consulta | contrato | uscis | rfe | aprobado
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipelineBucket = "intake" | "consulta" | "contrato" | "uscis" | "rfe" | "aprobado";

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
  { bucket: "intake", label: "INTAKE" },
  { bucket: "consulta", label: "CONSULTA" },
  { bucket: "contrato", label: "CONTRATO" },
  { bucket: "uscis", label: "USCIS" },
  { bucket: "rfe", label: "RFE" },
  { bucket: "aprobado", label: "APROB. 30D" },
];

function classify(stage: string | null): PipelineBucket | null {
  if (!stage) return "intake";
  const s = stage.toLowerCase();
  if (s.includes("rfe") || s.includes("noid")) return "rfe";
  if (s.includes("aprob") || s.includes("approved")) return "aprobado";
  if (s.includes("uscis") || s.includes("nvc") || s.includes("embajada") || s.includes("filed") || s.includes("env")) return "uscis";
  if (s.includes("contrat") || s.includes("firm") || s.includes("sign")) return "contrato";
  if (s.includes("consult")) return "consulta";
  if (s.includes("intake") || s.includes("no-iniciado") || s.includes("lead")) return "intake";
  return "intake";
}

export function usePipelineStats(accountId: string | null): State {
  const [state, setState] = useState<State>({ stats: [], totalActive: 0, loading: true });

  useEffect(() => {
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
          .select("pipeline_stage, process_stage, status")
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
          const b = classify(row.pipeline_stage ?? row.process_stage);
          // No contamos "aprobado" del set activo — esa columna se llena con 30d
          if (b && b !== "aprobado") counts.set(b, (counts.get(b) ?? 0) + 1);
        }
      }
      counts.set("aprobado", approvedRes.count ?? 0);

      const activeData = activeRes.data ?? [];
      const totalActive = activeData.filter((r: any) => {
        const b = classify(r.pipeline_stage ?? r.process_stage);
        return b !== "aprobado";
      }).length;

      setState({
        stats: BUCKETS.map(b => ({ ...b, count: counts.get(b.bucket) ?? 0 })),
        totalActive,
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId]);

  return state;
}
