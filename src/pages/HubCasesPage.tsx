import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Table as TableIcon, ArrowUpDown, FolderTree, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import HubLayout from "@/components/hub/HubLayout";
import CaseTable from "@/components/hub/CaseTable";
import CaseKanban from "@/components/hub/CaseKanban";
import CaseViewTabs from "@/components/hub/CaseViewTabs";
import CaseFiltersPopover, { type CaseFilters, EMPTY_FILTERS } from "@/components/hub/CaseFiltersPopover";
import CaseGroupStrip from "@/components/hub/CaseGroupStrip";
import CasePeekPanel from "@/components/hub/CasePeekPanel";
// KPI strip removido 2026-06-05 (consenso Valerie + Vanessa):
// duplicaba 100% lo que ya hacen los tabs. Fusionados en CaseViewTabs
// Linear-style con número grande inline.
import { useCasePipeline } from "@/hooks/useCasePipeline";
import { useDemoMode, DEMO_CASES } from "@/hooks/useDemoData";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { useCaseViews, filterCasesByView } from "@/hooks/useCaseViews";
import { groupCases, sortCases, SORT_LABELS, type GroupByKey, type SortKey } from "@/lib/caseGrouping";
import { cn } from "@/lib/utils";

type ViewMode = "tabla" | "kanban";

const GROUP_BY_LABELS: Record<GroupByKey, string> = {
  stage:       "Etapa",
  owner:       "Owner",
  case_type:   "Tipo",
  responsible: "Responsable",
  none:        "Ninguno",
};

const SORT_OPTIONS: SortKey[] = [
  "default", "alerts_desc", "due_asc", "client_asc", "client_desc", "updated_desc", "updated_asc", "due_desc",
];

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

  // userId resolution PRIMERO (lo necesita useCasePipeline para my_pending_tasks_count)
  useEffect(() => {
    if (demoMode) {
      setUserId("demo-u-vanessa");
      return;
    }
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [demoMode]);

  const { cases, loading, unclassifiedCount, updateCase } = useCasePipeline(accountId, userId);

  const [view, setView] = useState<ViewMode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ner_cases_view") : null;
    return saved === "kanban" ? "kanban" : "tabla";
  });
  const [groupBy, setGroupBy] = useState<GroupByKey>(() => {
    if (typeof window === "undefined") return "stage";
    const saved = localStorage.getItem("ner_cases_group_by");
    if (saved && (["stage","owner","case_type","responsible","none"] as const).includes(saved as GroupByKey)) {
      return saved as GroupByKey;
    }
    return "stage";
  });
  useEffect(() => {
    try { localStorage.setItem("ner_cases_group_by", groupBy); } catch {}
  }, [groupBy]);
  const [sortBy, setSortBy] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "default";
    const saved = localStorage.getItem("ner_cases_sort_by");
    if (saved && SORT_OPTIONS.includes(saved as SortKey)) return saved as SortKey;
    return "default";
  });
  useEffect(() => {
    try { localStorage.setItem("ner_cases_sort_by", sortBy); } catch {}
  }, [sortBy]);

  // Drill-down del strip: filtra a un solo grupo. null = todos.
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  // Reset drill-down si cambia el agrupador (los keys cambian de dominio)
  useEffect(() => { setActiveGroupKey(null); }, [groupBy]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CaseFilters>(() => {
    if (typeof window === "undefined") return EMPTY_FILTERS;
    try {
      const saved = localStorage.getItem("ner_cases_filters");
      if (saved) return { ...EMPTY_FILTERS, ...JSON.parse(saved) };
    } catch {}
    return EMPTY_FILTERS;
  });
  useEffect(() => {
    try { localStorage.setItem("ner_cases_filters", JSON.stringify(filters)); } catch {}
  }, [filters]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [peekCaseId, setPeekCaseId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { activeView, setActiveView } = useCaseViews();

  // ⌘K shortcut → focus search input.
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

      if (memErr) {
        console.error("[HubCasesPage] team load error:", memErr.message);
        return;
      }

      if (!mems || mems.length === 0) {
        setStaffNames({});
        setTeam([]);
        return;
      }

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

  function changeView(next: ViewMode) {
    setView(next);
    try { localStorage.setItem("ner_cases_view", next); } catch {}
  }

  // Pipeline ▶ Search ▶ View ▶ Filtros toggle ▶ Sort ▶ Group
  const searchFilteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter(c => {
      if (!q) return true;
      if (c.client_name?.toLowerCase().includes(q)) return true;
      if (c.file_number?.toLowerCase().includes(q)) return true;
      if (c.case_type?.toLowerCase().includes(q)) return true;
      if (c.nvc_case_number?.toLowerCase().includes(q)) return true;
      const receipts = c.uscis_receipt_numbers;
      if (Array.isArray(receipts) && receipts.some((r: any) => String(r).toLowerCase().includes(q))) return true;
      if (receipts && typeof receipts === "object") {
        if (Object.values(receipts).some((r: any) => String(r).toLowerCase().includes(q))) return true;
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

  const sortedCases = useMemo(
    () => sortCases(toggleFilteredCases, sortBy),
    [toggleFilteredCases, sortBy]
  );

  // Groups completos (para el strip — necesita ver todos los grupos con counts).
  const allGroups = useMemo(
    () => groupCases(sortedCases, groupBy, { staffNames }),
    [sortedCases, groupBy, staffNames]
  );

  // Groups visibles en la tabla — si hay drill-down activo, solo ese.
  const visibleGroups = useMemo(() => {
    if (!activeGroupKey) return allGroups;
    return allGroups.filter(g => g.key === activeGroupKey);
  }, [allGroups, activeGroupKey]);

  // Counts por vista (para badges en tabs) — antes de aplicar toggle filters
  const viewCounts = useMemo(() => ({
    "mis-casos":      filterCasesByView(searchFilteredCases, "mis-casos", userId).length,
    "urgentes":       filterCasesByView(searchFilteredCases, "urgentes", userId).length,
    "pte-accion-mia": filterCasesByView(searchFilteredCases, "pte-accion-mia", userId).length,
    "cerrados-30d":   filterCasesByView(searchFilteredCases, "cerrados-30d", userId).length,
    "todos":          searchFilteredCases.length,
  }), [searchFilteredCases, userId]);

  return (
    <HubLayout>
      <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-3">

        {/* ═══ Header + Search global ═══ */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold font-sora text-foreground">Pipeline de casos</h1>
            <p className="text-[11px] text-muted-foreground">
              Tu vista · {cases.length} casos totales
              {unclassifiedCount > 0 && (
                <span className="ml-2 text-muted-foreground/50">
                  · {unclassifiedCount} sin clasificar
                </span>
              )}
            </p>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, A-number, receipt USCIS/NVC…"
              className="h-9 pl-9 pr-16 text-[12px] bg-white/[0.04] border-white/10 focus-visible:border-cyan-accent/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/50 border border-white/10 rounded px-1 py-0.5">⌘K</span>
          </div>
        </div>

        {/* ═══ Vista activa — pills Linear-style con número grande ═══
            Reemplaza la doble fila KPI + Tabs anterior. Single source
            of truth para filtrar la vista. */}
        <CaseViewTabs
          activeView={activeView}
          onChange={setActiveView}
          counts={viewCounts}
          loading={loading}
        />

        {/* ═══ Group Strip horizontal (chips uno al lado del otro) ═══
            Reemplaza visualmente los headers verticales que decía Mr. Lorenzo
            que eran ruido. Click chip → drill-down a un solo grupo. */}
        <CaseGroupStrip
          groupBy={groupBy}
          groups={allGroups}
          activeKey={activeGroupKey}
          onSelect={setActiveGroupKey}
          totalCount={sortedCases.length}
        />

        {/* ═══ Toolbar ═══ */}
        <div className="flex items-center gap-2 flex-wrap">
          <CaseFiltersPopover value={filters} onChange={setFilters} />

          {/* Ordenar funcional 2026-06-05 (antes badge PRONTO). */}
          <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
            <SelectTrigger
              className={cn(
                "h-8 w-auto px-3 text-[11px] gap-1.5 border",
                sortBy === "default"
                  ? "bg-white/[0.04] border-white/10 text-muted-foreground"
                  : "bg-ai-blue/10 border-ai-blue/30 text-blue-200",
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

          {/* Agrupar — ahora con 4 dimensiones REALES (no UI muerta). */}
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

          <div className="ml-auto flex items-center bg-white/[0.04] border border-white/10 rounded-md p-0.5">
            <ViewButton active={view === "tabla"} onClick={() => changeView("tabla")} icon={<TableIcon className="w-3.5 h-3.5" />} label="Tabla" />
            <ViewButton active={view === "kanban"} onClick={() => changeView("kanban")} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
          </div>
        </div>

        {search.trim() && !loading && (
          <p className="text-[10px] text-muted-foreground/60 -mt-1">
            {sortedCases.length} de {cases.length} casos coinciden con "{search.trim()}"
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
        ) : sortedCases.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted/30 mx-auto flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                {search
                  ? "Ningún caso coincide"
                  : "No hay casos en esta vista"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {search
                  ? "Probá ajustar los filtros o limpiar la búsqueda."
                  : "Cambiá de tab o limpiá los filtros toggle."}
              </p>
            </div>
            {!search && (
              <Button
                size="sm"
                onClick={() => navigate("/hub/leads")}
                className="text-[11px]"
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                Crear caso desde lead
              </Button>
            )}
          </div>
        ) : view === "tabla" ? (
          <CaseTable
            groups={visibleGroups}
            staffNames={staffNames}
            team={team}
            activeCaseId={peekCaseId}
            onRowClick={(id) => setPeekCaseId(id)}
            onCaseChange={(id, updates) => updateCase(id, updates)}
            hideHeaders={activeGroupKey !== null && visibleGroups.length === 1}
          />
        ) : (
          <CaseKanban
            groups={visibleGroups}
            staffNames={staffNames}
            onCardClick={(id) => setPeekCaseId(id)}
          />
        )}
      </div>

      {/* Peek panel lateral */}
      <CasePeekPanel
        c={peekCaseId ? sortedCases.find(c => c.id === peekCaseId) || null : null}
        ownerName={peekCaseId ? staffNames[sortedCases.find(c => c.id === peekCaseId)?.assigned_to || ""] || null : null}
        onClose={() => setPeekCaseId(null)}
        onOpenCase={() => {
          if (peekCaseId) navigate(`/case-engine/${peekCaseId}`);
        }}
        onNextActionChange={(id, next) => updateCase(id, { next_action: next })}
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
