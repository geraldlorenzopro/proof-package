import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, Briefcase, ArrowRight, FileText, CheckCircle2, Search,
  Package, Save, Plus, Sparkles, X, ChevronDown, ChevronUp, FolderOpen
} from "lucide-react";
import { logAudit } from "@/lib/auditLog";
import { Badge } from "@/components/ui/badge";

interface UscisForm {
  form_number: string;
  form_name_es: string;
  category: string;
}

interface CaseTemplate {
  id: string;
  process_type: string;
  process_label: string;
  description: string | null;
  form_package: string[];
  is_system: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientProfileId: string;
  clientName: string;
  clientEmail?: string | null;
  onCreated: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  family: "Familiar",
  adjustment: "Ajuste de Estatus",
  employment: "Permiso de Trabajo",
  travel: "Viaje",
  removal_conditions: "Remoción de Condiciones",
  fiance: "Prometido(a)",
  naturalization: "Naturalización",
  humanitarian: "Humanitario",
  tps_daca: "TPS / DACA",
  consular: "Consular",
  general: "General",
  work: "Visa de Trabajo",
  waiver: "Perdón / Waiver",
};

// Group templates by prefix for visual grouping
const TEMPLATE_GROUPS: { prefix: string; label: string; icon: string }[] = [
  { prefix: "PF-IR", label: "Petición Familiar — Inmediatos", icon: "👨‍👩‍👧" },
  { prefix: "PF-F", label: "Petición Familiar — Preferencia", icon: "👨‍👩‍👧‍👦" },
  { prefix: "FULL-AOS-IR", label: "FULL AOS — Inmediatos", icon: "🟢" },
  { prefix: "FULL-AOS-F", label: "FULL AOS — Preferencia", icon: "🔵" },
  { prefix: "AOS-ONLY", label: "AOS — Solo Ajuste (Petición Aprobada)", icon: "📋" },
  { prefix: "CONSULAR", label: "Proceso Consular", icon: "🏛️" },
  { prefix: "VAWA", label: "VAWA", icon: "🛡️" },
  { prefix: "Waiver", label: "Perdón / Waiver", icon: "⚖️" },
];

type Step = "template" | "customize" | "details";

export default function NewCaseFromProfile({
  open, onOpenChange, clientProfileId, clientName, clientEmail, onCreated
}: Props) {
  const [step, setStep] = useState<Step>("template");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [allForms, setAllForms] = useState<UscisForm[]>([]);

  const [selectedTemplate, setSelectedTemplate] = useState<CaseTemplate | null>(null);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [formSearch, setFormSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [caseName, setCaseName] = useState("");
  const [petitionerName, setPetitionerName] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState(clientName);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");

  useEffect(() => {
    if (!open) return;
    const loadData = async () => {
      const [templatesRes, formsRes] = await Promise.all([
        supabase
          .from("pipeline_templates")
          .select("id, process_type, process_label, description, form_package, is_system")
          .eq("is_active", true)
          .order("process_label"),
        supabase
          .from("uscis_forms")
          .select("form_number, form_name_es, category")
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      if (templatesRes.data) {
        setTemplates(templatesRes.data.map(t => ({
          ...t,
          form_package: Array.isArray(t.form_package) ? t.form_package as string[] : [],
        })));
      }
      if (formsRes.data) setAllForms(formsRes.data);
    };
    loadData();
    setStep("template");
    setSelectedTemplate(null);
    setSelectedForms([]);
    setTemplateSearch("");
    setFormSearch("");
    setCaseName("");
    setPetitionerName("");
    setBeneficiaryName(clientName);
    setShowSaveTemplate(false);
    setCollapsedGroups(new Set());
  }, [open, clientName]);

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const search = templateSearch.toLowerCase();
    const filtered = templates.filter(t =>
      t.process_label.toLowerCase().includes(search) ||
      (t.description || "").toLowerCase().includes(search) ||
      t.form_package.some(f => f.toLowerCase().includes(search))
    );

    const groups: { label: string; icon: string; key: string; items: CaseTemplate[] }[] = [];
    const assigned = new Set<string>();

    // Known groups
    for (const g of TEMPLATE_GROUPS) {
      const items = filtered.filter(t => t.process_type.startsWith(g.prefix) && t.is_system);
      if (items.length > 0) {
        groups.push({ label: g.label, icon: g.icon, key: g.prefix, items });
        items.forEach(t => assigned.add(t.id));
      }
    }

    // Other system templates
    const otherSystem = filtered.filter(t => t.is_system && !assigned.has(t.id));
    if (otherSystem.length > 0) {
      groups.push({ label: "Otros Procesos", icon: "📄", key: "other-system", items: otherSystem });
      otherSystem.forEach(t => assigned.add(t.id));
    }

    // Custom (account) templates
    const custom = filtered.filter(t => !t.is_system && !assigned.has(t.id));
    if (custom.length > 0) {
      groups.push({ label: "Mis Templates Personalizados", icon: "⭐", key: "custom", items: custom });
    }

    return groups;
  }, [templates, templateSearch]);

  // Group forms by category
  const filteredFormsByCategory = useMemo(() => {
    const search = formSearch.toLowerCase();
    return Object.entries(
      allForms.reduce((acc, form) => {
        const cat = form.category || "general";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(form);
        return acc;
      }, {} as Record<string, UscisForm[]>)
    ).reduce((acc, [cat, forms]) => {
      const filtered = forms.filter(f =>
        f.form_number.toLowerCase().includes(search) ||
        f.form_name_es.toLowerCase().includes(search)
      );
      if (filtered.length > 0) acc[cat] = filtered;
      return acc;
    }, {} as Record<string, UscisForm[]>);
  }, [allForms, formSearch]);

  const toggleForm = (formNumber: string) => {
    setSelectedForms(prev =>
      prev.includes(formNumber) ? prev.filter(f => f !== formNumber) : [...prev, formNumber]
    );
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSelectTemplate = (template: CaseTemplate) => {
    setSelectedTemplate(template);
    setSelectedForms([...template.form_package]);
    setCaseName(template.process_label);
    setStep("customize");
  };

  const handleStartManual = () => {
    setSelectedTemplate(null);
    setSelectedForms([]);
    setCaseName("");
    setStep("customize");
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || selectedForms.length === 0) {
      toast.error("Ingresa un nombre y selecciona al menos un formulario");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      const processType = newTemplateName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const { error } = await supabase.from("pipeline_templates").insert({
        process_type: `custom-${processType}-${Date.now()}`,
        process_label: newTemplateName.trim(),
        description: newTemplateDesc.trim() || null,
        form_package: selectedForms,
        account_id: accountId,
        is_system: false,
        is_active: true,
        stages: [],
        field_definitions: [],
      });
      if (error) throw error;

      toast.success("Template guardado exitosamente");
      setShowSaveTemplate(false);
      setNewTemplateName("");
      setNewTemplateDesc("");

      // Refresh
      const { data } = await supabase
        .from("pipeline_templates")
        .select("id, process_type, process_label, description, form_package, is_system")
        .eq("is_active", true)
        .order("process_label");
      if (data) {
        setTemplates(data.map(t => ({
          ...t,
          form_package: Array.isArray(t.form_package) ? t.form_package as string[] : [],
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar el template");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (selectedForms.length === 0) {
      toast.error("Selecciona al menos un formulario");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sesión expirada"); setLoading(false); return; }
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) { toast.error("Error de cuenta"); setLoading(false); return; }

      const caseType = selectedTemplate?.process_type || selectedForms[0] || "General";
      const processType = selectedTemplate?.process_type || null;
      const initialStage = processType ? "caso-activado" : null;

      const { data, error } = await supabase
        .from("client_cases")
        .insert({
          professional_id: user.id,
          account_id: accountId,
          assigned_to: user.id,
          client_name: clientName,
          client_email: clientEmail || "",
          client_profile_id: clientProfileId,
          case_type: caseName || caseType,
          process_type: processType,
          pipeline_stage: initialStage,
          stage_entered_at: initialStage ? new Date().toISOString() : null,
          ball_in_court: initialStage ? "team" : null,
          petitioner_name: petitionerName || null,
          beneficiary_name: beneficiaryName || null,
          status: "active",
        })
        .select("id, case_type")
        .single();

      if (error) { console.error(error); toast.error("Error al crear el caso"); setLoading(false); return; }

      if (selectedForms.length > 0 && data) {
        const formRows = selectedForms.map((ft, i) => ({
          case_id: data.id,
          account_id: accountId,
          form_type: ft,
          status: "pending",
          sort_order: i,
        }));
        await supabase.from("case_forms").insert(formRows);
      }

      if (initialStage && data) {
        await supabase.from("case_stage_history").insert({
          case_id: data.id,
          account_id: accountId,
          to_stage: initialStage,
          from_stage: null,
          changed_by: user.id,
          changed_by_name: user.email?.split("@")[0] || "Sistema",
          note: `Caso creado: ${caseName || caseType} (${selectedForms.length} formularios)`,
        });
      }

      logAudit({
        action: "case.created",
        entity_type: "case",
        entity_id: data!.id,
        entity_label: `${caseName || caseType} - ${clientName}`,
        metadata: {
          case_type: caseName || caseType,
          process_type: processType,
          template_id: selectedTemplate?.id || null,
          client_profile_id: clientProfileId,
          forms: selectedForms,
        },
      });

      toast.success(`Caso creado con ${selectedForms.length} formulario${selectedForms.length !== 1 ? "s" : ""}`);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-5 h-5 text-jarvis" />
              {step === "template" && "Seleccionar Paquete de Formularios"}
              {step === "customize" && "Personalizar Formularios"}
              {step === "details" && "Detalles del Caso"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1">
            Cliente: <span className="font-medium text-foreground">{clientName}</span>
          </p>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {(["template", "customize", "details"] as Step[]).map((s, i) => {
              const labels = ["Paquete", "Formularios", "Detalles"];
              const isDone = (s === "template" && step !== "template") || (s === "customize" && step === "details");
              const isCurrent = s === step;
              return (
                <div key={s} className="flex-1 text-center">
                  <div className={`h-1 rounded-full mb-1 transition-colors ${isDone || isCurrent ? "bg-jarvis" : "bg-muted"}`} />
                  <span className={`text-[9px] ${isCurrent ? "text-jarvis font-semibold" : "text-muted-foreground"}`}>
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {/* STEP 1: Select Template */}
          {step === "template" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paquete, proceso o formulario..."
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  autoFocus
                />
              </div>

              {/* Manual option */}
              <button
                onClick={handleStartManual}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-jarvis/30 bg-jarvis/5 hover:bg-jarvis/10 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center shrink-0 group-hover:bg-jarvis/20">
                  <Plus className="w-4 h-4 text-jarvis" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Armar Paquete Manual</p>
                  <p className="text-[10px] text-muted-foreground">
                    Selecciona formularios uno a uno y guarda como template reutilizable
                  </p>
                </div>
              </button>

              {/* Grouped templates */}
              {groupedTemplates.map(group => {
                const isCollapsed = collapsedGroups.has(group.key);
                return (
                  <div key={group.key} className="space-y-1">
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>{group.icon}</span>
                        {group.label}
                        <span className="text-muted-foreground font-normal">({group.items.length})</span>
                      </span>
                      {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1 pl-1">
                        {group.items.map(template => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className="w-full flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/50 hover:border-jarvis/20 transition-all text-left group"
                          >
                            <div className="w-7 h-7 rounded-md bg-jarvis/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Package className="w-3.5 h-3.5 text-jarvis" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground leading-tight">{template.process_label}</p>
                              {template.description && (
                                <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                              )}
                              <div className="flex flex-wrap gap-0.5 mt-1">
                                {template.form_package.map(f => (
                                  <span key={f} className="text-[8px] px-1 py-0 rounded bg-background/60 text-muted-foreground border border-border/50">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {groupedTemplates.length === 0 && templateSearch && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No se encontraron paquetes para "{templateSearch}"
                </p>
              )}
            </div>
          )}

          {/* STEP 2: Customize Forms */}
          {step === "customize" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-jarvis" />
                  {selectedTemplate ? `Basado en: ${selectedTemplate.process_label}` : "Paquete Manual"}
                </Label>
                <span className="text-[10px] font-medium text-jarvis">
                  {selectedForms.length} formulario{selectedForms.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Selected chips */}
              {selectedForms.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-jarvis/5 border border-jarvis/10">
                  {selectedForms.map(f => (
                    <button
                      key={f}
                      onClick={() => toggleForm(f)}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-jarvis/15 text-jarvis border border-jarvis/20 hover:bg-jarvis/25 transition-colors"
                    >
                      {f}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar formulario (ej: I-765, asilo, trabajo...)"
                  value={formSearch}
                  onChange={e => setFormSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* Forms by category */}
              <div className="space-y-1">
                {Object.entries(filteredFormsByCategory).map(([cat, forms]) => {
                  const isExpanded = expandedCategories.has(cat) || formSearch.length > 0;
                  const selectedInCat = forms.filter(f => selectedForms.includes(f.form_number)).length;
                  return (
                    <div key={cat}>
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
                      >
                        <span className="text-xs font-semibold text-muted-foreground">
                          {CATEGORY_LABELS[cat] || cat}
                          {selectedInCat > 0 && (
                            <span className="ml-1.5 text-jarvis">({selectedInCat})</span>
                          )}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                          {forms.map(form => {
                            const isSelected = selectedForms.includes(form.form_number);
                            return (
                              <button
                                key={form.form_number}
                                type="button"
                                onClick={() => toggleForm(form.form_number)}
                                className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all text-xs ${
                                  isSelected
                                    ? "bg-jarvis/10 border border-jarvis/30 text-foreground"
                                    : "bg-transparent border border-transparent text-muted-foreground hover:bg-secondary"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                  isSelected ? "bg-jarvis border-jarvis" : "border-muted-foreground/30"
                                }`}>
                                  {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold">{form.form_number}</span>
                                  <span className="block text-[9px] text-muted-foreground truncate">{form.form_name_es}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Save as template */}
              {!selectedTemplate && selectedForms.length >= 2 && (
                <div className="border-t border-border pt-3">
                  {!showSaveTemplate ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSaveTemplate(true)}
                      className="text-xs gap-1.5 text-jarvis hover:text-jarvis"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar como Template Reutilizable
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 rounded-lg bg-secondary/40 border border-border">
                      <p className="text-[10px] font-semibold text-foreground">Guardar Paquete Inteligente</p>
                      <Input
                        placeholder="Nombre del template (ej: AOS Completo con Viaje)"
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Descripción breve (opcional)"
                        value={newTemplateDesc}
                        onChange={e => setNewTemplateDesc(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveAsTemplate} disabled={saving || !newTemplateName.trim()} className="text-xs bg-jarvis hover:bg-jarvis/90 gap-1">
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)} className="text-xs">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Case Details */}
          {step === "details" && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-jarvis" />
                  Paquete ({selectedForms.length} formularios)
                </Label>
                <div className="flex flex-wrap gap-1">
                  {selectedForms.map(f => (
                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-jarvis/10 text-jarvis border border-jarvis/20">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Nombre del Caso *</Label>
                <Input
                  placeholder="Ej: AOS Cónyuge, Petición F4 Hermano..."
                  value={caseName}
                  onChange={e => setCaseName(e.target.value)}
                  disabled={loading}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Peticionario</Label>
                  <Input
                    placeholder="Nombre del peticionario"
                    value={petitionerName}
                    onChange={e => setPetitionerName(e.target.value)}
                    disabled={loading}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Beneficiario</Label>
                  <Input
                    value={beneficiaryName}
                    onChange={e => setBeneficiaryName(e.target.value)}
                    disabled={loading}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between shrink-0">
          <div>
            {step !== "template" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step === "details" ? "customize" : "template")}
                disabled={loading}
                className="text-xs"
              >
                ← Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading} className="text-xs">
              Cancelar
            </Button>
            {step === "customize" && (
              <Button
                size="sm"
                onClick={() => setStep("details")}
                disabled={selectedForms.length === 0}
                className="bg-jarvis hover:bg-jarvis/90 gap-1 text-xs"
              >
                Continuar
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
            {step === "details" && (
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={loading || selectedForms.length === 0 || !caseName.trim()}
                className="bg-jarvis hover:bg-jarvis/90 gap-1 text-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Crear Caso ({selectedForms.length} forms)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
