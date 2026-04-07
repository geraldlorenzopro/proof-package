import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const AGENT_META: Record<string, { emoji: string; label: string; verb: string }> = {
  felix: { emoji: "📋", label: "Felix", verb: "llenó formulario" },
  nina: { emoji: "✍️", label: "Nina", verb: "ensambló paquete" },
  max: { emoji: "📊", label: "Max", verb: "evaluó paquete" },
};

function describeSession(slug: string, inputData: any): string {
  const meta = AGENT_META[slug];
  if (!meta) return `Agente ${slug} ejecutado`;
  const formType = inputData?.case_type || inputData?.form_type || "";
  return formType ? `${meta.emoji} ${meta.label} ${meta.verb} ${formType}` : `${meta.emoji} ${meta.label} ${meta.verb}`;
}

interface Props {
  caseId: string;
}

export default function CaseAgentHistory({ caseId }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("ai_agent_sessions")
        .select("id, agent_slug, status, credits_used, created_at, input_data")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      setSessions(data || []);
      setLoading(false);
    }
    load();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <Cpu className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Sin actividad de agentes AI</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Cpu className="w-4 h-4 text-jarvis" />
        Actividad de Agentes AI ({sessions.length})
      </h3>
      {sessions.map((s) => {
        const description = describeSession(s.agent_slug, s.input_data);
        const statusOk = s.status === "completed";
        return (
          <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/50">
            <div className="mt-0.5 text-lg leading-none">
              {AGENT_META[s.agent_slug]?.emoji || "🤖"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">{description}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${statusOk ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}
                >
                  {statusOk ? "✓ Completado" : s.status}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: es })}
                {s.credits_used > 0 && ` · ${s.credits_used} créditos`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
