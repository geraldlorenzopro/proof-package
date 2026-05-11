import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Table as TableIcon, AlertCircle, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import HubLayout from "@/components/hub/HubLayout";
import CaseTable from "@/components/hub/CaseTable";
import CaseKanban from "@/components/hub/CaseKanban";
import { useCasePipeline, PIPELINE_COLUMNS } from "@/hooks/useCasePipeline";
import { useDemoMode, DEMO_CASES } from "@/hooks/useDemoData";
import { cn } from "@/lib/utils";

type ViewMode = "tabla" | "kanban";

export default function HubCasesPage() {
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

  useEffect(() => {
    // Demo mode: inyectar staffNames desde DEMO_CASES (los UUIDs demo no existen en BD)
    if (demoMode) {
      const map: Record<string, string> = {};
      DEMO_CASES.forEach(c => {
        if (c.assigned_to) map[c.assigned_to] = c.assigned_to_name;
      });
      setStaffNames(map);
      return;
    }
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
  }, [accountId, demoMode]);

  function changeView(next: ViewMode) {
    setView(next);
    try { localStorage.setItem("ner_cases_view", next); } catch {}
  }

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter(c => {
      if (ownerFilter !== "all" && c.assigned_to !== ownerFilter) return false;
      if (!q) return true;
      // Búsqueda extendida (Vanessa requirement): A-number, USCIS receipt, NVC case
      if (c.client_name?.toLowerCase().includes(q)) return true;
      if (c.file_number?.toLowerCase().includes(q)) return true;
      if (c.case_type?.toLowerCase().includes(q)) return true;
      // A-number (alien_number) viene en case_tags_array o se busca en raw — el hook no lo trae
      // pero podemos buscar en file_number también si el preparador lo guardó ahí.
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
      <div className="max-w-[1400px] mx-auto px-4 py-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pipeline de casos</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
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
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente, expediente, recibo USCIS o NVC…"
                className="h-8 w-80 pl-8 text-[11px] bg-card/60"
              />
            </div>

            {uniqueOwners.length > 0 && (
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-8 w-40 text-[11px] bg-card/60">
                  <SelectValue placeholder="Todo el equipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el equipo</SelectItem>
                  {uniqueOwners.map(uid => (
                    <SelectItem key={uid} value={uid}>{staffNames[uid] || "Staff"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center bg-card/60 border border-border rounded-md p-0.5">
              <ViewButton active={view === "tabla"} onClick={() => changeView("tabla")} icon={<TableIcon className="w-3.5 h-3.5" />} label="Tabla" />
              <ViewButton active={view === "kanban"} onClick={() => changeView("kanban")} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Kanban" />
            </div>
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
          <CaseTable columns={filteredColumns} staffNames={staffNames} />
        ) : (
          <CaseKanban columns={filteredColumns} staffNames={staffNames} />
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
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      )}
      title={`Vista ${label}`}
    >
      {icon}
      {label}
    </button>
  );
}
