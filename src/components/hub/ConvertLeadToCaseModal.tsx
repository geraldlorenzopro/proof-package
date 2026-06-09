/**
 * ConvertLeadToCaseModal — Convierte un lead en un caso activo.
 *
 * Soporta 2 modos:
 *  - "simple": 1 caso con 1 form principal (flow original)
 *  - "smart":  1 caso con N forms (Smart Process template). Inserta rows en
 *              case_forms por cada form marcado como requerido. case_type se
 *              setea al nombre del template.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Briefcase, Search, Sparkles, FileText, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { CASE_TYPES, CATEGORY_LABELS, type CaseTypeMeta, type CaseTypeCategory } from "@/lib/caseTypes";
import { getPrimaryFormForCaseType, getFormsForCaseType } from "@/lib/caseTypeToForms";
import { USCIS_FORMS_CATALOG } from "@/lib/uscisForms";

type ProcessStage = "uscis" | "nvc" | "embajada" | "court" | "ice";
type CreationMode = "simple" | "smart";

interface TemplateForm {
  form_type: string;
  required: boolean;
  sort_order: number;
}

interface SmartTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  case_type: string | null;
  account_id: string | null; // null = global NER
  forms_included: TemplateForm[];
}

const PIPELINE_OPTIONS: Array<{ value: ProcessStage; label: string; description: string; chipClass: string }> = [
  { value: "uscis",    label: "USCIS",        description: "Petición / ajuste / EAD",       chipClass: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  { value: "nvc",      label: "NVC",          description: "Visa Center · DS-260",          chipClass: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  { value: "embajada", label: "Consular",     description: "Embajada · entrevista",         chipClass: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  { value: "court",    label: "Corte EOIR",   description: "Master · Individual · BIA",     chipClass: "bg-red-500/10 border-red-500/30 text-red-300" },
  { value: "ice",      label: "ICE",          description: "Detención · Bond · Removal",    chipClass: "bg-rose-700/10 border-rose-700/30 text-rose-300" },
];

interface LeadInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_id: string;
}

interface TeamMember {
  user_id: string;
  full_name: string | null;
  role: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadInfo | null;
  onCreated?: (caseId: string) => void;
}

export default function ConvertLeadToCaseModal({ open, onOpenChange, lead, onCreated }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CreationMode>("simple");

  // Simple mode state
  const [caseTypeKey, setCaseTypeKey] = useState<string>("");
  const [caseTypeSearch, setCaseTypeSearch] = useState("");

  // Smart mode state
  const [templates, setTemplates] = useState<SmartTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [enabledForms, setEnabledForms] = useState<Record<string, boolean>>({});

  // Extra ad-hoc forms (ambos modos) — sumados al margen del template/case_type.
  // Use case: I-130 + I-601A waiver + I-907 premium. Cherry-pickeado de
  // lovable-sync-1779996417 commit ac34d31 (2026-05-28). Las demás partes
  // de esa branch revertían fixes del 28/5 (filtro anti-staff, simplificación
  // v8.6 SmartFormsLayout, Resend→GHL en send-email) → close de la branch
  // documentado en HUMAN-ACTIONS #8/#11.
  const [extraForms, setExtraForms] = useState<string[]>([]);
  const [extraSearch, setExtraSearch] = useState("");
  const [extraPickerOpen, setExtraPickerOpen] = useState(false);

  // Shared
  const [processStage, setProcessStage] = useState<ProcessStage>("uscis");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setMode("simple");
      setCaseTypeKey("");
      setCaseTypeSearch("");
      setSelectedTemplateId("");
      setEnabledForms({});
      setProcessStage("uscis");
      setNotes("");
    }
  }, [open]);

  // Cargar equipo
  useEffect(() => {
    if (!open || !lead?.account_id) return;
    (async () => {
      const { data } = await supabase
        .from("account_members")
        .select("user_id, role, profiles:profiles(full_name)")
        .eq("account_id", lead.account_id)
        .eq("is_active", true);
      if (data) {
        const members: TeamMember[] = (data as any[]).map(m => ({
          user_id: m.user_id,
          role: m.role,
          full_name: m.profiles?.full_name || null,
        }));
        setTeam(members);
        const { data: { user } } = await supabase.auth.getUser();
        if (user && members.some(m => m.user_id === user.id)) {
          setAssignedTo(user.id);
        }
      }
    })();
  }, [open, lead?.account_id]);

  // Cargar Smart Process templates (globales + de la firma)
  useEffect(() => {
    if (!open || !lead?.account_id) return;
    (async () => {
      const { data, error } = await supabase
        .from("smart_process_templates" as any)
        .select("id, name, description, icon, color, case_type, account_id, forms_included")
        .eq("is_active", true)
        .or(`account_id.is.null,account_id.eq.${lead.account_id}`)
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("[smart-templates]", error);
        return;
      }
      setTemplates((data as any) || []);
    })();
  }, [open, lead?.account_id]);

  // Cuando seleccionás un template, pre-marcar todos los forms como activos
  useEffect(() => {
    if (!selectedTemplateId) {
      setEnabledForms({});
      return;
    }
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    const next: Record<string, boolean> = {};
    for (const f of tpl.forms_included) next[f.form_type] = true;
    setEnabledForms(next);
  }, [selectedTemplateId, templates]);

  // Filtrado + agrupado del catálogo (simple mode)
  const filteredTypes = useMemo(() => {
    const q = caseTypeSearch.toLowerCase().trim();
    let list = CASE_TYPES;
    if (q) {
      list = CASE_TYPES.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.shortLabel.toLowerCase().includes(q) ||
        t.formNumber.toLowerCase().includes(q) ||
        (t.searchTerms || []).some(s => s.includes(q))
      );
    }
    const grouped = new Map<CaseTypeCategory, CaseTypeMeta[]>();
    for (const t of list) {
      const arr = grouped.get(t.category) || [];
      arr.push(t);
      grouped.set(t.category, arr);
    }
    return grouped;
  }, [caseTypeSearch]);

  const selectedType = CASE_TYPES.find(t => t.key === caseTypeKey);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const enabledFormCount = Object.values(enabledForms).filter(Boolean).length;

  // Forms ya incluidos por el modo activo — para excluir del picker de extras.
  // Si user desmarca un form del template, deja de estar en baseFormCodes y
  // puede agregarlo via extras (no choca con UNIQUE(case_id, form_type) porque
  // el form desmarcado tampoco se inserta en case_forms en el flow normal).
  const baseFormCodes = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    if (mode === "simple" && selectedType) {
      const primary = getPrimaryFormForCaseType(selectedType.key);
      if (primary) set.add(primary.toUpperCase());
    }
    if (mode === "smart" && selectedTemplate) {
      for (const f of selectedTemplate.forms_included) {
        if (enabledForms[f.form_type]) set.add(f.form_type.toUpperCase());
      }
    }
    return set;
  }, [mode, selectedType, selectedTemplate, enabledForms]);

  const availableExtraForms = useMemo(() => {
    const q = extraSearch.toLowerCase().trim();
    return USCIS_FORMS_CATALOG.filter(f => {
      if (baseFormCodes.has(f.code.toUpperCase())) return false;
      if (extraForms.includes(f.code)) return false;
      if (!q) return true;
      return f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
    });
  }, [baseFormCodes, extraForms, extraSearch]);

  const clientName = useMemo(() => {
    if (!lead) return "";
    return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || lead.phone || "Sin nombre";
  }, [lead]);

  const canSubmit = useMemo(() => {
    if (mode === "simple") return !!caseTypeKey;
    return !!selectedTemplateId && enabledFormCount > 0;
  }, [mode, caseTypeKey, selectedTemplateId, enabledFormCount]);

  async function handleConvert() {
    if (!lead) return;
    if (!canSubmit) {
      toast.error(mode === "simple" ? "Seleccioná el tipo de caso" : "Seleccioná un Smart Process y al menos 1 form");
      return;
    }
    if (!lead.email && !lead.phone) {
      toast.error("Este lead no tiene email ni teléfono. Editalo antes de convertir.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sesión expirada");
        setLoading(false);
        return;
      }

      const caseTypeLabel = mode === "simple" ? selectedType!.shortLabel : selectedTemplate!.name;
      const processTypeKey = mode === "simple" ? selectedType!.key : (selectedTemplate!.case_type || selectedTemplate!.name.toLowerCase().replace(/\s+/g, "-"));

      // INSERT en client_cases
      const { data: caseRow, error: caseErr } = await supabase
        .from("client_cases")
        .insert({
          account_id: lead.account_id,
          client_profile_id: lead.id,
          professional_id: user.id,
          assigned_to: assignedTo || user.id,
          client_name: clientName,
          client_email: lead.email || "",
          case_type: caseTypeLabel,
          process_type: processTypeKey,
          process_stage: processStage,
          pipeline_stage: "caso-activado",
          status: "active",
          ball_in_court: "team",
          notes: notes.trim() || null,
        } as any)
        .select("id, access_token, file_number")
        .single();

      if (caseErr) {
        console.error("[convert-lead-to-case]", caseErr);
        toast.error("Error al crear el caso", { description: caseErr.message });
        setLoading(false);
        return;
      }

      // Branch por modo
      if (mode === "smart" && selectedTemplate) {
        // Insertar 1 row por form activo en case_forms
        const rows = selectedTemplate.forms_included
          .filter(f => enabledForms[f.form_type])
          .map(f => ({
            case_id: caseRow.id,
            account_id: lead.account_id,
            form_type: f.form_type,
            status: "pending",
            sort_order: f.sort_order,
          }));
        if (rows.length > 0) {
          const { error: formsErr } = await supabase.from("case_forms" as any).insert(rows as any);
          if (formsErr) console.warn("[smart-process] case_forms insert", formsErr);
        }
      } else if (mode === "simple") {
        // Form draft principal (flow original)
        const primaryFormType = getPrimaryFormForCaseType(selectedType!.key);
        if (primaryFormType) {
          try {
            await supabase
              .from("form_submissions")
              .insert({
                account_id: lead.account_id,
                case_id: caseRow.id,
                user_id: user.id,
                form_type: primaryFormType,
                form_version: primaryFormType === "i-130" ? "04/01/24" : "08/21/25",
                status: "draft",
                client_name: clientName,
                client_email: lead.email || "",
                form_data: {},
                notes: `Borrador auto-creado al abrir expediente · ${selectedType!.shortLabel}`,
              } as any);
          } catch (formErr) {
            console.warn("[convert-lead] form auto-draft skipped:", formErr);
          }
        }
      }

      // Forms ad-hoc del picker (ambos modos) → case_forms.
      // Filtro defensivo: si user agregó extras y después re-habilitó el mismo
      // form del template, la UI excluye del picker pero el state extraForms
      // podría tenerlo todavía. Filtramos para evitar UNIQUE(case_id, form_type)
      // collision en case_forms.
      if (extraForms.length > 0) {
        const filteredExtras = extraForms.filter(c => !baseFormCodes.has(c.toUpperCase()));
        if (filteredExtras.length > 0) {
          const baseOrder = mode === "smart" && selectedTemplate
            ? selectedTemplate.forms_included.length
            : 1;
          const extraRows = filteredExtras.map((code, idx) => ({
            case_id: caseRow.id,
            account_id: lead.account_id,
            form_type: code,
            status: "pending",
            sort_order: baseOrder + idx + 1,
          }));
          const { error: extraErr } = await supabase.from("case_forms" as any).insert(extraRows as any);
          if (extraErr) console.warn("[convert-lead] extra forms insert", extraErr);
        }
      }

      // UPDATE lead → client
      await supabase
        .from("client_profiles")
        .update({ contact_stage: "client", updated_at: new Date().toISOString() } as any)
        .eq("id", lead.id);

      // forms_count incluye los extras del picker para reflejar el total
      // de forms preparados en este caso. extra_forms va como array para
      // que el auditor sepa qué se agregó ad-hoc vs lo del template.
      const extraFormsApplied = extraForms.filter(c => !baseFormCodes.has(c.toUpperCase()));
      const totalForms = (mode === "smart" ? enabledFormCount : 1) + extraFormsApplied.length;
      logAudit({
        action: "case.created" as any,
        entity_type: "case",
        entity_id: caseRow.id,
        entity_label: `${clientName} · ${caseTypeLabel}`,
        metadata: {
          process_stage: processStage,
          mode,
          template_id: mode === "smart" ? selectedTemplateId : null,
          forms_count: totalForms,
          extra_forms: extraFormsApplied,
          from_lead: lead.id,
        },
      });

      const descSuffix = mode === "smart"
        ? `${totalForms} formulario${totalForms === 1 ? "" : "s"} preparado${totalForms === 1 ? "" : "s"}`
        : (() => {
            const baseCount = getFormsForCaseType(selectedType!.key).length;
            const sumWithExtras = baseCount + extraFormsApplied.length;
            return sumWithExtras > 0
              ? `${selectedType!.shortLabel} · ${sumWithExtras} formulario${sumWithExtras === 1 ? "" : "s"} sugerido${sumWithExtras === 1 ? "" : "s"}`
              : `${selectedType!.shortLabel} · ${PIPELINE_OPTIONS.find(p => p.value === processStage)?.label}`;
          })();

      toast.success(`Expediente abierto · ${clientName}`, {
        description: descSuffix,
        duration: 4000,
      });

      onOpenChange(false);
      onCreated?.(caseRow.id);
      navigate(`/case-engine/${caseRow.id}?tab=formularios`);
    } catch (err: any) {
      console.error(err);
      toast.error("Error inesperado", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-sora">
            <Briefcase className="w-5 h-5 text-cyan-accent" />
            Abrir expediente
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{clientName}</span>
            {lead.email && <span> · {lead.email}</span>}
            {lead.phone && <span> · {lead.phone}</span>}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* MODE SWITCHER */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/10 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("simple")}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold font-sora transition-all ${
                mode === "simple"
                  ? "bg-cyan-accent/15 text-cyan-accent ring-1 ring-cyan-accent/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Caso simple
              <span className="text-[9px] uppercase tracking-wider opacity-70 hidden sm:inline">1 form</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("smart")}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold font-sora transition-all ${
                mode === "smart"
                  ? "bg-cyan-accent/15 text-cyan-accent ring-1 ring-cyan-accent/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Smart Process
              <span className="text-[9px] uppercase tracking-wider opacity-70 hidden sm:inline">N forms</span>
            </button>
          </div>

          {/* 1. Pipeline picker (always visible) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. ¿En qué etapa está el caso?
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PIPELINE_OPTIONS.map(opt => {
                const active = processStage === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProcessStage(opt.value)}
                    className={`flex flex-col items-start text-left px-3 py-2 rounded-lg border transition-all ${
                      active
                        ? `${opt.chipClass} ring-2 ring-offset-1 ring-offset-background`
                        : "bg-white/[0.02] border-white/10 text-muted-foreground hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="text-xs font-bold font-sora">{opt.label}</span>
                    <span className={`text-[9px] uppercase tracking-wider ${active ? "" : "text-muted-foreground/60"}`}>
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SIMPLE MODE: Case type picker */}
          {mode === "simple" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Tipo de caso
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Buscar por formulario (I-130), tipo (esposa, asilo, EB-2)..."
                  value={caseTypeSearch}
                  onChange={e => setCaseTypeSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              {selectedType && (
                <div className="rounded-lg border border-cyan-accent/30 bg-cyan-accent/5 px-3 py-2">
                  <p className="text-xs font-bold text-cyan-accent font-sora">{selectedType.shortLabel}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{selectedType.description}</p>
                </div>
              )}
              <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border/40 bg-card/30">
                {Array.from(filteredTypes.entries()).map(([category, types]) => (
                  <div key={category}>
                    <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b border-border/30 z-10">
                      <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/70 font-semibold">
                        {CATEGORY_LABELS[category]}
                      </span>
                    </div>
                    {types.map(t => {
                      const active = caseTypeKey === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setCaseTypeKey(t.key)}
                          className={`w-full text-left px-3 py-2 border-b border-border/20 transition-colors ${
                            active ? "bg-cyan-accent/10" : "hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-xs font-semibold font-sora ${active ? "text-cyan-accent" : "text-foreground/90"}`}>
                              {t.shortLabel}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-mono shrink-0">
                              {t.formNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{t.description}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filteredTypes.size === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-muted-foreground">Sin resultados para "{caseTypeSearch}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. SMART MODE: Template picker + form checklist */}
          {mode === "smart" && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Elegí un Smart Process
              </Label>
              {templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center">
                  <Sparkles className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No hay templates disponibles todavía.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Creá uno desde Configuración → Smart Processes.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {templates.map(tpl => {
                    const active = selectedTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`flex items-start gap-2 text-left px-3 py-2.5 rounded-lg border transition-all ${
                          active
                            ? "border-cyan-accent/50 bg-cyan-accent/5 ring-1 ring-cyan-accent/30"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                        }`}
                      >
                        <span className="text-base leading-none mt-0.5">{tpl.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-semibold font-sora truncate ${active ? "text-cyan-accent" : "text-foreground/90"}`}>
                              {tpl.name}
                            </p>
                            {tpl.account_id === null && (
                              <span className="text-[8px] uppercase tracking-wider text-muted-foreground/60 font-mono shrink-0">NER</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            {tpl.forms_included.length} formulario{tpl.forms_included.length === 1 ? "" : "s"}
                            {tpl.description ? ` · ${tpl.description.slice(0, 40)}${tpl.description.length > 40 ? "…" : ""}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Form checklist */}
              {selectedTemplate && (
                <div className="rounded-lg border border-cyan-accent/30 bg-cyan-accent/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider font-mono text-cyan-accent font-semibold">
                      Formularios incluidos ({enabledFormCount})
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">Destildá los que no apliquen</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {selectedTemplate.forms_included
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(f => {
                        const checked = !!enabledForms[f.form_type];
                        return (
                          <button
                            key={f.form_type}
                            type="button"
                            onClick={() =>
                              setEnabledForms(prev => ({ ...prev, [f.form_type]: !prev[f.form_type] }))
                            }
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                              checked
                                ? "bg-cyan-accent/10 text-foreground"
                                : "bg-white/[0.02] text-muted-foreground/60 line-through"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                checked ? "bg-cyan-accent border-cyan-accent" : "border-border/60"
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 text-deep-navy" strokeWidth={3} />}
                            </span>
                            <span className="text-xs font-mono font-semibold">{f.form_type}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXTRA FORMS — picker ad-hoc (ambos modos).
              Use case: I-130 + I-601A waiver + I-907 premium. */}
          {((mode === "simple" && selectedType) || (mode === "smart" && selectedTemplate)) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Formularios adicionales {extraForms.length > 0 && <span className="text-cyan-accent ml-1">({extraForms.length})</span>}
                </Label>
                <Popover open={extraPickerOpen} onOpenChange={setExtraPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] font-semibold text-cyan-accent hover:text-cyan-accent/80 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Agregar formulario
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-2 border-b border-border/40">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                        <Input
                          autoFocus
                          placeholder="Buscar form (I-601A, I-907...)"
                          value={extraSearch}
                          onChange={e => setExtraSearch(e.target.value)}
                          className="pl-7 h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {availableExtraForms.length === 0 ? (
                        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                          {extraSearch ? "Sin resultados" : "Todos los forms ya están agregados"}
                        </div>
                      ) : (
                        availableExtraForms.map(f => (
                          <button
                            key={f.code}
                            type="button"
                            onClick={() => {
                              setExtraForms(prev => [...prev, f.code]);
                              setExtraSearch("");
                              setExtraPickerOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-cyan-accent/10 transition-colors border-b border-border/20 last:border-b-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono font-semibold text-foreground">{f.code}</span>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 shrink-0">{f.category}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{f.name}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {extraForms.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70">
                  ¿Este caso lleva otros forms? (ej. I-601A waiver, I-907 premium)
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {extraForms.map(code => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-accent/10 border border-cyan-accent/30 text-[11px] font-mono font-semibold text-cyan-accent"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => setExtraForms(prev => prev.filter(c => c !== code))}
                        className="hover:text-foreground transition-colors"
                        aria-label={`Quitar ${code}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Asignado a */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3. Asignar a
              </Label>
              {team.length === 0 && lead?.account_id && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { error } = await supabase.functions.invoke("seed-team-members", {
                        body: { account_id: lead.account_id },
                      });
                      if (error) throw error;
                      toast.success("Equipo creado · 5 personas agregadas", { duration: 3000 });
                      // Recargar team
                      const { data } = await supabase
                        .from("account_members")
                        .select("user_id, role, profiles:profiles(full_name)")
                        .eq("account_id", lead.account_id)
                        .eq("is_active", true);
                      if (data) {
                        const members: TeamMember[] = (data as any[]).map(m => ({
                          user_id: m.user_id,
                          role: m.role,
                          full_name: m.profiles?.full_name || null,
                        }));
                        setTeam(members);
                      }
                    } catch (err: any) {
                      toast.error("Error al crear equipo", { description: err?.message });
                    }
                  }}
                  className="text-[10px] text-cyan-accent hover:text-cyan-accent/80 font-medium"
                >
                  + Crear equipo de prueba
                </button>
              )}
            </div>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-cyan-accent/50 focus:outline-none"
            >
              <option value="">Sin asignar (yo lo agarro después)</option>
              {team.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || "Sin nombre"} · {m.role}
                </option>
              ))}
            </select>
            {team.length === 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                Tu cuenta aún no tiene miembros. Click "+ Crear equipo de prueba" para agregar 5 personas (Pablo · Vanessa · Daniela · Carmen · Sofía).
              </p>
            )}
          </div>

          {/* 4. Notas */}
          <div className="space-y-2">
            <Label htmlFor="case-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              4. Notas iniciales (opcional)
            </Label>
            <Input
              id="case-notes"
              placeholder="Detalles, urgencia, contexto..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConvert}
            disabled={loading || !canSubmit}
            className="bg-cyan-accent hover:bg-cyan-accent/90 text-deep-navy font-semibold gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Abrir expediente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
