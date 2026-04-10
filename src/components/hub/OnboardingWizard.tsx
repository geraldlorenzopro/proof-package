import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { speakAsCamila, stopSpeaking } from "@/lib/camilaTTS";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  X, ArrowRight, Check, Sparkles, Building2, UserPlus,
  MessageSquare, Upload, Globe, Mail, Users, FolderOpen, Bot
} from "lucide-react";

interface Props {
  accountId: string;
  accountName: string;
  onComplete: () => void;
}

const STORAGE_KEY = "ner_onboarding_progress";
const STEPS = ["welcome", "firma", "cliente", "comunicacion", "listo"] as const;
type Step = typeof STEPS[number];

const STEP_LABELS = ["Firma", "Cliente", "Comunicación", "¡Listo!"];

const US_STATES = [
  "Florida", "Texas", "New York", "California", "Arizona", "Colorado",
  "Georgia", "Illinois", "New Jersey", "Nevada", "Other"
];

const CASE_TYPES = [
  "Petición Familiar (I-130)",
  "Ajuste de Estatus (I-485)",
  "Naturalización (N-400)",
  "DACA",
  "VAWA",
  "Asilo",
  "Otro"
];

export default function OnboardingWizard({ accountId, accountName, onComplete }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");

  // Firm data
  const [firmName, setFirmName] = useState(accountName || "");
  const [attorneyName, setAttorneyName] = useState("");
  const [firmPhone, setFirmPhone] = useState("");
  const [firmState, setFirmState] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Client data
  const [clientMode, setClientMode] = useState<"real" | "demo" | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCaseType, setClientCaseType] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [typewriterText, setTypewriterText] = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef<Set<string>>(new Set());

  // Restore progress from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step && STEPS.includes(parsed.step)) setStep(parsed.step);
        if (parsed.firmName) setFirmName(parsed.firmName);
        if (parsed.attorneyName) setAttorneyName(parsed.attorneyName);
        if (parsed.firmPhone) setFirmPhone(parsed.firmPhone);
        if (parsed.firmState) setFirmState(parsed.firmState);
      }
    } catch {}
  }, []);

  // Save progress
  useEffect(() => {
    if (step !== "welcome") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step, firmName, attorneyName, firmPhone, firmState
      }));
    }
  }, [step, firmName, attorneyName, firmPhone, firmState]);

  // Typewriter for welcome
  const welcomeText = "Hola, soy Camila. Voy a ayudarte a configurar tu oficina virtual. Solo toma 2 minutos y cuando terminemos, tu oficina estará lista para trabajar.";

  useEffect(() => {
    if (step === "welcome" && !typewriterDone) {
      let i = 0;
      setTypewriterText("");
      typewriterRef.current = setInterval(() => {
        i++;
        setTypewriterText(welcomeText.slice(0, i));
        if (i >= welcomeText.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current);
          setTypewriterDone(true);
        }
      }, 35);

      // TTS
      if (!hasSpokenRef.current.has("welcome")) {
        hasSpokenRef.current.add("welcome");
        setTimeout(() => speakAsCamila(welcomeText), 500);
      }

      return () => {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      };
    }
  }, [step]);

  const speak = useCallback((key: string, text: string) => {
    if (!hasSpokenRef.current.has(key)) {
      hasSpokenRef.current.add(key);
      speakAsCamila(text);
    }
  }, []);

  useEffect(() => {
    if (step === "firma") speak("firma", "Cuéntame cómo se llama tu firma. Esto aparecerá en todos tus documentos.");
    if (step === "cliente") speak("cliente", "¿Quieres agregar un cliente ahora o prefieres ver el sistema con datos de ejemplo primero?");
    if (step === "comunicacion") speak("comunicacion", "Puedes conectar WhatsApp y tu correo para que Camila te ayude a atender clientes automáticamente.");
    if (step === "listo") speak("listo", `¡Todo listo! Tu oficina está configurada y lista para trabajar. Recuerda que siempre puedes preguntarme lo que necesites.`);
  }, [step, speak]);

  function goTo(s: Step) {
    stopSpeaking();
    setStep(s);
  }

  async function skip() {
    stopSpeaking();
    await markComplete();
    onComplete();
  }

  async function markComplete() {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.from("ner_accounts").update({ onboarding_completed: true } as any).eq("id", accountId);
  }

  async function saveFirmAndContinue() {
    setSaving(true);
    try {
      // Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${accountId}/logo.${ext}`;
        await supabase.storage.from("firm-logos").upload(path, logoFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("firm-logos").getPublicUrl(path);
        logoUrl = urlData?.publicUrl || null;
      }

      // Update account name
      await supabase.from("ner_accounts").update({ account_name: firmName } as any).eq("id", accountId);

      // Upsert office_config
      const configPayload: Record<string, any> = {
        account_id: accountId,
        firm_name: firmName,
        attorney_name: attorneyName,
        firm_phone: firmPhone,
        bar_state: firmState,
      };
      if (logoUrl) configPayload.firm_logo_url = logoUrl;

      const { data: existing } = await supabase.from("office_config").select("id").eq("account_id", accountId).maybeSingle();
      if (existing) {
        await supabase.from("office_config").update(configPayload).eq("account_id", accountId);
      } else {
        await supabase.from("office_config").insert(configPayload);
      }

      goTo("cliente");
    } catch (err) {
      console.error("Save firm error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleClientStep() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) throw new Error("No user");

      if (clientMode === "demo") {
        // Insert demo clients
        const demoClients = [
          { first_name: "Carlos", last_name: "Mendoza", email: "carlos.mendoza@demo.com", phone: "+1 305-555-0101", is_test: true },
          { first_name: "María", last_name: "González", email: "maria.gonzalez@demo.com", phone: "+1 786-555-0202", is_test: true },
          { first_name: "Juan", last_name: "Pérez", email: "juan.perez@demo.com", phone: "+1 954-555-0303", is_test: true },
        ];

        const profileIds: string[] = [];
        for (const dc of demoClients) {
          const { data: inserted } = await supabase.from("client_profiles").insert({
            account_id: accountId, created_by: userId,
            first_name: dc.first_name, last_name: dc.last_name,
            email: dc.email, phone: dc.phone, is_test: dc.is_test,
          }).select("id").single();
          if (inserted) profileIds.push(inserted.id);
        }

        // Insert demo cases
        if (profileIds.length >= 2) {
          await supabase.from("client_cases").insert([
            {
              account_id: accountId, professional_id: userId,
              client_name: "Carlos Mendoza", client_email: "carlos.mendoza@demo.com",
              case_type: "I-130", client_profile_id: profileIds[0],
              status: "in_progress", pipeline_stage: "documentos-pendientes",
            },
            {
              account_id: accountId, professional_id: userId,
              client_name: "María González", client_email: "maria.gonzalez@demo.com",
              case_type: "I-485", client_profile_id: profileIds[1],
              status: "pending", pipeline_stage: "caso-no-iniciado",
            },
          ]);
        }

        // Insert demo appointment
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await supabase.from("appointments").insert({
          account_id: accountId,
          client_name: "Juan Pérez",
          client_email: "juan.perez@demo.com",
          appointment_date: tomorrow.toISOString().split("T")[0],
          appointment_type: "consultation",
          status: "scheduled",
        });
      } else if (clientMode === "real" && clientName.trim()) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const uid = currentUser?.id;
        if (!uid) throw new Error("No user");

        const { data: profile } = await supabase.from("client_profiles").insert({
          account_id: accountId, created_by: uid,
          first_name: clientName.split(" ")[0],
          last_name: clientName.split(" ").slice(1).join(" ") || "",
          email: clientEmail, phone: clientPhone,
        }).select("id").single();

        if (profile && clientCaseType) {
          const caseTypeMap: Record<string, string> = {
            "Petición Familiar (I-130)": "I-130",
            "Ajuste de Estatus (I-485)": "I-485",
            "Naturalización (N-400)": "N-400",
            "DACA": "DACA",
            "VAWA": "VAWA",
            "Asilo": "Asilo",
            "Otro": "general",
          };
          await supabase.from("client_cases").insert({
            account_id: accountId, professional_id: uid,
            client_name: clientName, client_email: clientEmail || "sin-correo@pending.com",
            case_type: caseTypeMap[clientCaseType] || "general",
            client_profile_id: profile.id,
          });
        }
      }

      goTo("comunicacion");
    } catch (err) {
      console.error("Client step error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish(destination: string) {
    setSaving(true);
    stopSpeaking();
    await markComplete();
    setSaving(false);
    onComplete();
    if (destination !== "/hub") navigate(destination);
  }

  const stepIndex = STEPS.indexOf(step);
  const progressPercent = step === "welcome" ? 0 : ((stepIndex - 1) / (STEPS.length - 2)) * 100;

  // ─── WELCOME SCREEN ───
  if (step === "welcome") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0f] flex flex-col items-center justify-center px-6">
        <button onClick={skip} className="absolute top-6 right-6 text-white/30 hover:text-white/60 transition-colors">
          <X className="w-6 h-6" />
        </button>

        {/* Camila avatar */}
        <div className="relative mb-10">
          <div className="w-24 h-24 rounded-3xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center animate-pulse">
            <Sparkles className="w-12 h-12 text-jarvis" />
          </div>
          <div className="absolute -inset-4 rounded-[2rem] bg-jarvis/5 animate-ping" style={{ animationDuration: "3s" }} />
        </div>

        {/* Typewriter text */}
        <div className="max-w-lg text-center mb-12">
          <p className="text-white/90 text-xl leading-relaxed font-light">
            {typewriterText}
            {!typewriterDone && <span className="inline-block w-0.5 h-5 bg-jarvis ml-1 animate-pulse" />}
          </p>
        </div>

        {/* CTA */}
        {typewriterDone && (
          <Button
            onClick={() => goTo("firma")}
            className="bg-jarvis hover:bg-jarvis/90 text-black font-bold text-lg px-10 py-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            Vamos <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    );
  }

  // ─── WIZARD OVERLAY ───
  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border/40 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-jarvis/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-jarvis" />
              </div>
              <span className="font-semibold text-foreground text-sm">Configuración inicial</span>
            </div>
            <button onClick={skip} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 ${i <= stepIndex - 1 ? "text-jarvis" : "text-muted-foreground/40"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    i < stepIndex - 1 ? "bg-jarvis border-jarvis text-black" :
                    i === stepIndex - 1 ? "border-jarvis text-jarvis" :
                    "border-border/30 text-muted-foreground/30"
                  }`}>
                    {i < stepIndex - 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-px ${i < stepIndex - 1 ? "bg-jarvis/40" : "bg-border/20"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* STEP: FIRMA */}
          {step === "firma" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Configura tu firma</h2>
                <p className="text-sm text-muted-foreground">Esta información aparecerá en documentos y comunicaciones</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Nombre de la firma</Label>
                  <Input value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Ej: López & Associates" className="mt-1" />
                </div>
                <div>
                  <Label>Nombre del abogado principal</Label>
                  <Input value={attorneyName} onChange={e => setAttorneyName(e.target.value)} placeholder="Ej: Ana María López" className="mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Teléfono de la firma</Label>
                    <Input value={firmPhone} onChange={e => setFirmPhone(e.target.value)} placeholder="(305) 555-0000" className="mt-1" />
                  </div>
                  <div>
                    <Label>Estado donde opera</Label>
                    <select
                      value={firmState}
                      onChange={e => setFirmState(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecciona...</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Logo de la firma (opcional)</Label>
                  <div className="mt-1 border-2 border-dashed border-border/30 rounded-xl p-4 text-center cursor-pointer hover:border-jarvis/30 transition-colors"
                    onClick={() => document.getElementById("logo-upload")?.click()}>
                    {logoFile ? (
                      <p className="text-sm text-foreground">{logoFile.name}</p>
                    ) : (
                      <div className="text-muted-foreground/50">
                        <Upload className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs">Arrastra o haz clic para subir</p>
                      </div>
                    )}
                    <input id="logo-upload" type="file" accept="image/*" className="hidden"
                      onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveFirmAndContinue} disabled={!firmName.trim() || saving}
                  className="bg-jarvis hover:bg-jarvis/90 text-black font-semibold px-6">
                  {saving ? "Guardando..." : "Continuar"} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP: CLIENTE */}
          {step === "cliente" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Tu primer cliente</h2>
                <p className="text-sm text-muted-foreground">Agrega un cliente real o usa datos de demostración para explorar</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setClientMode("real")}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    clientMode === "real" ? "border-jarvis bg-jarvis/5" : "border-border/20 hover:border-border/40"
                  }`}
                >
                  <UserPlus className={`w-8 h-8 mb-2 ${clientMode === "real" ? "text-jarvis" : "text-muted-foreground/40"}`} />
                  <p className="font-semibold text-sm text-foreground">Agregar un cliente real</p>
                  <p className="text-xs text-muted-foreground mt-1">Ingresa los datos de un cliente existente</p>
                </button>
                <button
                  onClick={() => setClientMode("demo")}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    clientMode === "demo" ? "border-jarvis bg-jarvis/5" : "border-border/20 hover:border-border/40"
                  }`}
                >
                  <Users className={`w-8 h-8 mb-2 ${clientMode === "demo" ? "text-jarvis" : "text-muted-foreground/40"}`} />
                  <p className="font-semibold text-sm text-foreground">Usar datos de demostración</p>
                  <p className="text-xs text-muted-foreground mt-1">3 clientes, 2 casos y 1 cita de ejemplo</p>
                </button>
              </div>

              {clientMode === "real" && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div>
                    <Label>Nombre completo</Label>
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej: Carlos Mendoza" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Correo electrónico</Label>
                      <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@email.com" className="mt-1" />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(305) 555-0000" className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Tipo de caso</Label>
                    <select
                      value={clientCaseType}
                      onChange={e => setClientCaseType(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecciona...</option>
                      {CASE_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => goTo("comunicacion")} className="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  Saltar por ahora
                </button>
                <Button onClick={handleClientStep} disabled={saving || (!clientMode)}
                  className="bg-jarvis hover:bg-jarvis/90 text-black font-semibold px-6">
                  {saving ? "Guardando..." : "Continuar"} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP: COMUNICACION */}
          {step === "comunicacion" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Conecta tu comunicación</h2>
                <p className="text-sm text-muted-foreground">Configura tus canales para atender clientes automáticamente</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border/20 hover:border-border/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">WhatsApp Business</p>
                      <p className="text-xs text-muted-foreground">Recibe consultas directo desde WhatsApp</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm"
                    onClick={() => { navigate("/hub/settings/office"); }}>
                    Configurar
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-border/20 hover:border-border/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">Correo electrónico</p>
                      <p className="text-xs text-muted-foreground">Envía notificaciones a clientes automáticamente</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm"
                    onClick={() => { navigate("/hub/settings/office"); }}>
                    Configurar
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => goTo("listo")} className="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  Lo hago después
                </button>
                <Button onClick={() => goTo("listo")}
                  className="bg-jarvis hover:bg-jarvis/90 text-black font-semibold px-6">
                  Continuar <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP: LISTO */}
          {step === "listo" && (
            <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Animated checkmark */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-jarvis/10 animate-ping" style={{ animationDuration: "2s" }} />
                <div className="relative w-20 h-20 rounded-full bg-jarvis/20 border-2 border-jarvis flex items-center justify-center">
                  <Check className="w-10 h-10 text-jarvis animate-in zoom-in duration-500" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-foreground mb-2">
                ¡Listo{attorneyName ? `, ${attorneyName.split(" ")[0]}` : ""}!
              </h2>
              <p className="text-muted-foreground mb-8">
                Tu oficina virtual está configurada y lista para trabajar.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto">
                <button
                  onClick={() => handleFinish("/hub")}
                  disabled={saving}
                  className="p-4 rounded-2xl border border-border/20 hover:border-jarvis/30 hover:bg-jarvis/5 transition-all group"
                >
                  <Building2 className="w-6 h-6 text-jarvis mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-foreground">Ver mi dashboard</p>
                </button>
                <button
                  onClick={() => handleFinish("/hub/cases")}
                  disabled={saving}
                  className="p-4 rounded-2xl border border-border/20 hover:border-jarvis/30 hover:bg-jarvis/5 transition-all group"
                >
                  <FolderOpen className="w-6 h-6 text-violet-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-foreground">Agregar caso</p>
                </button>
                <button
                  onClick={() => handleFinish("/hub/ai")}
                  disabled={saving}
                  className="p-4 rounded-2xl border border-border/20 hover:border-jarvis/30 hover:bg-jarvis/5 transition-all group"
                >
                  <Bot className="w-6 h-6 text-emerald-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-foreground">Hablar con Camila</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
