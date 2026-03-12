import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, FolderOpen, FileText, Scale,
  Calculator, FileSearch, ClipboardList, Briefcase, X,
  ArrowRight, Mail, Calendar, Hash
} from "lucide-react";

// ═══ TYPES ═══
type ResultType = "client" | "case" | "form" | "tool";
type FilterTab = "all" | "client" | "case" | "tool";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  route: string;
  meta?: {
    email?: string;
    caseType?: string;
    caseCount?: number;
    status?: string;
    date?: string;
  };
}

// ═══ STATIC DATA ═══
const TOOLS: SearchResult[] = [
  { id: "t-case", type: "tool", title: "Case Engine", subtitle: "Gestión de casos y pipeline", route: "/dashboard/workspace-demo" },
  { id: "t-evidence", type: "tool", title: "Photo Organizer", subtitle: "Recopilación de evidencia", route: "/dashboard/evidence" },
  { id: "t-uscis", type: "tool", title: "USCIS Analyzer", subtitle: "Auditoría de documentos", route: "/dashboard/uscis-analyzer" },
  { id: "t-forms", type: "tool", title: "NER Smart Forms", subtitle: "Formularios inteligentes", route: "/dashboard/smart-forms" },
  { id: "t-cspa", type: "tool", title: "Calculadora CSPA", subtitle: "Calculadora de edad", route: "/dashboard/cspa" },
  { id: "t-vawa", type: "tool", title: "Agente VAWA", subtitle: "Evaluación de elegibilidad", route: "/dashboard/vawa-screener" },
  { id: "t-affidavit", type: "tool", title: "Calculadora I-864", subtitle: "Generador de declaraciones", route: "/dashboard/affidavit" },
  { id: "t-checklist", type: "tool", title: "Checklist Generator", subtitle: "Listas de verificación", route: "/dashboard/checklist" },
];

const TYPE_ICON: Record<ResultType, any> = {
  client: Users,
  case: FolderOpen,
  form: FileText,
  tool: Briefcase,
};

const TYPE_COLORS: Record<ResultType, string> = {
  client: "text-jarvis",
  case: "text-emerald-400",
  form: "text-accent",
  tool: "text-purple-400",
};

const TYPE_BG: Record<ResultType, string> = {
  client: "bg-jarvis/10",
  case: "bg-emerald-500/10",
  form: "bg-accent/10",
  tool: "bg-purple-500/10",
};

const FILTER_TABS: { key: FilterTab; label: string; icon: any }[] = [
  { key: "all", label: "Todos", icon: Search },
  { key: "client", label: "Clientes", icon: Users },
  { key: "case", label: "Casos", icon: FolderOpen },
  { key: "tool", label: "Herramientas", icon: Briefcase },
];

const FILTER_PLACEHOLDERS: Record<FilterTab, string> = {
  all: "Buscar clientes, casos o herramientas...",
  client: "Buscar por nombre, email o A-Number...",
  case: "Buscar por nombre de cliente o tipo de caso...",
  tool: "Buscar herramienta...",
};

// ═══ COMPONENT ═══
interface HubCommandBarProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  defaultFilter?: FilterTab;
}

export default function HubCommandBar({ externalOpen, onExternalOpenChange, defaultFilter }: HubCommandBarProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  };

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // ⌘K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          setOpen(true);
        }
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery("");
      setFilter(defaultFilter || "all");
      setSelectedIdx(0);
    }
  }, [open, defaultFilter]);

  // Search logic
  const performSearch = useCallback(async (q: string, f: FilterTab) => {
    const trimmed = q.trim().toLowerCase();

    // No query: show contextual defaults
    if (!trimmed) {
      if (f === "tool" || f === "all") {
        const toolResults = f === "tool" ? TOOLS : [];
        if (f === "all") {
          // Show recent clients + tools
          setLoading(true);
          const { data: recentClients } = await supabase
            .from("client_profiles")
            .select("id, first_name, last_name, email")
            .order("updated_at", { ascending: false })
            .limit(5);

          const clientResults: SearchResult[] = (recentClients || []).map(c => ({
            id: `c-${c.id}`,
            type: "client" as ResultType,
            title: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre",
            subtitle: c.email || undefined,
            route: "/dashboard/workspace-demo",
            meta: { email: c.email || undefined },
          }));

          setResults([...clientResults, ...TOOLS.slice(0, 4)]);
          setLoading(false);
          return;
        }
        setResults(toolResults);
        return;
      }

      // Client or Case filter with no query → show recent
      setLoading(true);
      if (f === "client") {
        const { data } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name, email, country_of_birth, updated_at")
          .order("updated_at", { ascending: false })
          .limit(10);

        setResults((data || []).map(c => ({
          id: `c-${c.id}`,
          type: "client",
          title: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre",
          subtitle: c.email || undefined,
          route: "/dashboard/workspace-demo",
          meta: { email: c.email || undefined },
        })));
      } else if (f === "case") {
        const { data } = await supabase
          .from("client_cases")
          .select("id, client_name, case_type, pipeline_stage, status, updated_at")
          .order("updated_at", { ascending: false })
          .limit(10);

        setResults((data || []).map(c => ({
          id: `case-${c.id}`,
          type: "case",
          title: c.client_name,
          subtitle: c.case_type,
          route: "/dashboard/workspace-demo",
          meta: { caseType: c.case_type, status: c.pipeline_stage || c.status },
        })));
      }
      setLoading(false);
      setSelectedIdx(0);
      return;
    }

    // Active search
    setLoading(true);
    const dbResults: SearchResult[] = [];

    // Tools (always fast, local)
    if (f === "all" || f === "tool") {
      TOOLS.filter(t =>
        t.title.toLowerCase().includes(trimmed) || t.subtitle?.toLowerCase().includes(trimmed)
      ).forEach(t => dbResults.push(t));
    }

    // DB searches
    const promises: Promise<void>[] = [];

    if (f === "all" || f === "client") {
      promises.push(
        supabase
          .from("client_profiles")
          .select("id, first_name, last_name, email, a_number")
          .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
          .limit(8)
          .then(({ data }) => {
            (data || []).forEach(c => dbResults.push({
              id: `c-${c.id}`,
              type: "client",
              title: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre",
              subtitle: c.email || undefined,
              route: "/dashboard/workspace-demo",
              meta: { email: c.email || undefined },
            }));
          })
      );
    }

    if (f === "all" || f === "case") {
      promises.push(
        supabase
          .from("client_cases")
          .select("id, client_name, case_type, pipeline_stage, status")
          .or(`client_name.ilike.%${trimmed}%,case_type.ilike.%${trimmed}%`)
          .limit(8)
          .then(({ data }) => {
            (data || []).forEach(c => dbResults.push({
              id: `case-${c.id}`,
              type: "case",
              title: c.client_name,
              subtitle: c.case_type,
              route: "/dashboard/workspace-demo",
              meta: { caseType: c.case_type, status: c.pipeline_stage || c.status },
            }));
          })
      );
    }

    await Promise.all(promises);

    // Sort: clients first, then cases, then tools
    const order: Record<ResultType, number> = { client: 0, case: 1, form: 2, tool: 3 };
    dbResults.sort((a, b) => order[a.type] - order[b.type]);

    setResults(dbResults);
    setSelectedIdx(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => performSearch(query, filter), 180);
    return () => clearTimeout(timeout);
  }, [query, filter, open, performSearch]);

  function go(result: SearchResult) {
    setOpen(false);
    sessionStorage.setItem("ner_hub_return", "/hub");
    sessionStorage.setItem("ner_auth_redirect", result.route);
    navigate(result.route);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) { go(results[selectedIdx]); }
    // Tab to cycle filters
    if (e.key === "Tab") {
      e.preventDefault();
      const idx = FILTER_TABS.findIndex(t => t.key === filter);
      const next = FILTER_TABS[(idx + 1) % FILTER_TABS.length];
      setFilter(next.key);
    }
  }

  // Group results by type for section headers
  const groupedResults = results.reduce<{ type: ResultType; label: string; items: SearchResult[] }[]>((acc, r) => {
    const existing = acc.find(g => g.type === r.type);
    if (existing) {
      existing.items.push(r);
    } else {
      const labels: Record<ResultType, string> = { client: "Clientes", case: "Casos", form: "Formularios", tool: "Herramientas" };
      acc.push({ type: r.type, label: labels[r.type], items: [r] });
    }
    return acc;
  }, []);

  // Flat index for keyboard nav
  const flatResults = groupedResults.flatMap(g => g.items);
  let flatIdx = 0;

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-foreground/20 bg-card hover:bg-card/90 transition-all text-muted-foreground hover:text-foreground group shadow-sm"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-xs hidden sm:inline text-foreground/80">Buscar...</span>
        <kbd className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded border border-foreground/10 bg-background/50 text-muted-foreground/60 group-hover:text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-[12%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101] px-4"
            >
              <div className="rounded-2xl border border-border/50 bg-card shadow-2xl shadow-background/50 overflow-hidden">
                
                {/* ═══ FILTER TABS ═══ */}
                <div className="flex items-center gap-0.5 px-3 pt-3 pb-0">
                  {FILTER_TABS.map(tab => {
                    const TabIcon = tab.icon;
                    const isActive = filter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                          isActive
                            ? "bg-jarvis/10 text-jarvis border border-jarvis/20"
                            : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 border border-transparent"
                        }`}
                      >
                        <TabIcon className="w-3 h-3" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* ═══ SEARCH INPUT ═══ */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Search className={`w-4 h-4 shrink-0 transition-colors ${loading ? "text-jarvis animate-pulse" : "text-muted-foreground/40"}`} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={FILTER_PLACEHOLDERS[filter]}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="h-px bg-border/20" />

                {/* ═══ RESULTS ═══ */}
                <div className="max-h-[380px] overflow-y-auto">
                  {results.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <Search className="w-8 h-8 text-muted-foreground/15" />
                      <p className="text-xs text-muted-foreground/40">
                        {query ? "Sin resultados para esta búsqueda" : "Escribe para buscar"}
                      </p>
                    </div>
                  )}

                  {groupedResults.map(group => (
                    <div key={group.type}>
                      {/* Section header */}
                      {(filter === "all" || groupedResults.length > 1) && (
                        <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                          <span className={`text-[9px] font-display font-bold tracking-[0.15em] uppercase ${TYPE_COLORS[group.type]}`}>
                            {group.label}
                          </span>
                          <span className="text-[9px] text-muted-foreground/25 font-mono">{group.items.length}</span>
                          <div className="h-px flex-1 bg-border/10" />
                        </div>
                      )}

                      {group.items.map(r => {
                        const currentFlatIdx = flatIdx++;
                        const Icon = TYPE_ICON[r.type];
                        const color = TYPE_COLORS[r.type];
                        const bg = TYPE_BG[r.type];
                        const isSelected = currentFlatIdx === selectedIdx;

                        return (
                          <button
                            key={r.id}
                            onClick={() => go(r)}
                            onMouseEnter={() => setSelectedIdx(currentFlatIdx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 group/item ${
                              isSelected ? "bg-jarvis/[0.06]" : "hover:bg-muted/20"
                            }`}
                          >
                            {/* Icon */}
                            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                              <Icon className={`w-4 h-4 ${color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {r.meta?.email && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 truncate">
                                    <Mail className="w-2.5 h-2.5" />
                                    {r.meta.email}
                                  </span>
                                )}
                                {r.meta?.caseType && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                                    <Hash className="w-2.5 h-2.5" />
                                    {r.meta.caseType}
                                  </span>
                                )}
                                {r.meta?.status && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground/40 font-mono">
                                    {r.meta.status}
                                  </span>
                                )}
                                {!r.meta?.email && !r.meta?.caseType && r.subtitle && (
                                  <span className="text-[11px] text-muted-foreground/40 truncate">{r.subtitle}</span>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all duration-150 ${
                              isSelected ? "text-jarvis/60 translate-x-0" : "text-transparent -translate-x-1"
                            }`} />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* ═══ FOOTER ═══ */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/15 bg-background/20">
                  <div className="flex items-center gap-4 text-[9px] text-muted-foreground/25 font-mono">
                    <span>↑↓ navegar</span>
                    <span>↵ abrir</span>
                    <span>tab filtrar</span>
                    <span>esc cerrar</span>
                  </div>
                  {results.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/20 font-mono">{results.length} resultados</span>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
