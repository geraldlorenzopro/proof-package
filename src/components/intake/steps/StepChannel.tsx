import type { IntakeData } from "../IntakeWizard";
import { MessageSquare, Instagram, Users, Globe, Phone, Footprints } from "lucide-react";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  { key: "referral", label: "Referido", icon: Users, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { key: "website", label: "Website", icon: Globe, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { key: "phone", label: "Llamada", icon: Phone, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "walk-in", label: "Walk-in", icon: Footprints, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CHANNELS.map(ch => {
          const Icon = ch.icon;
          const selected = data.entry_channel === ch.key;
          return (
            <button
              key={ch.key}
              onClick={() => update({ entry_channel: ch.key, referral_source: "" })}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                selected
                  ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30"
                  : `border-border hover:border-foreground/20 bg-card`
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ch.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-sm font-semibold ${selected ? "text-jarvis" : "text-foreground"}`}>
                {ch.label}
              </span>
            </button>
          );
        })}
      </div>

      {(data.entry_channel === "whatsapp" || data.entry_channel === "instagram") && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            {data.entry_channel === "whatsapp" ? "Número (opcional)" : "Usuario (opcional)"}
          </label>
          <input
            type="text"
            value={data.referral_source}
            onChange={e => update({ referral_source: e.target.value })}
            placeholder={data.entry_channel === "whatsapp" ? "+1 (555) 123-4567" : "@usuario"}
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {data.entry_channel === "referral" && (
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
    </div>
  );
}
