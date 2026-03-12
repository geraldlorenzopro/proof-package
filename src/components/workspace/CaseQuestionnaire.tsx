import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Loader2, Save, CheckCircle2, FileText, User, MapPin,
  Plane, Briefcase, Heart, Shield, ClipboardList, AlertCircle
} from "lucide-react";

interface FieldDef {
  field_key: string;
  label_en: string;
  label_es: string;
  field_type: string;
  field_group: string;
  field_subgroup: string | null;
  options: string[];
  help_text_es: string | null;
  sort_order: number;
  is_required: boolean;
  forms_using: string[]; // which forms need this field
}

interface Props {
  caseId: string;
  accountId: string;
}

const GROUP_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  beneficiary: { label: "Beneficiario", icon: User, color: "text-jarvis" },
  petitioner: { label: "Peticionario", icon: User, color: "text-accent" },
  relationship: { label: "Relación", icon: Heart, color: "text-pink-400" },
  employment: { label: "Empleo", icon: Briefcase, color: "text-emerald-400" },
  ead: { label: "Permiso de Trabajo (EAD)", icon: ClipboardList, color: "text-blue-400" },
  travel: { label: "Documento de Viaje", icon: Plane, color: "text-purple-400" },
  i485: { label: "Ajuste de Estatus (I-485)", icon: Shield, color: "text-amber-400" },
};

const SUBGROUP_LABELS: Record<string, string> = {
  personal: "Datos Personales",
  address: "Dirección",
  contact: "Contacto",
  immigration: "Información Migratoria",
  marriage: "Matrimonio",
  current: "Empleo Actual",
  eligibility: "Elegibilidad",
  details: "Detalles",
  history: "Historial",
  medical: "Examen Médico",
};

export default function CaseQuestionnaire({ caseId, accountId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [caseForms, setCaseForms] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>("");
  const [profileData, setProfileData] = useState<Record<string, string>>({});

  // Load case forms, field registry, mappings, and existing answers
  useEffect(() => {
    loadAll();
  }, [caseId]);

  const loadAll = async () => {
    setLoading(true);

    // 1. Get forms for this case
    const { data: formRows } = await supabase
      .from("case_forms")
      .select("form_type")
      .eq("case_id", caseId);

    const formTypes = formRows?.map(r => r.form_type) || [];
    setCaseForms(formTypes);

    if (formTypes.length === 0) {
      setLoading(false);
      return;
    }

    // 2. Get field mappings for these forms
    const { data: mappings } = await supabase
      .from("form_field_mappings")
      .select("form_type, field_key, is_required, sort_order")
      .in("form_type", formTypes);

    if (!mappings || mappings.length === 0) {
      setLoading(false);
      return;
    }

    // 3. Get unique field keys and their form associations
    const fieldFormMap: Record<string, { forms: string[]; isRequired: boolean; sortOrder: number }> = {};
    for (const m of mappings) {
      if (!fieldFormMap[m.field_key]) {
        fieldFormMap[m.field_key] = { forms: [], isRequired: false, sortOrder: m.sort_order };
      }
      fieldFormMap[m.field_key].forms.push(m.form_type);
      if (m.is_required) fieldFormMap[m.field_key].isRequired = true;
      fieldFormMap[m.field_key].sortOrder = Math.min(fieldFormMap[m.field_key].sortOrder, m.sort_order);
    }

    const uniqueKeys = Object.keys(fieldFormMap);

    // 4. Get field definitions from registry
    const { data: registryFields } = await supabase
      .from("form_field_registry")
      .select("field_key, label_en, label_es, field_type, field_group, field_subgroup, options, help_text_es, sort_order")
      .in("field_key", uniqueKeys);

    if (registryFields) {
      const merged: FieldDef[] = registryFields.map(rf => ({
        ...rf,
        options: Array.isArray(rf.options) ? rf.options as string[] : [],
        is_required: fieldFormMap[rf.field_key]?.isRequired || false,
        forms_using: fieldFormMap[rf.field_key]?.forms || [],
      }));

      // Sort by group then sort_order
      merged.sort((a, b) => {
        if (a.field_group !== b.field_group) return a.sort_order - b.sort_order;
        return a.sort_order - b.sort_order;
      });

      setFields(merged);

      // Set first group as active
      if (merged.length > 0 && !activeGroup) {
        setActiveGroup(merged[0].field_group);
      }
    }

    // 5. Load existing answers
    const { data: existingAnswers } = await supabase
      .from("case_questionnaire_answers")
      .select("field_key, value")
      .eq("case_id", caseId);

    if (existingAnswers) {
      const answerMap: Record<string, string> = {};
      for (const a of existingAnswers) {
        if (a.value) answerMap[a.field_key] = a.value;
      }
      setAnswers(answerMap);
    }

    // 6. Try to pre-fill from client profile
    const { data: caseData } = await supabase
      .from("client_cases")
      .select("client_profile_id")
      .eq("id", caseId)
      .single();

    if (caseData?.client_profile_id) {
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("id", caseData.client_profile_id)
        .single();

      if (profile) {
        const profileMap: Record<string, string> = {};
        const pMap: Record<string, string> = {
          ben_first_name: profile.first_name || "",
          ben_last_name: profile.last_name || "",
          ben_middle_name: profile.middle_name || "",
          ben_dob: profile.dob || "",
          ben_gender: profile.gender || "",
          ben_city_of_birth: profile.city_of_birth || "",
          ben_state_of_birth: profile.province_of_birth || "",
          ben_country_of_birth: profile.country_of_birth || "",
          ben_country_of_citizenship: profile.country_of_citizenship || "",
          ben_a_number: profile.a_number || "",
          ben_ssn: profile.ssn_last4 || "",
          ben_marital_status: profile.marital_status || "",
          ben_address_street: profile.address_street || "",
          ben_address_apt: profile.address_apt || "",
          ben_address_city: profile.address_city || "",
          ben_address_state: profile.address_state || "",
          ben_address_zip: profile.address_zip || "",
          ben_address_country: profile.address_country || "",
          ben_phone: profile.phone || "",
          ben_mobile: profile.mobile_phone || "",
          ben_email: profile.email || "",
          ben_immigration_status: profile.immigration_status || "",
          ben_class_of_admission: profile.class_of_admission || "",
          ben_date_of_last_entry: profile.date_of_last_entry || "",
          ben_place_of_last_entry: profile.place_of_last_entry || "",
          ben_i94_number: profile.i94_number || "",
          ben_passport_number: profile.passport_number || "",
          ben_passport_country: profile.passport_country || "",
          ben_passport_expiration: profile.passport_expiration || "",
        };
        for (const [k, v] of Object.entries(pMap)) {
          if (v) profileMap[k] = v;
        }
        setProfileData(profileMap);

        // Pre-fill answers that don't already exist
        setAnswers(prev => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(profileMap)) {
            if (!merged[k] && v) merged[k] = v;
          }
          return merged;
        });
      }
    }

    setLoading(false);
  };

  // Group fields
  const groups = useMemo(() => {
    const groupMap: Record<string, FieldDef[]> = {};
    for (const f of fields) {
      if (!groupMap[f.field_group]) groupMap[f.field_group] = [];
      groupMap[f.field_group].push(f);
    }
    return groupMap;
  }, [fields]);

  const groupKeys = Object.keys(groups);

  // Stats
  const totalFields = fields.length;
  const answeredFields = fields.filter(f => answers[f.field_key]?.trim()).length;
  const progressPct = totalFields > 0 ? Math.round((answeredFields / totalFields) * 100) : 0;
  const requiredFields = fields.filter(f => f.is_required);
  const requiredAnswered = requiredFields.filter(f => answers[f.field_key]?.trim()).length;

  const updateAnswer = useCallback((key: string, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sesión expirada"); return; }

      // Upsert all answers
      const rows = Object.entries(answers)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([key, value]) => ({
          case_id: caseId,
          account_id: accountId,
          field_key: key,
          value: value || null,
          updated_by: user.id,
        }));

      if (rows.length === 0) {
        toast.info("No hay respuestas para guardar");
        setSaving(false);
        return;
      }

      // Batch upsert using onConflict
      const { error } = await supabase
        .from("case_questionnaire_answers")
        .upsert(rows, { onConflict: "case_id,field_key" });

      if (error) {
        console.error(error);
        toast.error("Error al guardar");
      } else {
        toast.success(`${rows.length} respuestas guardadas`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-jarvis animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando cuestionario...</span>
      </div>
    );
  }

  if (caseForms.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Este caso no tiene formularios asignados</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Edita el caso para agregar formularios y generar el cuestionario unificado</p>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No se encontraron campos para los formularios seleccionados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-jarvis" />
            Cuestionario Unificado
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {caseForms.map(f => (
              <Badge key={f} variant="outline" className="text-[9px] bg-jarvis/10 text-jarvis border-jarvis/20">{f}</Badge>
            ))}
            <span className="text-[10px] text-muted-foreground">
              · {totalFields} preguntas ({fields.filter(f => f.is_required).length} requeridas)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">{answeredFields}/{totalFields}</p>
            <p className="text-[9px] text-muted-foreground">respondidas</p>
          </div>
          <div className="w-16 h-16 relative">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="hsl(var(--jarvis))"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${progressPct * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-jarvis">{progressPct}%</span>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-jarvis hover:bg-jarvis/90 gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Required fields warning */}
      {requiredAnswered < requiredFields.length && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {requiredFields.length - requiredAnswered} campo{requiredFields.length - requiredAnswered !== 1 ? "s" : ""} requerido{requiredFields.length - requiredAnswered !== 1 ? "s" : ""} sin responder
        </div>
      )}

      {/* Group tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {groupKeys.map(gk => {
          const cfg = GROUP_CONFIG[gk] || { label: gk, icon: FileText, color: "text-muted-foreground" };
          const Icon = cfg.icon;
          const groupFields = groups[gk];
          const groupAnswered = groupFields.filter(f => answers[f.field_key]?.trim()).length;
          const isComplete = groupAnswered === groupFields.length;
          return (
            <button
              key={gk}
              onClick={() => setActiveGroup(gk)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeGroup === gk
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground bg-secondary/50"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              )}
              {cfg.label}
              <span className="text-[9px] text-muted-foreground ml-1">
                {groupAnswered}/{groupFields.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active group fields */}
      <motion.div
        key={activeGroup}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        {(() => {
          const groupFields = groups[activeGroup] || [];
          // Sub-group fields
          const subgroups: Record<string, FieldDef[]> = {};
          for (const f of groupFields) {
            const sg = f.field_subgroup || "general";
            if (!subgroups[sg]) subgroups[sg] = [];
            subgroups[sg].push(f);
          }

          return Object.entries(subgroups).map(([sg, sgFields]) => (
            <div key={sg} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {SUBGROUP_LABELS[sg] || sg}
                </h4>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sgFields.map(field => (
                  <FieldInput
                    key={field.field_key}
                    field={field}
                    value={answers[field.field_key] || ""}
                    fromProfile={!!profileData[field.field_key]}
                    onChange={v => updateAnswer(field.field_key, v)}
                  />
                ))}
              </div>
            </div>
          ));
        })()}
      </motion.div>

      {/* Bottom save bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <p className="text-[10px] text-muted-foreground">
          Los datos del perfil del cliente se pre-llenan automáticamente
        </p>
        <Button onClick={handleSave} disabled={saving} className="bg-jarvis hover:bg-jarvis/90 gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Todo
        </Button>
      </div>
    </div>
  );
}

/* ── Individual Field Renderer ── */
function FieldInput({
  field, value, fromProfile, onChange
}: {
  field: FieldDef;
  value: string;
  fromProfile: boolean;
  onChange: (v: string) => void;
}) {
  const isWide = field.field_type === "textarea";

  return (
    <div className={`space-y-1.5 ${isWide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-foreground">
          {field.label_es}
          {field.is_required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {fromProfile && value && (
          <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1">
            Auto
          </Badge>
        )}
      </div>

      {/* Form usage indicator */}
      <div className="flex gap-1">
        {field.forms_using.map(f => (
          <span key={f} className="text-[8px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">{f}</span>
        ))}
      </div>

      {field.field_type === "select" && field.options.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map(opt => (
              <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.field_type === "textarea" ? (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.label_en}
          className="text-xs min-h-[60px]"
        />
      ) : field.field_type === "checkbox" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value === "true"}
            onCheckedChange={checked => onChange(checked ? "true" : "false")}
          />
          <span className="text-xs text-muted-foreground">{field.help_text_es || "Sí"}</span>
        </div>
      ) : (
        <Input
          type={field.field_type === "date" ? "date" : field.field_type === "email" ? "email" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.label_en}
          className="h-9 text-xs"
        />
      )}
    </div>
  );
}
