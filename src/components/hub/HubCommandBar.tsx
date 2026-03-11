import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Command, Users, FolderOpen, FileText, Scale,
  Calculator, FileSearch, ClipboardList, Briefcase, X
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "client" | "case" | "form" | "tool";
  title: string;
  subtitle?: string;
  route: string;
}

const TOOLS: SearchResult[] = [
  { id: "t-case", type: "tool", title: "Case Engine", subtitle: "Gestión de casos", route: "/dashboard/workspace-demo" },
  { id: "t-evidence", type: "tool", title: "Evidence Tool", subtitle: "Recopilación de evidencia", route: "/dashboard/evidence" },
  { id: "t-uscis", type: "tool", title: "USCIS Analyzer", subtitle: "Auditoría de documentos", route: "/dashboard/uscis-analyzer" },
  { id: "t-forms", type: "tool", title: "Smart Forms", subtitle: "Formularios inteligentes", route: "/dashboard/smart-forms" },
  { id: "t-cspa", type: "tool", title: "CSPA Calculator", subtitle: "Calculadora de edad", route: "/dashboard/cspa" },
  { id: "t-vawa", type: "tool", title: "VAWA Screener", subtitle: "Evaluación de elegibilidad", route: "/dashboard/vawa-screener" },
  { id: "t-affidavit", type: "tool", title: "Affidavit Builder", subtitle: "Generador de declaraciones", route: "/dashboard/affidavit" },
  { id: "t-checklist", type: "tool", title: "Checklist Generator", subtitle: "Listas de verificación", route: "/dashboard/checklist" },
];

const TYPE_ICON: Record<string, any> = {
  client: Users,
  case: FolderOpen,
  form: FileText,
  tool: Briefcase,
};

const TYPE_COLORS: Record<string, string> = {
  client: "text-jarvis",
  case: "text-emerald-400",
  form: "text-accent",
  tool: "text-purple-400",
};

export default function HubCommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Cmd+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults(TOOLS);
      setSelectedIdx(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim().toLowerCase();
    if (!q) { setResults(TOOLS); setSelectedIdx(0); return; }

    // Filter tools
    const toolResults = TOOLS.filter(t =>
      t.title.toLowerCase().includes(q) || t.subtitle?.toLowerCase().includes(q)
    );

    // Search DB
    const search = async () => {
      const dbResults: SearchResult[] = [...toolResults];

      const [clientsRes, casesRes] = await Promise.all([
        supabase.from("client_profiles").select("id, first_name, last_name, email").ilike("first_name", `%${q}%`).limit(4),
        supabase.from("client_cases").select("id, client_name, case_type").ilike("client_name", `%${q}%`).limit(4),
      ]);

      clientsRes.data?.forEach(c => dbResults.push({
        id: `c-${c.id}`, type: "client",
        title: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre",
        subtitle: c.email || undefined,
        route: "/dashboard/workspace-demo",
      }));

      casesRes.data?.forEach(c => dbResults.push({
        id: `case-${c.id}`, type: "case",
        title: c.client_name,
        subtitle: c.case_type,
        route: "/dashboard/workspace-demo",
      }));

      setResults(dbResults);
      setSelectedIdx(0);
    };

    const timeout = setTimeout(search, 200);
    return () => clearTimeout(timeout);
  }, [query, open]);

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
  }

  return (
    <>
      {/* Trigger button */}
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
              transition={{ duration: 0.2 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[101]"
            >
              <div className="rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                  <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar clientes, casos o herramientas..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <button onClick={() => setOpen(false)} className="text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto py-1">
                  {results.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground/40 py-8">Sin resultados</p>
                  )}
                  {results.map((r, i) => {
                    const Icon = TYPE_ICON[r.type] || Briefcase;
                    const color = TYPE_COLORS[r.type] || "text-muted-foreground";
                    return (
                      <button
                        key={r.id}
                        onClick={() => go(r)}
                        onMouseEnter={() => setSelectedIdx(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          i === selectedIdx ? "bg-jarvis/8" : "hover:bg-card/80"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{r.title}</p>
                          {r.subtitle && <p className="text-[11px] text-muted-foreground/50 truncate">{r.subtitle}</p>}
                        </div>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/30 shrink-0">{r.type}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Footer hint */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/20 bg-background/30">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/30">
                    <span>↑↓ navegar</span>
                    <span>↵ abrir</span>
                    <span>esc cerrar</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
