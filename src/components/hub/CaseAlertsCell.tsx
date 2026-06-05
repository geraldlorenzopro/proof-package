/**
 * CaseAlertsCell — Col Alertas (70px) del Pipeline de Casos.
 *
 * v3 Round 4 2026-06-05 (Valerie + Vanessa + Marcus + Victoria consensus):
 *
 *   - "Cliente silent >10d" deja de ser ícono Phone+pulse cyan en col Alertas
 *     (era affordance falsa — parecía CTA pero no era). Movido a sub-text
 *     bajo el nombre del cliente en CaseTable (badge ámbar `12d`).
 *
 *   - Los íconos restantes (RFE, Felix bad, doc faltante, Felix OK) son
 *     STATUS ÍCONOS NO clickeables. Se quedan como están.
 *
 *   - "Pinned" caso → ícono Pin amber al frente (Round 4 Marcus alternativa
 *     a priority manual).
 *
 *   - Pulse animation reservada SOLO para deadlines gov ≤3 días — Marcus:
 *     "Si todo pulsa, nada pulsa."
 */
import { Zap, FileText, Check } from "lucide-react";
import type { PipelineCase } from "@/hooks/useCasePipeline";

interface Props {
  c: PipelineCase;
}

interface Alert {
  key: string;
  title: string;
  iconClass: string;
  Icon: typeof Zap;
  pulse?: boolean;
}

function deriveAlerts(c: PipelineCase): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  // Pin REMOVIDO de aquí — Round 4.5 (Valerie audit). Vive al lado
  // del avatar en CaseRow como "anchor" del caso. La col Alertas es
  // SOLO para fuego activo (RFE, Felix, deadlines), no para
  // properties del caso.

  // RFE deadline próximos 7d — pulse SOLO si ≤3d (Marcus rule)
  if (c.rfe_deadline) {
    const rfeMs = new Date(c.rfe_deadline + "T00:00:00").getTime();
    const daysLeft = Math.ceil((rfeMs - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 7) {
      alerts.push({
        key: "rfe",
        title: `RFE vence en ${daysLeft}d (${c.rfe_deadline})`,
        iconClass: "bg-rose-500/20 text-rose-300",
        Icon: FileText,
        pulse: daysLeft <= 3,
      });
    }
  }

  // Overdue tasks → Felix bad
  if ((c.overdue_tasks_count ?? 0) > 0) {
    alerts.push({
      key: "felix-bad",
      title: `Felix: ${c.overdue_tasks_count} tarea${c.overdue_tasks_count === 1 ? "" : "s"} vencida${c.overdue_tasks_count === 1 ? "" : "s"}`,
      iconClass: "bg-rose-500/20 text-rose-300",
      Icon: Zap,
    });
  }

  // Si no hay alertas negativas → Felix OK
  if (alerts.length === 0) {
    alerts.push({
      key: "felix-ok",
      title: "Felix: checklist OK",
      iconClass: "bg-emerald-500/20 text-emerald-300",
      Icon: Check,
    });
  }

  // Cap a 3 íconos máximo
  return alerts.slice(0, 3);
}

export default function CaseAlertsCell({ c }: Props) {
  const alerts = deriveAlerts(c);
  return (
    <div className="flex items-center gap-1 justify-center">
      {alerts.map(a => {
        const Icon = a.Icon;
        return (
          <div
            key={a.key}
            title={a.title}
            aria-label={a.title}
            role="img"
            className={`w-5 h-5 rounded-full flex items-center justify-center ${a.iconClass} ${a.pulse ? "animate-pulse" : ""}`}
          >
            <Icon className="w-3 h-3" />
          </div>
        );
      })}
    </div>
  );
}
