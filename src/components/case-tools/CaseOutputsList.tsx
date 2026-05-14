import { useEffect, useState } from "react";
import {
  FileSearch,
  Camera,
  Calculator,
  BarChart3,
  ListChecks,
  Globe,
  MessageSquare,
  Archive,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { listToolOutputs, type ToolOutput } from "@/lib/caseToolOutputs";
import { cn } from "@/lib/utils";

const TOOL_ICONS: Record<string, LucideIcon> = {
  affidavit: Calculator,
  evidence: Camera,
  cspa: BarChart3,
  "uscis-analyzer": FileSearch,
  checklist: ListChecks,
  "visa-evaluator": Globe,
  "interview-sim": MessageSquare,
};

interface Props {
  caseId: string;
}

/**
 * Sección del workspace que muestra outputs generados por tools NER
 * y guardados al expediente. Lee del cliente hybrid (Supabase + localStorage).
 *
 * Se actualiza vía storage event cuando otra tab guarda algo (paralegal
 * generó PDF en /tools/evidence?case_id=X, vuelve al workspace y ve el
 * output listado sin recargar) y también en window focus.
 */
export default function CaseOutputsList({ caseId }: Props) {
  const [outputs, setOutputs] = useState<ToolOutput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const list = await listToolOutputs(caseId);
      if (alive) {
        setOutputs(list);
        setLoading(false);
      }
    };
    refresh();
    // Refresh cuando otra tab guarde algo en localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === `ner.case-tools.${caseId}`) refresh();
    };
    window.addEventListener("storage", onStorage);
    // Refresh cuando la pestaña vuelve a foco (paralegal regresó del tool)
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [caseId]);

  if (loading) return null;
  if (outputs.length === 0) return null;

  const supabaseCount = outputs.filter((o) => o._source === "supabase").length;
  const localCount = outputs.filter((o) => o._source === "localStorage").length;

  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <Archive className="w-3.5 h-3.5 text-jarvis" />
          <h3 className="text-[12px] font-semibold text-foreground">Outputs guardados al expediente</h3>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{outputs.length}</span>
      </div>
      <ul className="space-y-1.5">
        {outputs.slice(0, 6).map((o) => {
          const Icon = TOOL_ICONS[o.tool_slug] ?? Archive;
          return (
            <li
              key={o.id}
              className="flex items-start gap-2.5 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/40"
            >
              <div className="w-7 h-7 rounded-md bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-jarvis" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-semibold text-foreground leading-tight truncate">
                  {o.tool_label}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1.5 flex-wrap">
                  <span>{formatRelativeTime(o.generated_at)}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="font-mono uppercase tracking-wider text-[9px]">
                    {o.output_type}
                  </span>
                  {o._source === "supabase" && (
                    <span className="text-emerald-400 font-mono uppercase tracking-wider text-[8.5px]">
                      · sync ✓
                    </span>
                  )}
                  {o._source === "localStorage" && (
                    <span className="text-amber-300 font-mono uppercase tracking-wider text-[8.5px]">
                      · local
                    </span>
                  )}
                </div>
              </div>
              {o.storage_url && (
                <a
                  href={o.storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1 rounded text-muted-foreground hover:text-jarvis transition-colors"
                  title="Abrir archivo"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {outputs.length > 6 && (
        <button className="mt-2 text-[10px] text-jarvis hover:underline self-start">
          Ver todos ({outputs.length})
        </button>
      )}
      {localCount > 0 && supabaseCount === 0 && (
        <div className="mt-2 pt-2 border-t border-border/40 text-[9px] text-muted-foreground/70 leading-tight">
          Algunos outputs están en localStorage (puente). Se migrarán a Supabase
          automáticamente cuando guardes el próximo output en un caso real.
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return "ahora mismo";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `hace ${diffHr}h`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 7) return `hace ${diffDay}d`;
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}
