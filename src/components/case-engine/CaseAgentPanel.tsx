import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot, Loader2, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, Clock, Zap, RefreshCw, Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Agent {
  slug: string;
  name: string;
  emoji: string;
  title: string;
  description: string;
  credit_cost: number;
  color: string;
  available_plans: string[];
  edge_function: string;
}

interface Session {
  id: string;
  agent_slug: string;
  status: string;
  output_data: any;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
}

const AGENT_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  teal: { bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-400", accent: "bg-teal-500" },
  coral: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", accent: "bg-rose-500" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", accent: "bg-amber-500" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", accent: "bg-blue-500" },
};

const FORM_OPTIONS = [
  { value: "N-400", label: "N-400 — Naturalización" },
  { value: "I-485", label: "I-485 — Ajuste de Estatus" },
  { value: "I-130", label: "I-130 — Petición Familiar" },
  { value: "I-864", label: "I-864 — Affidavit of Support" },
  { value: "I-765", label: "I-765 — Permiso de Trabajo" },
  { value: "I-131", label: "I-131 — Advance Parole" },
  { value: "I-539", label: "I-539 — Extensión de Estatus" },
  { value: "I-751", label: "I-751 — Remover Condición" },
  { value: "I-360", label: "I-360 — VAWA / Petición Especial" },
];

const LOADING_MESSAGES: Record<string, string[]> = {
  felix: [
    "📋 Leyendo el expediente...",
    "📋 Mapeando datos al formulario...",
    "📋 Verificando campos requeridos...",
    "📋 Preparando el reporte...",
  ],
  nina: [
    "✍️ Revisando los documentos...",
    "✍️ Redactando la cover letter...",
    "✍️ Organizando el índice...",
    "✍️ Ensamblando el paquete final...",
  ],
  max: [
    "📊 Analizando el paquete...",
    "📊 Verificando documentos...",
    "📊 Detectando inconsistencias...",
    "📊 Preparando la evaluación...",
  ],
};

export default function CaseAgentPanel({ caseId, accountId }: { caseId: string; accountId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [credits, setCredits] = useState<{ balance: number; monthly_allowance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("professional");

  // Activation state
  const [confirmAgent, setConfirmAgent] = useState<Agent | null>(null);
  const [felixForm, setFelixForm] = useState("N-400");
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [activeOutput, setActiveOutput] = useState<{ agent: Agent; output: any } | null>(null);
  const [viewSession, setViewSession] = useState<Session | null>(null);

  useEffect(() => { loadData(); }, [caseId, accountId]);

  async function loadData() {
    const [agentsRes, sessionsRes, creditsRes, acctRes] = await Promise.all([
      supabase.from("ai_agents").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("ai_agent_sessions").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("ai_credits").select("balance, monthly_allowance").eq("account_id", accountId).single(),
      supabase.from("ner_accounts").select("plan").eq("id", accountId).single(),
    ]);
    if (agentsRes.data) setAgents(agentsRes.data as any);
    if (sessionsRes.data) setSessions(sessionsRes.data as any);
    if (creditsRes.data) setCredits(creditsRes.data as any);
    if (acctRes.data) setPlan((acctRes.data as any).plan || "professional");
    setLoading(false);
  }

  async function activateAgent(agent: Agent) {
    setConfirmAgent(null);
    setRunningAgent(agent.slug);

    // Rotating messages
    const msgs = LOADING_MESSAGES[agent.slug] || ["🤖 Procesando..."];
    let msgIdx = 0;
    setLoadingMsg(msgs[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % msgs.length;
      setLoadingMsg(msgs[msgIdx]);
    }, 3000);

    try {
      const body: any = { case_id: caseId, account_id: accountId };
      if (agent.slug === "felix") body.form_type = felixForm;

      const { data, error } = await supabase.functions.invoke(agent.edge_function, { body });

      clearInterval(interval);

      if (error) {
        toast.error(`Error al activar ${agent.name}`);
        console.error(error);
      } else if (data?.error === "insufficient_credits") {
        toast.error(`No hay suficientes créditos. Tienes ${data.balance}, necesitas ${data.needed}.`);
      } else if (data?.output) {
        setActiveOutput({ agent, output: data.output });
        toast.success(`${agent.emoji} ${agent.name} completó el trabajo`);
      }
    } catch (err) {
      clearInterval(interval);
      toast.error("Error inesperado");
    }

    setRunningAgent(null);
    setLoadingMsg("");
    loadData();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-jarvis animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Bot className="w-4 h-4 text-jarvis" />
            Equipo trabajando en este caso
          </h3>
        </div>
        {credits && (
          <Badge variant="outline" className="text-[10px] font-mono">
            Créditos: {credits.balance}/{credits.monthly_allowance}
          </Badge>
        )}
      </div>

      {/* Running indicator */}
      {runningAgent && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-jarvis/20 bg-jarvis/5 p-5 text-center"
        >
          <Loader2 className="w-8 h-8 text-jarvis animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">{loadingMsg}</p>
        </motion.div>
      )}

      {/* Agent Cards */}
      {!runningAgent && agents.map(agent => {
        const isAvailable = agent.available_plans.includes(plan);
        const colors = AGENT_COLORS[agent.color] || AGENT_COLORS.blue;
        const lastSession = sessions.find(s => s.agent_slug === agent.slug && s.status === "completed");

        return (
          <div key={agent.slug} className={`rounded-xl border ${isAvailable ? colors.border : "border-border/20"} ${isAvailable ? "bg-card" : "bg-card/30"} p-5`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${isAvailable ? colors.bg : "bg-muted/20"} flex items-center justify-center text-xl shrink-0`}>
                {isAvailable ? agent.emoji : "🔒"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`text-sm font-bold ${isAvailable ? "text-foreground" : "text-muted-foreground/40"}`}>{agent.name}</h4>
                  <span className="text-[10px] text-muted-foreground">— {agent.title}</span>
                </div>
                <p className={`text-xs mt-0.5 ${isAvailable ? "text-muted-foreground" : "text-muted-foreground/30"}`}>{agent.description}</p>

                {isAvailable && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="text-[9px]">Costo: {agent.credit_cost} créditos</Badge>

                    {agent.slug === "felix" && (
                      <Select value={felixForm} onValueChange={setFelixForm}>
                        <SelectTrigger className="h-7 w-[200px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORM_OPTIONS.map(f => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      size="sm"
                      className={`h-7 text-[11px] gap-1.5 ${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`}
                      variant="outline"
                      onClick={() => setConfirmAgent(agent)}
                    >
                      <Zap className="w-3 h-3" />
                      Activar {agent.name} — {agent.credit_cost} créditos
                    </Button>

                    {lastSession && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => setActiveOutput({ agent, output: lastSession.output_data })}
                      >
                        <Eye className="w-3 h-3" /> Ver último resultado
                      </Button>
                    )}
                  </div>
                )}

                {!isAvailable && (
                  <p className="text-[10px] text-muted-foreground/40 mt-2">
                    Disponible en <span className="font-semibold capitalize">{agent.available_plans[0]}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Session History */}
      {sessions.length > 0 && !runningAgent && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            Historial de sesiones en este caso
          </h4>
          <div className="space-y-2">
            {sessions.slice(0, 10).map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-muted/10">
                <span className="text-sm">{agents.find(a => a.slug === s.agent_slug)?.emoji || "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground">
                    {agents.find(a => a.slug === s.agent_slug)?.name || s.agent_slug}
                    <span className={`ml-2 text-[9px] ${s.status === "completed" ? "text-emerald-400" : s.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                      {s.status}
                    </span>
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { locale: es, addSuffix: true })} · {s.credits_used} créditos
                  </p>
                </div>
                {s.status === "completed" && (
                  <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2" onClick={() => setActiveOutput({ agent: agents.find(a => a.slug === s.agent_slug)!, output: s.output_data })}>
                    Ver
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={!!confirmAgent} onOpenChange={() => setConfirmAgent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmAgent?.emoji} {confirmAgent?.name}</DialogTitle>
            <DialogDescription>
              {confirmAgent?.name} usará {confirmAgent?.credit_cost} créditos.
              {credits && <><br />Te quedarán {credits.balance - (confirmAgent?.credit_cost || 0)} créditos este mes.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAgent(null)}>Cancelar</Button>
            <Button onClick={() => confirmAgent && activateAgent(confirmAgent)}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Output Modal */}
      <Dialog open={!!activeOutput} onOpenChange={() => setActiveOutput(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{activeOutput?.agent.emoji}</span>
              Resultado de {activeOutput?.agent.name}
            </DialogTitle>
          </DialogHeader>
          {activeOutput && <AgentOutputDisplay agent={activeOutput.agent} output={activeOutput.output} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentOutputDisplay({ agent, output }: { agent: Agent; output: any }) {
  if (!output || output.raw) {
    return <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/20 p-4 rounded-lg">{output?.raw || "Sin datos"}</pre>;
  }

  const colors = AGENT_COLORS[agent.color] || AGENT_COLORS.blue;

  // Felix output
  if (agent.slug === "felix") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{output.form}</span>
          <span className="text-sm text-muted-foreground">— {output.client_name}</span>
        </div>

        {/* Completion bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Completado</span>
            <span className="font-mono font-bold">{output.completion_percentage || 0}%</span>
          </div>
          <Progress value={output.completion_percentage || 0} className="h-2" />
        </div>

        {/* Parts */}
        {output.parts && Object.entries(output.parts).map(([key, part]: [string, any]) => (
          <div key={key} className="rounded-lg border border-border/50 p-3">
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-bold">{part.title}</h5>
              <Badge variant="outline" className="text-[9px]">{part.completion}%</Badge>
            </div>
            <div className="space-y-1">
              {part.fields?.map((f: any, i: number) => (
                <div key={i} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${
                  f.status === "completed" ? "bg-emerald-500/5" : f.status === "missing" ? "bg-red-500/5" : "bg-amber-500/5"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    f.status === "completed" ? "bg-emerald-400" : f.status === "missing" ? "bg-red-400" : "bg-amber-400"
                  }`} />
                  <span className="flex-1 text-muted-foreground">{f.field}</span>
                  <span className={`font-mono text-[10px] ${f.status === "completed" ? "text-foreground" : "text-red-400"}`}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Missing fields */}
        {output.missing_fields?.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <h5 className="text-xs font-bold text-red-400 mb-2">Campos faltantes</h5>
            <ul className="space-y-1">
              {output.missing_fields.map((f: string, i: number) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="w-3 h-3 text-red-400" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Felix note */}
        {output.felix_note && (
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
            <p className="text-xs text-foreground">{output.felix_note}</p>
          </div>
        )}
      </div>
    );
  }

  // Nina output
  if (agent.slug === "nina") {
    return (
      <div className="space-y-4">
        {output.package_title && <h4 className="text-sm font-bold">{output.package_title}</h4>}

        {output.cover_letter && (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <h5 className="text-xs font-bold">Cover Letter</h5>
            <div className="text-xs text-muted-foreground space-y-1 whitespace-pre-wrap">
              <p><strong>Fecha:</strong> {output.cover_letter.date}</p>
              <p><strong>Para:</strong> {output.cover_letter.service_center}</p>
              <p><strong>Re:</strong> {output.cover_letter.re}</p>
              <p className="mt-2">{output.cover_letter.salutation}</p>
              <p className="mt-1">{output.cover_letter.body}</p>
              <p className="mt-2">{output.cover_letter.closing}</p>
            </div>
          </div>
        )}

        {output.document_index?.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <h5 className="text-xs font-bold mb-2">Índice de Documentos</h5>
            {output.document_index.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/20 last:border-0">
                <Badge variant="outline" className="text-[8px] w-6 justify-center">{d.tab}</Badge>
                <span className="flex-1">{d.document}</span>
                <Badge className={`text-[8px] ${d.status === "received" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {output.missing_for_assembly?.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <h5 className="text-xs font-bold text-red-400 mb-2">Falta para ensamblar</h5>
            {output.missing_for_assembly.map((m: string, i: number) => (
              <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <XCircle className="w-3 h-3 text-red-400" /> {m}
              </p>
            ))}
          </div>
        )}

        {output.nina_note && (
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
            <p className="text-xs text-foreground">{output.nina_note}</p>
          </div>
        )}
      </div>
    );
  }

  // Max output
  if (agent.slug === "max") {
    const scoreColor = (output.readiness_score || 0) >= 80 ? "text-emerald-400" : (output.readiness_score || 0) >= 60 ? "text-amber-400" : "text-red-400";
    const scoreBg = (output.readiness_score || 0) >= 80 ? "bg-emerald-500/10" : (output.readiness_score || 0) >= 60 ? "bg-amber-500/10" : "bg-red-500/10";

    return (
      <div className="space-y-4">
        {/* Score */}
        <div className={`rounded-xl ${scoreBg} border border-border p-6 text-center`}>
          <p className={`text-4xl font-bold font-mono ${scoreColor}`}>{output.readiness_score || 0}</p>
          <p className="text-sm font-semibold text-foreground mt-1">{output.readiness_label}</p>
          <p className="text-xs text-muted-foreground mt-1">{output.summary}</p>
        </div>

        {/* Critical */}
        {output.critical_issues?.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-red-400">Problemas Críticos</h5>
            {output.critical_issues.map((c: any, i: number) => (
              <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                <p className="text-xs font-bold text-foreground">{c.issue}</p>
                <p className="text-[10px] text-muted-foreground">{c.impact}</p>
                <p className="text-[10px] text-red-400 font-medium">→ {c.action}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {output.warnings?.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-amber-400">Advertencias</h5>
            {output.warnings.map((w: any, i: number) => (
              <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                <p className="text-xs font-bold text-foreground">{w.issue}</p>
                <p className="text-[10px] text-muted-foreground">{w.impact}</p>
                <p className="text-[10px] text-amber-400 font-medium">→ {w.action}</p>
              </div>
            ))}
          </div>
        )}

        {/* Strengths */}
        {output.strengths?.length > 0 && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <h5 className="text-xs font-bold text-emerald-400 mb-2">Fortalezas</h5>
            {output.strengths.map((s: string, i: number) => (
              <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {s}
              </p>
            ))}
          </div>
        )}

        {/* Next Steps */}
        {output.next_steps?.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <h5 className="text-xs font-bold mb-2">Próximos Pasos</h5>
            {output.next_steps.map((s: string, i: number) => (
              <p key={i} className="text-[11px] text-muted-foreground py-0.5">
                {i + 1}. {s}
              </p>
            ))}
          </div>
        )}

        {output.max_note && (
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
            <p className="text-xs text-foreground">{output.max_note}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/20 p-4 rounded-lg">{JSON.stringify(output, null, 2)}</pre>;
}
