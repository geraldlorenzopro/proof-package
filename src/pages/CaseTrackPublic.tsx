import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, CircleDot, Loader2, Shield, Mic, ArrowLeft,
  FileText, Upload, ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StageInfo {
  order: number;
  slug: string;
  label: string;
  owner: string;
  description: string;
}

const B1B2_CHECKLIST = [
  { id: "passport", label: "Pasaporte vigente", desc: "Mínimo 6 meses de vigencia después de la fecha de viaje" },
  { id: "ds160", label: "Confirmación DS-160", desc: "Imprime la página de confirmación con el código de barras" },
  { id: "photo", label: "Foto tipo pasaporte", desc: "5x5 cm, fondo blanco, reciente (últimos 6 meses)" },
  { id: "appointment", label: "Hoja de cita", desc: "Confirmación de la cita en la embajada/consulado" },
  { id: "financial", label: "Pruebas financieras", desc: "Estados de cuenta bancarios de los últimos 3 meses" },
  { id: "employment", label: "Carta de empleo", desc: "Carta del empleador indicando puesto, salario y fecha de regreso" },
  { id: "property", label: "Prueba de propiedad", desc: "Escrituras, título de vehículo u otros bienes" },
  { id: "ties", label: "Lazos familiares", desc: "Actas de nacimiento de hijos, acta de matrimonio" },
  { id: "itinerary", label: "Itinerario de viaje", desc: "Reservación de hotel y vuelos (no necesitan estar pagados)" },
  { id: "invitation", label: "Carta de invitación", desc: "Si aplica — de quien te invita en EE.UU." },
];

export default function CaseTrackPublic() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`b1b2-checklist-${token}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    if (!token) return;
    loadCase();
  }, [token]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(`b1b2-checklist-${token}`, JSON.stringify([...checkedItems]));
    }
  }, [checkedItems, token]);

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
          const raw = typeof parsed.stages === "string" ? JSON.parse(parsed.stages) : parsed.stages;
          setStages((raw as any[]).map((s: any, i: number) => ({
            order: s.order ?? i + 1,
            slug: s.slug || s.key || `stage-${i}`,
            label: s.label || "",
            owner: s.owner || s.ball_in_court || "team",
            description: s.description || "",
          })));
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

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
  const checklistPct = B1B2_CHECKLIST.length > 0 ? Math.round((checkedItems.size / B1B2_CHECKLIST.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{caseData.client_name}</h1>
            <p className="text-sm text-muted-foreground">
              {caseData.process_label || caseData.case_type} — Mi Portal
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="status" className="text-xs gap-1">
              <CircleDot className="w-3 h-3" />
              Estado
            </TabsTrigger>
            <TabsTrigger value="interview" className="text-xs gap-1">
              <Mic className="w-3 h-3" />
              Entrevista
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs gap-1">
              <FileText className="w-3 h-3" />
              Documentos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Estado del Caso */}
          <TabsContent value="status" className="space-y-6">
            {/* Progress card */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progreso</span>
                <span className="text-lg font-bold text-primary">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2.5" />
              <p className="text-[11px] text-muted-foreground">
                Etapa {Math.max(currentIdx, 0) + 1} de {stages.length}
              </p>
            </div>

            {/* Pipeline stages — 2-col grid */}
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
                      <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 shrink-0">Aquí estás</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab: Simulador de Entrevista */}
          <TabsContent value="interview" className="space-y-4">
            <div className="rounded-xl border border-border/50 p-5 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Simulador de Entrevista</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Practica las preguntas más comunes de la entrevista consular B1/B2.
                  Escucha cada pregunta en inglés y graba tu respuesta.
                </p>
              </div>
              <div className="space-y-2 text-left text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>25+ preguntas reales de entrevista consular</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Audio en inglés para practicar comprensión</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Tips del abogado para cada pregunta</span>
                </div>
              </div>
              <Link to="/interview-sim/practice" className="block">
                <Button className="w-full gap-2">
                  <Mic className="w-4 h-4" />
                  Comenzar Práctica
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </Link>
            </div>
          </TabsContent>

          {/* Tab: Checklist de Documentos */}
          <TabsContent value="checklist" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Documentos listos</span>
                <span className="text-xs font-bold text-primary">{checkedItems.size}/{B1B2_CHECKLIST.length}</span>
              </div>
              <Progress value={checklistPct} className="h-2" />
            </div>

            <div className="space-y-2">
              {B1B2_CHECKLIST.map((item) => {
                const checked = checkedItems.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    className={`w-full text-left flex items-start gap-3 rounded-xl px-4 py-3 border transition-all ${
                      checked
                        ? "bg-accent/5 border-accent/20"
                        : "bg-transparent border-border/30 hover:border-border/60"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      checked ? "bg-accent/15" : "bg-muted"
                    }`}>
                      {checked ? (
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${checked ? "text-accent line-through" : "text-foreground"}`}>
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

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
