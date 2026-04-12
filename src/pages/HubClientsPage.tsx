import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import {
  Search, Users, UserPlus, SortAsc, ChevronRight,
  Phone, Mail, Calendar, AlertCircle, CheckCircle2, CircleDot, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  created_at: string;
  updated_at: string;
}

function getProfileCompleteness(c: ClientProfile): number {
  const fields = [c.first_name, c.last_name, c.email, c.phone, c.dob, c.country_of_birth, c.address_city, c.address_state, c.immigration_status];
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
type SortType = "recent" | "name" | "completeness";

export default function HubClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [caseMap, setCaseMap] = useState<Record<string, { case_type: string; file_number: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("recent");
  const [showNewModal, setShowNewModal] = useState(false);
  const PAGE_SIZE = 500;

  const accountId = (() => {
    try {
      const imp = sessionStorage.getItem("ner_impersonate");
      if (imp) { const p = JSON.parse(imp); if (new Date(p.expires_at) > new Date()) return p.account_id; }
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  useEffect(() => {
    if (!accountId) return;
    fetchClients();
  }, [accountId]);

  async function fetchClients() {
    setLoading(true);
    const [profilesRes, countRes, casesRes] = await Promise.all([
      supabase
        .from("client_profiles")
        .select("id, first_name, middle_name, last_name, email, phone, dob, country_of_birth, address_city, address_state, immigration_status, created_at, updated_at")
        .eq("account_id", accountId)
        .eq("is_test", false)
        .eq("contact_stage", "client")
        .order("updated_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from("client_profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("is_test", false)
        .eq("contact_stage", "client"),
      supabase
        .from("client_cases")
        .select("client_profile_id, case_type, file_number")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data) setClients(profilesRes.data);
    setTotalCount(countRes.count || 0);
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

  async function loadMore() {
    setLoadingMore(true);
    const from = clients.length;
    const { data } = await supabase
      .from("client_profiles")
      .select("id, first_name, middle_name, last_name, email, phone, dob, country_of_birth, address_city, address_state, immigration_status, created_at, updated_at")
      .eq("account_id", accountId)
        .eq("is_test", false)
        .eq("contact_stage", "client")
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
    if (data) setClients(prev => [...prev, ...data]);
    setLoadingMore(false);
  }

  const getName = (c: ClientProfile) => normalizeClientName([c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre");
  const getInitials = (c: ClientProfile) => ((c.first_name?.[0] || "") + (c.last_name?.[0] || "")).toUpperCase() || "?";

  const filtered = clients
    .filter((c) => {
      const q = search.toLowerCase();
      const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
      if (q && !fullName.includes(q) && !c.email?.toLowerCase().includes(q) && !c.phone?.includes(q)) return false;
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
    })
    .sort((a, b) => {
      if (sortBy === "name") return getName(a).localeCompare(getName(b));
      if (sortBy === "completeness") return getProfileCompleteness(b) - getProfileCompleteness(a);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "nuevo", label: "Nuevo" },
    { key: "en_progreso", label: "En Progreso" },
    { key: "completo", label: "Completo" },
    { key: "con_caso", label: "Con caso" },
    { key: "sin_caso", label: "Sin caso" },
  ];

  const SORTS: { key: SortType; label: string }[] = [
    { key: "recent", label: "Recientes" },
    { key: "name", label: "Nombre A-Z" },
    { key: "completeness", label: "Perfil %" },
  ];

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jarvis/20 to-accent/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-jarvis" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Clientes</h1>
              <p className="text-xs text-muted-foreground">{totalCount.toLocaleString("es")} expedientes activos</p>
            </div>
          </div>
          <Button variant="default" size="sm" className="gap-2 bg-jarvis hover:bg-jarvis/90" onClick={() => setShowNewModal(true)}>
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, email o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/50 border-border" />
        </div>

        {/* Filters + Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.key ? "bg-jarvis/15 text-jarvis border border-jarvis/30" : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"}`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${sortBy === s.key ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">{search ? "Sin resultados" : "Sin clientes"}</h3>
            <p className="text-sm text-muted-foreground">{search ? "Intenta con otro término." : "Los clientes registrados aparecerán aquí."}</p>
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((client) => {
                const pct = getProfileCompleteness(client);
                const status = getStatusBadge(pct);
                const StatusIcon = status.icon;
                const caseInfo = caseMap[client.id];

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
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-jarvis/20 to-accent/10 flex items-center justify-center text-lg font-bold text-jarvis shrink-0">
                        {getInitials(client)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-jarvis transition-colors">{getName(client)}</h3>
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

        {!loading && totalCount > clients.length && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Cargar más clientes → ({clients.length.toLocaleString("es")} de {totalCount.toLocaleString("es")})
            </Button>
          </div>
        )}
      </div>

      <NewClientModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        onCreated={(id, name) => {
          setShowNewModal(false);
          navigate(`/hub/clients/${id}`);
        }}
      />
    </HubLayout>
  );
}
