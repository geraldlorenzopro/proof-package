import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { X, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import StepChannel from "./steps/StepChannel";
import StepClient from "./steps/StepClient";
import StepSituation from "./steps/StepSituation";
import StepGoal from "./steps/StepGoal";
import StepAiDetection from "./steps/StepAiDetection";
import StepCreate from "./steps/StepCreate";

export interface IntakeData {
  // Step 1
  entry_channel: string;
  referral_source: string;
  // Step 2
  client_profile_id: string | null;
  is_existing_client: boolean;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
  client_language: string;
  // Step 3
  current_status: string;
  entry_date: string;
  entry_method: string;
  has_prior_deportation: boolean;
  has_criminal_record: boolean;
  current_documents: string[];
  // Step 4
  client_goal: string;
  client_goal_text: string;
  urgency_level: string;
  has_pending_deadline: boolean;
  deadline_date: string;
  // Step 5
  ai_suggested_case_type: string;
  ai_confidence_score: number;
  ai_reasoning: string;
  ai_flags: string[];
  ai_secondary_type: string;
  final_case_type: string;
  // Step 6
  notes: string;
}

const INITIAL_DATA: IntakeData = {
  entry_channel: "",
  referral_source: "",
  client_profile_id: null,
  is_existing_client: false,
  client_first_name: "",
  client_last_name: "",
  client_phone: "",
  client_email: "",
  client_language: "es",
  current_status: "",
  entry_date: "",
  entry_method: "",
  has_prior_deportation: false,
  has_criminal_record: false,
  current_documents: [],
  client_goal: "",
  client_goal_text: "",
  urgency_level: "normal",
  has_pending_deadline: false,
  deadline_date: "",
  ai_suggested_case_type: "",
  ai_confidence_score: 0,
  ai_reasoning: "",
  ai_flags: [],
  ai_secondary_type: "",
  final_case_type: "",
  notes: "",
};

const STEPS = [
  { label: "Canal", key: "channel" },
  { label: "Cliente", key: "client" },
  { label: "Situación", key: "situation" },
  { label: "Objetivo", key: "goal" },
  { label: "Detección AI", key: "ai" },
  { label: "Expediente", key: "create" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (caseData: any) => void;
}

export default function IntakeWizard({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeData>({ ...INITIAL_DATA });
  const [accountId, setAccountId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setStep(0);
      setData({ ...INITIAL_DATA });
      setCreated(null);
      loadAccountId();
    }
  }, [open]);

  async function loadAccountId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: aid } = await supabase.rpc("user_account_id", { _user_id: user.id });
    if (aid) setAccountId(aid);
  }

  function update(partial: Partial<IntakeData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  function canNext(): boolean {
    switch (step) {
      case 0: return !!data.entry_channel;
      case 1: return data.client_first_name.length >= 2 && data.client_last_name.length >= 2 && data.client_phone.length >= 5;
      case 2: return true;
      case 3: return !!(data.client_goal || data.client_goal_text);
      case 4: return !!data.final_case_type;
      case 5: return true;
      default: return false;
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Create or link client profile
      let profileId = data.client_profile_id;
      if (!profileId) {
        const { data: profile, error: profErr } = await supabase
          .from("client_profiles")
          .insert({
            account_id: accountId,
            created_by: user.id,
            first_name: data.client_first_name,
            last_name: data.client_last_name,
            phone: data.client_phone,
            email: data.client_email || null,
          })
          .select("id")
          .single();
        if (profErr) throw profErr;
        profileId = profile.id;
      }

      // 2. Create the case
      const { data: newCase, error: caseErr } = await supabase
        .from("client_cases")
        .insert({
          professional_id: user.id,
          account_id: accountId,
          assigned_to: user.id,
          client_name: `${data.client_first_name} ${data.client_last_name}`.trim(),
          client_email: data.client_email || `${data.client_phone}@intake.ner`,
          case_type: data.final_case_type,
          client_profile_id: profileId,
          status: "pending",
          notes: data.notes || null,
        })
        .select()
        .single();
      if (caseErr) throw caseErr;

      // 3. Save intake session
      await supabase.from("intake_sessions").insert({
        account_id: accountId,
        created_by: user.id,
        entry_channel: data.entry_channel,
        referral_source: data.referral_source || null,
        client_profile_id: profileId,
        is_existing_client: data.is_existing_client,
        client_first_name: data.client_first_name,
        client_last_name: data.client_last_name,
        client_phone: data.client_phone,
        client_email: data.client_email || null,
        client_language: data.client_language,
        current_status: data.current_status || null,
        entry_date: data.entry_date || null,
        entry_method: data.entry_method || null,
        has_prior_deportation: data.has_prior_deportation,
        has_criminal_record: data.has_criminal_record,
        current_documents: data.current_documents,
        client_goal: data.client_goal || data.client_goal_text || null,
        urgency_level: data.urgency_level,
        has_pending_deadline: data.has_pending_deadline,
        deadline_date: data.deadline_date || null,
        ai_suggested_case_type: data.ai_suggested_case_type || null,
        ai_confidence_score: data.ai_confidence_score || null,
        ai_reasoning: data.ai_reasoning || null,
        ai_flags: data.ai_flags,
        status: "converted",
        final_case_type: data.final_case_type,
        case_id: newCase.id,
        notes: data.notes || null,
      });

      setCreated(newCase);
    } catch (err) {
      console.error("Intake create error:", err);
    } finally {
      setCreating(false);
    }
  }

  function handleDone(action: "view" | "new" | "close") {
    if (action === "view" && created) {
      onOpenChange(false);
      navigate(`/case-engine/${created.id}`);
    } else if (action === "new") {
      setStep(0);
      setData({ ...INITIAL_DATA });
      setCreated(null);
    } else {
      onOpenChange(false);
      if (created) onCreated?.(created);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-border overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header + Progress */}
        <div className="border-b border-border p-4 sm:p-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">
              {created ? "✅ Expediente creado" : "Nuevo Intake"}
            </h2>
            <button onClick={() => onOpenChange(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!created && (
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center flex-1">
                  <div className={`flex-1 h-1.5 rounded-full transition-all ${
                    i <= step ? "bg-jarvis" : "bg-border"
                  }`} />
                </div>
              ))}
            </div>
          )}
          {!created && (
            <div className="flex justify-between mt-1.5">
              {STEPS.map((s, i) => (
                <span key={s.key} className={`text-[9px] font-medium tracking-wide uppercase ${
                  i === step ? "text-jarvis" : i < step ? "text-muted-foreground" : "text-muted-foreground/40"
                }`}>
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {created ? (
            <StepCreate
              data={data}
              created={created}
              creating={creating}
              onDone={handleDone}
              onCreate={handleCreate}
              accountId={accountId}
            />
          ) : (
            <>
              {step === 0 && <StepChannel data={data} update={update} />}
              {step === 1 && <StepClient data={data} update={update} accountId={accountId} />}
              {step === 2 && <StepSituation data={data} update={update} />}
              {step === 3 && <StepGoal data={data} update={update} accountId={accountId} />}
              {step === 4 && <StepAiDetection data={data} update={update} accountId={accountId} />}
              {step === 5 && (
                <StepCreate
                  data={data}
                  created={null}
                  creating={creating}
                  onDone={handleDone}
                  onCreate={handleCreate}
                  accountId={accountId}
                />
              )}
            </>
          )}
        </div>

        {/* Footer — navigation */}
        {!created && (
          <div className="border-t border-border p-4 sm:p-5 flex items-center justify-between shrink-0">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Anterior
            </button>

            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="flex items-center gap-1.5 text-sm font-semibold bg-jarvis text-jarvis-foreground px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all"
              >
                Siguiente
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {creating ? "Creando..." : "Crear Expediente"}
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
