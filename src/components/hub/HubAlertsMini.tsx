import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";

interface AlertItem {
  id: string;
  title: string;
  clientName: string;
  fileNumber: string | null;
  dueDate: string;
  priority: string;
  caseId: string;
}

export default function HubAlertsMini({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      try {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const { data } = await supabase
          .from("case_tasks")
          .select("id, title, due_date, priority, case_id, client_cases!inner(client_name, file_number, id)")
          .eq("account_id", accountId)
          .eq("status", "pending")
          .lte("due_date", threeDaysFromNow.toISOString().split("T")[0])
          .order("due_date", { ascending: true })
          .limit(5);

        if (data) {
          setAlerts(data.map((t: any) => ({
            id: t.id,
            title: t.title,
            clientName: t.client_cases?.client_name || "—",
            fileNumber: t.client_cases?.file_number || null,
            dueDate: t.due_date,
            priority: t.priority,
            caseId: t.case_id,
          })));
        }
      } catch (err) {
        console.warn("[HubAlertsMini]", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  if (loading) return null;

  if (alerts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-emerald-400/80">
        <CheckCircle className="w-4 h-4" />
        <span className="text-xs font-medium">Todo al día</span>
      </div>
    );
  }

  const priorityDot: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-400",
    low: "bg-emerald-400",
  };

  function relativeDate(dateStr: string) {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (diff < 0) return `Vencido hace ${Math.abs(diff)}d`;
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Mañana";
    return `En ${diff} días`;
  }

  return (
    <div className="space-y-1.5 overflow-y-auto max-h-full pr-1">
      {alerts.map(a => (
        <button
          key={a.id}
          onClick={() => navigate(`/case-engine/${a.caseId}`)}
          className="w-full text-left p-2 rounded-lg border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all group"
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[a.priority] || priorityDot.low}`} />
            <span className="text-[11px] font-medium text-foreground truncate flex-1">{a.title}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-jarvis transition-colors shrink-0" />
          </div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5 pl-3.5 truncate">
            {a.clientName}{a.fileNumber ? ` · ${a.fileNumber}` : ""} · {relativeDate(a.dueDate)}
          </div>
        </button>
      ))}
    </div>
  );
}
