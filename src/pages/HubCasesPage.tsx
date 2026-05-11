import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, List as ListIcon, Users, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import HubLayout from "@/components/hub/HubLayout";
import CaseKanban from "@/components/hub/CaseKanban";
import CaseCard from "@/components/hub/CaseCard";
import { useCasePipeline, PIPELINE_COLUMNS } from "@/hooks/useCasePipeline";
import { cn } from "@/lib/utils";

type ViewMode = "kanban" | "list";

export default function HubCasesPage() {
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const { cases, columns, loading, unclassifiedCount } = useCasePipeline(accountId);
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  // Cargar staff del account para filtro de "asignado a"
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

  // Apply search + owner filter
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
        // Re-clasificar localmente para evitar import circular
        if (c.process_stage && (PIPELINE_COLUMNS as any).some((pc: any) => pc.key === c.process_stage)) {
          return c.process_stage === col.key;
        }
        // Inferencia fallback igual que en hook (mantener consistente)
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
          if (!hasReceipts) return false; // sin clasificar, no entra a ninguna columna activa
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
      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline de casos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredCases.length} casos activos
              {totalOverdue > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-rose-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {totalOverdue} tarea{totalOverdue === 1 ? "" : "s"} vencida{totalOverdue === 1 ? "" : "s"}
                </span>
              )}
              {unclassifiedCount > 0 && (
                <span className="ml-2 text-muted-foreground/60">
                  · {unclassifiedCount} sin clasificar
                </span>
              )}
            </p>
          </div>

          {/* Toolbar: search + filter + view toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente o expediente…"
                className="h-9 w-64 pl-8 text-sm bg-card/60"
              />
            </div>

            {uniqueOwners.length > 0 && (
              <div className="relative">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <select
                  value={ownerFilter}
                  onChange={e => setOwnerFilter(e.target.value)}
                  className="h-9 pl-8 pr-8 text-sm rounded-md border border-border bg-card/60 text-foreground focus:outline-none focus:ring-1 focus:ring-jarvis appearance-none"
                >
                  <option value="all">Todo el equipo</option>
                  {uniqueOwners.map(uid => (
                    <option key={uid} value={uid}>{staffNames[uid] || "Staff"}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center bg-card/60 border border-border rounded-md p-0.5">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "px-2.5 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5",
                  view === "kanban"
                    ? "bg-jarvis text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Kanban
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "px-2.5 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5",
                  view === "list"
                    ? "bg-jarvis text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ListIcon className="w-3.5 h-3.5" />
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center">
            <p className="text-muted-foreground">
              {search || ownerFilter !== "all"
                ? "Ningún caso coincide con tus filtros"
                : "No hay casos activos todavía"}
            </p>
          </div>
        ) : view === "kanban" ? (
          <CaseKanban columns={filteredColumns} staffNames={staffNames} emptyHint="Sin casos en esta etapa" />
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
