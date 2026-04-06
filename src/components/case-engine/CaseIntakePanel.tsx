import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare, Phone, Mail, Globe, User, FileText,
  AlertTriangle, Brain, Target, Calendar, Clock, Sparkles, Pencil,
  Plus, Trash2, Users, ChevronDown, ChevronUp, ExternalLink, Hash
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface IntakeSession {
  id: string;
  entry_channel: string | null;
  referral_source: string | null;
  client_language: string | null;
  client_phone: string | null;
  client_email: string | null;
  current_status: string | null;
  entry_method: string | null;
  entry_date: string | null;
  current_documents: string[] | null;
  has_prior_deportation: boolean | null;
  has_criminal_record: boolean | null;
  client_goal: string | null;
  urgency_level: string | null;
  has_pending_deadline: boolean | null;
  deadline_date: string | null;
  ai_suggested_case_type: string | null;
  ai_confidence_score: number | null;
  ai_reasoning: string | null;
  ai_flags: string[] | null;
  final_case_type: string | null;
  notes: string | null;
}

interface CaseType {
  case_type: string;
  display_name: string;
  icon: string | null;
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "📱", instagram: "📸", referral: "👥",
  website: "🌐", phone: "📞", "walk-in": "🚶",
};
const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", referral: "Referido",
  website: "Website", phone: "Llamada", "walk-in": "Walk-in",
};
const URGENCY: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgente", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  high: { label: "Alta", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  normal: { label: "Normal", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  low: { label: "Baja", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};
const DOC_LABELS: Record<string, string> = {
  pasaporte_vigente: "Pasaporte vigente", i94: "I-94", ead: "EAD",
  green_card: "Green Card", visa_vigente: "Visa vigente",
  daca: "DACA", tps: "TPS", ninguno: "Ninguno",
};
const FLAG_CONFIG: Record<string, { label: string; color: string }> = {
  prior_deportation: { label: "Deportación previa", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  criminal_record: { label: "Antecedentes penales", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  urgent_deadline: { label: "Deadline urgente", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  complex_case: { label: "Caso complejo", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  multiple_options: { label: "Múltiples opciones", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
};

export function IntakeBadge({ caseId }: { caseId: string }) {
  const [has, setHas] = useState(false);
  useEffect(() => {
    supabase.from("intake_sessions").select("id").eq("case_id", caseId).limit(1)
      .then(({ data }) => setHas(!!(data && data.length > 0)));
  }, [caseId]);
  if (!has) return null;
  return <Badge variant="outline" className="text-[10px] border-jarvis/30 text-jarvis gap-1">📋 Intake completado</Badge>;
}

interface CaseIntakePanelProps {
  caseId: string;
  currentCaseType?: string;
  accountId?: string;
  userRole?: string | null;
  onCaseTypeChanged?: (newType: string) => void;
  caseData?: any;
  onCaseDataChanged?: (updates: Record<string, any>) => void;
}

export default function CaseIntakePanel({ caseId, currentCaseType, accountId, userRole, onCaseTypeChanged, caseData, onCaseDataChanged }: CaseIntakePanelProps) {
  const [intake, setIntake] = useState<IntakeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [correctedType, setCorrectedType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    supabase.from("intake_sessions")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setIntake(data && data.length > 0 ? data[0] as IntakeSession : null);
        setLoading(false);
      });
  }, [caseId]);

  // Load case types when editing starts
  useEffect(() => {
    if (editing && accountId && caseTypes.length === 0) {
      supabase.from("active_case_types")
        .select("case_type, display_name, icon")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("sort_order")
        .then(({ data }) => {
          if (data) setCaseTypes(data);
        });
    }
  }, [editing, accountId, caseTypes.length]);

  // Determine if AI type was corrected (comparing ai suggestion vs current case type)
  const aiType = intake?.ai_suggested_case_type || null;
  const wasCorrected = correctedType !== null && correctedType !== aiType;

  async function handleTypeChange(newType: string) {
    if (!caseId || !currentCaseType) return;
    const oldType = currentCaseType;
    if (newType === oldType) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await supabase.from("client_cases")
        .update({ case_type: newType } as any)
        .eq("id", caseId);

      setCorrectedType(newType);
      setEditing(false);

      await logAudit({
        action: "case.updated" as any,
        entity_type: "case",
        entity_id: caseId,
        entity_label: `Tipo cambiado de ${oldType} a ${newType} (corrección de AI)`,
        metadata: {
          correction_type: "case_type_corrected",
          old_type: oldType,
          new_type: newType,
          ai_suggested: aiType,
        },
      });

      toast.success("Tipo de caso actualizado correctamente");
      onCaseTypeChanged?.(newType);
    } catch (err) {
      toast.error("Error al actualizar tipo de caso");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !intake) return null;

  const channel = intake.entry_channel || "";
  const urgency = URGENCY[intake.urgency_level || "normal"] || URGENCY.normal;
  const docs = (intake.current_documents || []).filter(d => d && d !== "ninguno");
  const flags = intake.ai_flags || [];
  const confidence = intake.ai_confidence_score || 0;

  const displayType = correctedType || currentCaseType || aiType;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-jarvis" />
        Datos del Intake
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* CARD 1 — Cliente */}
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Información del Cliente
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Canal:</span>
              <span className="text-foreground text-xs font-medium">
                {CHANNEL_ICONS[channel] || "📋"} {CHANNEL_LABELS[channel] || channel}
              </span>
            </div>
            {intake.referral_source && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Referido por:</span>
                <span className="text-foreground text-xs font-medium">{intake.referral_source}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Idioma:</span>
              <span className="text-foreground text-xs font-medium">
                {intake.client_language === "es" ? "🇪🇸 Español" : "🇺🇸 English"}
              </span>
            </div>
            {intake.client_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground text-xs">{intake.client_phone}</span>
              </div>
            )}
            {intake.client_email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground text-xs">{intake.client_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2 — Situación Migratoria */}
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Situación Migratoria
          </p>
          <div className="space-y-1.5 text-sm">
            {intake.current_status && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Estatus:</span>
                <span className="text-foreground text-xs font-medium capitalize">{intake.current_status}</span>
              </div>
            )}
            {intake.entry_method && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Entrada:</span>
                <span className="text-foreground text-xs font-medium capitalize">{intake.entry_method}</span>
              </div>
            )}
            {intake.entry_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground text-xs">{intake.entry_date}</span>
              </div>
            )}
            {docs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {docs.map(d => (
                  <Badge key={d} variant="outline" className="text-[10px] border-border">
                    {DOC_LABELS[d] || d}
                  </Badge>
                ))}
              </div>
            )}
            {(intake.has_prior_deportation || intake.has_criminal_record) && (
              <div className="mt-2 space-y-1">
                {intake.has_prior_deportation && (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Deportación previa
                  </div>
                )}
                {intake.has_criminal_record && (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Antecedentes penales
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CARD 3 — Análisis AI */}
        <div className="rounded-xl border border-jarvis/20 bg-jarvis/5 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-jarvis uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Análisis AI
          </p>
          <div className="space-y-2 text-sm">
            {/* Type display with edit */}
            {aiType && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Tipo sugerido:</span>
                  {editing ? (
                    <Select
                      value={displayType || ""}
                      onValueChange={handleTypeChange}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-7 text-[10px] w-[180px] border-jarvis/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {caseTypes.map(ct => (
                          <SelectItem key={ct.case_type} value={ct.case_type} className="text-xs">
                            <span className="flex items-center gap-1.5">
                              <span>{ct.icon || "📋"}</span>
                              {ct.display_name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      {wasCorrected ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground line-through">
                            {aiType}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-jarvis/30 text-jarvis">
                            {correctedType}
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-jarvis/30 text-jarvis">
                          {displayType}
                        </Badge>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-jarvis"
                          onClick={() => setEditing(true)}
                        >
                          <Pencil className="w-3 h-3 mr-0.5" /> Cambiar
                        </Button>
                      )}
                    </>
                  )}
                </div>
                {wasCorrected && (
                  <Badge variant="outline" className="text-[9px] border-accent/30 text-accent">
                    🔄 Corregido por preparador
                  </Badge>
                )}
              </div>
            )}
            {confidence > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Confianza:</span>
                  <span className="text-xs font-bold text-jarvis">{confidence}%</span>
                </div>
                <Progress value={confidence} className="h-1.5 bg-border [&>div]:bg-jarvis" />
              </div>
            )}
            {intake.ai_reasoning && (
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                "{intake.ai_reasoning}"
              </p>
            )}
            {flags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {flags.map(f => {
                  const cfg = FLAG_CONFIG[f] || { label: f, color: "bg-muted text-muted-foreground border-border" };
                  return (
                    <Badge key={f} variant="outline" className={`text-[10px] ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CARD 4 — Objetivo */}
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Objetivo del Cliente
          </p>
          <div className="space-y-1.5 text-sm">
            {intake.client_goal && (
              <p className="text-xs text-foreground">{intake.client_goal}</p>
            )}
            {intake.notes && (
              <p className="text-xs text-muted-foreground italic">{intake.notes}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground text-xs">Urgencia:</span>
              <Badge variant="outline" className={`text-[10px] ${urgency.color}`}>
                {urgency.label}
              </Badge>
            </div>
            {intake.has_pending_deadline && intake.deadline_date && (
              <div className="flex items-center gap-1.5 text-orange-400 text-xs">
                <Clock className="w-3 h-3" />
                Deadline: {intake.deadline_date}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case Roles Section */}
      {caseData && (
        <CaseRolesSection
          caseId={caseId}
          caseData={caseData}
          canEdit={canEdit}
          onCaseDataChanged={onCaseDataChanged}
        />
      )}

      {/* Priority Date & Visa Category */}
      {caseData && (
        <CasePrioritySection
          caseId={caseId}
          caseData={caseData}
          canEdit={canEdit}
          onCaseDataChanged={onCaseDataChanged}
        />
      )}

      {/* USCIS Receipt Numbers */}
      {caseData && (
        <ReceiptNumbersSection
          caseId={caseId}
          caseData={caseData}
          canEdit={canEdit}
          onCaseDataChanged={onCaseDataChanged}
        />
      )}
    </div>
  );
}

/* ──────── Priority Date & Beneficiary Info Section ──────── */
function CasePrioritySection({ caseId, caseData, canEdit, onCaseDataChanged }: {
  caseId: string; caseData: any; canEdit: boolean;
  onCaseDataChanged?: (u: Record<string, any>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [priorityDate, setPriorityDate] = useState<Date | undefined>(
    caseData.priority_date ? new Date(caseData.priority_date + "T00:00:00") : undefined
  );
  const [visaCategory, setVisaCategory] = useState(caseData.visa_category || "");
  const [beneficiaryCountry, setBeneficiaryCountry] = useState(caseData.beneficiary_country || "");
  const [alienNumber, setAlienNumber] = useState(caseData.alien_number || "");

  async function saveField(field: string, value: any) {
    await supabase.from("client_cases").update({ [field]: value } as any).eq("id", caseId);
    onCaseDataChanged?.({ [field]: value });
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
        <FileText className="w-4 h-4 text-jarvis" />
        <h3 className="text-sm font-bold text-foreground flex-1">Información del Caso</h3>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Priority Date */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Prioridad</p>
            {canEdit ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-8 text-xs w-full justify-start", !priorityDate && "text-muted-foreground")}>
                    <Calendar className="w-3.5 h-3.5 mr-2" />
                    {priorityDate ? format(priorityDate, "PPP") : "Seleccionar fecha..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={priorityDate}
                    onSelect={(d) => {
                      setPriorityDate(d);
                      saveField("priority_date", d ? format(d, "yyyy-MM-dd") : null);
                    }}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <p className="text-sm text-foreground">{priorityDate ? format(priorityDate, "PPP") : "—"}</p>
            )}
          </div>

          {/* Visa Category */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoría de Visa</p>
            {canEdit ? (
              <Input value={visaCategory} onChange={e => setVisaCategory(e.target.value)}
                onBlur={() => saveField("visa_category", visaCategory)}
                placeholder="Ej: F2A, EB-3, IR-1" className="h-8 text-xs bg-background" />
            ) : (
              <p className="text-sm text-foreground">{visaCategory || "—"}</p>
            )}
          </div>

          {/* Beneficiary Country */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">País del Beneficiario</p>
            {canEdit ? (
              <Input value={beneficiaryCountry} onChange={e => setBeneficiaryCountry(e.target.value)}
                onBlur={() => saveField("beneficiary_country", beneficiaryCountry)}
                placeholder="Ej: México, Honduras..." className="h-8 text-xs bg-background" />
            ) : (
              <p className="text-sm text-foreground">{beneficiaryCountry || "—"}</p>
            )}
          </div>

          {/* Alien Number */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número A (Alien Number)</p>
            {canEdit ? (
              <Input value={alienNumber}
                onChange={e => {
                  let v = e.target.value.toUpperCase().replace(/[^A0-9-]/g, '');
                  if (v && !v.startsWith('A')) v = 'A' + v.replace(/^A*/, '');
                  setAlienNumber(v);
                }}
                onBlur={() => saveField("alien_number", alienNumber || null)}
                placeholder="A-XXX-XXX-XXX" className="h-8 text-xs bg-background font-mono" maxLength={13} />
            ) : (
              <p className="text-sm text-foreground font-mono">{alienNumber || "—"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────── USCIS Receipt Numbers Section ──────── */
interface ReceiptEntry {
  form: string;
  receipt_number: string;
  received_date: string;
  status: string;
}

const FORM_OPTIONS = [
  "I-130","I-485","I-765","I-131","N-400","I-864","I-539","I-90","I-751","I-589","I-360","Otro"
];

function ReceiptNumbersSection({ caseId, caseData, canEdit, onCaseDataChanged }: {
  caseId: string; caseData: any; canEdit: boolean;
  onCaseDataChanged?: (u: Record<string, any>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>(() => {
    try {
      const raw = caseData.uscis_receipt_numbers;
      return Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState("I-130");
  const [newNumber, setNewNumber] = useState("");
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newStatus, setNewStatus] = useState("Case Was Received");
  const [saving, setSaving] = useState(false);

  const receiptRegex = /^[A-Z]{3}-?\d{10}$/i;

  async function saveReceipts(updated: ReceiptEntry[]) {
    setSaving(true);
    await supabase.from("client_cases").update({ uscis_receipt_numbers: updated } as any).eq("id", caseId);
    onCaseDataChanged?.({ uscis_receipt_numbers: updated });
    setSaving(false);
  }

  function handleAdd() {
    if (!newNumber.trim()) { toast.error("Ingresa el número de recibo"); return; }
    const entry: ReceiptEntry = {
      form: newForm,
      receipt_number: newNumber.trim().toUpperCase(),
      received_date: newDate ? format(newDate, "yyyy-MM-dd") : "",
      status: newStatus,
    };
    const updated = [...receipts, entry];
    setReceipts(updated);
    saveReceipts(updated);
    setShowAdd(false);
    setNewNumber("");
    setNewDate(undefined);
    setNewStatus("Case Was Received");
    toast.success("Receipt number agregado");
  }

  function handleRemove(idx: number) {
    const updated = receipts.filter((_, i) => i !== idx);
    setReceipts(updated);
    saveReceipts(updated);
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
        <Hash className="w-4 h-4 text-jarvis" />
        <h3 className="text-sm font-bold text-foreground flex-1">Números de Recibo USCIS</h3>
        {receipts.length > 0 && (
          <Badge variant="outline" className="text-[10px] mr-2">{receipts.length}</Badge>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {receipts.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sin números de recibo registrados</p>
          )}
          {receipts.map((r, i) => (
            <div key={i} className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{r.form}</Badge>
                  <a
                    href="https://egov.uscis.gov/casestatus/landing.do"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono font-bold text-jarvis hover:underline flex items-center gap-1"
                  >
                    {r.receipt_number}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {r.received_date && <span>📅 {r.received_date}</span>}
                  {r.status && <span>📋 {r.status}</span>}
                </div>
              </div>
              {canEdit && (
                <button onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {canEdit && !showAdd && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="text-xs gap-1 w-full border-dashed">
              <Plus className="w-3.5 h-3.5" /> Agregar Receipt Number
            </Button>
          )}

          {showAdd && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm">Agregar Número de Recibo</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Formulario</label>
                    <Select value={newForm} onValueChange={setNewForm}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORM_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Número de Recibo</label>
                    <Input value={newNumber} onChange={e => setNewNumber(e.target.value.toUpperCase())}
                      placeholder="IOE-XXXXXXXXXX" className="h-8 text-xs mt-1 font-mono" maxLength={14} />
                    {newNumber && !receiptRegex.test(newNumber.replace(/-/g, '').replace(/^([A-Z]{3})/, '$1')) && (
                      <p className="text-[10px] text-amber-400 mt-0.5">Formato: 3 letras + 10 dígitos (ej: IOE0123456789)</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Fecha de Recibo</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-8 text-xs w-full justify-start mt-1", !newDate && "text-muted-foreground")}>
                          <Calendar className="w-3.5 h-3.5 mr-2" />
                          {newDate ? format(newDate, "PPP") : "Seleccionar..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent mode="single" selected={newDate} onSelect={setNewDate} className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status Actual</label>
                    <Input value={newStatus} onChange={e => setNewStatus(e.target.value)}
                      placeholder="Case Was Received" className="h-8 text-xs mt-1" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleAdd} size="sm" className="flex-1 text-xs" disabled={saving}>Guardar</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
  caseId: string;
  caseData: any;
  canEdit: boolean;
  onCaseDataChanged?: (updates: Record<string, any>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [petitioner, setPetitioner] = useState(caseData.petitioner_name || "");
  const [coSponsor, setCoSponsor] = useState(caseData.co_sponsor_name || "");
  const [showCoSponsor, setShowCoSponsor] = useState(!!caseData.co_sponsor_name);
  const [members, setMembers] = useState<HouseholdMember[]>(() => {
    try {
      const raw = caseData.household_members;
      return Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [saving, setSaving] = useState(false);

  async function saveField(field: string, value: any) {
    setSaving(true);
    try {
      await supabase.from("client_cases").update({ [field]: value } as any).eq("id", caseId);
      onCaseDataChanged?.({ [field]: value });
    } catch { /* silent */ }
    setSaving(false);
  }

  function addMember() {
    const updated = [...members, { name: "", relationship: "", income: "" }];
    setMembers(updated);
  }

  function removeMember(idx: number) {
    const updated = members.filter((_, i) => i !== idx);
    setMembers(updated);
    saveField("household_members", updated);
  }

  function updateMember(idx: number, field: keyof HouseholdMember, val: string) {
    const updated = members.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    setMembers(updated);
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Users className="w-4 h-4 text-jarvis" />
        <h3 className="text-sm font-bold text-foreground flex-1">Partes del Caso</h3>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {/* Petitioner */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Peticionario</p>
            {canEdit ? (
              <Input
                value={petitioner}
                onChange={e => setPetitioner(e.target.value)}
                onBlur={() => saveField("petitioner_name", petitioner)}
                placeholder="Nombre del peticionario..."
                className="h-8 text-xs bg-background"
              />
            ) : (
              <p className="text-sm text-foreground">{petitioner || "—"}</p>
            )}
          </div>

          {/* Co-Sponsor toggle */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Co-Sponsor</p>
              {canEdit && (
                <button
                  onClick={() => {
                    setShowCoSponsor(!showCoSponsor);
                    if (showCoSponsor) {
                      setCoSponsor("");
                      saveField("co_sponsor_name", null);
                    }
                  }}
                  className="text-[10px] text-jarvis hover:underline"
                >
                  {showCoSponsor ? "Quitar" : "+ Agregar"}
                </button>
              )}
            </div>
            {showCoSponsor && (
              canEdit ? (
                <Input
                  value={coSponsor}
                  onChange={e => setCoSponsor(e.target.value)}
                  onBlur={() => saveField("co_sponsor_name", coSponsor)}
                  placeholder="Nombre del co-sponsor..."
                  className="h-8 text-xs bg-background"
                />
              ) : (
                <p className="text-sm text-foreground">{coSponsor || "—"}</p>
              )
            )}
          </div>

          {/* Household Members */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Household Members</p>
              {canEdit && (
                <button onClick={addMember} className="text-[10px] text-jarvis hover:underline flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              )}
            </div>
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin miembros adicionales</p>
            )}
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                {canEdit ? (
                  <>
                    <Input
                      value={m.name}
                      onChange={e => updateMember(i, "name", e.target.value)}
                      onBlur={() => saveField("household_members", members)}
                      placeholder="Nombre"
                      className="h-7 text-[11px] bg-background flex-1"
                    />
                    <Input
                      value={m.relationship}
                      onChange={e => updateMember(i, "relationship", e.target.value)}
                      onBlur={() => saveField("household_members", members)}
                      placeholder="Relación"
                      className="h-7 text-[11px] bg-background w-24"
                    />
                    <Input
                      value={m.income}
                      onChange={e => updateMember(i, "income", e.target.value)}
                      onBlur={() => saveField("household_members", members)}
                      placeholder="Ingresos"
                      className="h-7 text-[11px] bg-background w-20"
                    />
                    <button onClick={() => removeMember(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-foreground">{m.name} — {m.relationship} {m.income ? `($${m.income})` : ""}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
