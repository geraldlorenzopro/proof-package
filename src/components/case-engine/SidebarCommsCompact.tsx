import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import CaseEmailSender from "./CaseEmailSender";

const TYPE_LABELS: Record<string, string> = {
  welcome: "Bienvenida", questionnaire: "Cuestionario", document_checklist: "Lista de documentos",
  document_received: "Documento recibido", payment_confirmed: "Pago confirmado",
  case_update: "Actualización", appointment_reminder: "Recordatorio",
  case_approved: "Caso aprobado", firm_welcome: "Bienvenida firma",
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  sent: { label: "Enviado", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed: { label: "Fallido", icon: XCircle, className: "bg-red-500/10 text-red-400 border-red-500/20" },
  pending: { label: "Pendiente", icon: Clock, className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
};

interface Props {
  caseId: string;
  accountId: string;
  clientEmail: string;
  clientName: string;
  caseType: string;
  fileNumber: string;
  accessToken: string;
}

export default function SidebarCommsCompact({ caseId, accountId, clientEmail, clientName, caseType, fileNumber, accessToken }: Props) {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("email_logs").select("*").eq("case_id", caseId).order("sent_at", { ascending: false }).limit(3)
      .then(({ data }) => { setEmails(data || []); setLoading(false); });
  }, [caseId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-jarvis" />
          <span className="text-xs font-bold text-foreground">Comunicaciones</span>
          {emails.length > 0 && <Badge variant="outline" className="text-[9px]">{emails.length}</Badge>}
        </div>
        <CaseEmailSender
          caseId={caseId} accountId={accountId} clientEmail={clientEmail}
          clientName={clientName} caseType={caseType} fileNumber={fileNumber} accessToken={accessToken}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : emails.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-3">Sin emails enviados</p>
      ) : (
        <div className="space-y-1.5">
          {emails.map(email => {
            const st = STATUS_CONFIG[email.status] || STATUS_CONFIG.pending;
            const StIcon = st.icon;
            return (
              <div key={email.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/50">
                <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-foreground truncate">
                    {TYPE_LABELS[email.template_type] || email.template_type}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {format(new Date(email.sent_at), "d MMM, HH:mm", { locale: es })}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[8px] shrink-0 ${st.className}`}>
                  <StIcon className="w-2.5 h-2.5 mr-0.5" />{st.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
