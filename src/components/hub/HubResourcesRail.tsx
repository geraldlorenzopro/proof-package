/**
 * HubResourcesRail — Recursos oficiales horizontal centrado.
 *
 * v8.4 (2026-05-28): Mr. Lorenzo pidió desplegar TODOS los recursos
 * (primarios + secundarios) inline en la misma línea. Sin dropdown
 * "+4 más" — los 8 chips caben perfectamente.
 */
import { BookOpen, ExternalLink } from "lucide-react";

interface ResourceLink {
  label: string;
  source: string;
  url: string;
  desc?: string;
  chipClass?: string;
}

interface Props {
  primaryResources: ResourceLink[];
  secondaryResources: ResourceLink[];
  onOpenResource: (r: { label: string; url: string }) => void;
}

const NEUTRAL_CHIP = "bg-white/[0.04] border-white/15 text-slate-300 hover:bg-white/[0.08]";

export default function HubResourcesRail({ primaryResources, secondaryResources, onOpenResource }: Props) {
  // v8.4: TODOS los 8 chips en una sola línea horizontal centrada.
  const allResources = [...primaryResources, ...secondaryResources];

  return (
    <section className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-sm px-5 py-3 shrink-0">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <h4 className="text-[13px] font-bold flex items-center gap-2 text-foreground font-sora shrink-0">
          <BookOpen className="w-4 h-4 text-cyan-accent" />
          Recursos oficiales
        </h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {allResources.map(r => (
            <button
              key={r.label}
              type="button"
              onClick={() => onOpenResource({ label: r.label, url: r.url })}
              title={r.desc || r.label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition whitespace-nowrap ${r.chipClass || NEUTRAL_CHIP}`}
            >
              <span>{r.source}</span>
              <span className="opacity-70 normal-case font-normal">{r.label}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
