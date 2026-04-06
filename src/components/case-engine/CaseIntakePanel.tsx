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
    </div>
  );
}

interface HouseholdMember {
  name: string;
  relationship: string;
  income: string;
}

function CaseRolesSection({ caseId, caseData, canEdit, onCaseDataChanged }: {
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
