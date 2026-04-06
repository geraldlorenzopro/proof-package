import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, CheckCircle, X, ChevronRight, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: string;
  type: "deadline" | "stale" | "ready";
  severity: "critical" | "warning" | "positive";
  title: string;
  description: string;
  caseId?: string;
  dismissible: boolean;
}

export default function HubAlerts({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) loadAlerts();
  }, [accountId]);

  async function loadAlerts() {
    try {
      const now = new Date();
      const threeDays = new Date(now);
      threeDays.setDate(now.getDate() + 3);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      const [deadlinesRes, staleCasesRes, readyRes] = await Promise.all([
        // Deadlines in 3 days or less
        supabase.from("case_deadlines")
          .select("id, client_name, deadline_date, deadline_type, case_id")
          .eq("account_id", accountId)
          .eq("status", "active")
          .lte("deadline_date", threeDays.toISOString().split("T")[0])
          .gte("deadline_date", now.toISOString().split("T")[0])
          .order("deadline_date", { ascending: true })
          .limit(5),
        // Cases with no activity in 10+ days
        supabase.from("client_cases")
          .select("id, client_name, case_type, updated_at")
          .eq("account_id", accountId)
          .not("status", "eq", "completed")
          .lte("updated_at", tenDaysAgo.toISOString())
          .order("updated_at", { ascending: true })
          .limit(5),
        // Ready packages (Max scored >= 80)
        supabase.from("ai_agent_sessions")
          .select("id, case_id, output_data, created_at")
          .eq("account_id", accountId)
          .eq("agent_slug", "max")
          .eq("status", "completed")
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const newAlerts: Alert[] = [];

      // Deadline alerts
      (deadlinesRes.data || []).forEach((d: any) => {
        newAlerts.push({
          id: `deadline-${d.id}`,
          type: "deadline",
          severity: "critical",
          title: `Deadline: ${d.client_name}`,
          description: `${d.deadline_type} vence el ${new Date(d.deadline_date).toLocaleDateString("es")}`,
          caseId: d.case_id,
          dismissible: true,
        });
      });

      // Stale cases
      (staleCasesRes.data || []).forEach((c: any) => {
        const days = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / 86400000);
        newAlerts.push({
          id: `stale-${c.id}`,
          type: "stale",
          severity: "warning",
          title: `${c.client_name} sin actividad`,
          description: `${days} días sin actualización · ${c.case_type}`,
          caseId: c.id,
          dismissible: true,
        });
      });

      // Ready packages
      (readyRes.data || []).forEach((s: any) => {
        const score = (s.output_data as any)?.readiness_score;
        if (score && score >= 80 && s.case_id) {
          newAlerts.push({
            id: `ready-${s.id}`,
            type: "ready",
            severity: "positive",
            title: "Paquete listo para enviar",
            description: `Score: ${score}/100 · Revisado por Max`,
            caseId: s.case_id,
            dismissible: true,
          });
        }
      });

      setAlerts(newAlerts);
    } catch (err) {
      console.warn("[HubAlerts]", err);
    } finally {
      setLoading(false);
    }
  }

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (loading || visibleAlerts.length === 0) {
    if (!loading && alerts.length === 0) {
      return (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm text-emerald-400/80 font-medium">Todo al día — Sin alertas urgentes</span>
        </div>
      );
    }
    return null;
  }

  const severityConfig = {
    critical: { bg: "bg-rose-500/[0.06]", border: "border-rose-500/20", icon: AlertTriangle, iconColor: "text-rose-400" },
    warning: { bg: "bg-amber-500/[0.06]", border: "border-amber-500/20", icon: Clock, iconColor: "text-amber-400" },
    positive: { bg: "bg-emerald-500/[0.06]", border: "border-emerald-500/20", icon: PackageCheck, iconColor: "text-emerald-400" },
  };

  return (
    <div className="space-y-2">
      {visibleAlerts.map(alert => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;
        return (
          <div
            key={alert.id}
            className={`rounded-xl border ${config.border} ${config.bg} p-3.5 flex items-center gap-3 group`}
          >
            <Icon className={`w-4 h-4 ${config.iconColor} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{alert.title}</p>
              <p className="text-[11px] text-muted-foreground/70">{alert.description}</p>
            </div>
            {alert.caseId && (
              <button
                onClick={() => navigate(`/case-engine/${alert.caseId}`)}
                className="text-[11px] font-semibold text-jarvis hover:underline flex items-center gap-0.5 shrink-0"
              >
                Ver <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {alert.dismissible && (
              <button
                onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
