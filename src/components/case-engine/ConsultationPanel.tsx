import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Mic, Clock, Play, Square, Save, Plus, X, Trash2,
  AlertTriangle, Shield, Calendar, Users, DollarSign,
  Heart, FileText, Scale, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ConsultationPanelProps {
  caseId: string;
  accountId: string;
  clientName: string;
  caseType: string;
  currentStatus?: string;
  clientProfileId?: string;
}

interface Derivative {
  id: string;
  name: string;
  relationship: string;
  dob?: string;
  country_of_birth?: string;
  immigration_status?: string;
  notes?: string;
}

interface Consultation {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  raw_notes: string | null;
  ai_summary: string | null;
  ai_eligibility_assessment: string | null;
  ai_recommended_case_type: string | null;
  ai_flags: string[] | null;
  ai_action_items: string[] | null;
  ai_strengths: string[] | null;
  ai_risks: string[] | null;
  derivatives: Derivative[];
  decision: string | null;
  decision_notes: string | null;
  contract_amount: number | null;
  follow_up_date: string | null;
  status: string;
  created_at: string;
}

const QUICK_FLAGS = [
  { label: "Deportación previa", icon: "🚨", tag: "prior_deportation" },
  { label: "Antecedentes penales", icon: "⚠️", tag: "criminal_record" },
  { label: "Deadline urgente", icon: "📅", tag: "urgent_deadline" },
  { label: "Tiene derivados", icon: "👨‍👩‍👧", tag: "has_derivatives" },
  { label: "Problema de pago", icon: "💰", tag: "payment_issue" },
  { label: "Caso humanitario", icon: "🏥", tag: "humanitarian" },
  { label: "Falta documentación", icon: "📋", tag: "missing_docs" },
  { label: "Caso en corte", icon: "⚖️", tag: "court_case" },
];

const FLAG_COLORS: Record<string, string> = {
  prior_deportation: "bg-red-500/10 text-red-400 border-red-500/20",
  criminal_record: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  urgent_deadline: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  complex_case: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  humanitarian: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  court_case: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  missing_docs: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  payment_issue: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  has_derivatives: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const DECISION_OPTIONS = [
  { value: "contracted", label: "CONTRATÓ", icon: "✅", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" },
  { value: "thinking", label: "PENSANDO", icon: "🤔", color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20" },
  { value: "no_contract", label: "NO CONTRATÓ", icon: "❌", color: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" },
  { value: "referred_attorney", label: "REFERIDO A ABOGADO", icon: "⚖️", color: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20" },
  { value: "no_show", label: "NO SHOW", icon: "🚫", color: "bg-zinc-500/10 border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/20" },
];

const AI_MESSAGES = [
  "Analizando las notas con Claude...",
  "Evaluando elegibilidad legal...",
  "Identificando fortalezas y riesgos...",
  "Generando plan de acción...",
];

const RELATIONSHIPS = ["Cónyuge", "Hijo/a", "Madre", "Padre", "Hermano/a", "Otro"];

export default function ConsultationPanel({
  caseId, accountId, clientName, caseType, currentStatus, clientProfileId,
}: ConsultationPanelProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [active, setActive] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [wordCount, setWordCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessageIdx, setAiMessageIdx] = useState(0);
  const [aiResult, setAiResult] = useState<any>(null);

  // Decision gate
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [decidingLoading, setDecidingLoading] = useState(false);

  // Derivatives
  const [derivatives, setDerivatives] = useState<Derivative[]>([]);
  const [showDerivativeModal, setShowDerivativeModal] = useState(false);
  const [newDerivative, setNewDerivative] = useState<Partial<Derivative>>({});

  // History
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const autoSaveRef = useRef<number | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Load consultations
  const loadConsultations = useCallback(async () => {
    const { data, error } = await supabase
      .from("consultations" as any)
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (data) {
      const typed = (data as any[]).map(c => ({
        ...c,
        derivatives: Array.isArray(c.derivatives) ? c.derivatives : [],
        ai_flags: c.ai_flags || [],
        ai_action_items: c.ai_action_items || [],
        ai_strengths: c.ai_strengths || [],
        ai_risks: c.ai_risks || [],
      })) as Consultation[];
      setConsultations(typed);

      const activeOne = typed.find(c => c.status === "active");
      if (activeOne) {
        setActive(activeOne);
        setNotes(activeOne.raw_notes || "");
        setDerivatives(activeOne.derivatives || []);
        if (activeOne.ai_summary) {
          setAiResult({
            summary: activeOne.ai_summary,
            eligibility: activeOne.ai_eligibility_assessment,
            strengths: activeOne.ai_strengths,
            risks: activeOne.ai_risks,
            flags: activeOne.ai_flags,
            action_items: activeOne.ai_action_items,
            recommended_case_type: activeOne.ai_recommended_case_type,
          });
        }
      }
    }
    setLoading(false);
  }, [caseId]);

  useEffect(() => { loadConsultations(); }, [loadConsultations]);

  // Timer
  useEffect(() => {
    if (active && !active.ended_at) {
      const startTime = new Date(active.started_at).getTime();
      const tick = () => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      };
      tick();
      timerRef.current = window.setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [active]);

  // Auto-save every 10s
  useEffect(() => {
    if (active && !active.ended_at) {
      autoSaveRef.current = window.setInterval(() => {
        saveNotes(notesRef.current);
      }, 10000);
      return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
    }
  }, [active]);

  // Word count
  useEffect(() => {
    setWordCount(notes.trim() ? notes.trim().split(/\s+/).length : 0);
  }, [notes]);

  // AI loading message rotation
  useEffect(() => {
    if (aiLoading) {
      const interval = setInterval(() => {
        setAiMessageIdx(prev => (prev + 1) % AI_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [aiLoading]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const saveNotes = async (text: string) => {
    if (!active) return;
    setSaveStatus("saving");
    await supabase.from("consultations" as any).update({
      raw_notes: text,
      derivatives: derivatives,
    } as any).eq("id", active.id);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const startConsultation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("consultations" as any).insert({
      account_id: accountId,
      case_id: caseId,
      client_profile_id: clientProfileId || null,
      created_by: user.id,
      status: "active",
      raw_notes: "",
      derivatives: [],
    } as any).select().single();

    if (data) {
      setActive(data as any);
      setNotes("");
      setDerivatives([]);
      setAiResult(null);
      setSelectedDecision(null);
      toast.success("Consulta iniciada");
      loadConsultations();
    }
  };

  const endConsultation = async () => {
    if (!active) return;
    // Save final notes
    await saveNotes(notes);

    const startedAt = new Date(active.started_at);
    const endedAt = new Date();
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

    await supabase.from("consultations" as any).update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
    } as any).eq("id", active.id);

    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    setActive(prev => prev ? { ...prev, ended_at: endedAt.toISOString(), duration_minutes: durationMinutes } : null);

    // Call AI
    if (notes.trim().length > 20) {
      setAiLoading(true);
      setAiMessageIdx(0);
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("summarize-consultation", {
          body: {
            consultation_id: active.id,
            raw_notes: notes,
            case_type: caseType,
            client_name: clientName,
            current_status: currentStatus || "",
            derivatives,
          },
        });

        if (fnErr) throw fnErr;
        setAiResult(fnData);
        toast.success("Análisis AI completado");
      } catch (err) {
        console.error("AI error:", err);
        toast.error("Error al generar análisis AI");
      } finally {
        setAiLoading(false);
      }
    }
  };

  const addFlag = (tag: string, label: string) => {
    const flagText = `\n[FLAG: ${label}]`;
    setNotes(prev => prev + flagText);
  };

  const addDerivative = () => {
    if (!newDerivative.name || !newDerivative.relationship) {
      toast.error("Nombre y relación son requeridos");
      return;
    }
    const d: Derivative = {
      id: crypto.randomUUID(),
      name: newDerivative.name,
      relationship: newDerivative.relationship,
      dob: newDerivative.dob,
      country_of_birth: newDerivative.country_of_birth,
      immigration_status: newDerivative.immigration_status,
      notes: newDerivative.notes,
    };
    setDerivatives(prev => [...prev, d]);
    setNewDerivative({});
    setShowDerivativeModal(false);
  };

  const removeDerivative = (id: string) => {
    setDerivatives(prev => prev.filter(d => d.id !== id));
  };

  const confirmDecision = async () => {
    if (!active || !selectedDecision) return;
    setDecidingLoading(true);

    try {
      await supabase.from("consultations" as any).update({
        decision: selectedDecision,
        decision_notes: decisionNotes || null,
        contract_amount: selectedDecision === "contracted" ? parseFloat(contractAmount) || null : null,
        follow_up_date: selectedDecision === "thinking" ? followUpDate || null : null,
        status: "completed",
      } as any).eq("id", active.id);

      // Sync to GHL silently
      supabase.functions.invoke("sync-case-stage-to-ghl", {
        body: { case_id: caseId, decision: selectedDecision, account_id: accountId },
      }).catch(err => console.warn("GHL sync failed:", err));

      // If contracted, update case status
      if (selectedDecision === "contracted") {
        await supabase.from("client_cases").update({ status: "active" } as any).eq("id", caseId);
      }

      toast.success("Decisión registrada correctamente");
      setActive(prev => prev ? { ...prev, status: "completed", decision: selectedDecision } : null);
      loadConsultations();
    } catch (err) {
      toast.error("Error al guardar decisión");
    } finally {
      setDecidingLoading(false);
    }
  };

  // Completed consultations for history
  const pastConsultations = consultations.filter(c => c.id !== active?.id && c.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-jarvis" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION A — Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Mic className="w-4 h-4 text-jarvis" />
              Consulta — {clientName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{caseType}</p>
          </div>

          <div className="flex items-center gap-3">
            {active && !active.ended_at && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 font-mono text-xs">
                  {formatTime(elapsed)}
                </Badge>
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20">🔴 En consulta</Badge>
              </div>
            )}
            {active?.ended_at && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                ✅ Completada • {active.duration_minutes}min
              </Badge>
            )}
            {!active && (
              <Badge variant="outline" className="text-muted-foreground">⚪ Sin consulta</Badge>
            )}
          </div>

          <div>
            {!active && (
              <Button size="sm" onClick={startConsultation} className="bg-jarvis hover:bg-jarvis/90 text-white gap-1.5">
                <Play className="w-3.5 h-3.5" /> Iniciar consulta
              </Button>
            )}
            {active && !active.ended_at && (
              <Button size="sm" variant="destructive" onClick={endConsultation} className="gap-1.5">
                <Square className="w-3.5 h-3.5" /> Finalizar consulta
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION B — Notes (only during/after active consultation) */}
      {active && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-jarvis" />
            Notas de la consulta
          </h4>

          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Toma notas aquí durante la consulta... El AI generará el resumen al finalizar."
            className="min-h-[200px] resize-y text-sm"
            disabled={!!active.ended_at}
          />

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{wordCount} palabras</span>
            <span>
              {saveStatus === "saving" && "Guardando..."}
              {saveStatus === "saved" && "Guardado ✓"}
            </span>
          </div>

          {/* Quick flags */}
          {!active.ended_at && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Flags rápidos</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FLAGS.map(f => (
                  <button
                    key={f.tag}
                    onClick={() => addFlag(f.tag, f.label)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors flex items-center gap-1"
                  >
                    <span>{f.icon}</span> {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION C — Derivatives */}
      {active && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-jarvis" />
              Derivados ({derivatives.length})
            </h4>
            {!active.ended_at && (
              <Button size="sm" variant="outline" onClick={() => setShowDerivativeModal(true)} className="text-xs gap-1">
                <Plus className="w-3 h-3" /> Agregar
              </Button>
            )}
          </div>

          {derivatives.length === 0 && (
            <p className="text-xs text-muted-foreground">No hay derivados registrados.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {derivatives.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30">
                <div className="w-9 h-9 rounded-full bg-jarvis/10 text-jarvis flex items-center justify-center text-xs font-bold shrink-0">
                  {d.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.relationship} • {d.immigration_status || "Sin estatus"}</p>
                </div>
                {!active.ended_at && (
                  <button onClick={() => removeDerivative(d.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Derivative Modal */}
          <Dialog open={showDerivativeModal} onOpenChange={setShowDerivativeModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar derivado</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nombre completo *</Label>
                  <Input value={newDerivative.name || ""} onChange={e => setNewDerivative(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Relación *</Label>
                  <Select value={newDerivative.relationship || ""} onValueChange={v => setNewDerivative(p => ({ ...p, relationship: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fecha de nacimiento</Label>
                  <Input type="date" value={newDerivative.dob || ""} onChange={e => setNewDerivative(p => ({ ...p, dob: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">País de nacimiento</Label>
                  <Input value={newDerivative.country_of_birth || ""} onChange={e => setNewDerivative(p => ({ ...p, country_of_birth: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Estatus migratorio</Label>
                  <Input value={newDerivative.immigration_status || ""} onChange={e => setNewDerivative(p => ({ ...p, immigration_status: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Input value={newDerivative.notes || ""} onChange={e => setNewDerivative(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDerivativeModal(false)}>Cancelar</Button>
                <Button onClick={addDerivative}>Agregar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* SECTION D — AI Result */}
      {active && (aiLoading || aiResult) && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-jarvis" />
            Análisis AI
          </h4>

          {aiLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-8 gap-4"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-jarvis/20 border-t-jarvis animate-spin" />
                <Sparkles className="w-5 h-5 text-jarvis absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={aiMessageIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-muted-foreground"
                >
                  {AI_MESSAGES[aiMessageIdx]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}

          {aiResult && !aiLoading && (
            <div className="space-y-4">
              {/* Flags */}
              {aiResult.flags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiResult.flags.map((f: string) => (
                    <Badge key={f} className={`text-[10px] ${FLAG_COLORS[f] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                      {f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-4 bg-secondary/20">
                  <h5 className="text-xs font-bold text-foreground mb-2">📋 Resumen Ejecutivo</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">{aiResult.summary}</p>
                </div>

                <div className="rounded-xl border border-border p-4 bg-secondary/20">
                  <h5 className="text-xs font-bold text-foreground mb-2">🎯 Evaluación de Elegibilidad</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">{aiResult.eligibility}</p>
                </div>

                <div className="rounded-xl border border-border p-4 bg-secondary/20">
                  <h5 className="text-xs font-bold text-foreground mb-2">Fortalezas y Riesgos</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400 mb-1">✅ Fortalezas</p>
                      <ul className="space-y-1">
                        {aiResult.strengths?.map((s: string, i: number) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-amber-400 mb-1">⚠️ Riesgos</p>
                      <ul className="space-y-1">
                        {aiResult.risks?.map((r: string, i: number) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 bg-secondary/20">
                  <h5 className="text-xs font-bold text-foreground mb-2">📝 Pasos a Seguir</h5>
                  <ol className="space-y-1">
                    {aiResult.action_items?.map((a: string, i: number) => (
                      <li key={i} className="text-[11px] text-muted-foreground">{i + 1}. {a}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION E — Decision Gate */}
      {active?.ended_at && active.status !== "completed" && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Scale className="w-4 h-4 text-jarvis" />
            ¿Cuál fue el resultado?
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {DECISION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedDecision(opt.value)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  selectedDecision === opt.value
                    ? opt.color + " ring-1 ring-current"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                <span className="text-lg block mb-1">{opt.icon}</span>
                <span className="text-[10px] font-bold block">{opt.label}</span>
              </button>
            ))}
          </div>

          {selectedDecision === "contracted" && (
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Monto del contrato ($)</Label>
                <Input type="number" placeholder="0.00" value={contractAmount} onChange={e => setContractAmount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Notas del contrato</Label>
                <Textarea value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} placeholder="Detalles del contrato..." className="min-h-[60px]" />
              </div>
            </div>
          )}

          {selectedDecision === "thinking" && (
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Fecha de seguimiento</Label>
                <Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Notas adicionales</Label>
                <Textarea value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} placeholder="Notas..." className="min-h-[60px]" />
              </div>
            </div>
          )}

          {selectedDecision && (
            <Button onClick={confirmDecision} disabled={decidingLoading} className="w-full bg-jarvis hover:bg-jarvis/90 text-white">
              {decidingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar decisión
            </Button>
          )}
        </div>
      )}

      {/* Decision summary for completed */}
      {active?.decision && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Decisión registrada
          </h4>
          <div className="flex items-center gap-2">
            <Badge className={
              DECISION_OPTIONS.find(o => o.value === active.decision)?.color || ""
            }>
              {DECISION_OPTIONS.find(o => o.value === active.decision)?.icon}{" "}
              {DECISION_OPTIONS.find(o => o.value === active.decision)?.label}
            </Badge>
            {active.contract_amount && (
              <Badge variant="outline" className="text-xs">${active.contract_amount.toLocaleString()}</Badge>
            )}
            {active.follow_up_date && (
              <Badge variant="outline" className="text-xs">📅 {active.follow_up_date}</Badge>
            )}
          </div>
          {active.decision_notes && (
            <p className="text-xs text-muted-foreground mt-2">{active.decision_notes}</p>
          )}
        </div>
      )}

      {/* SECTION — History */}
      {pastConsultations.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-jarvis" />
            Consultas anteriores ({pastConsultations.length})
          </h4>

          {pastConsultations.map(c => (
            <div key={c.id} className="border border-border rounded-xl p-3 bg-secondary/20">
              <button
                onClick={() => setExpandedHistory(expandedHistory === c.id ? null : c.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.started_at).toLocaleDateString("es")} • {c.duration_minutes || "?"}min
                  </span>
                  {c.decision && (
                    <Badge className={`text-[9px] ${DECISION_OPTIONS.find(o => o.value === c.decision)?.color || ""}`}>
                      {DECISION_OPTIONS.find(o => o.value === c.decision)?.icon}{" "}
                      {DECISION_OPTIONS.find(o => o.value === c.decision)?.label}
                    </Badge>
                  )}
                </div>
                {expandedHistory === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {expandedHistory === c.id && c.ai_summary && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground">{c.ai_summary}</p>
                  {c.ai_action_items && c.ai_action_items.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-foreground">Pasos:</p>
                      <ul className="text-[11px] text-muted-foreground">
                        {c.ai_action_items.map((a, i) => <li key={i}>• {a}</li>)}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export for tab badge
export function ConsultationLiveBadge({ caseId }: { caseId: string }) {
  const [hasActive, setHasActive] = useState(false);

  useEffect(() => {
    supabase
      .from("consultations" as any)
      .select("id")
      .eq("case_id", caseId)
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => {
        setHasActive(!!data && data.length > 0);
      });
  }, [caseId]);

  if (!hasActive) return null;

  return (
    <span className="relative flex h-2 w-2 ml-1">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  );
}
