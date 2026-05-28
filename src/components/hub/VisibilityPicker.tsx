/**
 * VisibilityPicker — 3 radios horizontales color-coded para asignar
 * visibility al crear notas / tareas / docs.
 *
 * Implementa la UX rule LOCKED en CLAUDE.md (2026-05-03):
 *   - Dropdown inline en creación, siempre visible
 *   - 3 radios horizontales con border color-coded (verde/amber/rojo)
 *   - NO toggle binario, NO collapsed
 *   - Microcopy oficial: "Esta nota queda en el círculo de abogados"
 *
 * Roles que pueden asignar cada nivel (per usePermissions):
 *   - team: TODOS los roles (default)
 *   - attorney_only: attorney, owner, admin
 *   - admin_only: owner, admin
 *
 * El picker filtra opciones según assignableVisibilityLevels() del user
 * actual. Si el user es paralegal/assistant, solo ve "team".
 */
import { Users, Briefcase, Lock } from "lucide-react";
import { usePermissions, type VisibilityLevel } from "@/hooks/usePermissions";

interface Props {
  value: VisibilityLevel;
  onChange: (v: VisibilityLevel) => void;
  /** Microcopy contextual del tipo de record. Default: "nota". */
  recordLabel?: string;
}

const OPTIONS: Array<{
  value: VisibilityLevel;
  label: string;
  icon: typeof Users;
  chipActive: string;
  chipInactive: string;
  helper: string;
}> = [
  {
    value: "team",
    label: "Equipo",
    icon: Users,
    chipActive: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
    chipInactive: "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-emerald-500/20 hover:text-emerald-300/80",
    helper: "Todos en tu firma pueden verla.",
  },
  {
    value: "attorney_only",
    label: "Abogados",
    icon: Briefcase,
    chipActive: "bg-amber-500/15 border-amber-500/40 text-amber-300",
    chipInactive: "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-amber-500/20 hover:text-amber-300/80",
    helper: "Queda en el círculo de abogados.",
  },
  {
    value: "admin_only",
    label: "Solo admin",
    icon: Lock,
    chipActive: "bg-rose-500/15 border-rose-500/40 text-rose-300",
    chipInactive: "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-rose-500/20 hover:text-rose-300/80",
    helper: "Sensible · owner/admin solamente.",
  },
];

export default function VisibilityPicker({ value, onChange, recordLabel = "nota" }: Props) {
  const { assignableVisibilityLevels, isLoading } = usePermissions();
  const allowed = assignableVisibilityLevels();
  const visibleOptions = OPTIONS.filter(o => allowed.includes(o.value));
  const current = visibleOptions.find(o => o.value === value) || visibleOptions[0];

  // Si solo puede asignar "team" (paralegal/assistant), no mostramos el picker —
  // se reduce ruido visual. Pero el default se respeta vía prop value=team.
  if (isLoading || visibleOptions.length <= 1) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          ¿Quién la ve?
        </span>
        {current && (
          <span className="text-[10px] text-muted-foreground/60 italic">
            {current.helper.replace("nota", recordLabel)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {visibleOptions.map(opt => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold border transition-all ${
                active ? opt.chipActive : opt.chipInactive
              }`}
            >
              <Icon className="w-3 h-3" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
