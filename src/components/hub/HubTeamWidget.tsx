import { useNavigate } from "react-router-dom";
import { Mic, FileText, Package, CheckCircle2, Bot } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  Icon: typeof Mic;
  gradient: string;
  href: string;
  title: string;
}

const AGENTS: Agent[] = [
  { id: "camila", name: "Camila", Icon: Mic,         gradient: "from-cyan-500 to-blue-500",     href: "/hub/chat",  title: "Camila · Chat AI" },
  { id: "felix",  name: "Felix",  Icon: FileText,    gradient: "from-blue-500 to-cyan-500",     href: "/hub/forms", title: "Felix · Forms USCIS" },
  { id: "nina",   name: "Nina",   Icon: Package,     gradient: "from-purple-500 to-pink-500",   href: "/hub/ai",    title: "Nina · Packets" },
  { id: "max",    name: "Max",    Icon: CheckCircle2, gradient: "from-emerald-500 to-green-500", href: "/hub/ai",    title: "Max · QA" },
];

export default function HubTeamWidget() {
  const navigate = useNavigate();
  return (
    <section className="rounded-2xl border border-cyan-accent/20 bg-gradient-to-br from-ai-blue/[0.04] to-cyan-accent/[0.04] backdrop-blur-sm p-2.5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground font-sora">
          <Bot className="w-3.5 h-3.5 text-cyan-accent" />
          Mi equipo
          <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-normal">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            4 listos
          </span>
        </h4>
        <button onClick={() => navigate("/hub/ai")} className="text-[10px] text-cyan-accent/80 hover:text-cyan-accent">
          Abrir →
        </button>
      </div>
      <div className="flex items-center gap-1 flex-1">
        {AGENTS.map(a => {
          const { Icon } = a;
          return (
            <button
              key={a.id}
              onClick={() => navigate(a.href)}
              title={a.title}
              className="flex-1 flex flex-col items-center gap-1 p-1.5 rounded-md hover:bg-cyan-accent/8 transition group"
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-md`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-[9px] font-semibold text-foreground/80 group-hover:text-cyan-accent transition">{a.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
