import { useState } from "react";
import { ChevronRight, Shield, ArrowLeft, type LucideIcon } from "lucide-react";
import { useBackDestination } from "@/hooks/useBackDestination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LangToggle } from "@/components/LangToggle";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type Lang = "es" | "en";

/** Color variant that maps to CSS custom properties */
export type ToolAccentVariant = "gold" | "cyan" | "navy" | "green" | "red";

export interface DisclaimerConfig {
  /** Title shown in the disclaimer modal */
  title: { es: string; en: string };
  /** Exclusive-use tagline */
  exclusive: { es: string; en: string };
  /** Rich description (can include JSX) */
  description: { es: React.ReactNode; en: React.ReactNode };
  /** Bullet points */
  bullets: { es: string[]; en: string[] };
  /** Footer acceptance text */
  acceptText: { es: string; en: string };
}

export interface ToolSplashProps {
  /** Tool slug — used for localStorage persistence */
  slug: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Large display title (the highlight word) */
  heroTitle: string;
  /** Secondary title below the hero */
  heroSubtitle: string;
  /** Small tagline under the subtitle */
  tagline?: { es: string; en: string };
  /** Color variant */
  accentVariant?: ToolAccentVariant;
  /** Disclaimer configuration — if omitted, no disclaimer is shown */
  disclaimer?: DisclaimerConfig;
  /** Called when the user proceeds past the splash */
  onContinue: () => void;
  /** Language */
  lang: Lang;
  /** Language setter */
  setLang: (l: Lang) => void;
  /** Platform name */
  platform?: string;
}

// ─── Accent variant mappings ────────────────────────────────────────────────

const ACCENT_STYLES: Record<ToolAccentVariant, {
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  glowText: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  btnClass: string;
  radialGlow: string;
  disclaimerBg: string;
  disclaimerBorder: string;
  bulletDot: string;
}> = {
  gold: {
    iconBg: "bg-accent/10",
    iconBorder: "border-accent/20",
    iconColor: "text-accent",
    glowText: "text-accent glow-text-gold",
    pillBg: "bg-accent/10",
    pillBorder: "border-accent/20",
    pillText: "text-accent",
    btnClass: "gradient-gold text-accent-foreground",
    radialGlow: "bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--accent)),_transparent_70%)]",
    disclaimerBg: "bg-accent/10",
    disclaimerBorder: "border-accent/20",
    bulletDot: "bg-accent",
  },
  cyan: {
    iconBg: "bg-jarvis/10",
    iconBorder: "border-jarvis/20",
    iconColor: "text-jarvis",
    glowText: "text-jarvis glow-text",
    pillBg: "bg-jarvis/10",
    pillBorder: "border-jarvis/20",
    pillText: "text-jarvis",
    btnClass: "bg-jarvis text-background hover:bg-jarvis/90",
    radialGlow: "bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)]",
    disclaimerBg: "bg-jarvis/10",
    disclaimerBorder: "border-jarvis/20",
    bulletDot: "bg-jarvis",
  },
  navy: {
    iconBg: "bg-primary/10",
    iconBorder: "border-primary/20",
    iconColor: "text-primary-foreground",
    glowText: "text-primary-foreground",
    pillBg: "bg-primary/10",
    pillBorder: "border-primary/20",
    pillText: "text-primary-foreground",
    btnClass: "bg-primary text-primary-foreground hover:bg-primary/90",
    radialGlow: "bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)),_transparent_70%)]",
    disclaimerBg: "bg-primary/10",
    disclaimerBorder: "border-primary/20",
    bulletDot: "bg-primary",
  },
  green: {
    iconBg: "bg-emerald-500/10",
    iconBorder: "border-emerald-500/20",
    iconColor: "text-emerald-400",
    glowText: "text-emerald-400",
    pillBg: "bg-emerald-500/10",
    pillBorder: "border-emerald-500/20",
    pillText: "text-emerald-400",
    btnClass: "bg-emerald-500 text-white hover:bg-emerald-600",
    radialGlow: "bg-[radial-gradient(ellipse_at_top_right,_hsl(158_64%_38%),_transparent_70%)]",
    disclaimerBg: "bg-emerald-500/10",
    disclaimerBorder: "border-emerald-500/20",
    bulletDot: "bg-emerald-400",
  },
  red: {
    iconBg: "bg-destructive/10",
    iconBorder: "border-destructive/20",
    iconColor: "text-destructive",
    glowText: "text-destructive",
    pillBg: "bg-destructive/10",
    pillBorder: "border-destructive/20",
    pillText: "text-destructive",
    btnClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    radialGlow: "bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--destructive)),_transparent_70%)]",
    disclaimerBg: "bg-destructive/10",
    disclaimerBorder: "border-destructive/20",
    bulletDot: "bg-destructive",
  },
};

const T_SPLASH = {
  es: {
    platform: "NER Immigration AI",
    tapToStart: "Toca para comenzar",
    continue: "Deseo Continuar",
  },
  en: {
    platform: "NER Immigration AI",
    tapToStart: "Tap to begin",
    continue: "I Wish to Continue",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ToolSplash({
  slug,
  icon: Icon,
  heroTitle,
  heroSubtitle,
  tagline,
  accentVariant = "gold",
  disclaimer,
  onContinue,
  lang,
  setLang,
  platform,
}: ToolSplashProps) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const t = T_SPLASH[lang];
  const s = ACCENT_STYLES[accentVariant];
  const { destination, isHub } = useBackDestination();

  const handleTap = () => {
    if (disclaimer) {
      setShowDisclaimer(true);
    } else {
      onContinue();
    }
  };

  const handleContinue = () => {
    setShowDisclaimer(false);
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background grid-bg">
      {/* Ambient glow */}
      <div className={cn("absolute top-0 right-0 w-72 h-72 opacity-10 pointer-events-none", s.radialGlow)} />

      {/* Top bar: back + lang */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {isHub ? (
          <a
            href={destination}
            className={cn("flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80", s.pillText)}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>🛡 Hub</span>
          </a>
        ) : (
          <div />
        )}
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
        onClick={handleTap}
      >
        {/* Icon */}
        <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center animate-float border", s.iconBg, s.iconBorder)}>
          <Icon className={cn("w-10 h-10", s.iconColor)} />
        </div>

        {/* Title */}
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">
            {platform || t.platform}
          </p>
          <h1 className="font-bold leading-tight">
            <span className={cn("text-5xl font-display", s.glowText)}>{heroTitle}</span>
            <br />
            <span className="text-3xl text-foreground">{heroSubtitle}</span>
          </h1>
          {tagline && (
            <p className="text-muted-foreground text-sm mt-3">{tagline[lang]}</p>
          )}
        </div>

        {/* CTA pill */}
        <div className={cn("flex items-center gap-2 rounded-full px-6 py-2.5 animate-glow-pulse border", s.pillBg, s.pillBorder)}>
          <Icon className={cn("w-4 h-4", s.pillText)} />
          <span className={cn("text-sm font-medium", s.pillText)}>{t.tapToStart}</span>
        </div>
      </div>

      {/* Disclaimer dialog */}
      {disclaimer && (
        <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
          <DialogContent className={cn("max-w-md bg-card", s.disclaimerBorder)}>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                  <Shield className={cn("w-5 h-5", s.iconColor)} />
                  {disclaimer.title[lang]}
                </DialogTitle>
                <LangToggle lang={lang} setLang={setLang} />
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <div className={cn("rounded-xl p-4 border", s.disclaimerBg, s.disclaimerBorder)}>
                <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">
                  {disclaimer.exclusive[lang]}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {disclaimer.description[lang]}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-foreground/80">
                {disclaimer.bullets[lang].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={cn("mt-1 w-1.5 h-1.5 rounded-full shrink-0", s.bulletDot)} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{disclaimer.acceptText[lang]}</p>
                <Button
                  onClick={handleContinue}
                  className={cn("font-semibold px-6 shrink-0", s.btnClass)}
                  size="sm"
                >
                  {t.continue}
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
