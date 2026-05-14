import { useEffect, useRef, useState } from "react";
import {
  Wrench,
  ChevronDown,
  Camera,
  FileSearch,
  Calculator,
  BarChart3,
  ListChecks,
  Globe,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PackType } from "@/components/questionnaire-packs/shared/types";

/**
 * Dropdown que vive en el workspace de cada pack. Lista todos los tools
 * NER existentes con link directo + ?case_id=X + ?pack=i130 para que el
 * tool pueda renderizar el CaseToolBanner y volver al caso.
 *
 * IMPORTANTE — additive: estos tools también están accesibles desde
 * `/features` standalone para las firmas que ya los usan así. El menú
 * acá es un atajo desde el case engine, no reemplaza el catálogo.
 */
interface ToolDef {
  slug: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Wrench;
  status?: "live" | "beta";
}

const TOOLS: ToolDef[] = [
  {
    slug: "evidence",
    label: "Photo Evidence Organizer",
    description: "Armá paquete de fotos cronológico + PDF organizado",
    href: "/tools/evidence",
    icon: Camera,
    status: "live",
  },
  {
    slug: "uscis-analyzer",
    label: "USCIS Document Analyzer",
    description: "Analizá RFE / NOID / NOIR / NOTT con AI",
    href: "/tools/uscis-analyzer",
    icon: FileSearch,
    status: "live",
  },
  {
    slug: "affidavit",
    label: "Affidavit Calculator (I-864)",
    description: "Calculadora 125% poverty completa (military + AK/HI + assets)",
    href: "/tools/affidavit",
    icon: Calculator,
    status: "live",
  },
  {
    slug: "cspa",
    label: "CSPA Calculator",
    description: "Edad CSPA con Visa Bulletin tiempo real",
    href: "/tools/cspa",
    icon: BarChart3,
    status: "live",
  },
  {
    slug: "checklist",
    label: "Checklist Generator",
    description: "Genera checklist contextual con AI",
    href: "/dashboard/checklist",
    icon: ListChecks,
    status: "live",
  },
  {
    slug: "visa-evaluator",
    label: "Visa Evaluator",
    description: "Evalúa elegibilidad para visa con AI",
    href: "/dashboard/visa-evaluator",
    icon: Globe,
    status: "live",
  },
  {
    slug: "interview-sim",
    label: "Interview Simulator",
    description: "Practicá la entrevista USCIS con AI",
    href: "/dashboard/interview-sim",
    icon: MessageSquare,
    status: "live",
  },
];

interface Props {
  caseId: string;
  packType: PackType;
  petitioner?: string;
  beneficiary?: string;
}

export default function CaseToolsMenu({ caseId, packType, petitioner, beneficiary }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function buildHref(tool: ToolDef): string {
    const sep = tool.href.includes("?") ? "&" : "?";
    let url = `${tool.href}${sep}case_id=${encodeURIComponent(caseId)}&pack=${packType}&source=workspace`;
    if (petitioner) url += `&petitioner=${encodeURIComponent(petitioner)}`;
    if (beneficiary) url += `&beneficiary=${encodeURIComponent(beneficiary)}`;
    return url;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-colors",
          open
            ? "bg-jarvis/15 border-jarvis/40 text-jarvis"
            : "bg-card border-border text-foreground hover:border-jarvis/40",
        )}
      >
        <Wrench className="w-3.5 h-3.5" />
        Tools del caso
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-[340px] rounded-lg border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              Tools NER (abren con contexto del caso)
            </div>
          </div>
          <ul className="max-h-[400px] overflow-y-auto">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.slug}>
                  <a
                    href={buildHref(tool)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0"
                    onClick={() => setOpen(false)}
                  >
                    <div className="w-7 h-7 rounded-md bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-jarvis" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-foreground truncate">
                          {tool.label}
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {tool.description}
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground leading-tight">
            Los tools también están disponibles standalone en{" "}
            <code className="font-mono">/features</code>
          </div>
        </div>
      )}
    </div>
  );
}
