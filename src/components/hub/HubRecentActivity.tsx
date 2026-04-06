import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle, FileText, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityItem {
  id: string;
  icon: any;
  iconColor: string;
  text: string;
  time: string;
  caseId?: string;
}

export default function HubRecentActivity({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (accountId) loadActivity();
  }, [accountId]);

  async function loadActivity() {
    try {
      const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString();

      const [agentRes, intakeRes] = await Promise.all([
        supabase.from("ai_agent_sessions")
          .select("id, agent_slug, case_id, created_at, output_text, status")
          .eq("account_id", accountId)
          .eq("status", "completed")
          .gte("created_at", twoDaysAgo)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("intake_sessions")
          .select("id, client_first_name, client_last_name, created_at")
          .eq("account_id", accountId)
          .gte("created_at", twoDaysAgo)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const result: ActivityItem[] = [];

      const agentNames: Record<string, string> = {
        felix: "Felix",
        nina: "Nina",
        max: "Max",
      };

      (agentRes.data || []).forEach((s: any) => {
        const name = agentNames[s.agent_slug] || s.agent_slug;
        result.push({
          id: `agent-${s.id}`,
          icon: Bot,
          iconColor: "text-jarvis",
          text: `${name} completó una tarea`,
          time: formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: es }),
          caseId: s.case_id,
        });
      });

      (intakeRes.data || []).forEach((i: any) => {
        const clientName = [i.client_first_name, i.client_last_name].filter(Boolean).join(" ") || "Cliente";
        result.push({
          id: `intake-${i.id}`,
          icon: UserPlus,
          iconColor: "text-emerald-400",
          text: `Nuevo intake — ${clientName}`,
          time: formatDistanceToNow(new Date(i.created_at), { addSuffix: true, locale: es }),
        });
      });

      // Sort by time (most recent first) - already sorted from DB
      result.sort((a, b) => 0); // keep as-is since both queries are desc
      setItems(result.slice(0, 5));
    } catch (err) {
      console.warn("[HubRecentActivity]", err);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 font-bold px-1">
        Actividad reciente
      </p>
      {items.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => item.caseId && navigate(`/case-engine/${item.caseId}`)}
            disabled={!item.caseId}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-card/60 transition-colors text-left disabled:cursor-default"
          >
            <Icon className={`w-3.5 h-3.5 ${item.iconColor} shrink-0`} />
            <span className="text-[12px] text-foreground/70 flex-1 truncate">{item.text}</span>
            <span className="text-[10px] text-muted-foreground/40 shrink-0">{item.time}</span>
          </button>
        );
      })}
    </div>
  );
}
