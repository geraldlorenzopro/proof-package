import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import { Briefcase, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HubLayout from "@/components/hub/HubLayout";

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  "caso-no-iniciado": { label: "Intake", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  "caso-activado": { label: "Activado", color: "bg-teal-500/15 text-teal-400 border-teal-500/20" },
  "recopilacion-evidencias": { label: "Evidencias", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  "preparacion-formularios": { label: "Formularios", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  "revision-qa": { label: "Revisión QA", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  filing: { label: "Filing", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  "seguimiento-uscis": { label: "En USCIS", color: "bg-blue-600/15 text-blue-400 border-blue-600/20" },
  aprobado: { label: "Aprobado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25" },
};

export default function HubCasesPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  useEffect(() => {
    if (!accountId) return;
    supabase
      .from("client_cases")
      .select("id, client_name, case_type, pipeline_stage, file_number, status, updated_at")
      .eq("account_id", accountId)
      .not("status", "eq", "completed")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setCases(data || []);
        setLoading(false);
      });
  }, [accountId]);

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Casos</h1>
            <p className="text-sm text-muted-foreground">{cases.length} casos activos</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {cases.map(c => {
            const stage = STAGE_CONFIG[c.pipeline_stage || ""] || { label: c.pipeline_stage || "—", color: "bg-muted/50 text-muted-foreground border-border/30" };
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/case-engine/${c.id}`)}
                className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4 text-jarvis/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{c.client_name}</span>
                    {c.file_number && <span className="text-[10px] font-mono text-muted-foreground/50">{c.file_number}</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">{getCaseTypeLabel(c.case_type)}</span>
                </div>
                <Badge variant="outline" className={`${stage.color} text-[8px]`}>{stage.label}</Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {!loading && cases.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No hay casos activos</p>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
