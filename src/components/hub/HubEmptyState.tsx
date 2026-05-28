/**
 * HubEmptyState — placeholder reusable para widgets del Hub Inicio.
 *
 * Reemplaza copys silentes tipo "Sin X" + literales "0" en widgets
 * (HubPipelineWidget, HubPulseRail, HubRiskWidget, HubMyActionsCard).
 * Cuando una firma nueva entra sin data, en vez de ver dashboards
 * con "0" decorativo, ve onboarding inline.
 *
 * Scoped a /components/hub/ (no en /components/ui/) porque el shape
 * está validado solo para widgets del Hub. Forms / Case Engine usan
 * empty states distintos.
 */
import type { LucideIcon } from "lucide-react";

type Tone = "cyan" | "emerald" | "muted" | "amber" | "rose";

interface Props {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  subtitle?: string;
  cta?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

const TONE_CLASSES: Record<Tone, { iconBg: string; iconColor: string; ctaBg: string; ctaText: string }> = {
  cyan: {
    iconBg: "bg-cyan-accent/10 border-cyan-accent/25",
    iconColor: "text-cyan-accent",
    ctaBg: "bg-cyan-accent/10 hover:bg-cyan-accent/20 border-cyan-accent/30",
    ctaText: "text-cyan-accent",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 border-emerald-500/25",
    iconColor: "text-emerald-300",
    ctaBg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
    ctaText: "text-emerald-300",
  },
  muted: {
    iconBg: "bg-white/[0.04] border-white/10",
    iconColor: "text-muted-foreground/60",
    ctaBg: "bg-white/[0.04] hover:bg-white/[0.08] border-white/10",
    ctaText: "text-muted-foreground",
  },
  amber: {
    iconBg: "bg-amber-500/10 border-amber-500/25",
    iconColor: "text-amber-300",
    ctaBg: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30",
    ctaText: "text-amber-300",
  },
  rose: {
    iconBg: "bg-rose-500/10 border-rose-500/25",
    iconColor: "text-rose-300",
    ctaBg: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30",
    ctaText: "text-rose-300",
  },
};

export default function HubEmptyState({
  icon: Icon,
  tone = "cyan",
  title,
  subtitle,
  cta,
  compact = false,
}: Props) {
  const c = TONE_CLASSES[tone];

  return (
    <div className={`flex-1 flex flex-col items-center justify-center text-center ${compact ? "py-3" : "py-6"}`}>
      <div className={`${compact ? "w-9 h-9" : "w-11 h-11"} rounded-full ${c.iconBg} border flex items-center justify-center mb-2`}>
        <Icon className={`${compact ? "w-4 h-4" : "w-5 h-5"} ${c.iconColor}`} />
      </div>
      <p className={`${compact ? "text-[11px]" : "text-[12px]"} font-semibold text-foreground/90 font-sora`}>
        {title}
      </p>
      {subtitle && (
        <p className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground/60 mt-1 max-w-[220px] leading-snug`}>
          {subtitle}
        </p>
      )}
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className={`mt-2.5 px-2.5 py-1 rounded-md border text-[10px] font-semibold transition-colors ${c.ctaBg} ${c.ctaText}`}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}
