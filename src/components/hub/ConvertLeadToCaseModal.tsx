/**
 * ConvertLeadToCaseModal — Convierte un lead (client_profiles row con
 * contact_stage='lead') en un caso activo (client_cases insert) +
 * actualiza el lead a contact_stage='client'.
 *
 * Pipeline picker: USCIS / NVC / Consular / Court / ICE.
 * Mapea a process_stage validado por trigger `validate_process_stage`
 * (migration 20260528170000_process_stage_court_ice.sql que extiende
 * el ENUM con court + ice).
 *
 * Case type picker: 75+ tipos del catálogo `caseTypes.ts` (la misma
 * fuente que CaseTypeInlineEdit). Searchable por label / shortLabel /
 * formNumber / searchTerms.
 *
 * Patrón INSERT replicado de ConsultationRoom.tsx:380-397 — campos
 * required: account_id, professional_id, client_email, client_name,
 * case_type, status. Adicionales: client_profile_id, assigned_to,
 * process_stage (locked al picker), pipeline_stage="caso-activado",
 * ball_in_court="team".
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Briefcase, Search } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { CASE_TYPES, CATEGORY_LABELS, type CaseTypeMeta, type CaseTypeCategory } from "@/lib/caseTypes";

type ProcessStage = "uscis" | "nvc" | "embajada" | "court" | "ice";

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
  const [caseTypeKey, setCaseTypeKey] = useState<string>("");
  const [caseTypeSearch, setCaseTypeSearch] = useState("");
  const [processStage, setProcessStage] = useState<ProcessStage>("uscis");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setCaseTypeKey("");
      setCaseTypeSearch("");
      setProcessStage("uscis");
      setNotes("");
    }
  }, [open]);

  // Cargar equipo de la firma para el picker "asignar a"
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
        // Default: el current user si está en el equipo
        const { data: { user } } = await supabase.auth.getUser();
        if (user && members.some(m => m.user_id === user.id)) {
          setAssignedTo(user.id);
        }
      }
    })();
  }, [open, lead?.account_id]);

  // Filtrado + agrupado del catálogo
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

  const clientName = useMemo(() => {
    if (!lead) return "";
    return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || lead.phone || "Sin nombre";
  }, [lead]);

  async function handleConvert() {
    if (!lead) return;
    if (!caseTypeKey) {
      toast.error("Seleccioná el tipo de caso");
      return;
    }
    if (!selectedType) return;
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

      // INSERT en client_cases — patrón de ConsultationRoom.tsx:380-397
      const { data: caseRow, error: caseErr } = await supabase
        .from("client_cases")
        .insert({
          account_id: lead.account_id,
          client_profile_id: lead.id,
          professional_id: user.id,
          assigned_to: assignedTo || user.id,
          client_name: clientName,
          client_email: lead.email || "",
          case_type: selectedType.shortLabel,
          process_type: selectedType.key,
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

      // UPDATE lead → contact_stage='client'
      await supabase
        .from("client_profiles")
        .update({ contact_stage: "client", updated_at: new Date().toISOString() } as any)
        .eq("id", lead.id);

      logAudit({
        action: "case.created" as any,
        entity_type: "case",
        entity_id: caseRow.id,
        entity_label: `${clientName} · ${selectedType.shortLabel}`,
        metadata: { process_stage: processStage, case_type_key: selectedType.key, from_lead: lead.id },
      });

      toast.success(`Caso creado · ${clientName}`, {
        description: `${selectedType.shortLabel} · ${PIPELINE_OPTIONS.find(p => p.value === processStage)?.label}`,
        duration: 4000,
      });

      onOpenChange(false);
      onCreated?.(caseRow.id);
      // Llevarlo al case engine para configurar siguiente paso
      navigate(`/case-engine/${caseRow.id}`);
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
            Convertir lead en caso
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{clientName}</span>
            {lead.email && <span> · {lead.email}</span>}
            {lead.phone && <span> · {lead.phone}</span>}
          </p>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 1. Pipeline picker */}
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

          {/* 2. Case type picker (searchable) */}
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

          {/* 3. Asignado a */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              3. Asignar a
            </Label>
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
            disabled={loading || !caseTypeKey}
            className="bg-cyan-accent hover:bg-cyan-accent/90 text-deep-navy font-semibold gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
