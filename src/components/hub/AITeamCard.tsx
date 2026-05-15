/**
 * AITeamCard — Card prominente del equipo IA en Hub Inicio (Ola 5.a).
 *
 * Implementa el wireframe del plano: muestra TODOS los agentes IA del
 * roadmap NER (live + planned) con avatar, rol, status badge y stats
 * básicos. Click en agent abre Equipo AI / panel específico.
 *
 * Agents según CLAUDE.md + INFORMATION-ARCHITECTURE.md:
 *   ✅ Live: Camila (voice), Felix (forms), Nina (packets), Max (QA)
 *   🟡 Planned (roadmap): Pablo (legal writer), Lucía (evidence),
 *      Sofía (interview sim), Rosa (comms), Carmen (scheduler), Leo (knowledge)
 *
 * Tracking:
 *   - `hub.ai_team_clicked` cuando se hace click en un agent card
 */

import { useNavigate } from "react-router-dom";
import { Sparkles, Mic, FileText, Layers, CheckCircle2, MessageSquare, BookOpen, Plane, Calendar, Bot, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface AgentDef {
  slug: string;
  name: string;
  role: string;
  icon: typeof Sparkles;
  status: "live" | "planned";
  /** Click destination (sólo para live). Planned muestran tooltip */
  href?: string;
  /** Color del icono (HSL ref Tailwind class) */
  accentClass?: string;
}

// Single source of truth del roadmap de AI Team.
// Cuando se agreguen agents nuevos (Pablo, Lucía, etc.) → solo agregar entry.
const AGENTS: AgentDef[] = [
  {
    slug: "camila",
    name: "Camila",
    role: "Voice AI Master",
    icon: Mic,
    status: "live",
    href: "/hub/chat",
    accentClass: "text-primary bg-primary/10 border-primary/20",
  },
  {
    slug: "felix",
    name: "Felix",
    role: "Forms USCIS",
    icon: FileText,
    status: "live",
    href: "/hub/ai",
    accentClass: "text-primary bg-primary/10 border-primary/20",
  },
  {
    slug: "nina",
    name: "Nina",
    role: "Packet Assembly",
    icon: Layers,
    status: "live",
    href: "/hub/ai",
    accentClass: "text-primary bg-primary/10 border-primary/20",
  },
  {
    slug: "max",
    name: "Max",
    role: "QA Packet",
    icon: CheckCircle2,
    status: "live",
    href: "/hub/ai",
    accentClass: "text-primary bg-primary/10 border-primary/20",
  },
  {
    slug: "pablo",
    name: "Pablo",
    role: "Legal Writer",
    icon: MessageSquare,
    status: "planned",
    accentClass: "text-muted-foreground bg-muted/40 border-border/40",
  },
  {
    slug: "lucia",
    name: "Lucía",
    role: "Evidence Specialist",
    icon: BookOpen,
    status: "planned",
    accentClass: "text-muted-foreground bg-muted/40 border-border/40",
  },
  {
    slug: "sofia",
    name: "Sofía",
    role: "Interview Sim",
    icon: Sparkles,
    status: "planned",
    accentClass: "text-muted-foreground bg-muted/40 border-border/40",
  },
  {
    slug: "rosa",
    name: "Rosa",
    role: "Affidavits",
    icon: Plane,
    status: "planned",
    accentClass: "text-muted-foreground bg-muted/40 border-border/40",
  },
  {
    slug: "carmen",
    name: "Carmen",
    role: "Scheduler",
    icon: Calendar,
    status: "planned",
    accentClass: "text-muted-foreground bg-muted/40 border-border/40",
  },
  {
    slug: "leo",
    name: "Leo",
    role: "Knowledge Base",
    icon: BookOpen,
    status: "planned",
    accentClass: "text-muted-foreground bg-muted/40 border-border/40",
  },
];

interface Props {
  /** Modo compacto: solo live agents, sin planned */
  compact?: boolean;
}

export default function AITeamCard({ compact = false }: Props) {
  const navigate = useNavigate();

  const liveAgents = AGENTS.filter((a) => a.status === "live");
  const plannedAgents = AGENTS.filter((a) => a.status === "planned");
  const visibleAgents = compact ? liveAgents : AGENTS;

  function handleAgentClick(agent: AgentDef) {
    void trackEvent("hub.ai_team_clicked", {
      properties: {
        agent: agent.slug,
        status: agent.status,
        source: "hub_inicio",
      },
    });
    if (agent.href) {
      navigate(agent.href);
    }
  }

  return (
    <section className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Tu equipo IA está listo</h3>
            <p className="text-[10px] text-muted-foreground">
              {liveAgents.length} activos · {plannedAgents.length} en roadmap
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/hub/ai")}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Ver todos <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Grid de agents */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {visibleAgents.map((agent) => {
          const Icon = agent.icon;
          const isLive = agent.status === "live";
          return (
            <button
              key={agent.slug}
              onClick={() => handleAgentClick(agent)}
              disabled={!isLive}
              className={cn(
                "group relative flex flex-col items-center text-center gap-1.5 p-2.5 rounded-lg border transition-all",
                isLive
                  ? "border-border/30 bg-background/40 hover:border-primary/40 hover:bg-primary/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  : "border-border/20 bg-muted/10 cursor-default opacity-60"
              )}
              title={isLive ? `Abrir ${agent.name}` : `${agent.name} — próximamente en roadmap`}
            >
              {/* Avatar circular con icono */}
              <div
                className={cn(
                  "w-9 h-9 rounded-full border flex items-center justify-center transition-transform",
                  agent.accentClass,
                  isLive && "group-hover:scale-110"
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>

              {/* Name + role */}
              <div className="flex flex-col items-center min-w-0 w-full">
                <span className="text-xs font-semibold truncate w-full">{agent.name}</span>
                <span className="text-[10px] text-muted-foreground truncate w-full leading-tight">
                  {agent.role}
                </span>
              </div>

              {/* Status badge */}
              {isLive ? (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" aria-label="Active" />
              ) : (
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
                  Roadmap
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
