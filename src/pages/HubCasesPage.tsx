import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, List as ListIcon, Table as TableIcon, Users, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import HubLayout from "@/components/hub/HubLayout";
import CaseTable from "@/components/hub/CaseTable";
import CaseKanban from "@/components/hub/CaseKanban";
import CaseCard from "@/components/hub/CaseCard";
import { useCasePipeline, PIPELINE_COLUMNS } from "@/hooks/useCasePipeline";
import { cn } from "@/lib/utils";

type ViewMode = "tabla" | "kanban" | "lista";

export default function HubCasesPage() {
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const { cases, loading, unclassifiedCount } = useCasePipeline(accountId);
  const [view, setView] = useState<ViewMode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ner_cases_view") : null;
    return (saved as ViewMode) || "tabla";
  });
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accountId) return;
    supabase
      .from("account_members")
      .select("user_id, profiles:user_id(full_name)")
      .eq("account_id", accountId)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((m: any) => {
          if (m.user_id) map[m.user_id] = m.profiles?.full_name || "Staff";
        });
        setStaffNames(map);
      });
  }, [accountId]);

  function changeView(next: ViewMode) {
    setView(next);
    try { localStorage.setItem("ner_cases_view", next); } catch {}
  }

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter(c => {
      if (ownerFilter !== "all" && c.assigned_to !== ownerFilter) return false;
      if (!q) return true;
      return (
        c.client_name?.toLowerCase().includes(q) ||
        c.file_number?.toLowerCase().includes(q) ||
        c.case_type?.toLowerCase().includes(q)
      );
    });
  }, [cases, search, ownerFilter]);

  const filteredColumns = useMemo(() => {
    return PIPELINE_COLUMNS.map(col => ({
      ...col,
      cases: filteredCases.filter(c => {
        if (c.process_stage && PIPELINE_COLUMNS.some(pc => pc.key === c.process_stage)) {
          return c.process_stage === col.key;
        }
        // Fallback heurístico igual al hook (consistencia)
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
      <div className="max-w-[1400px] mx-auto px-4 py-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pipeline de casos</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredCases.length} {filteredCases.length === 1 ? "caso activo" : "casos activos"}
              {totalOverdue > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-rose-400 font-semibold">
                  <AlertCircle className="w-3 h-3" />
                  {totalOverdue} vencida{totalOverdue === 1 ? "" : "s"}
                </span>
              )}
              {unclassifiedCount > 0 && (
                <span className="ml-2 text-muted-foreground/50">
                  · {unclassifiedCount} sin clasificar
                </span>
              )}
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente o expediente…"
                className="h-8 w-60 pl-8 text-xs bg-card/60"
              />
            </div>

            {uniqueOwners.length > 0 && (
              <div className="relative">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <select
                  value={ownerFilter}
                  onChange={e => setOwnerFilter(e.target.value)}
                  className="h-8 pl-8 pr-6 text-xs rounded-md border border-border bg-card/60 text-foreground focus:outline-none focus:ring-1 focus:ring-jarvis appearance-none"
                >
                  <option value="all">Todo el equipo</option>
                  {uniqueOwners.map(uid => (
                    <option key={uid} value={uid}>{staffNames[uid] || "Staff"}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center bg-card/60 border border-border rounded-md p-0.5">
              <ViewButton active={view === "tabla"} onClick={() => changeView("tabla")} icon={<TableIcon className="w-3.5 h-3.5" />} label="Tabla" />
              <ViewButton active={view === "kanban"} onClick={() => changeView("kanban")} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
              <ViewButton active={view === "lista"} onClick={() => changeView("lista")} icon={<ListIcon className="w-3.5 h-3.5" />} label="Lista" />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
        ) : filteredCases.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {search || ownerFilter !== "all"
                ? "Ningún caso coincide con tus filtros"
                : "No hay casos activos todavía"}
            </p>
          </div>
        ) : view === "tabla" ? (
          <CaseTable columns={filteredColumns} staffNames={staffNames} />
        ) : view === "kanban" ? (
          <CaseKanban columns={filteredColumns} staffNames={staffNames} />
        ) : (
          <div className="space-y-1.5">
            {filteredCases.map(c => (
              <CaseCard key={c.id} case={c} variant="list" staffNames={staffNames} />
            ))}
          </div>
        )}
      </div>
    </HubLayout>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1",
        active ? "bg-jarvis text-white" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
