import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Table as TableIcon, ArrowUpDown, FolderTree, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
// Round 7: toast eliminado (R6 cross-view aclaración movida a /hub/tasks separado).
import HubLayout from "@/components/hub/HubLayout";
import CaseTable from "@/components/hub/CaseTable";
import QuickNoteModal from "@/components/hub/QuickNoteModal";
import QuickTaskModal from "@/components/hub/QuickTaskModal";
import CaseKanban from "@/components/hub/CaseKanban";
import CaseViewTabs from "@/components/hub/CaseViewTabs";
import CaseFiltersPopover, { type CaseFilters, EMPTY_FILTERS } from "@/components/hub/CaseFiltersPopover";
import CaseTypeFilterDropdown from "@/components/hub/CaseTypeFilterDropdown";
import CasePeekPanel from "@/components/hub/CasePeekPanel";
// Round 7: TasksByDateView ya no se importa aquí. Vive en /hub/tasks.
import { useCasePipeline, type PipelineCase } from "@/hooks/useCasePipeline";
import { useDemoMode, DEMO_CASES } from "@/hooks/useDemoData";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { useCaseViews, filterCasesByView } from "@/hooks/useCaseViews";
import { usePermissions } from "@/hooks/usePermissions";
import { groupCases, sortCases, SORT_LABELS, type GroupByKey, type SortKey } from "@/lib/caseGrouping";
import { getCaseTypeByKey } from "@/lib/caseTypes";
import { readScopedJson, writeScopedJson, migrateLegacyKeys } from "@/lib/scopedStorage";
import { logAccess } from "@/lib/auditLog";
import { cn } from "@/lib/utils";

// Round 7: Tareas movido a /hub/tasks (Marcus pattern). Pipeline solo Tabla|Kanban.
type ViewMode = "tabla" | "kanban";

const GROUP_BY_LABELS: Record<GroupByKey, string> = {
  stage:       "Etapa",
  owner:       "Owner",
  case_type:   "Tipo",
  responsible: "Responsable",
  none:        "Ninguno",
};

// Round 4 set (6 sorts, sin ambigüedad). Ver SORT_LABELS y SORT_DESCRIPTIONS
// en caseGrouping.ts para la definición de cada uno.
const SORT_OPTIONS: SortKey[] = [
  "default", "urgency_desc", "stage_age_desc", "gov_deadline_asc", "due_asc", "activity_desc", "client_asc",
];

const MAX_RECENT_TYPES = 3;

export default function HubCasesPage() {
  useTrackPageView("hub.cases");
  const navigate = useNavigate();
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const demoMode = useDemoMode();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) { setUserId("demo-u-vanessa"); return; }
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [demoMode]);

  // Migration de localStorage legacy (Victoria BLOCKER #1).
  // Una vez por mount cuando accountId resuelve.
  useEffect(() => {
    if (accountId) migrateLegacyKeys(accountId);
  }, [accountId]);

  // SOC II CC7.2 (Marcus quick win #5): logAccess al mount.
  // Audit trail de quién vio el Pipeline cuando — evidencia operativa
  // para auditor Type II ("¿quién accedió a casos el 14-mayo a las 9am?").
  useEffect(() => {
    if (!accountId || !userId) return;
    void logAccess({
      accountId, userId,
      action: "viewed", entityType: "cases_pipeline",
    });
  }, [accountId, userId]);

  const { cases, loading, error, unclassifiedCount, updateCase } = useCasePipeline(accountId, userId);

  // Permisos para $$$ por columna (Round 4 Marcus + Mr. Lorenzo):
  // solo tier 1+2 (owner/admin/attorney) ven revenue. Paralegal NO.
  // Round 4.5 (Victoria flash fix): esperamos isLoading antes de
  // decidir showRevenue, sino el Kanban del owner ve "primero $0,
  // después $ aparece" durante 1-2 render cycles.
  const { canViewVisibility, isLoading: permsLoading } = usePermissions(accountId);
  const canViewRevenue = !permsLoading && canViewVisibility("attorney_only");

  // ═══ State persistido por account_id (anti-leak Victoria fix #1) ═══
  const [view, setView] = useState<ViewMode>("tabla");
  const [groupBy, setGroupBy] = useState<GroupByKey>("stage");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [filters, setFilters] = useState<CaseFilters>(EMPTY_FILTERS);
  const [activeTypeKey, setActiveTypeKey] = useState<string | null>(null);
  const [recentTypes, setRecentTypes] = useState<string[]>([]);

  // Re-hidratar cuando accountId resuelve (depende del namespace).
  useEffect(() => {
    if (!accountId) return;
    const savedView = readScopedJson<ViewMode>("ner_cases_view", accountId, "tabla");
    // Round 7: legacy "tareas" se redirige a "tabla" (Tareas vive en /hub/tasks)
    if (savedView === "kanban" || savedView === "tabla") setView(savedView);
    else if ((savedView as string) === "tareas") setView("tabla");
    const savedGroup = readScopedJson<GroupByKey>("ner_cases_group_by", accountId, "stage");
    if ((["stage","owner","case_type","responsible","none"] as const).includes(savedGroup as GroupByKey)) {
      setGroupBy(savedGroup);
    }
    const savedSort = readScopedJson<SortKey>("ner_cases_sort_by", accountId, "default");
    if (SORT_OPTIONS.includes(savedSort)) setSortBy(savedSort);
    setFilters(readScopedJson<CaseFilters>("ner_cases_filters", accountId, EMPTY_FILTERS));
    setActiveTypeKey(readScopedJson<string | null>("ner_cases_type_filter", accountId, null));
    setRecentTypes(readScopedJson<string[]>("ner_cases_recent_types", accountId, []));
  }, [accountId]);

  // Persist (scoped)
  useEffect(() => { writeScopedJson("ner_cases_view", accountId, view); }, [view, accountId]);

  // Round 7: toast informativo R6 ELIMINADO. Tareas vive en /hub/tasks
  // ahora — no hay cross-view dentro de /hub/cases que necesite explicar.
  useEffect(() => { writeScopedJson("ner_cases_group_by", accountId, groupBy); }, [groupBy, accountId]);
  useEffect(() => { writeScopedJson("ner_cases_sort_by", accountId, sortBy); }, [sortBy, accountId]);
  useEffect(() => { writeScopedJson("ner_cases_filters", accountId, filters); }, [filters, accountId]);
  useEffect(() => { writeScopedJson("ner_cases_type_filter", accountId, activeTypeKey); }, [activeTypeKey, accountId]);
  useEffect(() => { writeScopedJson("ner_cases_recent_types", accountId, recentTypes); }, [recentTypes, accountId]);

  const [search, setSearch] = useState("");
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [peekCaseId, setPeekCaseId] = useState<string | null>(null);

  // Round 9 (Mr. Lorenzo + Valerie + Marcus): quick modals para nota
  // y tarea SIN abandonar la tabla (NO navega al expediente completo).
  const [quickNoteCase, setQuickNoteCase] = useState<PipelineCase | null>(null);
  const [quickTaskCase, setQuickTaskCase] = useState<PipelineCase | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { activeView, setActiveView } = useCaseViews();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (demoMode) {
      const map: Record<string, string> = {};
      const teamList: Array<{ user_id: string; full_name: string }> = [];
      DEMO_CASES.forEach(c => {
        if (c.assigned_to && !map[c.assigned_to]) {
          map[c.assigned_to] = c.assigned_to_name;
          teamList.push({ user_id: c.assigned_to, full_name: c.assigned_to_name });
        }
      });
      setStaffNames(map);
      setTeam(teamList);
      return;
    }
    if (!accountId) return;

    async function loadTeam() {
      const { data: mems, error: memErr } = await supabase
        .from("account_members")
        .select("user_id, role")
        .eq("account_id", accountId)
        .eq("is_active", true);
      if (memErr) { console.error("[HubCasesPage] team load error:", memErr.message); return; }
      if (!mems || mems.length === 0) { setStaffNames({}); setTeam([]); return; }

      const userIds = mems.map((m: any) => m.user_id).filter(Boolean);
      const [{ data: profiles }, { data: ghlMaps }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("ghl_user_mappings").select("mapped_user_id, ghl_user_name").in("mapped_user_id", userIds),
      ]);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      const ghlMap = new Map((ghlMaps || []).map((g: any) => [g.mapped_user_id, g.ghl_user_name]));
      const map: Record<string, string> = {};
      const teamList: Array<{ user_id: string; full_name: string }> = [];
      mems.forEach((m: any) => {
        if (!m.user_id) return;
        const name = profileMap.get(m.user_id) || ghlMap.get(m.user_id) || "Staff";
        map[m.user_id] = name;
        teamList.push({ user_id: m.user_id, full_name: name });
      });
      setStaffNames(map);
      setTeam(teamList);
    }
    loadTeam();
  }, [accountId, demoMode]);

  // Pipeline: search → view → toggle → type filter → sort → group
  // Round 4.5 (Vanessa + Victoria): search expand a phone digits-only
  // y A-number stripped del prefix "A". Vanessa: "tipeo últimos 4 del
  // teléfono, cliente llama y no me sé el nombre exacto. Apellido o
  // teléfono = primera cosa que tipeo".
  const searchFilteredCases = useMemo(() => {
    // Round 4.6 (Vanessa): accent-insensitive. Hispanos tipean "garcia"
    // (sin tilde) y esperan match a "García". Normalizamos query y campos
    // con NFD + strip diacritics antes de comparar.
    const stripAccents = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = stripAccents(search.trim());
    if (!q) return cases;
    // Normalizar input: si el usuario tipeó algo que parece número/teléfono,
    // lo comparamos digits-only contra phone/mobile_phone/a_number normalizados.
    const qDigits = q.replace(/\D/g, "");
    const qAnum = q.replace(/^a/i, "").replace(/\D/g, "");
    return cases.filter(c => {
      // Text fields (nombre, file, tipo, NVC) — accent-insensitive
      if (c.client_name && stripAccents(c.client_name).includes(q)) return true;
      if (c.file_number && stripAccents(c.file_number).includes(q)) return true;
      if (c.case_type && stripAccents(c.case_type).includes(q)) return true;
      if (c.nvc_case_number && stripAccents(c.nvc_case_number).includes(q)) return true;

      // USCIS receipt numbers (array u objeto) — accent-insensitive
      const receipts = c.uscis_receipt_numbers;
      if (Array.isArray(receipts) && receipts.some((r: any) => stripAccents(String(r)).includes(q))) return true;
      if (receipts && typeof receipts === "object") {
        if (Object.values(receipts).some((r: any) => stripAccents(String(r)).includes(q))) return true;
      }

      // Phone + A-number (Round 4.5): JOIN nested client_profiles.
      // Solo aplica si la query parece numérica (qDigits >= 3 chars)
      // o A-number-like (empieza con A + dígitos).
      const prof = c.client_profile;
      if (prof && qDigits.length >= 3) {
        const phoneDigits = (prof.phone || "").replace(/\D/g, "");
        const mobileDigits = (prof.mobile_phone || "").replace(/\D/g, "");
        if (phoneDigits && phoneDigits.includes(qDigits)) return true;
        if (mobileDigits && mobileDigits.includes(qDigits)) return true;
      }
      if (prof?.a_number && qAnum.length >= 3) {
        const aDigits = prof.a_number.replace(/^A/i, "").replace(/\D/g, "");
        if (aDigits && aDigits.includes(qAnum)) return true;
      }
      return false;
    });
  }, [cases, search]);

  const viewFilteredCases = useMemo(
    () => filterCasesByView(searchFilteredCases, activeView, userId),
    [searchFilteredCases, activeView, userId]
  );

  const toggleFilteredCases = useMemo(() => {
    let out = viewFilteredCases;
    if (filters.onlyOverdue) out = out.filter(c => (c.overdue_tasks_count ?? 0) > 0);
    if (filters.onlyWithRfe) out = out.filter(c => !!c.rfe_deadline);
    if (filters.onlyWithNextAction) out = out.filter(c => !!c.next_action);
    if (filters.onlyWithoutOwner) out = out.filter(c => !c.assigned_to);
    return out;
  }, [viewFilteredCases, filters]);

  // Filtro por case_type (independiente del groupBy)
  const typeFilteredCases = useMemo(() => {
    if (!activeTypeKey) return toggleFilteredCases;
    return toggleFilteredCases.filter(c => c.case_type === activeTypeKey);
  }, [toggleFilteredCases, activeTypeKey]);

  const sortedCases = useMemo(
    () => sortCases(typeFilteredCases, sortBy),
    [typeFilteredCases, sortBy]
  );

  // Type options para el dropdown — calculadas sobre toggleFilteredCases
  // (no sobre typeFiltered — así el dropdown muestra "I-130 (47)" aún
  // cuando ya estamos filtrando por otro tipo).
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    toggleFilteredCases.forEach(c => {
      if (!c.case_type) return;
      counts.set(c.case_type, (counts.get(c.case_type) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([key, count]) => ({
      key,
      label: getCaseTypeByKey(key)?.shortLabel || key,
      count,
    }));
  }, [toggleFilteredCases]);

  // Groups para la tabla
  const allGroups = useMemo(
    () => groupCases(sortedCases, groupBy, { staffNames }),
    [sortedCases, groupBy, staffNames]
  );

  // hideHeaders extendido (Victoria fix #4): si filtro Tipo + Agrupar=Tipo
  // produce 1 sola entry, ocultar header redundante.
  const hideHeaders = useMemo(() => {
    if (groupBy === "none") return true;
    if (activeTypeKey && groupBy === "case_type") return true;
    if (allGroups.length === 1 && allGroups[0].cases.length === sortedCases.length) {
      // Filtro produjo 1 solo grupo no-vacío — el header dice lo mismo que el filtro
      return !!activeTypeKey;
    }
    return false;
  }, [groupBy, activeTypeKey, allGroups, sortedCases.length]);

  const caseCounts = useMemo(() => ({
    "mis-casos":      filterCasesByView(searchFilteredCases, "mis-casos", userId).length,
    "urgentes":       filterCasesByView(searchFilteredCases, "urgentes", userId).length,
    "pte-accion-mia": filterCasesByView(searchFilteredCases, "pte-accion-mia", userId).length,
    "rfe-response":   0, // Round 7: tasksOnly tab. /hub/cases NO renderiza este tab (filtrado en CaseViewTabs).
    "cerrados-30d":   filterCasesByView(searchFilteredCases, "cerrados-30d", userId).length,
    "todos":          searchFilteredCases.length,
  }), [searchFilteredCases, userId]);

  // Round 7: taskCounts ELIMINADO. Tareas vive en /hub/tasks con su propio state.

  // Counts que se pasan a CaseViewTabs: tasks counts si vista=tareas,
  // case counts si tabla/kanban. Counter NUNCA miente (Marcus + Vanessa).
  const viewCounts = caseCounts;

  function handleUseRecent(key: string) {
    setRecentTypes(prev => {
      const next = [key, ...prev.filter(k => k !== key)].slice(0, MAX_RECENT_TYPES);
      return next;
    });
  }

  return (
    <HubLayout>
      {/* Edge-to-edge (Marcus + Vanessa): w-full px-6, sin max-w mx-auto */}
      <div className="w-full px-6 py-4 space-y-3">

        {/* Header + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold font-sora text-foreground">Pipeline de casos</h1>
            <p className="text-[11px] text-muted-foreground">
              Tu vista · {cases.length} casos totales
              {unclassifiedCount > 0 && (
                <span className="ml-2 text-muted-foreground/50">· {unclassifiedCount} sin clasificar</span>
              )}
            </p>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre, teléfono, # caso, A-number, recibo USCIS/NVC"
              className="h-9 pl-9 pr-16 text-[12px] bg-white/[0.04] border-white/10 focus-visible:border-cyan-accent/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/50 border border-white/10 rounded px-1 py-0.5">⌘K</span>
          </div>
        </div>

        {/* Hero pills h-12 edge-to-edge — Round 7: viewMode prop ya no
            necesario porque Tareas vive en /hub/tasks ruta propia. */}
        <CaseViewTabs
          activeView={activeView}
          onChange={setActiveView}
          counts={viewCounts}
          loading={loading}
        />

        {/* Toolbar 1 línea — strip horizontal MUERTO, dropdown único para Tipo */}
        <div className="flex items-center gap-2 flex-wrap">
          <CaseFiltersPopover value={filters} onChange={setFilters} />

          <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
            <SelectTrigger
              className={cn(
                "h-8 w-auto px-3 text-[11px] gap-1.5 border",
                sortBy === "default"
                  ? "bg-white/[0.04] border-white/10 text-muted-foreground"
                  : "bg-ai-blue/10 border-ai-blue/40 text-blue-200",
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(k => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(v: GroupByKey) => setGroupBy(v)}>
            <SelectTrigger className="h-8 w-auto px-3 text-[11px] bg-cyan-accent/10 border-cyan-accent/30 text-cyan-accent gap-1.5">
              <FolderTree className="w-3.5 h-3.5" />
              <span>Agrupar: {GROUP_BY_LABELS[groupBy]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stage">Etapa del expediente</SelectItem>
              <SelectItem value="owner">Owner (persona del equipo)</SelectItem>
              <SelectItem value="case_type">Tipo de proceso</SelectItem>
              <SelectItem value="responsible">Responsable (ball-in-court)</SelectItem>
              <SelectItem value="none">Sin agrupar</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro independiente Tipo (Round 3 — reemplaza strip horizontal) */}
          <CaseTypeFilterDropdown
            options={typeOptions}
            selectedKey={activeTypeKey}
            onChange={setActiveTypeKey}
            recents={recentTypes}
            onUseRecent={handleUseRecent}
          />

          {/* View switcher con 3 modos: Tabla / Kanban / Tareas.
              Tareas es la nueva vista Round 4 (Vanessa + Marcus):
              tasks agrupadas por fecha (Overdue / Hoy / Esta semana). */}
          <div className="ml-auto flex items-center bg-white/[0.04] border border-white/10 rounded-md p-0.5">
            <ViewButton active={view === "tabla"} onClick={() => setView("tabla")} icon={<TableIcon className="w-3.5 h-3.5" />} label="Tabla" />
            <ViewButton active={view === "kanban"} onClick={() => setView("kanban")} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
            {/* Round 7: "Tareas" sacado del switcher. Vive en /hub/tasks ruta propia. */}
          </div>
        </div>

        {search.trim() && !loading && (
          // Round 9.12: agregar click-to-clear inline (UX consistencia con
          // /hub/tasks empty state CTA "Limpiar filtros").
          <p className="text-[10px] text-muted-foreground/60 -mt-1 flex items-center gap-2">
            <span>{sortedCases.length} de {cases.length} casos coinciden con "{search.trim()}"</span>
            <button
              onClick={() => setSearch("")}
              className="text-cyan-accent hover:underline transition-colors"
              type="button"
            >
              Limpiar búsqueda
            </button>
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
        ) : error ? (
          /* Round 4.5 (Victoria fix #11): distinguir error vs no-data.
             Si la query falló (ej. schema mismatch porque la migration
             no fue aplicada todavía), mostramos error real — antes
             se veía como "BD vacía", confusión total. */
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 mx-auto flex items-center justify-center">
              <span className="text-2xl">⚠</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-200 mb-1">
                Error al cargar el pipeline
              </p>
              <p className="text-[11px] text-rose-300/70 max-w-md mx-auto break-words">
                {error}
              </p>
              <p className="text-[10px] text-muted-foreground mt-3">
                Si esto persiste contactá soporte. Probablemente falta aplicar una migration de base de datos.
              </p>
            </div>
          </div>
        ) : sortedCases.length === 0 ? (
          (() => {
            // Round 9.12 Mr. Lorenzo audit: diagnostico WHY vacío + CTA contextual
            // (mismo pattern que /hub/tasks Round 9).
            const hasFiltersActive =
              filters.onlyOverdue || filters.onlyWithRfe ||
              filters.onlyWithNextAction || filters.onlyWithoutOwner ||
              !!activeTypeKey || activeView !== "todos" || !!search.trim();
            const universeHasCases = cases.length > 0;
            const filterCausedEmpty = universeHasCases && hasFiltersActive;

            function clearAllFilters() {
              setFilters(EMPTY_FILTERS);
              setActiveTypeKey(null);
              setActiveView("todos");
              setSearch("");
            }

            return (
              <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center space-y-4">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                  filterCausedEmpty ? "bg-amber-500/15" : "bg-muted/30"
                }`}>
                  <FolderPlus className={`w-5 h-5 ${filterCausedEmpty ? "text-amber-300" : "text-muted-foreground/60"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {filterCausedEmpty
                      ? `Tenés ${cases.length} caso${cases.length === 1 ? "" : "s"}, pero ninguno calza con los filtros`
                      : search ? "Ningún caso coincide" : "No hay casos en esta vista"}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                    {filterCausedEmpty
                      ? "Probá ampliar el rango — pestaña, tipo o toggles."
                      : search ? "Probá ajustar los filtros o limpiar la búsqueda." : "Cambiá de tab o limpiá los filtros toggle."}
                  </p>
                </div>
                {filterCausedEmpty ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearAllFilters}
                    className="text-[11px] border-cyan-accent/40 text-cyan-accent hover:bg-cyan-accent/10"
                  >
                    Limpiar filtros
                  </Button>
                ) : !search && (
                  <Button size="sm" onClick={() => navigate("/hub/leads")} className="text-[11px]">
                    <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                    Crear caso desde lead
                  </Button>
                )}
              </div>
            );
          })()
        ) : view === "tabla" ? (
          <CaseTable
            groups={allGroups}
            staffNames={staffNames}
            team={team}
            activeCaseId={peekCaseId}
            onRowClick={(id) => setPeekCaseId(id)}
            onQuickNote={(c) => setQuickNoteCase(c)}
            onQuickTask={(c) => setQuickTaskCase(c)}
            onCaseChange={(id, updates) => updateCase(id, updates)}
            hideHeaders={hideHeaders}
          />
        ) : (
          <CaseKanban
            groups={allGroups}
            staffNames={staffNames}
            onCardClick={(id) => setPeekCaseId(id)}
            showRevenue={canViewRevenue}
            onQuickNote={(c) => setQuickNoteCase(c)}
            onQuickTask={(c) => setQuickTaskCase(c)}
          />
        )}
      </div>

      <CasePeekPanel
        c={peekCaseId ? sortedCases.find(c => c.id === peekCaseId) || null : null}
        ownerName={peekCaseId ? staffNames[sortedCases.find(c => c.id === peekCaseId)?.assigned_to || ""] || null : null}
        onClose={() => setPeekCaseId(null)}
        onOpenCase={() => { if (peekCaseId) navigate(`/case-engine/${peekCaseId}`); }}
        onNextActionChange={(id, next) => updateCase(id, { next_action: next })}
      />

      {/* Round 9 quick modals (Mr. Lorenzo + Valerie + Marcus consensus):
          click 📝 nota o ✅ tarea → modal pequeño SIN abandonar tabla.
          NO navega a /case-engine. */}
      <QuickNoteModal
        open={!!quickNoteCase}
        onOpenChange={(o) => !o && setQuickNoteCase(null)}
        prefilledCase={quickNoteCase ? {
          id: quickNoteCase.id,
          client_name: quickNoteCase.client_name,
          case_type: quickNoteCase.case_type,
        } : null}
      />
      <QuickTaskModal
        open={!!quickTaskCase}
        onOpenChange={(o) => !o && setQuickTaskCase(null)}
        prefilledCase={quickTaskCase ? {
          id: quickTaskCase.id,
          client_name: quickTaskCase.client_name,
          case_type: quickTaskCase.case_type,
        } : null}
      />
    </HubLayout>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      )}
      title={`Vista ${label}`}
    >
      {icon}
      {label}
    </button>
  );
}
