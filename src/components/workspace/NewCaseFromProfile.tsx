import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Briefcase, ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import { logAudit } from "@/lib/auditLog";
import { Badge } from "@/components/ui/badge";

interface PipelineTemplate {
  id: string;
  process_type: string;
  process_label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientProfileId: string;
  clientName: string;
  clientEmail?: string | null;
  onCreated: () => void;
}

const GENERIC_CASE_TYPES = [
  { value: "I-130", label: "I-130 — Petición Familiar" },
  { value: "I-485", label: "I-485 — Ajuste de Estatus" },
  { value: "I-765", label: "I-765 — Permiso de Trabajo (EAD)" },
  { value: "I-751", label: "I-751 — Remoción de Condiciones" },
  { value: "I-129F", label: "I-129F — Visa de Prometido(a)" },
  { value: "N-400", label: "N-400 — Naturalización" },
  { value: "I-589", label: "I-589 — Asilo" },
  { value: "VAWA", label: "VAWA — Violencia Doméstica" },
  { value: "U-Visa", label: "U-Visa — Víctima de Crimen" },
  { value: "TPS", label: "TPS — Estatus de Protección Temporal" },
  { value: "DACA", label: "DACA — Acción Diferida" },
  { value: "Consular", label: "Proceso Consular" },
  { value: "Other", label: "Otro" },
];

const AVAILABLE_FORMS = [
  { value: "I-130", label: "I-130", desc: "Petición Familiar" },
  { value: "I-485", label: "I-485", desc: "Ajuste de Estatus" },
  { value: "I-765", label: "I-765", desc: "Permiso de Trabajo (EAD)" },
  { value: "I-131", label: "I-131", desc: "Documento de Viaje" },
  { value: "I-864", label: "I-864", desc: "Declaración de Sostenimiento" },
  { value: "I-693", label: "I-693", desc: "Examen Médico" },
  { value: "I-751", label: "I-751", desc: "Remoción de Condiciones" },
  { value: "I-129F", label: "I-129F", desc: "Visa de Prometido(a)" },
  { value: "N-400", label: "N-400", desc: "Naturalización" },
  { value: "I-589", label: "I-589", desc: "Asilo" },
  { value: "G-28", label: "G-28", desc: "Representación Legal" },
];

// Suggested form packages based on case type
const FORM_PRESETS: Record<string, string[]> = {
  "I-485": ["I-130", "I-485", "I-765", "I-131", "I-864", "I-693", "G-28"],
  "I-130": ["I-130", "G-28"],
  "I-765": ["I-765", "G-28"],
  "I-751": ["I-751", "G-28"],
  "I-129F": ["I-129F", "G-28"],
  "N-400": ["N-400", "G-28"],
  "I-589": ["I-589", "I-765", "G-28"],
};

export default function NewCaseFromProfile({
  open, onOpenChange, clientProfileId, clientName, clientEmail, onCreated
}: Props) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [caseType, setCaseType] = useState("");
  const [processType, setProcessType] = useState<string>("none");
  const [petitionerName, setPetitionerName] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState(clientName);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);

  // Load available pipeline templates
  useEffect(() => {
    if (!open) return;
    supabase
      .from("pipeline_templates")
      .select("id, process_type, process_label")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setTemplates(data);
      });
  }, [open]);

  // Auto-fill beneficiary
  useEffect(() => {
    if (open) setBeneficiaryName(clientName);
  }, [open, clientName]);

  // Auto-suggest forms when case type changes
  useEffect(() => {
    if (caseType && FORM_PRESETS[caseType]) {
      setSelectedForms(FORM_PRESETS[caseType]);
    } else if (caseType) {
      setSelectedForms([caseType].filter(f => AVAILABLE_FORMS.some(af => af.value === f)));
    }
  }, [caseType]);

  const selectedTemplate = templates.find(t => t.process_type === processType);

  const toggleForm = (formType: string) => {
    setSelectedForms(prev =>
      prev.includes(formType)
        ? prev.filter(f => f !== formType)
        : [...prev, formType]
    );
  };

  const handleCreate = async () => {
    if (!caseType) {
      toast.error("Selecciona un tipo de caso");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sesión expirada"); setLoading(false); return; }

      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) { toast.error("Error de cuenta"); setLoading(false); return; }

      // Determine initial pipeline stage
      const initialStage = processType !== "none" ? "caso-activado" : null;

      const { data, error } = await supabase
        .from("client_cases")
        .insert({
          professional_id: user.id,
          account_id: accountId,
          assigned_to: user.id,
          client_name: clientName,
          client_email: clientEmail || "",
          client_profile_id: clientProfileId,
          case_type: caseType,
          process_type: processType !== "none" ? processType : null,
          pipeline_stage: initialStage,
          stage_entered_at: initialStage ? new Date().toISOString() : null,
          ball_in_court: initialStage ? "team" : null,
          petitioner_name: petitionerName || null,
          beneficiary_name: beneficiaryName || null,
          status: "active",
        })
        .select("id, case_type")
        .single();

      if (error) {
        console.error(error);
        toast.error("Error al crear el caso");
        setLoading(false);
        return;
      }

      // Insert selected forms into case_forms
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

      // Record initial stage in history if pipeline was assigned
      if (initialStage && data) {
        await supabase.from("case_stage_history").insert({
          case_id: data.id,
          account_id: accountId,
          to_stage: initialStage,
          from_stage: null,
          changed_by: user.id,
          changed_by_name: user.email?.split("@")[0] || "Sistema",
          note: `Caso creado con pipeline: ${selectedTemplate?.process_label || processType}`,
        });
      }

      logAudit({
        action: "case.created",
        entity_type: "case",
        entity_id: data!.id,
        entity_label: `${caseType} - ${clientName}`,
        metadata: {
          case_type: caseType,
          process_type: processType,
          client_profile_id: clientProfileId,
          forms: selectedForms,
        },
      });

      toast.success(`Caso "${caseType}" creado con ${selectedForms.length} formulario${selectedForms.length !== 1 ? "s" : ""}`);

      // Reset
      setCaseType("");
      setProcessType("none");
      setPetitionerName("");
      setSelectedForms([]);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-jarvis" />
            Nuevo Caso — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Case Type */}
          <div className="space-y-2">
            <Label>Tipo de Caso *</Label>
            <Select value={caseType} onValueChange={setCaseType} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de caso..." />
              </SelectTrigger>
              <SelectContent>
                {GENERIC_CASE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Form Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-jarvis" />
                Formularios del Caso
              </Label>
              {selectedForms.length > 0 && (
                <Badge variant="outline" className="text-[10px] bg-jarvis/10 text-jarvis border-jarvis/20">
                  {selectedForms.length} seleccionado{selectedForms.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {caseType && FORM_PRESETS[caseType] && (
              <p className="text-[10px] text-jarvis/70">
                📦 Paquete sugerido para {caseType} — puedes agregar o quitar formularios
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-border p-2 bg-secondary/30">
              {AVAILABLE_FORMS.map(form => {
                const isSelected = selectedForms.includes(form.value);
                return (
                  <button
                    key={form.value}
                    type="button"
                    onClick={() => toggleForm(form.value)}
                    disabled={loading}
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
                      <span className="font-semibold">{form.label}</span>
                      <span className="block text-[9px] text-muted-foreground truncate">{form.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pipeline Template */}
          <div className="space-y-2">
            <Label>Pipeline de Proceso</Label>
            <Select value={processType} onValueChange={setProcessType} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Sin pipeline (seguimiento manual)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin pipeline (seguimiento manual)</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.process_type} value={t.process_type}>
                    {t.process_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-[10px] text-jarvis/70">
                Este caso seguirá las etapas predefinidas del pipeline con seguimiento de SLA y ownership
              </p>
            )}
          </div>

          {/* Petitioner / Beneficiary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Peticionario</Label>
              <Input
                placeholder="Nombre del peticionario"
                value={petitionerName}
                onChange={e => setPetitionerName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Beneficiario</Label>
              <Input
                value={beneficiaryName}
                onChange={e => setBeneficiaryName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={loading || !caseType} className="bg-jarvis hover:bg-jarvis/90 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Crear Caso {selectedForms.length > 0 && `(${selectedForms.length} forms)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
