import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useDemoMode, DEMO_CRISIS } from "@/hooks/useDemoData";

// HubCrisisBar — Alerta única más urgente del día. Va ANTES del briefing
// porque los ojos del abogado buscan rojo instintivamente al entrar.
//
// Decisión 2026-05-11 — post-debate con Mr. Lorenzo:
//   "El briefing es lectura, la crisis es acción. Acción siempre arriba."
//
// Solo renderiza si HAY crisis. Si no hay → null (no ocupa espacio).

interface Crisis {
  case_id: string;
  title: string;
  subtitle: string;
}

interface Props {
  accountId: string | null;
}

export default function HubCrisisBar({ accountId }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const [crisis, setCrisis] = useState<Crisis | null>(null);

  useEffect(() => {
    if (demoMode) {
      setCrisis(DEMO_CRISIS);
      return;
    }
    if (!accountId) {
      setCrisis(null);
      return;
    }
    loadCrisis();
  }, [accountId, demoMode]);

  async function loadCrisis() {
    // Detectar la TAREA más crítica: RFE/revisión vencida o ≤2 días
    const today = new Date().toISOString().slice(0, 10);
    const in2d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    const { data } = await supabase
      .from("case_tasks")
      .select("id, case_id, title, due_date, created_by_name, status, case_id")
      .eq("account_id", accountId)
      .neq("status", "completed")
      .neq("status", "archived")
      .or("title.ilike.%rfe%,title.ilike.%revis%,title.ilike.%review%,priority.eq.critical")
      .lte("due_date", in2d)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1);

    const worst = data?.[0];
    if (!worst) {
      setCrisis(null);
      return;
    }

    // Cargar nombre del cliente
    const { data: caseData } = await supabase
      .from("client_cases")
      .select("client_name")
      .eq("id", worst.case_id)
      .maybeSingle();

    const isOverdue = worst.due_date && worst.due_date < today;
    const daysText = worst.due_date
      ? (isOverdue
          ? `venció hace ${Math.abs(daysBetween(worst.due_date, today))}d`
          : (worst.due_date === today
              ? "vence HOY"
              : `vence en ${daysBetween(today, worst.due_date)}d`))
      : "sin fecha de vencimiento";

    setCrisis({
      case_id: worst.case_id,
      title: `${worst.title}${caseData?.client_name ? ` — ${caseData.client_name}` : ""}`,
      subtitle: `${daysText}${worst.created_by_name ? ` · drafted por ${worst.created_by_name}` : " · sin empezar"}`,
    });
  }

  if (!crisis) return null;

  function handleViewCase() {
    if (demoMode) {
      toast.info("Vista demo · navegación a caso desactivada", {
        description: "En producción, este click abre el case engine completo.",
        duration: 3000,
      });
      return;
    }
    navigate(`/case-engine/${crisis!.case_id}`);
  }

  return (
    <div className="bg-rose-500/10 border border-rose-500/40 border-l-4 border-l-rose-500 rounded-lg px-4 py-3 flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
      </div>
      <div className="flex-1 text-[12px] leading-relaxed">
        <strong className="text-rose-300">{crisis.title}</strong>
        <span className="text-muted-foreground"> — {crisis.subtitle}</span>
      </div>
      <button
        onClick={handleViewCase}
        className="text-[11px] font-semibold px-3.5 py-1.5 rounded bg-rose-500 hover:bg-rose-600 text-white transition-colors shrink-0"
      >
        Ver caso
      </button>
    </div>
  );
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
}
