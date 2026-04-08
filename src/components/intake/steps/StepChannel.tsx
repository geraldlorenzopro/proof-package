import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { IntakeData } from "../IntakeWizard";
import { CHANNEL_LOGOS } from "../ChannelLogo";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "referido", label: "Referido" },
  { key: "anuncio", label: "Anuncio / Ads" },
  { key: "website", label: "Website" },
  { key: "llamada", label: "Llamada" },
  { key: "walk-in", label: "Walk-in" },
  { key: "youtube", label: "YouTube" },
  { key: "otro", label: "Otro" },
];

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

export default function StepChannel({ data, update }: Props) {
  const referidoRef = useRef<HTMLInputElement>(null);
  const otroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.entry_channel === "referido") setTimeout(() => referidoRef.current?.focus(), 100);
    if (data.entry_channel === "otro") setTimeout(() => otroRef.current?.focus(), 100);
  }, [data.entry_channel]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Cómo llegó este cliente?</h3>
        <p className="text-sm text-muted-foreground">Selecciona el canal de entrada</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {CHANNELS.map(ch => {
          const selected = data.entry_channel === ch.key;
          const logo = CHANNEL_LOGOS[ch.key] || CHANNEL_LOGOS.otro;
          return (
            <div key={ch.key} className="w-[calc(33.333%-0.5rem)]">
              <button
                onClick={() => update({ entry_channel: ch.key, referral_source: "", entry_channel_detail: "" })}
                className={`w-full flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 relative ${
                  selected
                    ? "border-accent bg-accent/10 ring-1 ring-accent/30 shadow-sm shadow-accent/10"
                    : "border-border hover:border-foreground/20 bg-card"
                }`}
              >
                {selected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-accent-foreground" />
                  </div>
                )}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${logo.color}15` }}
                >
                  <span
                    style={{ width: 22, height: 22, display: "inline-flex" }}
                    dangerouslySetInnerHTML={{ __html: logo.svg }}
                  />
                </div>
                <span className={`text-sm font-semibold transition-colors ${selected ? "text-accent" : "text-foreground"}`}>
                  {ch.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {data.entry_channel === "referido" && (
        <div className="animate-fade-in">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            ¿Quién lo refirió?
          </label>
          <input
            ref={referidoRef}
            type="text"
            value={data.referral_source}
            onChange={e => update({ referral_source: e.target.value })}
            placeholder="Nombre de quien refirió..."
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {data.entry_channel === "otro" && (
        <div className="animate-fade-in">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            ¿Por qué canal llegó?
          </label>
          <input
            ref={otroRef}
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
