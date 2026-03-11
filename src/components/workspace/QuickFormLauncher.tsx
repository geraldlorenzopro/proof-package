import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  FileText, Plus, ArrowRight, Loader2, Sparkles, Clock, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FormSubmission {
  id: string;
  form_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  clientId: string;
  clientName: string;
  existingForms: FormSubmission[];
  onFormCreated?: () => void;
}

const availableForms = [
  {
    type: "i-765",
    name: "I-765",
    description: "Solicitud de Autorización de Empleo",
    color: "from-jarvis/20 to-accent/10",
  },
];

export default function QuickFormLauncher({ clientId, clientName, existingForms, onFormCreated }: Props) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState<string | null>(null);

  async function handleCreateForm(formType: string) {
    setCreating(formType);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Debes iniciar sesión");
        setCreating(null);
        return;
      }

      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) {
        toast.error("No se pudo determinar la cuenta");
        setCreating(null);
        return;
      }

      // Fetch client profile data for pre-fill
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("id", clientId)
        .single();

      // Build pre-filled form_data from profile
      const formData: Record<string, any> = {};
      if (profile) {
        // Map client_profile fields to I-765 form fields
        if (profile.last_name) formData["familyName"] = profile.last_name;
        if (profile.first_name) formData["givenName"] = profile.first_name;
        if (profile.middle_name) formData["middleName"] = profile.middle_name;
        if (profile.dob) formData["dateOfBirth"] = profile.dob;
        if (profile.country_of_birth) formData["countryOfBirth"] = profile.country_of_birth;
        if (profile.city_of_birth) formData["cityOfBirth"] = profile.city_of_birth;
        if (profile.province_of_birth) formData["provinceOfBirth"] = profile.province_of_birth;
        if (profile.country_of_citizenship) formData["countryOfCitizenship"] = profile.country_of_citizenship;
        if (profile.gender) formData["gender"] = profile.gender;
        if (profile.marital_status) formData["maritalStatus"] = profile.marital_status;
        if (profile.ssn_last4) formData["ssnLast4"] = profile.ssn_last4;
        if (profile.a_number) formData["aNumber"] = profile.a_number;
        if (profile.i94_number) formData["i94Number"] = profile.i94_number;
        if (profile.passport_number) formData["passportNumber"] = profile.passport_number;
        if (profile.passport_country) formData["passportCountry"] = profile.passport_country;
        if (profile.passport_expiration) formData["passportExpiration"] = profile.passport_expiration;
        if (profile.class_of_admission) formData["classOfAdmission"] = profile.class_of_admission;
        if (profile.date_of_last_entry) formData["dateOfLastEntry"] = profile.date_of_last_entry;
        if (profile.place_of_last_entry) formData["placeOfLastEntry"] = profile.place_of_last_entry;
        if (profile.email) formData["email"] = profile.email;
        if (profile.phone) formData["daytimePhone"] = profile.phone;
        if (profile.mobile_phone) formData["mobilePhone"] = profile.mobile_phone;
        // Address
        if (profile.address_street) formData["streetAddress"] = profile.address_street;
        if (profile.address_apt) formData["aptSuite"] = profile.address_apt;
        if (profile.address_city) formData["city"] = profile.address_city;
        if (profile.address_state) formData["state"] = profile.address_state;
        if (profile.address_zip) formData["zipCode"] = profile.address_zip;
        // Mailing
        if (!profile.mailing_same_as_physical) {
          if (profile.mailing_street) formData["mailingStreet"] = profile.mailing_street;
          if (profile.mailing_city) formData["mailingCity"] = profile.mailing_city;
          if (profile.mailing_state) formData["mailingState"] = profile.mailing_state;
          if (profile.mailing_zip) formData["mailingZip"] = profile.mailing_zip;
        }
      }

      const { data: submission, error } = await supabase
        .from("form_submissions")
        .insert({
          account_id: accountId,
          user_id: user.id,
          form_type: formType,
          beneficiary_profile_id: clientId,
          client_name: clientName,
          client_email: profile?.email || null,
          form_data: formData,
          status: "draft",
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        toast.error("Error al crear formulario");
        setCreating(null);
        return;
      }

      toast.success("Formulario creado con datos pre-llenados");
      logAudit({
        action: "form.created",
        entity_type: "form",
        entity_id: submission.id,
        entity_label: `${formType.toUpperCase()} - ${clientName}`,
        metadata: { form_type: formType },
      });
      onFormCreated?.();
      navigate(`/dashboard/smart-forms/${submission.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado");
    } finally {
      setCreating(null);
    }
  }

  const statusConfig = {
    draft: { label: "Borrador", color: "bg-accent/10 text-accent border-accent/20", icon: Clock },
    completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  };

  return (
    <div className="space-y-4">
      {/* Existing forms */}
      {existingForms.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Formularios del cliente
          </p>
          <div className="space-y-2">
            {existingForms.map((form) => {
              const cfg = statusConfig[form.status as keyof typeof statusConfig] || statusConfig.draft;
              const StatusIcon = cfg.icon;
              return (
                <motion.button
                  key={form.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/dashboard/smart-forms/${form.id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-jarvis/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jarvis/20 to-accent/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-jarvis" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{form.form_type.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      Actualizado {format(new Date(form.updated_at), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <Badge className={`text-[10px] border ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {cfg.label}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create new form */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Crear nuevo formulario
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableForms.map((form) => (
            <motion.button
              key={form.type}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCreateForm(form.type)}
              disabled={creating !== null}
              className="relative flex flex-col items-center gap-3 rounded-xl border border-dashed border-jarvis/30 bg-jarvis/5 hover:bg-jarvis/10 p-6 transition-all group disabled:opacity-50"
            >
              {creating === form.type ? (
                <Loader2 className="w-8 h-8 text-jarvis animate-spin" />
              ) : (
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${form.color} flex items-center justify-center`}>
                  <Plus className="w-6 h-6 text-jarvis" />
                </div>
              )}
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{form.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{form.description}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-jarvis font-semibold">
                <Sparkles className="w-3 h-3" />
                Pre-llenado automático
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
