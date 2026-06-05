/**
 * CaseTypeInlineEdit — chip editable del case_type con buscador.
 *
 * Click chip → popover (Portal por virtualizer) con buscador arriba +
 * lista categorizada de 75+ case types. Filtra por:
 *   - Nombre del caso (label / shortLabel)
 *   - Número de formulario (I-130, DS-160, EOIR-26, etc.)
 *   - Searchterms adicionales (esposa, asilo, eb1, b1b2, etc.)
 *   - Categoría
 *
 * Optimistic update con rollback (useCaseInlineEdit) — en demo mode
 * skipea Supabase.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useCaseInlineEdit } from "@/hooks/useCaseInlineEdit";
import { useCloseOnScroll } from "@/hooks/useCloseOnScroll";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  CASE_TYPES,
  CATEGORY_LABELS,
  searchCaseTypes,
  getCaseTypeByKey,
  inferAgencyForCaseType,
  filterCaseTypesByAgency,
  AGENCY_LABELS,
  AGENCY_DESCRIPTIONS,
  type CaseTypeMeta,
  type CaseTypeCategory,
  type Agency,
} from "@/lib/caseTypes";

interface Props {
  caseId: string;
  /** key existente (CASE_TYPES.key) o el legacy string del DEMO_CASES */
  currentCaseType: string | null;
  onCaseTypeChange: (newCaseTypeKey: string) => void;
}

/**
 * Mapea legacy case_type strings (DEMO_CASES) a un CaseTypeMeta del catálogo.
 * Ejemplo: "I-130" demo → matches "i130-spouse-ir1" si nada más específico.
 */
function resolveLegacyType(legacy: string | null): CaseTypeMeta | undefined {
  if (!legacy) return undefined;
  const exact = CASE_TYPES.find(t => t.key === legacy);
  if (exact) return exact;
  // Match por formNumber inicial (ej. "I-130" → primer I-130)
  const byForm = CASE_TYPES.find(t => t.formNumber.toLowerCase() === legacy.toLowerCase());
  if (byForm) return byForm;
  // Match parcial del label
  const lower = legacy.toLowerCase();
  return CASE_TYPES.find(t =>
    t.label.toLowerCase().includes(lower) ||
    t.shortLabel.toLowerCase().includes(lower) ||
    t.searchTerms?.some(s => s.toLowerCase() === lower)
  );
}

// Persist filtro de agencia entre sesiones — paralegal de Mr Visa abre
// dropdown 80% USCIS, pre-seleccioná esa columna (sugerencia 2da opinión).
const AGENCY_FILTER_KEY = "ner_case_types_agency_filter";

const AGENCY_OPTIONS: Array<{ key: Agency | "all"; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "USCIS", label: "USCIS" },
  { key: "DOS", label: "DOS" },
  { key: "EOIR", label: "EOIR" },
  { key: "ICE", label: "ICE" },
];

export default function CaseTypeInlineEdit({ caseId, currentCaseType, onCaseTypeChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<Agency | "all">(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(AGENCY_FILTER_KEY) : null;
      if (saved && AGENCY_OPTIONS.some(o => o.key === saved)) return saved as Agency | "all";
    } catch {}
    return "all";
  });
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  // State local del case_type activo — necesario para optimistic update visible
  // sin depender de que el parent re-renderee (en demo mode el parent NO
  // re-renderea porque no hay query Supabase que dispare refetch).
  const [activeCaseType, setActiveCaseType] = useState<string | null>(currentCaseType);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { saving, edit } = useCaseInlineEdit();

  useEffect(() => { setActiveCaseType(currentCaseType); }, [currentCaseType]);

  // Persistir filtro de agencia
  useEffect(() => {
    try { localStorage.setItem(AGENCY_FILTER_KEY, agencyFilter); } catch {}
  }, [agencyFilter]);

  // Chip principal — usa el resolver para soportar legacy values
  const currentMeta = useMemo(() => {
    const direct = getCaseTypeByKey(activeCaseType);
    return direct || resolveLegacyType(activeCaseType);
  }, [activeCaseType]);

  const displayLabel = currentMeta?.shortLabel || currentCaseType || "Sin clasificar";

  // Reset search al cerrar
  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPopPos({ top: rect.bottom + 4, left: rect.left });
    // Focus al input
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [open]);

  // Round 9.30 Mr. Lorenzo screenshot: popover queda flotando en posición
  // vieja durante scroll (rect.bottom no se recalcula). Cerramos al scroll
  // — patrón Notion/Linear/Airtable.
  useCloseOnScroll(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const searchResults = useMemo(() => searchCaseTypes(search), [search]);
  const results = useMemo(
    () => filterCaseTypesByAgency(searchResults, agencyFilter),
    [searchResults, agencyFilter]
  );

  // Conteo por agencia para los badges de los chips
  const agencyCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searchResults.length };
    for (const t of searchResults) {
      // Respeta agency_override igual que filterCaseTypesByAgency
      // (fix auditoría 2026-06-03: antes usaba inferAgency directo → counts ≠ filter)
      const a = inferAgencyForCaseType(t);
      counts[a] = (counts[a] || 0) + 1;
    }
    return counts;
  }, [searchResults]);

  // Agrupar por categoría
  const grouped = useMemo(() => {
    const byCategory: Record<string, CaseTypeMeta[]> = {};
    results.forEach(t => {
      (byCategory[t.category] = byCategory[t.category] || []).push(t);
    });
    return byCategory;
  }, [results]);

  async function handleSelect(t: CaseTypeMeta) {
    setOpen(false);
    if (t.key === currentMeta?.key) return;
    const oldKey = currentMeta?.key || activeCaseType || "";
    await edit({
      caseId,
      field: "case_type",
      newValue: t.key,
      oldValue: oldKey,
      onOptimistic: (v) => {
        setActiveCaseType(v as string);
        onCaseTypeChange(v as string);
      },
      successMessage: `Tipo actualizado → ${t.formNumber} · ${t.shortLabel.split("·")[1]?.trim() || t.shortLabel}`,
    });
  }

  // Round 9.25 (4-agentes consensus — Linear/Clio/Litify pattern):
  //   Stack format en chip: form code (mono) arriba + descripción abajo.
  //   Mr. Lorenzo screenshot: "DS-82 · Renovación pasapor[t]" truncaba
  //   con ellipsis = no profesional. Solución: 2 líneas SIEMPRE para
  //   uniformidad visual (Vanessa: "no quiero unos chips 1 línea + otros
  //   2, me marea con 50 casos"). Form code es el anchor de scanning.
  const tooltipFullLabel = currentMeta?.label ?? currentCaseType ?? "Tipo no clasificado";
  const tooltipDescription = currentMeta?.description ?? (currentCaseType ? "Click para reclasificar" : "Click para asignar tipo de caso");
  // Extract description (everything after "FORM · ")
  const descriptionPart = currentMeta?.shortLabel.split("·").slice(1).join("·").trim() || currentCaseType || "Sin clasificar";
  const formNumberPart = currentMeta?.formNumber ?? "—";
  return (
    <div className="relative inline-block max-w-full">
      <Tooltip open={open ? false : undefined} delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
            disabled={saving}
            className="inline-flex flex-col items-start gap-0 px-2 py-1 rounded border bg-ai-blue/15 border-ai-blue/30 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-wait max-w-full text-left"
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-blue-200 leading-tight">
              {formNumberPart}
              <span className="text-[8px] opacity-70">▾</span>
            </span>
            <span className="text-[9px] text-blue-300/80 leading-tight truncate max-w-full mt-0.5">
              {descriptionPart}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          avoidCollisions
          collisionPadding={16}
          style={{ maxWidth: "min(280px, calc(100vw - 32px))" }}
          className="text-[11px] font-sora bg-deep-navy/95 border border-cyan-accent/30 text-slate-100 overflow-hidden"
        >
          <div className="font-semibold text-cyan-accent break-all">{tooltipFullLabel}</div>
          <div className="text-[10px] text-slate-300 mt-0.5 break-all">{tooltipDescription}</div>
        </TooltipContent>
      </Tooltip>

      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 9999, maxHeight: "min(70vh, 500px)" }}
          className="w-[420px] rounded-lg border border-cyan-accent/30 bg-deep-navy shadow-2xl shadow-black/40 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Chips de filtro por agencia */}
          <div className="p-2 border-b border-white/8 shrink-0 space-y-2 bg-deep-navy">
            <div className="flex items-center gap-1 flex-wrap">
              {AGENCY_OPTIONS.map(opt => {
                const isActive = agencyFilter === opt.key;
                const count = agencyCounts[opt.key] ?? 0;
                const description = opt.key === "all"
                  ? "Todos los tipos del catálogo"
                  : AGENCY_DESCRIPTIONS[opt.key as Agency];
                return (
                  <button
                    key={opt.key}
                    onClick={() => setAgencyFilter(opt.key)}
                    title={description}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
                      isActive
                        ? "bg-cyan-accent/15 border-cyan-accent/40 text-cyan-accent"
                        : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={`tabular-nums text-[9px] ${isActive ? "text-cyan-accent/80" : "text-slate-500"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar: I-130, esposa, F-1, asilo, B-2…"
                className="w-full h-8 pl-8 pr-2 text-[12px] bg-white/[0.04] border border-white/10 rounded focus:outline-none focus:border-cyan-accent/50 placeholder:text-slate-500 text-slate-200"
              />
            </div>
            <p className="text-[9px] text-slate-500 px-1 flex items-center justify-between">
              <span>
                {results.length} de {CASE_TYPES.length} tipos
                {agencyFilter !== "all" && (
                  <span className="text-cyan-accent/70"> · filtro: {AGENCY_LABELS[agencyFilter]}</span>
                )}
              </span>
              <span>ESC cierra</span>
            </p>
          </div>

          {/* Results list (scrollable) — Round 9.30: data attr para que
              useCloseOnScroll NO cierre cuando scrolleamos esta lista. */}
          <div className="flex-1 overflow-y-auto p-1" data-popover-internal-scroll="true">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center space-y-2">
                <p className="text-[11px] text-slate-500 italic">
                  {search.trim()
                    ? `Sin resultados para "${search}"`
                    : `Sin tipos en ${AGENCY_LABELS[agencyFilter as Agency] || "este filtro"}`}
                </p>
                {agencyFilter !== "all" && (
                  <button
                    onClick={() => setAgencyFilter("all")}
                    className="text-[10px] text-cyan-accent hover:underline"
                  >
                    Ver todas las agencias
                  </button>
                )}
              </div>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-cyan-accent/80 px-2.5 py-2 font-bold sticky -top-1 z-20 bg-deep-navy border-b border-cyan-accent/20 shadow-[0_4px_8px_-2px_rgba(11,31,58,0.95)]">
                    {CATEGORY_LABELS[cat as CaseTypeCategory] || cat}
                  </p>
                  {items.map(t => {
                    const isActive = t.key === currentMeta?.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => handleSelect(t)}
                        className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${isActive ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
                      >
                        <span className="font-mono text-[10px] bg-white/[0.06] border border-white/10 rounded px-1 py-0.5 shrink-0 text-blue-300">
                          {t.formNumber}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.shortLabel.replace(/^[A-Z0-9-]+\s·\s/, "")}</div>
                          <div className="text-[9px] text-slate-500 truncate">{t.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
