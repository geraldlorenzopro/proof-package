import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import HubLayout from "./HubLayout";
import { HUB_SECTIONS, HubSectionKey, HUB_SECTIONS_LIST } from "@/lib/hubSections";

interface Props {
  sectionKey: HubSectionKey;
}

export default function HubComingSoonPage({ sectionKey }: Props) {
  const navigate = useNavigate();
  const section = HUB_SECTIONS[sectionKey];
  const meta = section.comingSoon;

  const queuePosition = HUB_SECTIONS_LIST
    .filter(s => !s.enabled)
    .findIndex(s => s.key === sectionKey) + 1;

  const totalDisabled = HUB_SECTIONS_LIST.filter(s => !s.enabled).length;

  return (
    <HubLayout>
      <div className="h-full w-full overflow-y-auto bg-background">
        <div className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
          {/* Back link */}
          <button
            onClick={() => navigate("/hub")}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Inicio
          </button>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-accent/10 border border-cyan-accent/30 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-accent">
              Próximamente
            </span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[10px] text-muted-foreground/80">
              {queuePosition} de {totalDisabled} en cola
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold font-display text-foreground mb-3 leading-tight">
            {meta?.title ?? section.label}
          </h1>

          {/* Description */}
          {meta?.description && (
            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-2xl">
              {meta.description}
            </p>
          )}

          {/* Bullets */}
          {meta?.bullets && meta.bullets.length > 0 && (
            <div className="rounded-2xl border border-border/40 bg-card/40 p-6 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Qué va a tener
              </h3>
              <ul className="space-y-3">
                {meta.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-ai-blue/70 mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground/90 leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ETA */}
          {meta?.eta && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-deep-navy/30 border border-deep-navy/40 mb-8">
              <Clock className="w-4 h-4 text-cyan-accent/80 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                  Cuándo
                </div>
                <div className="text-sm text-foreground/90">{meta.eta}</div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/hub")}
              className="px-5 py-2.5 rounded-xl bg-ai-blue text-white text-sm font-semibold hover:bg-ai-blue/90 transition"
            >
              Volver al Inicio
            </button>
            <span className="text-xs text-muted-foreground/60">
              Mientras tanto, todo el trabajo del día está en el Inicio.
            </span>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
