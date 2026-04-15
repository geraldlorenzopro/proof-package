import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import {
  Search, Users, UserPlus, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  Phone, Mail, Calendar, AlertCircle, CheckCircle2, CircleDot, ArrowUpDown, HelpCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import NewClientModal from "@/components/workspace/NewClientModal";
import HubLayout from "@/components/hub/HubLayout";

interface ClientProfile {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  country_of_birth: string | null;
  address_city: string | null;
  address_state: string | null;
  immigration_status: string | null;
  passport_number: string | null;
  a_number: string | null;
  marital_status: string | null;
  ssn_last4: string | null;
  created_at: string;
  updated_at: string;
}

function getProfileCompleteness(c: ClientProfile): number {
  const fields = [
    c.first_name, c.last_name, c.email, c.phone, c.dob,
    c.country_of_birth, c.address_city, c.address_state, c.immigration_status,
    c.passport_number, c.a_number, c.marital_status, c.ssn_last4,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

type StatusVariant = "success" | "warning" | "default";

function getStatusBadge(pct: number): { label: string; variant: StatusVariant; icon: typeof CheckCircle2 } {
  if (pct >= 80) return { label: "Completo", variant: "success", icon: CheckCircle2 };
  if (pct >= 50) return { label: "En progreso", variant: "warning", icon: CircleDot };
  return { label: "Nuevo", variant: "default", icon: AlertCircle };
}

const statusColors: Record<StatusVariant, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-accent/10 text-accent border-accent/20",
  default: "bg-jarvis/10 text-jarvis border-jarvis/20",
};

type FilterType = "all" | "nuevo" | "en_progreso" | "completo" | "con_caso" | "sin_caso";
type SortType = "recent" | "name_asc" | "name_desc" | "completeness";

function getDisplayName(c: ClientProfile): string {
  const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");
  if (name) return normalizeClientName(name);
  if (c.phone) return c.phone;
  if (c.email) return c.email;
  return "Sin identificar";
}

function getDisplayInitials(c: ClientProfile): { text: string; isUnknown: boolean } {
  const hasName = !!(c.first_name || c.last_name);
  if (hasName) {
    return { text: ((c.first_name?.[0] || "") + (c.last_name?.[0] || "")).toUpperCase() || "?", isUnknown: false };
  }
  return { text: "?", isUnknown: true };
}

const PAGE_SIZE_OPTIONS = [15, 30, 45];

export default function HubClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [caseMap, setCaseMap] = useState<Record<string, { case_type: string; file_number: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("recent");
  const [showNewModal, setShowNewModal] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(0);

  const accountId = (() => {
    try {
      const imp = sessionStorage.getItem("ner_impersonate");
      if (imp) { const p = JSON.parse(imp); if (new Date(p.expires_at) > new Date()) return p.account_id; }
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDebounce), 300);
    return () => clearTimeout(t);
  }, [searchDebounce]);

  // Reset page on filter/search/sort changes
  useEffect(() => { setCurrentPage(0); }, [search, filter, pageSize, sortBy]);

  useEffect(() => {
    if (!accountId) return;
    fetchPage();
  }, [accountId, currentPage, pageSize, sortBy, search, filter]);

  async function fetchPage() {
    setLoading(true);
    const from = currentPage * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("client_profiles")
      .select("id, first_name, middle_name, last_name, email, phone, dob, country_of_birth, address_city, address_state, immigration_status, passport_number, a_number, marital_status, ssn_last4, created_at, updated_at", { count: "exact" })
      .eq("account_id", accountId)
      .eq("is_test", false)
      .eq("contact_stage", "client");

    // Sort
    if (sortBy === "name_asc") {
      query = query.order("first_name", { ascending: true });
    } else if (sortBy === "name_desc") {
      query = query.order("first_name", { ascending: false });
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    // Search
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`);
    }

    const [profilesRes, casesRes] = await Promise.all([
      query.range(from, to),
      supabase
        .from("client_cases")
        .select("client_profile_id, case_type, file_number")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
    ]);

    setClients((profilesRes.data as any) || []);
    setTotalCount(profilesRes.count || 0);

    if (casesRes.data) {
      const map: Record<string, { case_type: string; file_number: string | null }> = {};
      for (const c of casesRes.data as any[]) {
        if (c.client_profile_id && !map[c.client_profile_id]) {
          map[c.client_profile_id] = { case_type: c.case_type, file_number: c.file_number };
        }
      }
      setCaseMap(map);
    }
    setLoading(false);
  }

  // Client-side filter for completeness/case status (already fetched)
  const filtered = clients.filter((c) => {
    const pct = getProfileCompleteness(c);
    const hasCase = !!caseMap[c.id];
    switch (filter) {
      case "nuevo": return pct < 50;
      case "en_progreso": return pct >= 50 && pct < 80;
      case "completo": return pct >= 80;
      case "con_caso": return hasCase;
      case "sin_caso": return !hasCase;
      default: return true;
    }
  });

  // Sort completeness client-side
  const sorted = sortBy === "completeness"
    ? [...filtered].sort((a, b) => getProfileCompleteness(b) - getProfileCompleteness(a))
    : filtered;

  const totalPages = Math.ceil(totalCount / pageSize);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "nuevo", label: "Nuevo" },
    { key: "en_progreso", label: "En Progreso" },
    { key: "completo", label: "Completo" },
    { key: "con_caso", label: "Con caso" },
    { key: "sin_caso", label: "Sin caso" },
  ];

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jarvis/20 to-accent/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-jarvis" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Clientes</h1>
              <p className="text-xs text-muted-foreground">{totalCount.toLocaleString("es")} clientes registrados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" className="gap-2 bg-jarvis hover:bg-jarvis/90" onClick={() => setShowNewModal(true)}>
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Cliente</span>
            </Button>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[160px] h-9 text-xs bg-muted/50 border-border gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                <SelectItem value="name_desc">Nombre Z-A</SelectItem>
                <SelectItem value="completeness">Perfil %</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search */}
        <div className="relative shrink-0 mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, email o teléfono..." value={searchDebounce} onChange={(e) => setSearchDebounce(e.target.value)} className="pl-10 bg-muted/50 border-border" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 mt-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.key ? "bg-jarvis/15 text-jarvis border border-jarvis/30" : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Scrollable Grid */}
        <div className="flex-1 overflow-y-auto mt-2 min-h-0 flex flex-col">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
              {Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">{search ? "Sin resultados" : "Sin clientes"}</h3>
              <p className="text-sm text-muted-foreground">{search ? "Intenta con otro término." : "Los clientes registrados aparecerán aquí."}</p>
            </div>
          ) : (
            <motion.div
              key={`page-${currentPage}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {sorted.map((client) => {
                  const pct = getProfileCompleteness(client);
                  const status = getStatusBadge(pct);
                  const StatusIcon = status.icon;
                  const caseInfo = caseMap[client.id];
                  const display = getDisplayInitials(client);

                  return (
                    <motion.button
                      key={client.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/hub/clients/${client.id}`)}
                      className="group relative bg-card border border-border rounded-xl p-4 text-left transition-all hover:border-jarvis/30 hover:shadow-lg hover:shadow-jarvis/5"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                          display.isUnknown
                            ? "bg-muted/50 text-muted-foreground"
                            : "bg-gradient-to-br from-jarvis/20 to-accent/10 text-jarvis"
                        }`}>
                          {display.isUnknown ? <HelpCircle className="w-5 h-5" /> : display.text}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-jarvis transition-colors">{getDisplayName(client)}</h3>
                          <Badge className={`mt-1 text-xs border ${statusColors[status.variant]}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />{status.label}
                          </Badge>
                          {caseInfo && (
                            <Badge variant="outline" className="mt-1 text-[9px] ml-1">{caseInfo.case_type}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        {client.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{client.phone}</div>}
                        {client.email && <div className="flex items-center gap-2 truncate"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{client.email}</span></div>}
                        <div className="flex items-center gap-2"><Calendar className="w-3 h-3" />{format(new Date(client.created_at), "d MMM yyyy", { locale: es })}</div>
                      </div>

                      {/* Completeness bar */}
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-muted-foreground">Perfil completo</span>
                          <span className="text-[10px] font-medium text-foreground">{pct}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-jarvis rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20 group-hover:text-jarvis/50 transition-colors" />
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Pagination bar */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-border py-2 shrink-0">
            <p className="text-xs text-muted-foreground">
              Página <span className="font-semibold text-foreground">{currentPage + 1}</span> de{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
              <span className="ml-2 text-muted-foreground/70">
                ({(currentPage * pageSize + 1).toLocaleString("es")}–{Math.min((currentPage + 1) * pageSize, totalCount).toLocaleString("es")} de {totalCount.toLocaleString("es")})
              </span>
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mostrar</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-8 text-xs bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(s => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(0)} className="h-8 px-2 text-xs" title="Primera página">
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)} className="h-8 px-2 text-xs gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />Anterior
                </Button>
                <div className="flex items-center gap-0.5 mx-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) pageNum = i;
                    else if (currentPage < 3) pageNum = i;
                    else if (currentPage > totalPages - 4) pageNum = totalPages - 7 + i;
                    else pageNum = currentPage - 3 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                          pageNum === currentPage
                            ? "bg-jarvis/15 text-jarvis border border-jarvis/30"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)} className="h-8 px-2 text-xs gap-1">
                  Siguiente<ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(totalPages - 1)} className="h-8 px-2 text-xs" title="Última página">
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <NewClientModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        onCreated={(id) => {
          setShowNewModal(false);
          navigate(`/hub/clients/${id}`);
        }}
      />
    </HubLayout>
  );
}
