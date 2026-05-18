/**
 * HubTeamWidget — "Equipo NER · Listo hoy"
 *
 * Widget compacto que se renderiza debajo de los 4 KPI cards del Hub Inicio.
 * Muestra los 4 agentes live (Camila, Felix, Nina, Max) como recordatorio
 * tangible de que el equipo IA está disponible para el paralegal.
 *
 * Spec: mockups/NER-HUB-INICIO-V6.html (paleta brandbook cyan/ai-blue 20% accent)
 */

import { useNavigate } from "react-router-dom";
import { Mic, FileText, Layers, CheckCircle2, Bot, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  slug: string;
  name: string;
  role: string;
  icon: typeof Mic;
  href: string;
  blurb: string;
  /** Avatar gradient classes */
  avatarGradient: string;
}

const AGENTS: Agent[] = [
  { slug: "camila", name: "Camila", role: "Voice AI",    icon: Mic,          href: "/hub/chat", blurb: "Briefing y dictado",        avatarGradient: "from-cyan-500 to-blue-500" },
  { slug: "felix",  name: "Felix",  role: "Forms USCIS", icon: FileText,     href: "/hub/ai",   blurb: "Llena formularios",         avatarGradient: "from-blue-500 to-cyan-500" },
  { slug: "nina",   name: "Nina",   role: "Packets",     icon: Layers,       href: "/hub/ai",   blurb: "Arma el paquete",           avatarGradient: "from-purple-500 to-pink-500" },
  { slug: "max",    name: "Max",    role: "QA",          icon: CheckCircle2, href: "/hub/ai",   blurb: "Revisa antes de enviar",    avatarGradient: "from-emerald-500 to-green-500" },
];

export default function HubTeamWidget() {
  const navigate = useNavigate();

  return (
    <section className="rounded-xl border border-cyan-accent/20 bg-gradient-to-r from-ai-blue/[0.04] to-cyan-accent/[0.04] backdrop-blur-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-cyan-accent/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-accent/10 border border-cyan-accent/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-cyan-accent" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold leading-tight font-sora">Equipo NER · Listo hoy</h3>
            <p className="text-[9px] text-muted-foreground/70 font-mono">4 agentes activos a tu disposición</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/hub/ai")}
          className="text-[10px] font-medium text-muted-foreground hover:text-cyan-accent transition-colors flex items-center gap-0.5 font-mono"
        >
          Ver equipo <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <button
              key={agent.slug}
              onClick={() => navigate(agent.href)}
              className={cn(
                "group relative flex items-center gap-2 p-2 rounded-lg border border-cyan-accent/15 bg-white/[0.03] hover:border-cyan-accent/40 hover:bg-cyan-accent/5 transition-all text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-accent/50"
              )}
              title={`Abrir ${agent.name}`}
            >
              <div className={cn(
                "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-md",
                agent.avatarGradient
              )}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold truncate font-sora">{agent.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" aria-label="Activo" />
                </div>
                <div className="text-[8px] uppercase tracking-wider text-cyan-accent font-mono leading-tight truncate">{agent.role}</div>
                <div className="text-[9px] text-muted-foreground/70 truncate leading-tight font-inter">{agent.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
