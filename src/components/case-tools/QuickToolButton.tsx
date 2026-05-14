import { ExternalLink, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PackType } from "@/components/questionnaire-packs/shared/types";

interface Props {
  caseId: string;
  packType: PackType;
  toolPath: string; // ej "/tools/uscis-analyzer"
  icon: LucideIcon;
  label: string;
  tone?: "default" | "amber" | "rose";
  source?: string; // ej "alerts", "packet-card", "bona-fide-card"
}

/**
 * Botón compacto que abre un tool NER con contexto del caso.
 * Visualmente diferenciado del primary action de la card para no confundir.
 * Siempre abre en nueva tab — paralegal puede ir y venir.
 */
export default function QuickToolButton({
  caseId,
  packType,
  toolPath,
  icon: Icon,
  label,
  tone = "default",
  source = "workspace",
}: Props) {
  const sep = toolPath.includes("?") ? "&" : "?";
  const href = `${toolPath}${sep}case_id=${encodeURIComponent(caseId)}&pack=${packType}&source=${source}`;

  const toneCls =
    tone === "amber"
      ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
      : tone === "rose"
        ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
        : "bg-card border-border text-foreground hover:border-jarvis/40";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10.5px] font-semibold transition-colors",
        toneCls,
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </a>
  );
}
