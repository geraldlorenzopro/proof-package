import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { logAccess } from "@/lib/auditLog";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Pause, Play, Loader2, Bot, Send, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import HubLayout from "./HubLayout";

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "bg-red-500/15 text-red-400 border-red-500/20" },
  prioritario: { label: "Prioritario", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  informativo: { label: "Informativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", referido: "Referido", anuncio: "Anuncio / Ads",
  website: "Website", llamada: "Llamada", "walk-in": "Walk-in",
  youtube: "YouTube", otro: "Otro",
};

const TOPIC_LABELS: Record<string, string> = {
  "familia": "Residencia / Green Card por familia",
  "ajuste-estatus": "Ajuste de estatus dentro de EE.UU.",
  "consular": "Proceso consular / Embajada / NVC",
  "naturalizacion": "Ciudadanía / Naturalización",
  "ead-documentos": "Permiso de trabajo o documentos",
  "visa-temporal": "Visa temporal",
  "empleo-inversion": "Green Card por trabajo o inversión",
  "asilo-humanitario": "Asilo o protección humanitaria",
  "proteccion-especial": "Protección especial",
  "waiver": "Perdones migratorios",
  "corte-ice-cbp": "Corte, ICE o situación en frontera",
  "otro": "Otro tema",
};

const REASON_LABELS: Record<string, string> = {
  'iniciar-proceso': 'Quiere iniciar un proceso migratorio',
  'seguimiento': 'Tiene un caso activo y necesita seguimiento',
  'calificacion': 'Quiere saber si califica',
  'situacion-urgente': 'Situación urgente (audiencia, detención)',
  'informacion': 'Solo busca información general',
  'otra': 'Otro motivo',
};

const CASE_TYPE_LABELS: Record<string, string> = {
  'adjustment-of-status': 'Ajuste de Estatus',
  'family-petition': 'Petición Familiar',
  'naturalization': 'Ciudadanía / Naturalización',
  'daca-tps': 'DACA / TPS',
  'ead-renewal': 'Renovación de EAD',
  'consular-b1b2': 'Proceso Consular',
  'vawa-u-visa': 'VAWA / U-Visa',
  'removal-defense': 'Defensa ante Remoción',
  'asylum': 'Asilo',
  'work-visa': 'Visa de Trabajo',
  'green-card-renewal': 'Renovación Green Card',
  'removal-of-conditions': 'Remoción de Condiciones',
  'extension-of-status': 'Extensión de Estatus',
  'affidavit-support': 'Affidavit of Support',
  'travel-document': 'Travel Document',
  'waiver': 'Perdón Migratorio',
  'consultation': 'Consulta inicial requerida',
};

const INITIAL_TASKS: Record<string, Array<{ title: string; days: number; priority: string }>> = {
  'adjustment-of-status': [
    { title: 'Solicitar examen médico (I-693)', days: 5, priority: 'high' },
    { title: 'Recopilar documentos de identidad', days: 7, priority: 'high' },
    { title: 'Recopilar documentos de estatus', days: 7, priority: 'high' },
    { title: 'Felix: Completar I-485', days: 10, priority: 'high' },
    { title: 'Felix: Completar I-864', days: 10, priority: 'high' },
    { title: 'Nina: Revisar paquete completo', days: 14, priority: 'high' },
    { title: 'Max: Evaluar calidad', days: 15, priority: 'medium' },
    { title: 'Enviar a USCIS', days: 16, priority: 'high' },
  ],
  'family-petition': [
    { title: 'Documentos del peticionario', days: 5, priority: 'high' },
    { title: 'Documentos del beneficiario', days: 5, priority: 'high' },
    { title: 'Felix: Completar I-130', days: 8, priority: 'high' },
    { title: 'Nina: Revisar paquete I-130', days: 12, priority: 'high' },
    { title: 'Enviar a USCIS', days: 14, priority: 'high' },
  ],
  'naturalization': [
    { title: 'Verificar 5 años de residencia', days: 2, priority: 'high' },
    { title: 'Recopilar documentos de residencia', days: 5, priority: 'high' },
    { title: 'Felix: Completar N-400', days: 7, priority: 'high' },
    { title: 'Nina: Revisar N-400', days: 10, priority: 'high' },
    { title: 'Preparar entrevista con cliente', days: 20, priority: 'medium' },
  ],
  'daca-tps': [
    { title: 'Verificar elegibilidad DACA/TPS', days: 2, priority: 'high' },
    { title: 'Documentos de presencia continua', days: 5, priority: 'high' },
    { title: 'Felix: Completar I-821D/I-821', days: 7, priority: 'high' },
    { title: 'Felix: Completar I-765', days: 7, priority: 'high' },
    { title: 'Nina: Revisar paquete', days: 10, priority: 'high' },
    { title: 'Enviar a USCIS', days: 12, priority: 'high' },
  ],
  'ead-renewal': [
    { title: 'Verificar fecha expiración EAD', days: 1, priority: 'high' },
    { title: 'Recopilar documentos de soporte', days: 3, priority: 'high' },
    { title: 'Felix: Completar I-765', days: 5, priority: 'high' },
    { title: 'Nina: Revisar I-765', days: 7, priority: 'high' },
    { title: 'Enviar a USCIS', days: 8, priority: 'high' },
  ],
  'consular-b1b2': [
    { title: 'Documentos de soporte consular', days: 5, priority: 'high' },
    { title: 'Felix: Completar DS-160', days: 7, priority: 'high' },
    { title: 'Agendar entrevista en embajada', days: 10, priority: 'high' },
    { title: 'Preparar entrevista consular', days: 15, priority: 'medium' },
  ],
  'default': [
    { title: 'Recopilar documentos iniciales', days: 7, priority: 'high' },
    { title: 'Revisar elegibilidad del proceso', days: 3, priority: 'high' },
    { title: 'Planificar estrategia del caso', days: 5, priority: 'medium' },
    { title: 'Nina: Revisar documentación inicial', days: 10, priority: 'medium' },
  ],
};

const NO_CONTRACT_REASONS = [
  { value: 'no_qualifies', label: 'No califica para ningún proceso' },
  { value: 'price', label: 'Precio fuera de su presupuesto' },
  { value: 'other_provider', label: 'Decidió buscar otro preparador' },
  { value: 'thinking', label: 'Necesita pensarlo — quiere seguimiento' },
  { value: 'no_show', label: 'No se presentó a la consulta' },
  { value: 'other', label: 'Otro' },
];

export default function ConsultationRoom() {
  const { intakeId } = useParams<{ intakeId: string }>();
  const navigate = useNavigate();

  // Data
  const [intake, setIntake] = useState<any>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");

  // Timer
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Notes
  const [notes, setNotes] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Felix AI
  const [felixLoading, setFelixLoading] = useState(false);
  const [felixSuggestion, setFelixSuggestion] = useState<{ case_type: string; confidence: number; reasoning: string } | null>(null);

  // Decision modals
  const [showContracted, setShowContracted] = useState(false);
  const [showNoContract, setShowNoContract] = useState(false);

  // Contracted modal state
  const [caseTypes, setCaseTypes] = useState<any[]>([]);
  const [selectedCaseType, setSelectedCaseType] = useState("");
  const [honorarios, setHonorarios] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // No-contract modal state
  const [noContractReason, setNoContractReason] = useState("");
  const [noContractOther, setNoContractOther] = useState("");
  const [noContractNote, setNoContractNote] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(14);

  useEffect(() => {
    loadData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [intakeId]);

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  // Auto-save notes every 30 seconds
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (notes.trim() && accountId && intake?.client_profile_id) {
        saveNotes();
      }
    }, 30000);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
  }, [notes, accountId, consultationId, intake]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: aid } = await supabase.rpc("user_account_id", { _user_id: user.id });
    if (aid) setAccountId(aid);

    // Load profile info
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    setUserName(prof?.full_name || "Usuario");

    // Load intake
    const { data: intakeData } = await supabase
      .from("intake_sessions")
      .select("*")
      .eq("id", intakeId)
      .single();
    if (!intakeData) { setLoading(false); return; }
    setIntake(intakeData);

    // Load appointment
    const { data: apptData } = await supabase
      .from("appointments")
      .select("*")
      .eq("intake_session_id", intakeId)
      .maybeSingle();
    setAppointment(apptData);

    // Load client profile
    if (intakeData.client_profile_id) {
      const { data: profileData } = await supabase
        .from("client_profiles")
        .select("id, first_name, last_name, phone, email")
        .eq("id", intakeData.client_profile_id)
        .single();
      setProfile(profileData);
    }

    // Load existing consultation
    if (aid) {
      const { data: existingConsult } = await supabase
        .from("consultations")
        .select("id, raw_notes")
        .eq("account_id", aid)
        .eq("client_profile_id", intakeData.client_profile_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingConsult) {
        setConsultationId(existingConsult.id);
        if (existingConsult.raw_notes) setNotes(existingConsult.raw_notes);
      }

      // Load case types
      const { data: ct } = await supabase
        .from("active_case_types")
        .select("case_type, display_name")
        .eq("account_id", aid)
        .eq("is_active", true)
        .order("sort_order");
      if (ct) setCaseTypes(ct);

      // Load team
      const { data: members } = await supabase
        .from("account_members")
        .select("user_id, role")
        .eq("account_id", aid);
      if (members) {
        const memberIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", memberIds);
        setTeamMembers((profiles || []).map(p => ({ user_id: p.user_id, name: p.full_name || "Usuario" })));
        setSelectedAssignee(user.id);
      }
    }

    // Audit log
    if (aid && user && intakeData) {
      logAccess({
        accountId: aid,
        userId: user.id,
        userName: prof?.full_name || undefined,
        action: "viewed",
        entityType: "consultation_room",
        entityId: intakeId,
        metadata: { client_name: intakeData.client_first_name || "" },
      });
    }

    // Run Felix AI
    runFelix(intakeData, apptData);
    setLoading(false);
  }

  async function runFelix(intakeData: any, apptData: any) {
    if (!intakeData) return;
    setFelixLoading(true);
    try {
      const { data: result } = await supabase.functions.invoke("detect-case-type", {
        body: {
          consultation_topic: intakeData.consultation_topic,
          consultation_topic_tag: intakeData.consultation_topic_tag,
          notes: intakeData.notes,
          urgency_level: intakeData.urgency_level,
          pre_intake_data: apptData?.pre_intake_data || null,
        },
      });
      if (result?.suggested_type && (result.confidence ?? 0) >= 40) {
        const suggestion = { case_type: result.suggested_type, confidence: result.confidence, reasoning: result.reasoning };
        setFelixSuggestion(suggestion);
        setSelectedCaseType(result.suggested_type);
      } else if (result?.case_type && (result.confidence ?? 0) >= 40) {
        setFelixSuggestion(result);
        setSelectedCaseType(result.case_type);
      }
    } catch (err) {
      console.warn("Felix detection failed:", err);
    } finally {
      setFelixLoading(false);
    }
  }

  async function saveNotes() {
    if (!accountId || !intake?.client_profile_id || !userId) return;
    try {
      if (consultationId) {
        await supabase.from("consultations").update({ raw_notes: notes } as any).eq("id", consultationId);
      } else {
        const { data: newConsult } = await supabase
          .from("consultations")
          .insert({
            account_id: accountId,
            client_profile_id: intake.client_profile_id,
            created_by: userId,
            status: "in_progress",
            raw_notes: notes,
            started_at: new Date().toISOString(),
          } as any)
          .select("id")
          .single();
        if (newConsult) setConsultationId(newConsult.id);
      }
      setLastSaved(new Date());
    } catch (err) {
      console.warn("Note save failed:", err);
    }
  }

  // ═══ CONTRACTED HANDLER ═══
  function capitalizeName(name: string): string {
    return name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
  }

  async function handleContracted() {
    if (!selectedCaseType || !honorarios || !profile || !accountId) return;
    setSubmitting(true);
    try {
      const clientName = capitalizeName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim());
      const timerMinutes = Math.round(seconds / 60);

      // Save notes first
      await saveNotes();

      // STEP 1: Create case
      const { data: newCase, error: caseErr } = await supabase
        .from("client_cases")
        .insert({
          account_id: accountId,
          client_profile_id: profile.id,
          assigned_to: selectedAssignee || userId,
          professional_id: userId,
          client_name: clientName,
          client_email: profile.email || "",
          case_type: selectedCaseType,
          process_type: selectedCaseType,
          status: "active",
          pipeline_stage: "caso-activado",
          ball_in_court: "team",
        } as any)
        .select("id, file_number, access_token")
        .single();
      if (caseErr) throw caseErr;

      // STEP 2: Update intake_sessions
      await supabase
        .from("intake_sessions")
        .update({ status: "converted", final_case_type: selectedCaseType, case_id: newCase.id } as any)
        .eq("id", intakeId);

      // STEP 3: Update/create consultation
      const consultData = {
        decision: "contracted",
        contract_amount: parseFloat(honorarios),
        ai_recommended_case_type: felixSuggestion?.case_type || null,
        case_id: newCase.id,
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_minutes: timerMinutes,
        raw_notes: notes,
      };
      if (consultationId) {
        await supabase.from("consultations").update(consultData as any).eq("id", consultationId);
      } else {
        await supabase.from("consultations").insert({
          ...consultData,
          account_id: accountId,
          client_profile_id: profile.id,
          created_by: userId,
          started_at: new Date().toISOString(),
        } as any);
      }

      // STEP 4: Create initial tasks
      const tasks = INITIAL_TASKS[selectedCaseType] || INITIAL_TASKS['default'];
      const today = new Date();
      for (const task of tasks) {
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() + task.days);
        await supabase.from("case_tasks").insert({
          account_id: accountId,
          case_id: newCase.id,
          title: task.title,
          status: "pending",
          priority: task.priority,
          due_date: dueDate.toISOString().split("T")[0],
          created_by: userId,
          created_by_name: userName,
        });
      }

      // STEP 5: Update appointment
      if (appointment?.id) {
        await supabase.from("appointments").update({ converted_to_case: true, case_id: newCase.id } as any).eq("id", appointment.id);
      }

      // STEP 6: Open WhatsApp
      const phoneClean = (profile.phone || "").replace(/\D/g, "");
      const caseTypeLabel = CASE_TYPE_LABELS[selectedCaseType] || selectedCaseType;
      const portalLink = `${window.location.origin}/case-track/${newCase.access_token}`;
      const welcomeMsg = `¡Hola ${profile.first_name}! 🎉\n\nBienvenido/a a Mr Visa Immigration.\n\nTu expediente ha sido abierto:\n📋 *${newCase.file_number}*\n📂 Proceso: ${caseTypeLabel}\n\n*¿Qué sigue?*\n1️⃣ Te contactaremos para coordinar la entrega de documentos\n2️⃣ Puedes seguir tu caso aquí:\n${portalLink}\n\nCualquier pregunta, escríbenos aquí. 🙏`;

      if (phoneClean) {
        window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(welcomeMsg)}`, "_blank");
      }

      toast.success(`Caso ${newCase.file_number} creado exitosamente`);
      navigate(`/case-engine/${newCase.id}`);
    } catch (err: any) {
      console.error("Contract error:", err);
      toast.error(err?.message || "Error al crear el caso");
    } finally {
      setSubmitting(false);
    }
  }

  // ═══ NO-CONTRACT HANDLER ═══
  async function handleNoContract() {
    if (!noContractReason || !profile || !accountId) return;
    setSubmitting(true);
    try {
      const timerMinutes = Math.round(seconds / 60);
      const reasonLabel = NO_CONTRACT_REASONS.find(r => r.value === noContractReason)?.label || noContractReason;
      const fullReason = noContractReason === "other" ? noContractOther : reasonLabel;

      await saveNotes();

      // STEP 1: Update intake
      await supabase.from("intake_sessions").update({ status: "no_contract" } as any).eq("id", intakeId);

      // STEP 2: Update/create consultation
      const consultData = {
        decision: "no_contract",
        decision_notes: `${fullReason}${noContractNote ? '. ' + noContractNote : ''}`,
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_minutes: timerMinutes,
        raw_notes: notes,
      };
      if (consultationId) {
        await supabase.from("consultations").update(consultData as any).eq("id", consultationId);
      } else {
        await supabase.from("consultations").insert({
          ...consultData,
          account_id: accountId,
          client_profile_id: profile.id,
          created_by: userId,
          started_at: new Date().toISOString(),
        } as any);
      }

      // STEP 3: Update profile stage
      await supabase.from("client_profiles").update({ contact_stage: "inactive" } as any).eq("id", profile.id);

      // STEP 4: Follow-up task
      if (followUp) {
        const followDate = new Date();
        followDate.setDate(followDate.getDate() + followUpDays);
        await supabase.from("case_tasks").insert({
          account_id: accountId,
          case_id: null,
          title: `Seguimiento: ${profile.first_name} ${profile.last_name}`,
          description: `Razón no contrató: ${fullReason}. ${noContractNote || ''}`,
          status: "pending",
          priority: "medium",
          due_date: followDate.toISOString().split("T")[0],
          created_by: userId,
          created_by_name: userName,
        });
      }

      toast.success(`Consulta de ${profile.first_name} registrada correctamente`);
      navigate("/hub/consultations");
    } catch (err: any) {
      console.error("No-contract error:", err);
      toast.error(err?.message || "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const rawClientName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : intake?.client_first_name || "";
  const clientName = capitalizeName(rawClientName);
  const topicLabel = TOPIC_LABELS[intake?.consultation_topic || ""] || intake?.consultation_topic || "";
  const urgency = URGENCY_CONFIG[intake?.urgency_level || ""];
  const channelLabel = CHANNEL_LABELS[intake?.entry_channel || ""] || intake?.entry_channel || "";

  if (loading) {
    return (
      <HubLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </HubLayout>
    );
  }

  if (!intake) {
    return (
      <HubLayout>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-muted-foreground">Consulta no encontrada</p>
          <Button variant="outline" onClick={() => navigate("/hub/consultations")}>← Volver</Button>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="h-full flex flex-col">
        {/* HEADER */}
        <div className="h-16 shrink-0 border-b border-border px-4 flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/hub/consultations")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{clientName}</span>
                <span className="text-muted-foreground text-xs">—</span>
                <span className="text-muted-foreground text-xs truncate max-w-[200px]">{topicLabel}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {urgency && <Badge variant="outline" className={`${urgency.color} text-[9px] py-0`}>{urgency.label}</Badge>}
                <Badge variant="outline" className="text-[9px] py-0">{channelLabel}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono text-sm font-semibold text-foreground">{formatTime(seconds)}</span>
              <button onClick={() => setTimerRunning(!timerRunning)} className="p-0.5 text-muted-foreground hover:text-foreground">
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* BODY — 2 columns */}
        <div className="flex-1 min-h-0 flex">
          {/* LEFT — Pre-intake */}
          <div className="w-[38%] border-r border-border overflow-auto p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Pre-intake del cliente</h3>
            {appointment?.pre_intake_completed ? (
              <div className="space-y-3">
                {appointment.pre_intake_data && typeof appointment.pre_intake_data === "object" ? (
                  Object.entries(appointment.pre_intake_data as Record<string, any>).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2 text-sm border-b border-border/30 pb-2">
                      <span className="text-muted-foreground text-xs capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-foreground text-xs font-medium text-right max-w-[60%]">{String(value)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Datos del pre-intake no disponibles</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Formulario pendiente</p>
                  <p className="text-xs text-muted-foreground mt-1">El cliente aún no ha completado el pre-intake</p>
                </div>
                {profile?.phone && appointment?.pre_intake_token && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => {
                      const phone = (profile.phone || "").replace(/\D/g, "");
                      const url = `${window.location.origin}/intake/${appointment.pre_intake_token}`;
                      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${profile.first_name}, completa este formulario antes de la consulta: ${url}`)}`, "_blank");
                    }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Reenviar por WhatsApp
                  </Button>
                )}
              </div>
            )}

            {/* Known data from intake */}
            <div className="mt-4 space-y-2 text-sm px-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lo que sabemos</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Canal</span>
                <span className="text-foreground">{channelLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tema</span>
                <span className="text-foreground text-right max-w-[60%]">{topicLabel}</span>
              </div>
              {urgency && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Urgencia</span>
                  <Badge variant="outline" className={`${urgency.color} text-[9px] py-0`}>{urgency.label}</Badge>
                </div>
              )}
              {intake?.consultation_reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo</span>
                  <span className="text-foreground">{REASON_LABELS[intake.consultation_reason] || intake.consultation_reason}</span>
                </div>
              )}
              {intake?.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Notas del registro</p>
                  <p className="text-sm italic text-foreground">"{intake.notes}"</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Notes + Felix */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Notes section */}
            <div className="flex-1 min-h-0 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">Mis notas</h3>
                {lastSaved && (
                  <span className="text-[10px] text-muted-foreground/60">
                    Guardado {Math.round((Date.now() - lastSaved.getTime()) / 1000)}s
                  </span>
                )}
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe tus notas de la consulta aquí..."
                className="flex-1 resize-none text-sm bg-muted/30 border-border min-h-[120px]"
              />
            </div>

            {/* Felix section */}
            <div className="border-t border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Felix sugiere</h3>
              </div>
              {felixLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span className="text-xs text-muted-foreground">Felix está analizando...</span>
                </div>
              ) : felixSuggestion ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">🤖 {CASE_TYPE_LABELS[felixSuggestion.case_type] || felixSuggestion.case_type}</span>
                    <Badge variant="outline" className="text-[9px]">Confianza: {felixSuggestion.confidence}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {felixSuggestion.case_type === 'consultation' 
                      ? "Felix necesita más información del cliente para sugerir un tipo de caso específico. Completa el pre-intake para una sugerencia más precisa."
                      : felixSuggestion.reasoning}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">No se pudo generar sugerencia</p>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER — Decision buttons */}
        <div className="h-[72px] shrink-0 border-t border-border px-4 flex items-center justify-center gap-4 bg-card/50">
          <Button
            variant="outline"
            size="lg"
            className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-8"
            onClick={() => setShowNoContract(true)}
          >
            ❌ No contrató
          </Button>
          <Button
            size="lg"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8"
            onClick={() => setShowContracted(true)}
          >
            ✅ Contrató
          </Button>
        </div>
      </div>

      {/* ═══ CONTRACTED MODAL ═══ */}
      <Dialog open={showContracted} onOpenChange={setShowContracted}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Registrar contratación</DialogTitle>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Tipo de caso *</Label>
              <Select value={selectedCaseType} onValueChange={setSelectedCaseType}>
                <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {caseTypes.map(ct => (
                    <SelectItem key={ct.case_type} value={ct.case_type}>{ct.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {felixSuggestion && selectedCaseType === felixSuggestion.case_type && (
                <p className="text-[10px] text-accent">🤖 Sugerido por Felix</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Honorarios acordados *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" min={0} value={honorarios} onChange={(e) => setHonorarios(e.target.value)} placeholder="0.00" className="pl-7 bg-muted/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Asignado a</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border border-border rounded-lg p-3 space-y-1.5 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground">Al crear el caso, NER va a:</p>
              <p className="text-xs text-emerald-400">✅ Generar el número de expediente</p>
              <p className="text-xs text-emerald-400">✅ Crear las tareas iniciales del proceso</p>
              <p className="text-xs text-emerald-400">✅ Activar el portal del cliente</p>
              <p className="text-xs text-emerald-400">✅ Preparar mensaje de bienvenida</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowContracted(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleContracted}
                disabled={!selectedCaseType || !honorarios || submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Crear caso ahora →
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ NO-CONTRACT MODAL ═══ */}
      <Dialog open={showNoContract} onOpenChange={setShowNoContract}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Registrar resultado</DialogTitle>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Razón *</Label>
              <div className="space-y-1.5">
                {NO_CONTRACT_REASONS.map(r => (
                  <label key={r.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${noContractReason === r.value ? "border-accent/30 bg-accent/5" : "border-border hover:bg-muted/30"}`}>
                    <input type="radio" name="reason" value={r.value} checked={noContractReason === r.value}
                      onChange={() => {
                        setNoContractReason(r.value);
                        setFollowUp(r.value === "thinking");
                      }}
                      className="accent-accent" />
                    <span className="text-sm text-foreground">{r.label}</span>
                  </label>
                ))}
              </div>
              {noContractReason === "other" && (
                <Input value={noContractOther} onChange={(e) => setNoContractOther(e.target.value.slice(0, 100))} placeholder="Especifica la razón..." className="mt-2 bg-muted/50" maxLength={100} />
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground">¿Programar seguimiento?</Label>
              <Switch checked={followUp} onCheckedChange={setFollowUp} />
            </div>
            {followUp && (
              <div className="flex gap-2">
                {[7, 14, 30, 60].map(d => (
                  <button
                    key={d}
                    onClick={() => setFollowUpDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${followUpDays === d ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted/30"}`}
                  >
                    {d} días
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-foreground">Nota interna</Label>
              <Textarea value={noContractNote} onChange={(e) => setNoContractNote(e.target.value.slice(0, 150))} placeholder="Notas para el equipo..." className="bg-muted/50 min-h-[60px]" maxLength={150} />
              <p className="text-[10px] text-muted-foreground text-right">{noContractNote.length}/150</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowNoContract(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleNoContract}
                disabled={!noContractReason || (noContractReason === "other" && !noContractOther) || submitting}
                className="flex-1 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Registrar →
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </HubLayout>
  );
}
