import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bot } from "lucide-react";
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

const AGENT_EMOJI: Record<string, string> = {
  felix: "📋",
  nina: "✍️",
  max: "📊",
};

function describeAgent(slug: string, clientName: string, inputData: any): string {
  const name = clientName || "un caso";
  switch (slug) {
    case "felix": {
      const formType = inputData?.form_type || "formulario";
      return `Felix llenó el ${formType} de ${name}`;
    }
    case "nina":
      return `Nina ensambló el paquete de ${name}`;
    case "max":
      return `Max evaluó el paquete de ${name}`;
    default:
      return `${slug} completó una tarea en ${name}`;
  }
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

      const { data: sessions } = await supabase
        .from("ai_agent_sessions")
        .select("id, agent_slug, case_id, created_at, input_data, status")
        .eq("account_id", accountId)
        .eq("status", "completed")
        .gte("created_at", twoDaysAgo)
        .order("created_at", { ascending: false })
        .limit(6);

      if (!sessions || sessions.length === 0) { setItems([]); return; }

      // Fetch case names for all case_ids
      const caseIds = [...new Set(sessions.map(s => s.case_id).filter(Boolean))] as string[];
      let caseMap = new Map<string, string>();
      if (caseIds.length > 0) {
        const { data: cases } = await supabase
          .from("client_cases")
          .select("id, client_name")
          .in("id", caseIds);
        (cases || []).forEach((c: any) => caseMap.set(c.id, c.client_name));
      }

      const result: ActivityItem[] = sessions.map((s: any) => {
        const clientName = s.case_id ? (caseMap.get(s.case_id) || "") : "";
        const emoji = AGENT_EMOJI[s.agent_slug] || "🤖";
        return {
          id: `agent-${s.id}`,
          icon: Bot,
          iconColor: "text-jarvis",
          text: `${emoji} ${describeAgent(s.agent_slug, clientName, s.input_data)}`,
          time: formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: es }),
          caseId: s.case_id,
        };
      });

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