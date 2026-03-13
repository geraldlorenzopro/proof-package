import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, CircleDot, Loader2, Shield, Mic, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface StageInfo {
  order: number;
  slug: string;
  label: string;
  owner: "team" | "client" | "uscis";
  description: string;
}

export default function CaseTrackPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [stages, setStages] = useState<StageInfo[]>([]);

  useEffect(() => {
    if (!token) return;
    loadCase();
  }, [token]);

  const loadCase = async () => {
    try {
      const { data, error: err } = await supabase.rpc("get_case_by_token" as any, { _token: token! });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setError("Caso no encontrado"); return; }
      setCaseData(row);

      const { data: pipelineData } = await supabase.rpc("get_case_pipeline_by_token" as any, { _token: token! });
      if (pipelineData) {
        const parsed = Array.isArray(pipelineData) ? pipelineData[0] : pipelineData;
        if (parsed?.stages) {
          const s = typeof parsed.stages === "string" ? JSON.parse(parsed.stages) : parsed.stages;
          setStages(s);
        }
        setCaseData((prev: any) => ({
          ...prev,
          pipeline_stage: parsed?.pipeline_stage,
          process_label: parsed?.process_label,
        }));
      }
    } catch (e) {
      console.error(e);
      setError("Error al cargar el caso");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">{error || "Caso no encontrado"}</p>
        </div>
      </div>
    );
  }

  const currentStage = caseData.pipeline_stage || "consulta-inicial";
  const currentIdx = stages.findIndex(s => s.slug === currentStage);
  const progressPct = stages.length > 0 ? Math.round(((Math.max(currentIdx, 0) + 1) / stages.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Estado de tu Caso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {caseData.process_label || caseData.case_type}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {caseData.client_name}
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Progreso</span>
            <span className="text-xs font-bold text-primary">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Pipeline stages */}
        <div className="space-y-2 mb-8">
          {stages.map((stage, i) => {
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;

            return (
              <div
                key={stage.slug}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  isCurrent
                    ? "bg-primary/5 border-primary/20 shadow-sm"
                    : isPast
                    ? "bg-accent/5 border-accent/10"
                    : "bg-transparent border-border/30 opacity-40"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isPast ? "bg-accent/15" :
                  isCurrent ? "bg-primary/10 ring-2 ring-primary/30" :
                  "bg-muted"
                }`}>
                  {isPast ? (
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                  ) : isCurrent ? (
                    <CircleDot className="w-4 h-4 text-primary animate-pulse" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isCurrent ? "text-foreground" : isPast ? "text-accent" : "text-muted-foreground"}`}>
                    {stage.label}
                  </p>
                  {isCurrent && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stage.description}</p>
                  )}
                </div>
                {isCurrent && (
                  <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">Aquí estás</Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link to="/interview-sim/practice" className="block">
            <Button className="w-full gap-2" variant="outline">
              <Mic className="w-4 h-4" />
              Practicar Entrevista Consular
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </Button>
          </Link>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground text-center italic">
            ⚖️ Este portal es informativo. Para consultas específicas, contacta a tu abogado.
          </p>
        </div>
      </div>
    </div>
  );
}
