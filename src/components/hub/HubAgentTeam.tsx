import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Clock, Eye, Lock, ChevronRight, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Agent {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  title: string;
  description: string;
  credit_cost: number;
  category: string;
  available_plans: string[];
  color: string;
  is_beta: boolean;
}

interface Session {
  id: string;
  agent_slug: string;
  case_id: string | null;
  status: string;
  credits_used: number;
  created_at: string;
  output_data: any;
}

const AGENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  teal: { bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-400" },
  coral: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
};

export default function HubAgentTeam({ accountId, plan }: { accountId: string; plan: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyAgent, setHistoryAgent] = useState<Agent | null>(null);
  const [agentHistory, setAgentHistory] = useState<Session[]>([]);

  useEffect(() => {
    loadData();
  }, [accountId]);

  async function loadData() {
    const [agentsRes, sessionsRes] = await Promise.all([
      supabase.from("ai_agents").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("ai_agent_sessions").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (agentsRes.data) setAgents(agentsRes.data as any);
    if (sessionsRes.data) setSessions(sessionsRes.data as any);
    setLoading(false);
  }

  async function openHistory(agent: Agent) {
    setHistoryAgent(agent);
    const { data } = await supabase
      .from("ai_agent_sessions")
      .select("*")
      .eq("account_id", accountId)
      .eq("agent_slug", agent.slug)
      .order("created_at", { ascending: false })
      .limit(10);
    setAgentHistory((data as any) || []);
  }

  if (loading) return null;
  if (agents.length === 0) return null;

  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent, i) => {
          const isAvailable = agent.available_plans.includes(plan);
          const colors = AGENT_COLORS[agent.color] || AGENT_COLORS.blue;
          const agentSessions = sessions.filter(s => s.agent_slug === agent.slug);
          const lastSession = agentSessions[0];
          const isRunning = agentSessions.some(s => s.status === "running");
          const monthCount = agentSessions.filter(s => {
            const d = new Date(s.created_at);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.status === "completed";
          }).length;

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl border ${isAvailable ? colors.border : "border-border/30"} ${isAvailable ? "bg-card" : "bg-card/40"} p-4 transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${isAvailable ? colors.bg : "bg-muted/30"} flex items-center justify-center shrink-0 text-lg`}>
                  {isAvailable ? agent.emoji : "🔒"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-bold ${isAvailable ? "text-foreground" : "text-muted-foreground/50"}`}>{agent.name}</h4>
                    {agent.is_beta && <Badge variant="outline" className="text-[8px] px-1.5">BETA</Badge>}
                  </div>
                  <p className={`text-[11px] ${isAvailable ? "text-muted-foreground" : "text-muted-foreground/40"}`}>{agent.title}</p>
                </div>
              </div>

              {isAvailable ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                    <span className="text-[10px] text-muted-foreground">
                      {isRunning ? "Trabajando..." : "Disponible"}
                    </span>
                  </div>

                  {lastSession && lastSession.status === "completed" && (
                    <p className="text-[10px] text-muted-foreground/60 truncate">
                      Última: {formatDistanceToNow(new Date(lastSession.created_at), { locale: es, addSuffix: true })}
                    </p>
                  )}

                  {monthCount > 0 && (
                    <p className="text-[10px] text-muted-foreground/50">
                      Este mes: {monthCount} ejecucion{monthCount !== 1 ? "es" : ""}
                    </p>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] px-2 text-muted-foreground hover:text-foreground w-full justify-start gap-1"
                    onClick={() => openHistory(agent)}
                  >
                    <Eye className="w-3 h-3" /> Ver historial
                  </Button>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground/40">
                    Disponible en <span className="font-semibold capitalize">{agent.available_plans[0]}</span>
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* History Modal */}
      <Dialog open={!!historyAgent} onOpenChange={() => setHistoryAgent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{historyAgent?.emoji}</span>
              Historial de {historyAgent?.name}
            </DialogTitle>
            <DialogDescription>Últimas 10 ejecuciones</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {agentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin actividad aún</p>
            ) : (
              agentHistory.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <span className={`w-2 h-2 rounded-full ${s.status === "completed" ? "bg-emerald-400" : s.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground capitalize">{s.status}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at), { locale: es, addSuffix: true })} · {s.credits_used} créditos
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
