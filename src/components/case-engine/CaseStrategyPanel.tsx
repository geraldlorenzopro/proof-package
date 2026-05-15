/**
 * CaseStrategyPanel — Tab "Estrategia" del Case Engine (Ola 4.3.a)
 *
 * Implementa el plano §15.1 L626-635: Strategic Packs deben vivir como tab
 * `?tab=strategy` del Case Engine, NO como rutas paralelas.
 *
 * Estado actual (Ola 4.3.a — ADDITIVE):
 *   - El panel detecta `case_type` y muestra cards de los 7 docs del pack
 *     correspondiente (I-130 / I-485 / I-765).
 *   - Click en card → navega a la ruta existente (`/hub/cases/:caseId/i130-pack/01-cuestionario`)
 *   - Las rutas paralelas siguen activas en paralelo para no romper bookmarks.
 *
 * Próximo (Ola 4.3.b):
 *   - Extraer contenido de cada Doc0X (sin HubLayout/PackChrome) como
 *     componente embebible.
 *   - Sub-router interno: `?tab=strategy&doc=01-cuestionario` monta el
 *     contenido inline en lugar de navigate.
 *   - Eliminar las 24 rutas paralelas con redirects.
 *
 * Tracking:
 *   - page.view captura `?tab=strategy` automáticamente vía useTrackPageView
 *     (Ola 3.2.a) — H4 fix de audit ronda 2 incluyó location.search en deps.
 *   - Click en doc card dispara `case.strategy_doc_opened` con doc slug.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Sparkles, AlertCircle, CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────

interface DocCard {
  num: string;
  slug: string;
  titleEs: string;
  titleEn: string;
  subtitle: string;
}

interface PackConfig {
  workspaceSlug: string; // "i130-pack" | "i485-pack" | "i765-pack"
  label: string;         // "I-130 Petition" | "I-485 Adjustment" | "I-765 EAD"
  docs: DocCard[];
}

// ─── Catalog de packs ─────────────────────────────────────────────
//
// Single source of truth para mapeo case_type → pack. Cuando se agreguen
// N-400 / DS-260 / I-751 packs en el futuro, solo agregar entry acá.

const PACKS: Record<string, PackConfig> = {
  "i130": {
    workspaceSlug: "i130-pack",
    label: "I-130 Petition for Alien Relative",
    docs: [
      { num: "01", slug: "01-cuestionario", titleEs: "Cuestionario Cliente", titleEn: "Client Questionnaire", subtitle: "35 preguntas · 90% del caso · 12-15 min cliente" },
      { num: "02", slug: "02-guia-entrevista", titleEs: "Guía Estratégica", titleEn: "Strategy Guide", subtitle: "Decision tree + fork por categoría" },
      { num: "03", slug: "03-evidence-checklist", titleEs: "Checklist Evidencia", titleEn: "Evidence Checklist", subtitle: "Lista personalizada por tipo de relación" },
      { num: "04", slug: "04-packet-preparation", titleEs: "Packet Pre-flight", titleEn: "Packet Builder", subtitle: "Cover letter + exhibits + orden USCIS" },
      { num: "05", slug: "05-bona-fide-builder", titleEs: "Bona Fide Builder", titleEn: "Bona Fide Evidence", subtitle: "Evidencia de matrimonio genuino" },
      { num: "06", slug: "06-i864-support", titleEs: "I-864 Preparatorio", titleEn: "I-864 Affidavit Prep", subtitle: "Soporte financiero (cuando aplique)" },
      { num: "07", slug: "07-interview-prep", titleEs: "Prep Entrevista", titleEn: "Interview Prep", subtitle: "Mock interview + red flags" },
    ],
  },
  "i485": {
    workspaceSlug: "i485-pack",
    label: "I-485 Adjustment of Status",
    docs: [
      { num: "01", slug: "01-eligibility", titleEs: "Screener de Elegibilidad", titleEn: "Eligibility Screener", subtitle: "Categoría + base + inadmisibilidad" },
      { num: "02", slug: "02-guia-entrevista", titleEs: "Guía Estratégica", titleEn: "Strategy Guide", subtitle: "Decision tree por categoría" },
      { num: "03", slug: "03-evidence-checklist", titleEs: "Checklist Evidencia", titleEn: "Evidence Checklist", subtitle: "Por base de elegibilidad" },
      { num: "04", slug: "04-packet-preparation", titleEs: "Packet Pre-flight", titleEn: "Packet Builder", subtitle: "Cover letter + I-693 + exhibits" },
      { num: "05", slug: "05-inadmissibility-screener", titleEs: "Inadmisibilidad", titleEn: "Inadmissibility Screener", subtitle: "212(a) grounds + waivers" },
      { num: "06", slug: "06-i693-medical", titleEs: "I-693 Médico", titleEn: "I-693 Medical Exam", subtitle: "Civil surgeon + sealed envelope" },
      { num: "07", slug: "07-interview-prep", titleEs: "Prep Entrevista", titleEn: "Interview Prep", subtitle: "Stokes interview readiness" },
    ],
  },
  "i765": {
    workspaceSlug: "i765-pack",
    label: "I-765 Employment Authorization",
    docs: [
      { num: "01", slug: "01-category", titleEs: "Categoría EAD", titleEn: "EAD Category", subtitle: "c8 / c9 / c14 / c33 selector" },
      { num: "02", slug: "02-documents", titleEs: "Documentos Required", titleEn: "Required Documents", subtitle: "Por categoría EAD seleccionada" },
      { num: "03", slug: "03-photo", titleEs: "Fotos Pasaporte", titleEn: "Passport Photos", subtitle: "2x2 specs + USCIS-compliant" },
      { num: "04", slug: "04-fee-waiver", titleEs: "Fee Waiver", titleEn: "Fee Waiver", subtitle: "I-912 si aplica (poverty guidelines)" },
      { num: "05", slug: "05-combo-card", titleEs: "Combo Card AP", titleEn: "Combo Card AP", subtitle: "I-131 advance parole bundling" },
      { num: "06", slug: "06-packet", titleEs: "Packet Pre-flight", titleEn: "Packet Builder", subtitle: "Bundle + cover letter" },
      { num: "07", slug: "07-status", titleEs: "Tracking Status", titleEn: "Status Tracking", subtitle: "USCIS receipt + biometrics + decision" },
    ],
  },
};

// ─── Normalización de case_type ──────────────────────────────────
//
// case_type viene como "I-130", "I130", "i130", "I-130 Cónyuge", etc.
// Normalizamos a "i130" / "i485" / "i765" para lookup.

function normalizeCaseType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/[-\s]/g, "");
  if (lower.startsWith("i130")) return "i130";
  if (lower.startsWith("i485")) return "i485";
  if (lower.startsWith("i765")) return "i765";
  return null;
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  caseId: string;
  caseType: string | null | undefined;
  /** Lenguaje preferido del paralegal — default 'es'. */
  lang?: "es" | "en";
}

// ─── Componente ──────────────────────────────────────────────────

export default function CaseStrategyPanel({ caseId, caseType, lang = "es" }: Props) {
  const navigate = useNavigate();
  const packKey = normalizeCaseType(caseType);
  const pack = packKey ? PACKS[packKey] : null;

  // Sprint C light: leer estado de progreso del pack para mostrar status
  // por doc (done/pending/blocked). Por ahora: detectar localStorage del
  // pack-state que useCasePack persiste. Cuando se migre a Supabase (PENDING
  // migration case_pack_state.sql), leer de ahí.
  const [packState, setPackState] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!packKey) return;
    try {
      const raw = localStorage.getItem(`ner.${packKey}-pack.${caseId}`);
      if (raw) setPackState(JSON.parse(raw));
    } catch {
      // localStorage no disponible o JSON corrupto
    }
  }, [packKey, caseId]);

  function getDocStatus(docSlug: string): "done" | "in_progress" | "pending" {
    if (!packState) return "pending";
    const docKey = docSlug.split("-").slice(1).join("_"); // "01-cuestionario" → "cuestionario"
    const docState = packState[docKey] || packState[docSlug];
    if (!docState) return "pending";
    if (typeof docState === "object") {
      // Heuristic: if any field has value, considered started
      const hasContent = Object.values(docState).some((v) => v && v !== "");
      return hasContent ? "in_progress" : "pending";
    }
    return docState === "done" ? "done" : "in_progress";
  }

  function handleOpenDoc(doc: DocCard) {
    void trackEvent("case.strategy_doc_opened", {
      caseId,
      properties: {
        pack: packKey,
        doc_slug: doc.slug,
        doc_num: doc.num,
      },
    });
    // Ola 4.3.a — navegamos a la ruta existing.
    // Ola 4.3.b extraerá el contenido inline y eliminará este navigate.
    navigate(`/hub/cases/${caseId}/${pack!.workspaceSlug}/${doc.slug}`);
  }

  function handleOpenWorkspace() {
    void trackEvent("case.strategy_workspace_opened", {
      caseId,
      properties: { pack: packKey },
    });
    navigate(`/hub/cases/${caseId}/${pack!.workspaceSlug}`);
  }

  // ─── Sin pack para este case_type ───
  if (!pack) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
        <h3 className="text-base font-semibold mb-1">Estrategia no disponible</h3>
        <p className="text-sm text-muted-foreground">
          Strategic Pack aún no implementado para case_type ={" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{caseType || "—"}</code>.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Packs disponibles: I-130, I-485, I-765 ·{" "}
          <span className="text-foreground/60">N-400, DS-260, I-751 (roadmap)</span>
        </p>
      </div>
    );
  }

  // ─── Pack disponible — mostrar docs ───
  return (
    <div className="space-y-4">
      {/* Header del pack */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold">{pack.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pack.docs.length} documentos estratégicos · workflow del paralegal
          </p>
        </div>
        <button
          onClick={handleOpenWorkspace}
          className="text-xs font-medium px-3 py-1.5 border border-border rounded-md hover:bg-accent/50 transition-colors flex-shrink-0"
        >
          Ver workspace completo
        </button>
      </div>

      {/* Sprint C light: removed "vista preliminar" banner — esto YA es el panel
          canonical. Refactor inline de los Doc0X queda como deuda explícita en
          GAP-ANALYSIS-2026-05-15.md #3 (Ola 4.3.b). El panel sirve hoy como
          entry point del workflow del pack. */}

      {/* Lista de docs con status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pack.docs.map((doc) => {
          const status = getDocStatus(doc.slug);
          const StatusIcon =
            status === "done" ? CheckCircle2 :
            status === "in_progress" ? Clock :
            Circle;
          const statusColor =
            status === "done" ? "text-emerald-500" :
            status === "in_progress" ? "text-amber-500" :
            "text-muted-foreground/40";
          const statusLabel =
            status === "done" ? "Completo" :
            status === "in_progress" ? "En progreso" :
            "Pendiente";

          return (
            <button
              key={doc.slug}
              onClick={() => handleOpenDoc(doc)}
              className={cn(
                "bg-card border border-border rounded-xl p-4 text-left",
                "transition-all hover:shadow-md hover:border-primary/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "flex items-start gap-3"
              )}
            >
              <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary tabular-nums">{doc.num}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {lang === "es" ? doc.titleEs : doc.titleEn}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{doc.subtitle}</p>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={cn("w-3 h-3", statusColor)} />
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider", statusColor)}>
                    {statusLabel}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
            </button>
          );
        })}
      </div>

      {/* Sprint C light: deuda explícita 4.3.b documentada al final del panel */}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-1">
          ¿Por qué los docs se abren en otra página?
        </summary>
        <p className="mt-2 text-muted-foreground leading-relaxed px-2">
          En esta versión, cada documento del Strategic Pack abre su propia página
          (las rutas <code className="text-[10px] bg-muted px-1 rounded">/hub/cases/:id/{pack.workspaceSlug}/...</code>).
          La transformación inline (todo dentro de este tab) está pendiente en{" "}
          <a href="/GAP-ANALYSIS-2026-05-15.md" className="text-primary hover:underline">
            Ola 4.3.b
          </a>{" "}
          — requiere refactor de 21 componentes para poder embebernos sin doble
          layout. Mientras tanto, este tab funciona como navegador del workflow
          completo del pack.
        </p>
      </details>
    </div>
  );
}
