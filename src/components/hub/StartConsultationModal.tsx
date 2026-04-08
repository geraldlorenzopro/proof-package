import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Phone, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Appointment {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_profile_id: string | null;
  appointment_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  accountId: string;
  onCreated?: (consultationId: string) => void;
}

export default function StartConsultationModal({ open, onOpenChange, appointment, accountId, onCreated }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    if (!appointment) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: consultation, error } = await supabase
        .from("consultations")
        .insert({
          account_id: accountId,
          created_by: user.id,
          client_profile_id: appointment.client_profile_id || null,
          status: "in_progress",
          raw_notes: notes.trim() || null,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      // Link consultation to appointment
      await supabase
        .from("appointments")
        .update({ consultation_id: consultation.id } as any)
        .eq("id", appointment.id);

      toast.success("Consulta iniciada");
      onOpenChange(false);
      setNotes("");
      onCreated?.(consultation.id);
    } catch (e: any) {
      toast.error(e.message || "Error al iniciar consulta");
    } finally {
      setSaving(false);
    }
  }

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Consulta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Client info summary */}
          <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{appointment.client_name}</span>
            </div>
            {appointment.client_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{appointment.client_phone}</span>
              </div>
            )}
            {appointment.client_email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{appointment.client_email}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground">Notas de la consulta</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Registra los puntos clave de la consulta..."
              className="mt-1 min-h-[120px]"
            />
          </div>

          <Button onClick={handleStart} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Iniciar Consulta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
