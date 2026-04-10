import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Bot, Wrench } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import HubAgentTeam from "@/components/hub/HubAgentTeam";
import VoiceAIPanel from "@/components/hub/VoiceAIPanel";
import {
  FileText, Clipboard, Globe, Shield, CheckSquare,
  Calculator, FileSearch, Camera, Zap
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
      <Tabs defaultValue="voice" className="flex-1 flex flex-col min-h-0">
        {/* Tab bar */}
        <div className="px-5 pt-4 pb-0 shrink-0">
          <TabsList className="bg-card/50 border border-border/20 h-11 p-1 gap-1">
            <TabsTrigger value="voice" className="gap-2 data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis data-[state=active]:shadow-none px-4">
              <Mic className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Voice AI</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2 data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis data-[state=active]:shadow-none px-4">
              <Bot className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Agentes</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2 data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis data-[state=active]:shadow-none px-4">
              <Wrench className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Herramientas</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Voice AI — split screen */}
        <TabsContent value="voice" className="flex-1 min-h-0 mt-0 relative data-[state=active]:flex data-[state=active]:flex-col">
          <VoiceAIPanel accountId={accountId} />
        </TabsContent>

        {/* Agents */}
        <TabsContent value="agents" className="flex-1 min-h-0 mt-0 overflow-hidden p-6 flex items-center justify-center">
          <div className="max-w-4xl w-full">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Equipo de Agentes AI</h2>
              <p className="text-sm text-muted-foreground/60 mt-1">Especialistas digitales que trabajan en tus casos de inmigración.</p>
            </div>
            <HubAgentTeam accountId={accountId} plan={plan} />
          </div>
        </TabsContent>

        {/* Tools */}
        <TabsContent value="tools" className="flex-1 min-h-0 mt-0 overflow-hidden p-6 flex items-center justify-center">
          <div className="max-w-4xl w-full">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Herramientas de Inmigración</h2>
              <p className="text-sm text-muted-foreground/60 mt-1">Calculadoras, generadores y herramientas especializadas.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  onClick={() => {
                    sessionStorage.setItem("ner_hub_return", "/hub/ai");
                    navigate(tool.path);
                  }}
                  className={`flex items-center gap-3 rounded-xl border ${tool.border} ${tool.bg} p-3 text-left hover:scale-[1.02] transition-all group`}
                >
                  <tool.icon className={`w-4 h-4 ${tool.color} shrink-0 group-hover:scale-110 transition-transform`} />
                  <span className="text-[11px] font-semibold text-foreground">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
