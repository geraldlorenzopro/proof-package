/**
 * HubResourcesRail — Recursos oficiales en el right rail.
 *
 * Separado del HubPulseRail original para que el rail (Hub v8.2) pueda
 * tener structure: Acción rápida + Recursos + Actividad (último flex-1).
 */
import { BookOpen, ExternalLink } from "lucide-react";

interface ResourceLink {
  label: string;
  source: string;
  url: string;
  desc?: string;
  chipClass: string;
}

interface Props {
  primaryResources: ResourceLink[];
  secondaryResources: ResourceLink[];
  onOpenResource: (r: { label: string; url: string }) => void;
}

export default function HubResourcesRail({ primaryResources, secondaryResources, onOpenResource }: Props) {
  return (
    <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3 shrink-0">
      <h4 className="text-[11px] font-bold flex items-center gap-1.5 text-foreground font-sora mb-2.5">
        <BookOpen className="w-3.5 h-3.5 text-cyan-accent" />
        Recursos oficiales
      </h4>
      <div className="grid grid-cols-2 gap-1.5">
        {primaryResources.map(r => (
          <button
            key={r.label}
            type="button"
            onClick={() => onOpenResource({ label: r.label, url: r.url })}
            title={r.desc}
            className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] font-semibold border transition ${r.chipClass}`}
          >
            <span>{r.source}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}
      </div>

      {secondaryResources.length > 0 && (
        <details className="mt-2 group">
          <summary className="text-[9px] uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-foreground transition list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▸</span>
            <span>+{secondaryResources.length} más</span>
          </summary>
          <div className="mt-1.5 space-y-1">
            {secondaryResources.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => onOpenResource({ label: r.label, url: r.url })}
                className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.04] transition"
              >
                <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border border-border/40 text-muted-foreground/70 shrink-0">{r.source}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-[10px] font-medium text-foreground/80 truncate block">{r.label}</span>
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
