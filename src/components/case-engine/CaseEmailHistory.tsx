import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  welcome: "Bienvenida",
  questionnaire: "Cuestionario",
  document_checklist: "Lista de documentos",
  document_received: "Documento recibido",
  payment_confirmed: "Pago confirmado",
  case_update: "Actualización de caso",
  appointment_reminder: "Recordatorio de cita",
  case_approved: "Caso aprobado",
  firm_welcome: "Bienvenida de firma",
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  sent: { label: "Enviado ✓", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed: { label: "Fallido ✗", icon: XCircle, className: "bg-red-500/10 text-red-400 border-red-500/20" },
  pending: { label: "Pendiente ⏳", icon: Clock, className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
};

interface Props {
  caseId: string;
}

export default function CaseEmailHistory({ caseId }: Props) {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("email_logs")
        .select("*")
        .eq("case_id", caseId)
        .order("sent_at", { ascending: false });
      setEmails(data || []);
      setLoading(false);
    }
    load();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-8">
        <Mail className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No se han enviado emails para este caso</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Mail className="w-4 h-4 text-jarvis" />
        Emails enviados ({emails.length})
      </h3>
      {emails.map((email) => {
        const status = STATUS_CONFIG[email.status] || STATUS_CONFIG.pending;
        const StatusIcon = status.icon;
        return (
          <div key={email.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/50">
            <div className="mt-0.5">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  {TYPE_LABELS[email.template_type] || email.template_type}
                </span>
                <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                Para: {email.recipient_name || email.recipient_email}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {format(new Date(email.sent_at), "d MMM yyyy, HH:mm", { locale: es })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
