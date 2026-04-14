import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, ChevronRight, ListTodo } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  clientName: string;
  fileNumber: string | null;
  caseId: string;
}

export default function HubMyTasks({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      try {
        const sevenDays = new Date();
        sevenDays.setDate(sevenDays.getDate() + 7);

        const { data } = await supabase
          .from("case_tasks")
          .select("id, title, due_date, priority, status, case_id, client_cases!inner(client_name, file_number, id)")
          .eq("account_id", accountId)
          .eq("status", "pending")
          .or(`due_date.lte.${sevenDays.toISOString().split("T")[0]},priority.eq.high`)
          .order("priority", { ascending: true })
          .order("due_date", { ascending: true })
          .limit(4);

        if (data) {
          setTasks(data.map((t: any) => ({
            id: t.id,
            title: t.title,
            dueDate: t.due_date,
            priority: t.priority,
            clientName: t.client_cases?.client_name || "—",
            fileNumber: t.client_cases?.file_number || null,
            caseId: t.case_id,
          })));
        }
      } catch (err) {
        console.warn("[HubMyTasks]", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const priorityDot: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-400",
    low: "bg-emerald-400",
  };

  function relativeDate(dateStr: string | null) {
    if (!dateStr) return "Sin fecha";
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (diff < 0) return `Vencido hace ${Math.abs(diff)}d`;
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Mañana";
    return `En ${diff} días`;
  }

  if (loading) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-jarvis/60" />
          <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Mis tareas de hoy</span>
        </div>
        <button
          onClick={() => navigate("/hub/cases")}
          className="text-[10px] text-jarvis hover:text-jarvis/80 font-medium transition-colors"
        >
          Ver todas →
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-emerald-400/80">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs font-medium">Todo al día ✅</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {tasks.map(t => (
            <button
              key={t.id}
              onClick={() => navigate(`/case-engine/${t.caseId}`)}
              className="w-full text-left p-2.5 rounded-xl border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all group flex items-center gap-3"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityDot[t.priority] || priorityDot.low}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
                <p className="text-[10px] text-muted-foreground/50 truncate">
                  {t.clientName}{t.fileNumber ? ` · ${t.fileNumber}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0 flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground/40">{relativeDate(t.dueDate)}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-jarvis transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
