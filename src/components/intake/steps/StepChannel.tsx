import type { IntakeData } from "../IntakeWizard";
import { MessageCircle, Instagram, Facebook, Music2, Users, Megaphone, Globe, Phone, DoorOpen, Youtube, MoreHorizontal } from "lucide-react";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  { key: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { key: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground bg-foreground/10 border-foreground/20" },
  { key: "referido", label: "Referido", icon: Users, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { key: "anuncio", label: "Anuncio / Ads", icon: Megaphone, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  { key: "website", label: "Website", icon: Globe, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  { key: "llamada", label: "Llamada", icon: Phone, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "walk-in", label: "Walk-in", icon: DoorOpen, color: "text-muted-foreground bg-muted/50 border-border" },
  { key: "youtube", label: "YouTube", icon: Youtube, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { key: "otro", label: "Otro", icon: MoreHorizontal, color: "text-muted-foreground bg-muted/50 border-border" },
];

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

export default function StepChannel({ data, update }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Cómo llegó este cliente?</h3>
        <p className="text-sm text-muted-foreground">Selecciona el canal de entrada</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {CHANNELS.map(ch => {
          const Icon = ch.icon;
          const selected = data.entry_channel === ch.key;
          return (
            <div key={ch.key} className="w-[calc(33.333%-0.5rem)]">
              <button
                onClick={() => update({ entry_channel: ch.key, referral_source: "", entry_channel_detail: "" })}
                className={`w-full flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  selected
                    ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30"
                    : "border-border hover:border-foreground/20 bg-card"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ch.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-semibold ${selected ? "text-jarvis" : "text-foreground"}`}>
                  {ch.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {data.entry_channel === "referido" && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            ¿Quién lo refirió?
          </label>
          <input
            type="text"
            value={data.referral_source}
            onChange={e => update({ referral_source: e.target.value })}
            placeholder="Nombre del referido"
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {data.entry_channel === "otro" && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            ¿Cuál canal? (escribe aquí)
          </label>
          <input
            type="text"
            value={data.entry_channel_detail}
            onChange={e => update({ entry_channel_detail: e.target.value })}
            placeholder="Ej: evento, feria, radio..."
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}
