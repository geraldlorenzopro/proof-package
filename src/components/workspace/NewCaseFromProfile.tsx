import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Briefcase, ArrowRight } from "lucide-react";
import { logAudit } from "@/lib/auditLog";

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

export default function NewCaseFromProfile({
  open, onOpenChange, clientProfileId, clientName, clientEmail, onCreated
}: Props) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [caseType, setCaseType] = useState("");
  const [processType, setProcessType] = useState<string>("none");
  const [petitionerName, setPetitionerName] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState(clientName);

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

  const selectedTemplate = templates.find(t => t.process_type === processType);

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
        metadata: { case_type: caseType, process_type: processType, client_profile_id: clientProfileId },
      });

      toast.success(`Caso "${caseType}" creado para ${clientName}`);

      // Reset
      setCaseType("");
      setProcessType("none");
      setPetitionerName("");
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
      <DialogContent className="sm:max-w-lg">
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
            Crear Caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
