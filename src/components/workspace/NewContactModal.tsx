import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

const CHANNELS = [
  { key: "whatsapp", label: "💬 WhatsApp" },
  { key: "instagram", label: "📸 Instagram" },
  { key: "facebook", label: "👍 Facebook" },
  { key: "tiktok", label: "🎵 TikTok" },
  { key: "referido", label: "🤝 Referido" },
  { key: "anuncio", label: "📢 Ads" },
  { key: "website", label: "🌐 Website" },
  { key: "llamada", label: "📞 Llamada" },
  { key: "walk-in", label: "🚶 Walk-in" },
  { key: "youtube", label: "▶️ YouTube" },
  { key: "lead-magnet", label: "🧲 Lead Magnet" },
  { key: "importado", label: "📥 Importado" },
  { key: "otro", label: "••• Otro" },
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md p-0 gap-0 bg-card border-border overflow-hidden [&>button.absolute]:hidden">
        {/* Header */}
        <div className="border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-jarvis" />
            <h2 className="text-base font-bold text-foreground">Nuevo contacto</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">Agrega un contacto al directorio sin programar consulta. Ideal para leads de marketing, referidos fríos o importaciones.</p>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nombre *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre"
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Apellido *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido"
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Teléfono *</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567"
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com"
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Channel */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Canal de origen</label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(c => {
                const selected = channel === c.key;
                return (
                  <button key={c.key} onClick={() => setChannel(selected ? "" : c.key)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${selected ? "border-jarvis bg-jarvis/10 text-jarvis font-semibold" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source detail */}
          {(channel === "referido" || channel === "lead-magnet" || channel === "anuncio" || channel === "otro") && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {channel === "referido" ? "¿Quién lo refirió?" : channel === "lead-magnet" ? "¿Cuál lead magnet?" : channel === "anuncio" ? "¿Cuál campaña?" : "Detalle"}
              </label>
              <input type="text" value={sourceDetail} onChange={e => setSourceDetail(e.target.value)}
                placeholder="Detalle del origen..."
                className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Etiqueta / nota</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Campaña Mayo 2026, Lista FB..."
              className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex justify-end gap-3">
          <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className="flex items-center gap-1.5 text-sm font-semibold bg-jarvis text-jarvis-foreground px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Agregar contacto"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
