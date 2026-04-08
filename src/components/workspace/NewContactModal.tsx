import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, UserPlus, MessageCircle, Instagram, Facebook, Music2, Users, Megaphone, Globe, Phone, DoorOpen, Youtube, MoreHorizontal, Magnet } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  { key: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { key: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground bg-foreground/10 border-foreground/20" },
  { key: "referido", label: "Referido", icon: Users, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { key: "anuncio", label: "Ads", icon: Megaphone, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  { key: "website", label: "Website", icon: Globe, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  { key: "llamada", label: "Llamada", icon: Phone, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "walk-in", label: "Walk-in", icon: DoorOpen, color: "text-muted-foreground bg-muted/50 border-border" },
  { key: "youtube", label: "YouTube", icon: Youtube, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { key: "lead-magnet", label: "Lead Magnet", icon: Magnet, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  { key: "importado", label: "Importado", icon: Globe, color: "text-muted-foreground bg-muted/50 border-border" },
  { key: "otro", label: "Otro", icon: MoreHorizontal, color: "text-muted-foreground bg-muted/50 border-border" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onCreated?: () => void;
}

export default function NewContactModal({ open, onOpenChange, accountId, onCreated }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFirstName(""); setLastName(""); setPhone(""); setEmail("");
    setChannel(""); setSourceDetail(""); setNotes("");
  }

  const canSave = firstName.trim().length >= 2 && lastName.trim().length >= 2 && phone.trim().length >= 5;

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No auth");

      const { error } = await supabase.from("client_profiles").insert({
        account_id: accountId,
        created_by: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        source_channel: channel || null,
        source_detail: sourceDetail.trim() || null,
        notes: notes.trim() || null,
      } as any);

      if (error) throw error;

      toast.success(`${firstName} ${lastName} agregado al directorio`);
      reset();
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar el contacto");
    } finally {
      setSaving(false);
    }
  }

  const showDetail = channel === "referido" || channel === "lead-magnet" || channel === "anuncio" || channel === "otro";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-border overflow-hidden [&>button.absolute]:hidden">
        {/* Header */}
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-jarvis" />
            </div>
            <h2 className="text-base font-bold text-foreground">Nuevo contacto</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Agrega un contacto al directorio sin programar consulta. Ideal para leads de marketing, referidos fríos o importaciones.
          </p>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre"
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellido *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido"
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Teléfono *</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567"
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com"
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Channel — same card grid as IntakeWizard StepChannel */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Canal de origen</label>
            <div className="flex flex-wrap justify-center gap-2.5">
              {CHANNELS.map(ch => {
                const Icon = ch.icon;
                const selected = channel === ch.key;
                return (
                  <div key={ch.key} className="w-[calc(33.333%-0.5rem)]">
                    <button
                      onClick={() => setChannel(selected ? "" : ch.key)}
                      className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        selected
                          ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30"
                          : "border-border hover:border-foreground/20 bg-card"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ch.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-semibold ${selected ? "text-jarvis" : "text-foreground"}`}>
                        {ch.label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source detail */}
          {showDetail && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                {channel === "referido" ? "¿Quién lo refirió?" : channel === "lead-magnet" ? "¿Cuál lead magnet?" : channel === "anuncio" ? "¿Cuál campaña?" : "Detalle"}
              </label>
              <input type="text" value={sourceDetail} onChange={e => setSourceDetail(e.target.value)}
                placeholder="Detalle del origen..."
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Etiqueta / nota</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Campaña Mayo 2026, Lista FB..."
              className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex justify-end gap-3">
          <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors hover:bg-secondary">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className="flex items-center gap-1.5 text-sm font-semibold bg-jarvis text-jarvis-foreground px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Agregar contacto"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
