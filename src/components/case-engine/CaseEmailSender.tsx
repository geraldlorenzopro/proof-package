import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Send, FileText, Bell, PartyPopper, ChevronDown, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Props {
  caseId: string;
  accountId: string;
  clientEmail: string;
  clientName: string;
  caseType: string;
  fileNumber?: string;
  accessToken?: string;
}

const SEND_OPTIONS = [
  { template: "questionnaire", label: "Enviar cuestionario al cliente", icon: ClipboardList },
  { template: "welcome", label: "Enviar bienvenida", icon: Send },
  { template: "document_checklist", label: "Enviar lista de documentos", icon: FileText },
  { template: "case_update", label: "Enviar actualización de caso", icon: Mail },
  { template: "appointment_reminder", label: "Enviar recordatorio de cita", icon: Bell },
  { template: "case_approved", label: "Enviar aprobación de caso", icon: PartyPopper },
];

export default function CaseEmailSender({ caseId, accountId, clientEmail, clientName, caseType, fileNumber, accessToken }: Props) {
  const [sending, setSending] = useState<string | null>(null);

  async function handleSend(templateType: string) {
    setSending(templateType);
    try {
      const portalLink = accessToken
        ? `${window.location.origin}/case-track/${accessToken}`
        : "#";
      // Cuestionario apunta al upload portal — el cliente sube docs +
      // ve checklist + agrega info inicial. /upload/{access_token} es
      // gratuito y siempre existe (auto-gen en INSERT client_cases).
      const questionnaireLink = accessToken
        ? `${window.location.origin}/upload/${accessToken}`
        : portalLink;

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          template_type: templateType,
          to_email: clientEmail,
          to_name: clientName,
          account_id: accountId,
          case_id: caseId,
          variables: {
            client_name: clientName,
            file_number: fileNumber,
            case_type: caseType,
            portal_link: portalLink,
            questionnaire_link: questionnaireLink,
          },
        },
      });

      if (error) throw error;
      toast.success("Email enviado correctamente");
    } catch (err) {
      console.error("Send email error:", err);
      toast.error("Error al enviar email");
    } finally {
      setSending(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-accent/20">
          <Mail className="w-3.5 h-3.5" />
          Enviar email
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {SEND_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.template}
            onClick={() => handleSend(opt.template)}
            disabled={sending !== null}
            className="text-xs gap-2"
          >
            <opt.icon className="w-3.5 h-3.5" />
            {sending === opt.template ? "Enviando..." : opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
