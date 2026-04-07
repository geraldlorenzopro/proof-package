import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Globe, Building2, Landmark, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  caseId: string;
  caseData: any;
  onCaseDataChanged: (updates: any) => void;
}

function PasswordField({ label, value, field, caseId, onSaved }: {
  label: string; value: string; field: string; caseId: string; onSaved: (field: string, val: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (val === (value || "")) return;
    setSaving(true);
    try {
      await supabase.from("client_cases").update({ [field]: val } as any).eq("id", caseId);
      onSaved(field, val);
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }, [val, value, field, caseId, onSaved]);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type={show ? "text" : "password"}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          className="h-8 text-xs font-mono"
          placeholder="••••••••"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShow(!show)}>
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function TextField({ label, value, field, caseId, onSaved, placeholder, mono }: {
  label: string; value: string; field: string; caseId: string;
  onSaved: (field: string, val: string) => void; placeholder?: string; mono?: boolean;
}) {
  const [val, setVal] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (val === (value || "")) return;
    setSaving(true);
    try {
      await supabase.from("client_cases").update({ [field]: val } as any).eq("id", caseId);
      onSaved(field, val);
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }, [val, value, field, caseId, onSaved]);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        className={cn("h-8 text-xs", mono && "font-mono")}
        placeholder={placeholder || "—"}
      />
    </div>
  );
}

function DateField({ label, value, field, caseId, onSaved }: {
  label: string; value: string; field: string; caseId: string;
  onSaved: (field: string, val: string) => void;
}) {
  const [val, setVal] = useState(value || "");

  const save = useCallback(async () => {
    if (val === (value || "")) return;
    try {
      await supabase.from("client_cases").update({ [field]: val || null } as any).eq("id", caseId);
      onSaved(field, val);
    } catch { toast.error("Error al guardar"); }
  }, [val, value, field, caseId, onSaved]);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input type="date" value={val} onChange={e => setVal(e.target.value)} onBlur={save} className="h-8 text-xs" />
    </div>
  );
}

const STAGE_ORDER = ["uscis", "nvc", "embajada", "cas", "aprobado", "denegado"];

export default function PortalTrackingPanel({ caseId, caseData, onCaseDataChanged }: Props) {
  const [activeSection, setActiveSection] = useState<string>("uscis");
  const processStage = caseData?.process_stage || "uscis";
  const stageIdx = STAGE_ORDER.indexOf(processStage);

  const handleSaved = useCallback((field: string, val: string) => {
    onCaseDataChanged({ [field]: val });
    toast.success("Guardado");
  }, [onCaseDataChanged]);

  const sections = [
    { key: "uscis", label: "USCIS", icon: Globe, always: true },
    { key: "nvc", label: "NVC", icon: Building2, minStage: 1 },
    { key: "embajada", label: "CAS / Embajada", icon: Landmark, minStage: 2 },
  ];

  const visibleSections = sections.filter(s => s.always || stageIdx >= (s.minStage || 0));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Globe className="w-4 h-4 text-jarvis" />
        Portal de Seguimiento
      </h3>

      {/* Section tabs */}
      <div className="flex gap-1 mb-4">
        {visibleSections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
              activeSection === s.key
                ? "bg-jarvis/10 text-jarvis border border-jarvis/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <s.icon className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div>

      {/* USCIS Section */}
      {activeSection === "uscis" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Email USCIS" value={caseData?.uscis_email} field="uscis_email" caseId={caseId} onSaved={handleSaved} placeholder="usuario@email.com" />
          <PasswordField label="Contraseña USCIS" value={caseData?.uscis_password} field="uscis_password" caseId={caseId} onSaved={handleSaved} />
          <div className="sm:col-span-2">
            <TextField label="Códigos de recuperación" value={caseData?.uscis_recovery_codes} field="uscis_recovery_codes" caseId={caseId} onSaved={handleSaved} placeholder="Códigos separados por coma" mono />
          </div>
        </div>
      )}

      {/* NVC Section */}
      {activeSection === "nvc" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Número de caso NVC" value={caseData?.nvc_case_number} field="nvc_case_number" caseId={caseId} onSaved={handleSaved} placeholder="NVC2024..." mono />
          <TextField label="Invoice ID" value={caseData?.nvc_invoice_id} field="nvc_invoice_id" caseId={caseId} onSaved={handleSaved} mono />
          <TextField label="Código DS-260" value={caseData?.nvc_ds260_code} field="nvc_ds260_code" caseId={caseId} onSaved={handleSaved} mono />
          <div className="sm:col-span-2 border-t border-border pt-3 mt-1">
            <Badge variant="outline" className="text-[10px] mb-2">Acceso CAS desde NVC</Badge>
          </div>
          <TextField label="Email CAS" value={caseData?.nvc_cas_email} field="nvc_cas_email" caseId={caseId} onSaved={handleSaved} placeholder="email@cas.com" />
          <PasswordField label="Contraseña CAS" value={caseData?.nvc_cas_password} field="nvc_cas_password" caseId={caseId} onSaved={handleSaved} />
        </div>
      )}

      {/* Embassy/CAS Section */}
      {activeSection === "embajada" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Apellido para login" value={caseData?.cas_apellido} field="cas_apellido" caseId={caseId} onSaved={handleSaved} />
            <TextField label="Año de nacimiento" value={caseData?.cas_anio_nacimiento} field="cas_anio_nacimiento" caseId={caseId} onSaved={handleSaved} placeholder="1990" />
            <div className="sm:col-span-2">
              <TextField label="P&R Seguridad" value={caseData?.cas_pr_seguridad} field="cas_pr_seguridad" caseId={caseId} onSaved={handleSaved} placeholder="Respuesta de seguridad" />
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <Badge variant="outline" className="text-[10px] mb-3">Citas de Entrevista</Badge>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Tipo de cita</Label>
                <select
                  value={caseData?.interview_type || "none"}
                  onChange={async (e) => {
                    const v = e.target.value;
                    await supabase.from("client_cases").update({ interview_type: v } as any).eq("id", caseId);
                    onCaseDataChanged({ interview_type: v });
                    toast.success("Guardado");
                  }}
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="none">Sin cita</option>
                  <option value="embajada">Embajada</option>
                  <option value="cas">CAS</option>
                  <option value="uscis_local">USCIS Local</option>
                </select>
              </div>
              <TextField label="Ciudad" value={caseData?.interview_city} field="interview_city" caseId={caseId} onSaved={handleSaved} placeholder="Ciudad Juárez" />
              <DateField label="Fecha cita CAS" value={caseData?.cas_interview_date} field="cas_interview_date" caseId={caseId} onSaved={handleSaved} />
              <TextField label="Hora cita CAS" value={caseData?.cas_interview_time} field="cas_interview_time" caseId={caseId} onSaved={handleSaved} placeholder="9:00 AM" />
              <DateField label="Fecha cita Embajada" value={caseData?.emb_interview_date} field="emb_interview_date" caseId={caseId} onSaved={handleSaved} />
              <TextField label="Hora cita Embajada" value={caseData?.emb_interview_time} field="emb_interview_time" caseId={caseId} onSaved={handleSaved} placeholder="10:30 AM" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
