/**
 * TaskViewTabs — Round 7 (Valerie + Vanessa propuesta convergente).
 *
 * Tabs específicos para /hub/tasks (NO comparte con CaseViewTabs).
 * Patrón Linear/Stripe + GHL Tasks combinado.
 *
 * 5 tabs core: Todas / Hoy / Atrasadas / Próximas (7d) / Completadas
 * + RFE Response tab CONDICIONAL (solo si count > 0, Vanessa pidió)
 *
 * Layout: flex con flex-1 estático (Victoria fix — sin Tailwind JIT bug
 * de clases dinámicas grid-cols-[repeat(${n},1fr)]).
 */
import { ListChecks, Clock, AlertTriangle, CalendarDays, CheckCheck, FileText } from "lucide-react";

export type TaskViewKey = "todas" | "hoy" | "atrasadas" | "proximas" | "completadas" | "rfe-response";

export interface TaskTabMeta {
  key: TaskViewKey;
  label: string;
  icon: typeof ListChecks;
  description: string;
  /** Si true, solo se renderiza cuando counts[key] > 0 (Vanessa: condicional). */
  conditional?: boolean;
}

export const TASK_TABS: TaskTabMeta[] = [
  { key: "hoy",          label: "Hoy",           icon: Clock,         description: "Tareas que vencen hoy" },
  { key: "atrasadas",    label: "Atrasadas",     icon: AlertTriangle, description: "Vencidas — abordar ya" },
  { key: "proximas",     label: "Próximas (7d)", icon: CalendarDays,  description: "Próximos 7 días" },
  { key: "rfe-response", label: "RFE Response",  icon: FileText,      description: "Tareas de casos con RFE ≤ 62 días (USCIS window)", conditional: true },
  { key: "todas",        label: "Todas",         icon: ListChecks,    description: "Todas las pendientes (no snoozed, no completadas)" },
  { key: "completadas",  label: "Completadas",   icon: CheckCheck,    description: "Marcadas como hechas" },
];

interface Props {
  activeTab: TaskViewKey;
  onChange: (k: TaskViewKey) => void;
  counts: Record<TaskViewKey, number>;
  loading?: boolean;
}

// Color tokens por tab (color semántico de urgencia/tipo).
const TAB_THEME: Record<TaskViewKey, { activeBg: string; activeBorder: string; activeText: string }> = {
  hoy:           { activeBg: "bg-amber-500/[0.10]",   activeBorder: "border-amber-500/55",   activeText: "text-amber-300" },
  atrasadas:     { activeBg: "bg-rose-500/[0.10]",    activeBorder: "border-rose-500/55",    activeText: "text-rose-300" },
  proximas:      { activeBg: "bg-cyan-accent/[0.10]", activeBorder: "border-cyan-accent/55", activeText: "text-cyan-accent" },
  "rfe-response":{ activeBg: "bg-rose-600/[0.10]",    activeBorder: "border-rose-600/55",    activeText: "text-rose-300" },
  todas:         { activeBg: "bg-white/[0.08]",       activeBorder: "border-white/30",       activeText: "text-white" },
  completadas:   { activeBg: "bg-emerald-500/[0.10]", activeBorder: "border-emerald-500/55", activeText: "text-emerald-300" },
};

export default function TaskViewTabs({ activeTab, onChange, counts, loading = false }: Props) {
  // Filtrar conditional tabs (RFE Response solo si count > 0 — Vanessa)
  const visibleTabs = TASK_TABS.filter(t => !t.conditional || counts[t.key] > 0);

  // Victoria fix: flex con flex-1 estático (NO grid-cols dinámico que JIT no purga)
  return (
    <div className="flex items-stretch gap-2 w-full">
      {visibleTabs.map(t => {
        const isActive = activeTab === t.key;
        const count = counts[t.key];
        const theme = TAB_THEME[t.key];
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            title={t.description}
            className={
              isActive
                ? `flex-1 ${theme.activeBg} ${theme.activeBorder} border rounded-lg px-3 h-14 flex items-center gap-3 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`
                : `flex-1 bg-white/[0.025] border border-white/[0.08] rounded-lg px-3 h-14 flex items-center gap-3 hover:bg-white/[0.04] hover:border-white/15 transition-all`
            }
          >
            <span
              className={`w-9 h-9 rounded-md ${isActive ? theme.activeBg : "bg-white/[0.04]"} flex items-center justify-center shrink-0`}
            >
              <Icon className={`w-4 h-4 ${isActive ? theme.activeText : "text-slate-400"}`} />
            </span>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider truncate ${
                  isActive ? theme.activeText : "text-slate-400"
                }`}
              >
                {t.label}
              </span>
              <span
                className={`font-sora font-bold text-[20px] leading-none tabular-nums min-w-[2ch] text-right ${
                  isActive ? theme.activeText : "text-slate-300"
                }`}
              >
                {loading ? <span className="opacity-0" aria-hidden="true">0</span> : count}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
