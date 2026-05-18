import { useNavigate } from "react-router-dom";
import { Mic, FileText, Package, CheckCircle2, Users, ChevronRight } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  credits: string;
  Icon: typeof Mic;
  gradient: string;
  shadow: string;
  href: string;
}

const AGENTS: Agent[] = [
  {
    id: "camila",
    name: "Camila",
    role: "Voice AI",
    description: "Graba consultas, transcribe y resume. Asigna tareas automáticamente.",
    credits: "450 cred · voice",
    Icon: Mic,
    gradient: "from-cyan-500 to-blue-500",
    shadow: "shadow-cyan-500/15",
    href: "/hub/chat",
  },
  {
    id: "felix",
    name: "Felix",
    role: "Forms Filler",
    description: "Llena formularios USCIS leyendo el expediente. I-130 + I-765 listos.",
    credits: "5 cred / uso",
    Icon: FileText,
    gradient: "from-blue-500 to-cyan-500",
    shadow: "shadow-blue-500/15",
    href: "/hub/forms",
  },
  {
    id: "nina",
    name: "Nina",
    role: "Packet Builder",
    description: "Ensambla el packet completo: cover letter, exhibits, orden correcto.",
    credits: "10 cred / uso",
    Icon: Package,
    gradient: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/15",
    href: "/hub/ai",
  },
  {
    id: "max",
    name: "Max",
    role: "Quality Assurance",
    description: "Revisa el packet antes de envío. Detecta errores y valida documentos.",
    credits: "10 cred / uso",
    Icon: CheckCircle2,
    gradient: "from-emerald-500 to-green-500",
    shadow: "shadow-emerald-500/15",
    href: "/hub/ai",
  },
];

interface Props {
  accountId: string;
}

export default function HubTeamWidget({ accountId: _accountId }: Props) {
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl px-6 py-5 border border-jarvis/20 bg-gradient-to-br from-jarvis/[0.04] to-jarvis/[0.02] backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-jarvis/80 font-mono font-semibold mb-1">
            Equipo NER · Listo hoy
          </p>
          <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
            <Users className="w-4 h-4 text-jarvis" />
            Tu equipo está disponible
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-400">
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
            style={{ animationDuration: "2.4s" }}
          />
          <span className="font-semibold">4 agentes en línea</span>
        </div>
      </div>

      {/* 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {AGENTS.map(agent => {
          const { Icon } = agent;
          return (
            <button
              key={agent.id}
              onClick={() => navigate(agent.href)}
              className="text-left bg-white/[0.03] border border-jarvis/15 hover:border-jarvis/40 hover:bg-jarvis/5 rounded-xl p-3 transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${agent.gradient} flex items-center justify-center shadow-md ${agent.shadow}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5" />
              </div>
              <div className="font-bold text-sm text-foreground">{agent.name}</div>
              <div className="text-[10px] text-jarvis uppercase tracking-wider font-mono font-semibold mt-0.5">
                {agent.role}
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-1.5 leading-snug">
                {agent.description}
              </p>
              <div className="mt-2.5 pt-2 border-t border-border/30 flex items-center justify-between">
                <span className="text-[9px] font-mono text-amber-300/70">{agent.credits}</span>
                <span className="text-[10px] text-jarvis opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer minimalista: aclaración + link gestión */}
      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-muted-foreground/80">
          Pídele cualquier cosa a Camila desde el campo de arriba — ella deriva a Felix, Nina o Max según convenga.
        </p>
        <button
          onClick={() => navigate("/hub/ai")}
          className="text-[11px] font-semibold text-jarvis/80 hover:text-jarvis transition-colors flex items-center gap-1 shrink-0"
        >
          Gestionar equipo
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
}
