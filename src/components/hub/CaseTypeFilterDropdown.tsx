/**
 * CaseTypeFilterDropdown — Filtro independiente por case_type.
 *
 * v1 2026-06-05 — propuesta convergida Round 3 (Valerie + Vanessa +
 * Marcus + Victoria audit):
 *
 *   - Dropdown único (no strip horizontal de chips).
 *   - Recents pinned arriba (top 3 usados por user en localStorage
 *     namespaced por account_id — anti-leak cross-account de Victoria).
 *   - Search alfabético sobre el resto.
 *   - Counts inline `I-130 (47)`.
 *   - Search vive en estado LOCAL — NO sube a parent en keystroke
 *     (Victoria BLOCKER #2: evita re-correr groupCases por keystroke).
 *   - onChange emite solo cuando el user hace click en una opción.
 *
 * Estado:
 *   - `selectedKey` (string | null): tipo activo o null = todos.
 *   - `recents` (string[]): top 3 keys más usados, persistido en
 *     localStorage scoped por account_id.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, FileType } from "lucide-react";
import { getCaseTypeByKey } from "@/lib/caseTypes";
import { useCloseOnScroll } from "@/hooks/useCloseOnScroll";

interface TypeOption {
  key: string;
  label: string;
  count: number;
}

interface Props {
  /** Todas las opciones disponibles: derivadas de la lista de cases. */
  options: TypeOption[];
  /** Tipo actualmente seleccionado, o null = todos. */
  selectedKey: string | null;
  onChange: (key: string | null) => void;
  /** Recents del user (top usados). Persistido por el parent (scoped). */
  recents: string[];
  /** Notifica que se debe agregar key al top de recents (max 3, unique). */
  onUseRecent: (key: string) => void;
}

export default function CaseTypeFilterDropdown({
  options, selectedKey, onChange, recents, onUseRecent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Memoize: recents son opciones top 3 que existen en options.
  const recentOptions = useMemo(() => {
    const map = new Map(options.map(o => [o.key, o]));
    return recents
      .map(k => map.get(k))
      .filter((o): o is TypeOption => !!o)
      .slice(0, 3);
  }, [options, recents]);

  const rest = useMemo(() => {
    const recentSet = new Set(recents);
    return options
      .filter(o => !recentSet.has(o.key))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [options, recents]);

  // Search local — Victoria BLOCKER #2: no sube a parent.
  const filteredRest = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rest;
    return rest.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.key.toLowerCase().includes(q)
    );
  }, [rest, query]);

  // Mismo patrón de anchor que NextActionEditor (probado).
  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      setAnchor({
        top: Math.min(r.bottom + 4, window.innerHeight - 380),
        left: Math.min(r.left, window.innerWidth - 280),
      });
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    }
    const tid = setTimeout(() => document.addEventListener("pointerdown", handle), 50);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("pointerdown", handle);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Round 9.30: cerrar en scroll (popover queda flotando sino).
  useCloseOnScroll(open, () => { setOpen(false); setQuery(""); });

  function handleSelect(key: string | null) {
    if (key !== null) onUseRecent(key);
    onChange(key);
    setOpen(false);
    setQuery("");
  }

  // Label del trigger button
  const selectedLabel = selectedKey
    ? getCaseTypeByKey(selectedKey)?.shortLabel || selectedKey
    : "Todos";

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[11px] transition-all whitespace-nowrap ${
          selectedKey
            ? "bg-ai-blue/10 border-ai-blue/40 text-blue-200"
            : "bg-white/[0.04] border-white/10 text-muted-foreground hover:bg-white/[0.06]"
        }`}
        title="Filtrar por tipo de proceso"
      >
        <FileType className="w-3.5 h-3.5" />
        <span>Tipo: {selectedLabel}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && anchor && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: anchor.top, left: anchor.left, zIndex: 9999, width: 280 }}
          className="rounded-lg border border-cyan-accent/30 bg-deep-navy/[0.97] backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          <div className="relative border-b border-white/8">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar entre ${options.length} tipos…`}
              className="w-full bg-transparent border-none pl-8 pr-3 py-2.5 text-[12px] text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-slate-500 italic">
                Sin tipos de proceso todavía
              </div>
            ) : (
              <>
                {/* Opción "Todos" siempre primera */}
                <OptionRow
                  label="Todos los tipos"
                  count={options.reduce((s, o) => s + o.count, 0)}
                  active={selectedKey === null}
                  onClick={() => handleSelect(null)}
                  italic
                />

                {/* Recents pinned (solo si no hay search activo) */}
                {!query.trim() && recentOptions.length > 0 && (
                  <>
                    <SectionLabel>Recientes</SectionLabel>
                    {recentOptions.map(o => (
                      <OptionRow
                        key={`r-${o.key}`}
                        label={o.label}
                        count={o.count}
                        active={selectedKey === o.key}
                        onClick={() => handleSelect(o.key)}
                      />
                    ))}
                  </>
                )}

                {/* Resto A-Z (filtered) */}
                {filteredRest.length > 0 ? (
                  <>
                    {!query.trim() && recentOptions.length > 0 && (
                      <SectionLabel>Todos (A-Z)</SectionLabel>
                    )}
                    {filteredRest.map(o => (
                      <OptionRow
                        key={o.key}
                        label={o.label}
                        count={o.count}
                        active={selectedKey === o.key}
                        onClick={() => handleSelect(o.key)}
                      />
                    ))}
                  </>
                ) : query.trim() && (
                  <div className="px-3 py-4 text-center text-[11px] text-slate-500 italic">
                    Sin resultados para "{query.trim()}"
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-wider text-slate-500 px-2 py-1.5 font-semibold">
      {children}
    </p>
  );
}

function OptionRow({ label, count, active, onClick, italic }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  italic?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
        active
          ? "bg-cyan-accent/15 text-cyan-accent"
          : "text-slate-200 hover:bg-white/[0.04]"
      }`}
    >
      {active ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 shrink-0" />}
      <span className={`flex-1 truncate ${italic ? "italic" : "font-medium"}`}>{label}</span>
      <span className="tabular-nums text-[10px] opacity-70">{count}</span>
    </button>
  );
}
