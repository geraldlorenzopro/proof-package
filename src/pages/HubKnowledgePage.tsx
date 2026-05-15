/**
 * HubKnowledgePage — `/hub/knowledge` Knowledge Base (Ola 5.c).
 *
 * Implementa la visión del plano: hub centralizado de recursos legales
 * (INA, 8 CFR, USCIS Policy Manual, 9 FAM) accesibles desde el Hub.
 *
 * Estado MVP (Ola 5.c):
 *   - UI completa con 3 secciones: Fuentes oficiales, Buscador, Agent Leo
 *   - Click en fuente → abre URL oficial en tab nueva (no embebido aún)
 *   - Buscador: placeholder sin backend (Ola 5.c.2 wire a edge fn search)
 *   - Agent Leo: card "coming soon" según roadmap
 *
 * Próximo (Ola 5.c.2 — fuera de scope inmediato):
 *   - Edge function `knowledge-search` con vector search sobre cargas de
 *     INA + 8 CFR + USCIS PM
 *   - Citation chips en respuestas del search (con anchor a sección)
 *   - Wire de Leo agent (camila-knowledge-leo edge fn)
 *
 * Tracking:
 *   - page.view automático via useTrackPageView
 *   - `knowledge.source_opened` click en fuente oficial
 *   - `knowledge.search_attempted` cuando se intenta search (MVP placeholder)
 */

import { useState } from "react";
import { ExternalLink, Search, BookOpen, Scale, FileText, Globe, Sparkles, ArrowRight } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { trackEvent } from "@/lib/analytics";

interface KnowledgeSource {
  slug: string;
  name: string;
  description: string;
  url: string;
  icon: typeof BookOpen;
  category: "statute" | "regulation" | "policy" | "consular" | "case_law";
  accentColor: string;
}

const SOURCES: KnowledgeSource[] = [
  {
    slug: "ina",
    name: "INA — Immigration & Nationality Act",
    description: "Ley federal base (Title 8 USC). Sustantiva, no operativa.",
    url: "https://www.uscis.gov/laws-and-policy/legislation/immigration-and-nationality-act",
    icon: Scale,
    category: "statute",
    accentColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    slug: "8cfr",
    name: "8 CFR — Code of Federal Regulations",
    description: "Reglamento operativo de USCIS, ICE, CBP, EOIR.",
    url: "https://www.ecfr.gov/current/title-8",
    icon: FileText,
    category: "regulation",
    accentColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    slug: "uscis-pm",
    name: "USCIS Policy Manual",
    description: "Guía interpretativa oficial USCIS — Volumes 1-12.",
    url: "https://www.uscis.gov/policy-manual",
    icon: BookOpen,
    category: "policy",
    accentColor: "text-primary bg-primary/10 border-primary/20",
  },
  {
    slug: "9fam",
    name: "9 FAM — Foreign Affairs Manual (Visas)",
    description: "Manual operativo de consulados US — DS-160, NIV/IV processing.",
    url: "https://fam.state.gov/Fam/FAM.aspx?ID=09FAM",
    icon: Globe,
    category: "consular",
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    slug: "aao",
    name: "USCIS AAO — Administrative Appeals Office",
    description: "Decisiones precedentes de apelaciones administrativas.",
    url: "https://www.uscis.gov/administrative-appeals/aao-decisions",
    icon: Scale,
    category: "case_law",
    accentColor: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  {
    slug: "bia",
    name: "BIA — Board of Immigration Appeals",
    description: "Decisiones precedentes de inmigración judicial (EOIR/DOJ).",
    url: "https://www.justice.gov/eoir/board-of-immigration-appeals-decisions",
    icon: Scale,
    category: "case_law",
    accentColor: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
];

export default function HubKnowledgePage() {
  useTrackPageView("hub.knowledge");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  function handleOpenSource(source: KnowledgeSource) {
    void trackEvent("knowledge.source_opened", {
      properties: {
        source_slug: source.slug,
        category: source.category,
      },
    });
    window.open(source.url, "_blank", "noopener,noreferrer");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    void trackEvent("knowledge.search_attempted", {
      properties: {
        query_length: searchQuery.length,
      },
    });
    setSearching(true);
    setTimeout(() => setSearching(false), 800);
  }

  return (
    <HubLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Base de conocimiento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acceso directo a INA, 8 CFR, USCIS Policy Manual, 9 FAM y precedentes
            administrativos. Tu fuente única de verdad legal.
          </p>
        </div>

        {/* Search bar (MVP placeholder — wire a edge fn en Ola 5.c.2) */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en INA, 8 CFR, USCIS PM... (ej. 'INA 245(i)', '9 FAM 304')"
            className="w-full pl-10 pr-24 py-3 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || searching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {/* Banner MVP */}
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Ola 5.c — vista preliminar
            </p>
            <p className="text-muted-foreground mt-0.5">
              Buscador semántico vectorial sobre INA + 8 CFR + USCIS PM viene
              en Ola 5.c.2. Por ahora click en una fuente abre la versión
              oficial en tab nueva.
            </p>
          </div>
        </div>

        {/* Fuentes oficiales */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Fuentes oficiales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SOURCES.map((source) => {
              const Icon = source.icon;
              return (
                <button
                  key={source.slug}
                  onClick={() => handleOpenSource(source)}
                  className="group flex items-start gap-3 p-4 bg-card border border-border rounded-xl text-left transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${source.accentColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <h3 className="text-sm font-semibold truncate">{source.name}</h3>
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {source.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Agent Leo placeholder */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">AI Agent Leo</h2>
          <div className="bg-card border border-dashed border-border rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-muted/40 border border-border/40 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold">Leo · Knowledge Base AI</h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Roadmap
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Hace preguntas en lenguaje natural sobre INA, 8 CFR, USCIS PM.
                  Devuelve respuestas con citations exactas (ej. "INA 245(i)(1)(B)
                  applies because..."). Citation accuracy target &gt; 99%.
                </p>
                <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Próximo en roadmap — Ola 5.c.2 wireado a edge fn
                  <code className="text-[10px] bg-muted px-1 py-0.5 rounded">camila-knowledge-leo</code>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA roadmap */}
        <div className="text-center pt-4 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            La Knowledge Base completa (con search semántico + Leo agent) está en
            roadmap. Si tenés un caso urgente y necesitás consulta legal, usá{" "}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("camila:open"))}
              className="text-primary hover:underline font-medium"
            >
              Camila chat
            </button>{" "}
            por ahora.
          </p>
        </div>
      </div>
    </HubLayout>
  );
}
