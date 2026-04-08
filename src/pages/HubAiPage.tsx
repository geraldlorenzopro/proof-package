import { useNavigate } from "react-router-dom";
import HubAgentTeam from "@/components/hub/HubAgentTeam";
import {
  FileText, Clipboard, BarChart3, Shield, CheckSquare,
  Globe, Calculator, Search, FileSearch, Settings2,
  Camera, Package, Zap
} from "lucide-react";

const TOOLS = [
  { label: "Formularios USCIS", icon: FileText, path: "/dashboard/smart-forms", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { label: "NER Smart Forms", icon: Clipboard, path: "/dashboard/smart-forms-list", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  { label: "Visa Evaluator B1/B2", icon: Globe, path: "/dashboard/visa-evaluator", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Agente VAWA", icon: Shield, path: "/dashboard/vawa", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { label: "Checklist VAWA", icon: CheckSquare, path: "/dashboard/vawa-checklist", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  { label: "Calculadora CSPA", icon: Calculator, path: "/dashboard/cspa", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { label: "Affidavit I-864", icon: FileText, path: "/dashboard/affidavit", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { label: "USCIS Analyzer", icon: FileSearch, path: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { label: "Checklist Generator", icon: Clipboard, path: "/dashboard/checklist", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { label: "Evidence Tool", icon: Camera, path: "/dashboard/evidence", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { label: "Interview Simulator", icon: Zap, path: "/dashboard/interview-simulator", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
];

export default function HubAiPage() {
  const navigate = useNavigate();

  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const plan = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).plan : "essential";
    } catch { return "essential"; }
  })();

  if (!accountId) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 pb-2 shrink-0">
        <h1 className="text-xl font-bold text-foreground">Equipo AI & Herramientas</h1>
        <p className="text-sm text-muted-foreground">Agentes inteligentes y herramientas especializadas</p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5 pt-3 space-y-6">
        {/* Section 1 — AI Agents */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">Mi Equipo AI</h2>
          <HubAgentTeam accountId={accountId} plan={plan} />
        </div>

        {/* Section 2 — Tools */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">Herramientas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                onClick={() => {
                  sessionStorage.setItem("ner_hub_return", "/hub/ai");
                  navigate(tool.path);
                }}
                className={`flex items-center gap-2.5 rounded-xl border ${tool.border} ${tool.bg} p-3 text-left hover:scale-[1.02] transition-all`}
              >
                <tool.icon className={`w-4 h-4 ${tool.color} shrink-0`} />
                <span className="text-[11px] font-semibold text-foreground truncate">{tool.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
