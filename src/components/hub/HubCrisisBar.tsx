import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useDemoMode, DEMO_CRISIS } from "@/hooks/useDemoData";
import { HUB_SECTIONS } from "@/lib/hubSections";

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
  severity?: "overdue" | "urgent" | "warning";
}

interface Props {
  accountId: string | null;
}

export default function HubCrisisBar({ accountId }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const [crisis, setCrisis] = useState<Crisis | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (demoMode) {
      setCrisis(DEMO_CRISIS);
      setLoaded(true);
      return;
    }
    if (!accountId) {
      setCrisis(null);
      setLoaded(true);
      return;
    }
    loadCrisis().finally(() => setLoaded(true));
  }, [accountId, demoMode]);

  async function loadCrisis() {
    // Bug fix: fechas en zona local del browser (no UTC) para que el
    // cutoff "vence en 3 días" no salte un día en franja noche EST.
    const today = format(new Date(), "yyyy-MM-dd");
    const in3d = format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd");

    // Fuente 1: client_cases con rfe_deadline próximo o vencido (PREFERIDA)
    const { data: caseRfes } = await supabase
      .from("client_cases")
      .select("id, client_name, case_type, rfe_deadline, last_client_activity_at")
      .eq("account_id", accountId)
      .not("rfe_deadline", "is", null)
      .lte("rfe_deadline", in3d)
      .not("status", "in", "(completed,archived,cancelled)")
      .order("rfe_deadline", { ascending: true })
      .limit(1);

    if (caseRfes && caseRfes.length > 0) {
      const c: any = caseRfes[0];
      const deadline = c.rfe_deadline as string;
      const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
      const daysText = days < 0
        ? `venció hace ${Math.abs(days)}d`
        : days === 0 ? "vence HOY"
        : `vence en ${days}d`;

      setCrisis({
        case_id: c.id,
        title: `${c.client_name} · ${c.case_type || "Caso"}`,
        subtitle: `RFE ${daysText}. Respuesta pendiente.`,
        severity: days <= 0 ? "overdue" : (days <= 3 ? "urgent" : "warning"),
      });
      return;
    }

    // Fuente 2 (fallback): tasks RFE-tagged con due_date próximo
    const { data: taskRfes } = await supabase
      .from("case_tasks")
      .select("id, case_id, title, due_date")
      .eq("account_id", accountId)
      .neq("status", "completed")
      .neq("status", "archived")
      .or("task_type.eq.rfe_response,title.ilike.%rfe%,priority.eq.critical")
      .lte("due_date", in3d)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1);

    const worst = taskRfes?.[0];
    if (!worst) { setCrisis(null); return; }

    const { data: caseData } = await supabase
      .from("client_cases")
      .select("client_name").eq("id", worst.case_id).maybeSingle();

    const days = worst.due_date
      ? Math.ceil((new Date(worst.due_date).getTime() - Date.now()) / 86400000)
      : null;

    setCrisis({
      case_id: worst.case_id,
      title: `${caseData?.client_name || "Caso"} · ${worst.title}`,
      subtitle: days !== null
        ? (days < 0
            ? `Venció hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}`
            : days === 0
            ? "Vence hoy"
            : `Vence en ${days} ${days === 1 ? "día" : "días"}`)
        : "Sin fecha — atender",
      severity: days !== null && days <= 0 ? "overdue" : "urgent",
    });
  }

  // Reserva siempre la misma altura para evitar que el briefing se
  // empuje hacia abajo cuando la query async resuelve y aparece la barra.
  if (!crisis) {
    // Si ya cargó y no hay crisis → no reservar espacio (limpio).
    // Si está cargando → reservar 40px para evitar layout shift.
    return loaded ? null : <div className="h-10 mb-2" aria-hidden="true" />;
  }

  function handleViewCase() {
    if (demoMode) {
      toast.info("Vista demo · navegación a caso desactivada", {
        description: "En producción, este click abre el case engine completo.",
        duration: 3000,
      });
      return;
    }
    // Gate temporal (2026-05-18): mientras Casos esté disabled, bloquear
    // atajo al case-engine para mantener coherencia con sidebar PRONTO.
    if (!HUB_SECTIONS.casos.enabled) {
      toast.info("Próximamente", {
        description: "Los detalles del caso llegan con el módulo de Casos.",
        duration: 3000,
      });
      return;
    }
    navigate(`/case-engine/${crisis!.case_id}`);
  }

  return (
    <div className="bg-gradient-to-r from-rose-500/12 to-rose-500/[0.03] border border-rose-500/30 border-l-4 border-l-rose-500 rounded-lg px-3 py-1.5 flex items-center gap-3 mb-2 backdrop-blur-sm">
      <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-3 h-3 text-rose-300" />
      </div>
      <div className="flex-1 text-[12px] leading-relaxed font-inter">
        <strong className="text-rose-300 font-sora">{crisis.title}</strong>
        <span className="text-muted-foreground"> — {crisis.subtitle}</span>
      </div>
      <button
        onClick={handleViewCase}
        className="text-[11px] font-semibold px-3.5 py-1.5 rounded text-rose-300 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 transition-colors shrink-0 font-sora"
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
