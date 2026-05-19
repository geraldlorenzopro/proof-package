/**
 * CaseAlertsCell — Col Alertas (40px) del Pipeline de Casos.
 *
 * Diferenciador NER vs Monday: agentes IA (Felix/Camila) y deadlines
 * visibles inline sin abrir el caso.
 *
 * Tipos de alertas:
 *   - Felix OK: checklist completo (✓ emerald)
 *   - Felix bad: falta documento/campo requerido (⚡ rose)
 *   - Camila call-to-action: cliente silent >10d (📞 cyan pulse)
 *   - RFE deadline: vence en ≤7d (📄 rose)
 *   - Doc faltante: documento requerido falta subir (📎 amber)
 *
 * Paridad visual estricta con mockup NER-HUB-CASOS-FASE-C-V2.html:
 *   - alert-icon: w-5 h-5 rounded-full flex items-center justify-center
 *   - alert-felix-ok: bg-emerald-500/20 text-emerald-300
 *   - alert-felix-bad: bg-rose-500/20 text-rose-300
 *   - alert-camila: bg-cyan-500/20 text-cyan-300 (animate-pulse)
 *   - alert-rfe: bg-rose-500/20 text-rose-300
 *   - alert-doc: bg-amber-500/20 text-amber-300
 */
import { Zap, FileText, Phone, Paperclip, Check } from "lucide-react";
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

  // RFE deadline próximos 7d
  if (c.rfe_deadline) {
    const rfeMs = new Date(c.rfe_deadline + "T00:00:00").getTime();
    const daysLeft = Math.ceil((rfeMs - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 7) {
      alerts.push({
        key: "rfe",
        title: `RFE vence en ${daysLeft}d (${c.rfe_deadline})`,
        iconClass: "bg-rose-500/20 text-rose-300",
        Icon: FileText,
      });
    }
  }

  // Cliente silent >10 días
  if (c.last_client_activity_at) {
    const lastMs = new Date(c.last_client_activity_at).getTime();
    const daysSilent = Math.floor((now - lastMs) / 86400000);
    if (daysSilent >= 10) {
      alerts.push({
        key: "camila",
        title: `Camila: llamar al cliente (${daysSilent}d sin contacto)`,
        iconClass: "bg-cyan-500/20 text-cyan-300",
        Icon: Phone,
        pulse: true,
      });
    }
  }

  // Overdue tasks → Felix bad (proxy hasta tener checklist real)
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

  // Cap a 3 íconos máximo para no sobrecargar la col de 40px
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
            className={`w-5 h-5 rounded-full flex items-center justify-center ${a.iconClass} ${a.pulse ? "animate-pulse" : ""}`}
          >
            <Icon className="w-3 h-3" />
          </div>
        );
      })}
    </div>
  );
}
