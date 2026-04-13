import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  preIntakeToken: string;
  accountId: string;
  onSent?: () => void;
}

export default function ResendModal({ open, onOpenChange, appointmentId, clientName, clientPhone, clientEmail, preIntakeToken, accountId, onSent }: Props) {
  const [sending, setSending] = useState<"whatsapp" | "email" | null>(null);

  const preIntakeUrl = `${window.location.origin}/intake/${preIntakeToken}`;
  const firstName = clientName.split(" ")[0];

  async function sendWhatsApp() {
    const phone = (clientPhone || "").replace(/\D/g, "");
    if (!phone) { toast.error("No hay teléfono registrado"); return; }
    setSending("whatsapp");

    const msg = `Hola ${firstName}, soy del equipo de Mr Visa Immigration.\n\nPara continuar con tu proceso, necesitamos que completes este breve formulario:\n\n${preIntakeUrl}\n\nCualquier pregunta, responde aquí. 🙏`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");

    await supabase.from("appointments").update({ pre_intake_sent: true, pre_intake_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() } as any).eq("id", appointmentId);
    toast.success("Formulario reenviado por WhatsApp");
    setSending(null);
    onOpenChange(false);
    onSent?.();
  }

  async function sendEmail() {
    if (!clientEmail) { toast.error("No hay email registrado"); return; }
    setSending("email");
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          template_type: "questionnaire",
          to_email: clientEmail,
          to_name: clientName,
          account_id: accountId,
          variables: {
            client_name: clientName,
            questionnaire_link: preIntakeUrl,
          },
        },
      });
      await supabase.from("appointments").update({ pre_intake_sent: true, pre_intake_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() } as any).eq("id", appointmentId);
      toast.success("Formulario reenviado por Email");
      onOpenChange(false);
      onSent?.();
    } catch {
      toast.error("Error al enviar email");
    } finally {
      setSending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <p className="text-sm font-semibold text-foreground text-center mb-1">Reenviar formulario a</p>
        <p className="text-xs text-muted-foreground text-center mb-4">{clientName}</p>
        <div className="flex flex-col gap-2">
          {clientPhone && (
            <Button
              onClick={sendWhatsApp}
              disabled={!!sending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {sending === "whatsapp" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              WhatsApp
            </Button>
          )}
          {clientEmail && (
            <Button
              onClick={sendEmail}
              disabled={!!sending}
              variant="outline"
              className="w-full"
            >
              {sending === "email" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Email
            </Button>
          )}
          {!clientPhone && !clientEmail && (
            <p className="text-xs text-muted-foreground text-center py-2">No hay teléfono ni email registrado</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
