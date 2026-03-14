import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Shield, Copy, Check, CheckCircle2, CircleDot,
  ExternalLink, ChevronRight, AlertTriangle, Send, Mic, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface CaseInfo {
  id: string;
  client_name: string;
  case_type: string;
  process_type: string;
  pipeline_stage: string;
  status: string;
  access_token: string;
}

interface StageInfo {
  order: number;
  slug: string;
  label: string;
  owner: string;
  description: string;
}

export default function B1B2AdminLite() {
  const { cid } = useParams<{ cid: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseInfo | null>(null);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [accountName, setAccountName] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!cid) return;
    loadCases();
  }, [cid]);

  const loadCases = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("resolve-client-portal", {
        body: { cid },
      });
      if (fnErr) throw fnErr;
      if (!data?.cases?.length) {
        setError("No se encontraron casos B1/B2 para este contacto.");
        return;
      }
      setAccountName(data.account_name || "");
      setCases(data.cases);
      // Auto-select first B1/B2 case
      const b1b2 = data.cases.find((c: any) =>
        c.process_type === "b1b2-visa" || c.process_type === "b1-b2-tourist"
      );
      const target = b1b2 || data.cases[0];
      setSelectedCase(target);
      await loadPipeline(target.access_token);
    } catch (e) {
      console.error(e);
      setError("Error al cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const loadPipeline = async (token: string) => {
    const { data } = await supabase.rpc("get_case_pipeline_by_token" as any, { _token: token });
    if (data) {
      const parsed = Array.isArray(data) ? data[0] : data;
      if (parsed?.stages) {
        const raw = typeof parsed.stages === "string" ? JSON.parse(parsed.stages) : parsed.stages;
        setStages((raw as any[]).map((s: any, i: number) => ({
          order: s.order ?? i + 1,
          slug: s.slug || s.key || `stage-${i}`,
          label: s.label || "",
          owner: s.owner || s.ball_in_court || "team",
          description: s.description || "",
        })));
        if (selectedCase || true) {
          setSelectedCase(prev => prev ? {
            ...prev,
            pipeline_stage: parsed?.pipeline_stage || prev.pipeline_stage,
          } : prev);
        }
      }
    }
  };

  const copyClientLink = () => {
    if (!selectedCase) return;
    const link = `${window.location.origin}/case-track/${selectedCase.access_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: "Link copiado", description: "Envíalo al cliente por WhatsApp o email." });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !selectedCase) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground text-sm">{error || "Caso no encontrado"}</p>
        </div>
      </div>
    );
  }

  const currentStage = selectedCase.pipeline_stage || "consulta-inicial";
  const currentIdx = stages.findIndex(s => s.slug === currentStage);
  const progressPct = stages.length > 0 ? Math.round(((Math.max(currentIdx, 0) + 1) / stages.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header — wider with more breathing room */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{selectedCase.client_name}</h1>
            <p className="text-sm text-muted-foreground">Visa B1/B2 — Portal del Abogado</p>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1">
            {selectedCase.status === "completed" ? "Completado" : "Activo"}
          </Badge>
        </div>

        {/* Top row: Actions + Progress side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Quick Actions */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones Rápidas</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={copyClientLink}
                className="gap-2 h-auto py-3.5"
                variant={copied ? "default" : "outline"}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-xs">{copied ? "¡Copiado!" : "Copiar Link Cliente"}</span>
              </Button>
              <Button
                variant="outline"
                className="gap-2 h-auto py-3.5"
                onClick={() => {
                  const link = `${window.location.origin}/case-track/${selectedCase.access_token}`;
                  window.open(link, "_blank");
                }}
              >
                <ExternalLink className="w-4 h-4" />
                <span className="text-xs">Ver como Cliente</span>
              </Button>
            </div>
          </div>

          {/* Progress Card */}
          <div className="rounded-xl border border-border/40 bg-card/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progreso del Caso</span>
              <span className="text-lg font-bold text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2.5" />
            <p className="text-[10px] text-muted-foreground">
              Etapa {Math.max(currentIdx, 0) + 1} de {stages.length}
            </p>
          </div>
        </div>

        {/* Pipeline — two-column grid instead of vertical list */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Pipeline del Caso</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stages.map((stage, i) => {
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div
                  key={stage.slug}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-all ${
                    isCurrent
                      ? "bg-primary/5 border-primary/25 shadow-md shadow-primary/5"
                      : isPast
                      ? "bg-accent/5 border-accent/15"
                      : "bg-card/30 border-border/20 opacity-50"
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
                    {isCurrent && stage.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{stage.description}</p>
                    )}
                  </div>
                  {isCurrent && (
                    <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 shrink-0">Actual</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Client Resources — horizontal cards */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Recursos del Cliente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-card/50 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/15">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Simulador de Entrevista</p>
                <p className="text-xs text-muted-foreground">ZYMA — Práctica consular</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">Incluido</Badge>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-[11px] text-muted-foreground text-center">
            Portal B1/B2 — Vista del abogado • {accountName}
          </p>
        </div>
      </div>
    </div>
  );
}
