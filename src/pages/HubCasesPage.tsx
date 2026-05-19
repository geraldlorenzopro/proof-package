import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Table as TableIcon, AlertCircle, FolderPlus, SlidersHorizontal, ArrowUpDown, Users, FolderTree, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import HubLayout from "@/components/hub/HubLayout";
import CaseTable from "@/components/hub/CaseTable";
import CaseKanban from "@/components/hub/CaseKanban";
import CaseKpiStrip from "@/components/hub/CaseKpiStrip";
import CaseViewTabs from "@/components/hub/CaseViewTabs";
import CasePeekPanel from "@/components/hub/CasePeekPanel";
import { useCasePipeline, PIPELINE_COLUMNS } from "@/hooks/useCasePipeline";
import { useDemoMode, DEMO_CASES } from "@/hooks/useDemoData";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { useCaseViews, filterCasesByView } from "@/hooks/useCaseViews";
import { cn } from "@/lib/utils";

type ViewMode = "tabla" | "kanban";

export default function HubCasesPage() {
  useTrackPageView("hub.cases");
  const navigate = useNavigate();
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const { cases, loading, unclassifiedCount } = useCasePipeline(accountId);
  const demoMode = useDemoMode();
  const [view, setView] = useState<ViewMode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ner_cases_view") : null;
    return saved === "kanban" ? "kanban" : "tabla";
  });
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [peekCaseId, setPeekCaseId] = useState<string | null>(null);
  const { activeView, setActiveView } = useCaseViews();

  // Resolver userId logueado (necesario para "Mis casos" / "Pte acción mía")
  useEffect(() => {
    if (demoMode) {
      // Vanessa Rivera = canonical paralegal persona (matches DEMO_CASES assigned_to)
      setUserId("demo-u-vanessa");
      return;
    }
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [demoMode]);

  useEffect(() => {
    // Demo mode: inyectar staffNames desde DEMO_CASES (los UUIDs demo no existen en BD)
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
    supabase
      .from("account_members")
      .select("user_id, profiles:user_id(full_name)")
      .eq("account_id", accountId)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        const teamList: Array<{ user_id: string; full_name: string }> = [];
        (data || []).forEach((m: any) => {
          if (m.user_id) {
            const name = m.profiles?.full_name || "Staff";
            map[m.user_id] = name;
            teamList.push({ user_id: m.user_id, full_name: name });
          }
        });
        setStaffNames(map);
        setTeam(teamList);
      });
  }, [accountId, demoMode]);

  function changeView(next: ViewMode) {
    setView(next);
    try { localStorage.setItem("ner_cases_view", next); } catch {}
  }

  // Filtro por search + owner (paso 1)
  const searchFilteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter(c => {
      if (ownerFilter !== "all" && c.assigned_to !== ownerFilter) return false;
      if (!q) return true;
      // Búsqueda extendida (Vanessa requirement): A-number, USCIS receipt, NVC case
      if (c.client_name?.toLowerCase().includes(q)) return true;
      if (c.file_number?.toLowerCase().includes(q)) return true;
      if (c.case_type?.toLowerCase().includes(q)) return true;
      if (c.nvc_case_number?.toLowerCase().includes(q)) return true;
      // USCIS receipt numbers (array)
      const receipts = c.uscis_receipt_numbers;
      if (Array.isArray(receipts) && receipts.some((r: any) => String(r).toLowerCase().includes(q))) return true;
      if (receipts && typeof receipts === "object") {
        if (Object.values(receipts).some((r: any) => String(r).toLowerCase().includes(q))) return true;
      }
      return false;
    });
  }, [cases, search, ownerFilter]);

  // Filtro adicional por vista activa (mis-casos / urgentes / pte-accion / cerrados / todos)
  const filteredCases = useMemo(
    () => filterCasesByView(searchFilteredCases, activeView, userId),
    [searchFilteredCases, activeView, userId]
  );

  // Counts por vista (para badges en tabs)
  const viewCounts = useMemo(() => ({
    "mis-casos":      filterCasesByView(searchFilteredCases, "mis-casos", userId).length,
    "urgentes":       filterCasesByView(searchFilteredCases, "urgentes", userId).length,
    "pte-accion-mia": filterCasesByView(searchFilteredCases, "pte-accion-mia", userId).length,
    "cerrados-30d":   filterCasesByView(searchFilteredCases, "cerrados-30d", userId).length,
    "todos":          searchFilteredCases.length,
  }), [searchFilteredCases, userId]);

  const filteredColumns = useMemo(() => {
    return PIPELINE_COLUMNS.map(col => ({
      ...col,
      cases: filteredCases.filter(c => {
        if (c.process_stage && PIPELINE_COLUMNS.some(pc => pc.key === c.process_stage)) {
          return c.process_stage === col.key;
        }
        const tags = c.case_tags_array || [];
        let stage = "uscis";
        if (tags.some(t => /aprobada|aprobado/i.test(t))) stage = "aprobado";
        else if (tags.some(t => /negada|negado/i.test(t))) stage = "negado";
        else if (tags.some(t => /221g/i.test(t))) stage = "admin-processing";
        else if (c.emb_interview_date || c.cas_interview_date) stage = "embajada";
        else if (c.nvc_case_number) stage = "nvc";
        else {
          const r = c.uscis_receipt_numbers;
          const hasReceipts = r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0));
          if (!hasReceipts) return false;
        }
        return stage === col.key;
      }),
    }));
  }, [filteredCases]);

  const totalOverdue = useMemo(
    () => filteredCases.reduce((sum, c) => sum + (c.overdue_tasks_count || 0), 0),
    [filteredCases]
  );

  const uniqueOwners = useMemo(() => {
    const ids = new Set<string>();
    cases.forEach(c => { if (c.assigned_to) ids.add(c.assigned_to); });
    return Array.from(ids);
  }, [cases]);

  return (
    <HubLayout>
      <div className="px-5 py-4 space-y-3">

        {/* ═══ Header + Search global ═══ (paridad mockup v2) */}
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

          {/* Search global SIEMPRE visible (separado de filtros, ⌘K shortcut) */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, A-number, receipt USCIS/NVC…"
              className="h-9 pl-9 pr-16 text-[12px] bg-white/[0.04] border-white/10 focus-visible:border-cyan-accent/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/50 border border-white/10 rounded px-1 py-0.5">⌘K</span>
          </div>
        </div>

        {/* ═══ KPI Strip (4 boxes sin culpa) ═══ */}
        <CaseKpiStrip accountId={accountId} userId={userId} />

        {/* ═══ Tabs guardables (4 + Todos) ═══ */}
        <CaseViewTabs
          activeView={activeView}
          onChange={setActiveView}
          counts={viewCounts}
        />

        {/* ═══ Toolbar (filtros separados de search) ═══ */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled
            title="Próximamente: filtros avanzados"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-white/[0.04] border border-white/10 rounded-md text-muted-foreground/60 cursor-not-allowed"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
          </button>
          <button
            type="button"
            disabled
            title="Próximamente: sort por columna"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-white/[0.04] border border-white/10 rounded-md text-muted-foreground/60 cursor-not-allowed"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Ordenar
          </button>
          {uniqueOwners.length > 0 && (
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="h-8 w-auto px-3 text-[11px] bg-white/[0.04] border-white/10 gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <SelectValue placeholder="Persona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el equipo</SelectItem>
                {uniqueOwners.map(uid => (
                  <SelectItem key={uid} value={uid}>{staffNames[uid] || "Staff"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-cyan-accent/10 border border-cyan-accent/30 text-cyan-accent rounded-md"
            title="Vista agrupada por etapa del caso"
          >
            <FolderTree className="w-3.5 h-3.5" />
            Agrupar: Stage
          </button>
          <div className="ml-auto flex items-center bg-white/[0.04] border border-white/10 rounded-md p-0.5">
            <ViewButton active={view === "tabla"} onClick={() => changeView("tabla")} icon={<TableIcon className="w-3.5 h-3.5" />} label="Tabla" />
            <ViewButton active={view === "kanban"} onClick={() => changeView("kanban")} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
          </div>
        </div>

        {/* Search results count */}
        {search.trim() && !loading && (
          <p className="text-[10px] text-muted-foreground/60 -mt-1">
            {filteredCases.length} de {cases.length} casos coinciden con "{search.trim()}"
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
        ) : filteredCases.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted/30 mx-auto flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                {search || ownerFilter !== "all"
                  ? "Ningún caso coincide"
                  : "No hay casos activos todavía"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {search || ownerFilter !== "all"
                  ? "Probá ajustar los filtros o limpiar la búsqueda."
                  : "Empezá por crear el primer caso o sincronizar contactos desde GHL."}
              </p>
            </div>
            {!search && ownerFilter === "all" && (
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
            columns={filteredColumns}
            staffNames={staffNames}
            team={team}
            activeCaseId={peekCaseId}
            onRowClick={(id) => setPeekCaseId(id)}
          />
        ) : (
          <CaseKanban columns={filteredColumns} staffNames={staffNames} />
        )}
      </div>

      {/* Peek panel lateral — click row → abre acá, NO navega al case-engine */}
      <CasePeekPanel
        c={peekCaseId ? filteredCases.find(c => c.id === peekCaseId) || null : null}
        ownerName={peekCaseId ? staffNames[filteredCases.find(c => c.id === peekCaseId)?.assigned_to || ""] || null : null}
        onClose={() => setPeekCaseId(null)}
        onOpenCase={() => {
          if (peekCaseId) navigate(`/case-engine/${peekCaseId}`);
        }}
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
