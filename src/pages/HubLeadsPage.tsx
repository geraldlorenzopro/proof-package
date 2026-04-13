import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import {
  Search, UserSearch,
  Phone, Mail, Calendar, MessageSquare, Clock, Info,
  ChevronLeft, ChevronRight, ArrowUpDown, SortAsc, SortDesc
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logAccess } from "@/lib/auditLog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import HubLayout from "@/components/hub/HubLayout";
import IntakeWizard from "@/components/intake/IntakeWizard";

interface LeadProfile {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source_channel: string | null;
  source_detail: string | null;
  created_at: string;
}

// Aligned with StepChannel.tsx channels
const CHANNEL_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "referido", label: "Referido" },
  { key: "anuncio", label: "Anuncio" },
  { key: "website", label: "Website" },
  { key: "llamada", label: "Llamada" },
  { key: "walk-in", label: "Walk-in" },
  { key: "youtube", label: "YouTube" },
  { key: "sin-canal", label: "Sin canal" },
  { key: "otro", label: "Otro" },
] as const;

type ChannelFilterKey = (typeof CHANNEL_FILTERS)[number]["key"];

const KNOWN_CHANNELS = [
  "whatsapp", "instagram", "facebook", "tiktok", "referido",
  "anuncio", "website", "llamada", "walk-in", "youtube",
];

function classifyChannel(raw: string | null): { key: string; label: string } {
  if (!raw) return { key: "sin-canal", label: "Sin canal" };
  const lower = raw.toLowerCase().trim();
  for (const ch of KNOWN_CHANNELS) {
    if (lower === ch || lower.startsWith(ch)) return { key: ch, label: ch };
  }
  if (lower === "referral" || lower.startsWith("referido")) return { key: "referido", label: "Referido" };
  return { key: "otro", label: raw.length > 25 ? raw.slice(0, 22) + "…" : raw };
}

function getChannelBadgeStyle(key: string): string {
  const map: Record<string, string> = {
    whatsapp: "bg-green-500/10 text-green-400 border-green-500/20",
    instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    tiktok: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    referido: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    anuncio: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    website: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    llamada: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    "walk-in": "bg-teal-500/10 text-teal-400 border-teal-500/20",
    youtube: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return map[key] || "bg-muted/50 text-muted-foreground border-border";
}

const CHANNEL_DISPLAY: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", referido: "Referido", anuncio: "Anuncio / Ads",
  website: "Website", llamada: "Llamada", "walk-in": "Walk-in",
  youtube: "YouTube", "sin-canal": "Sin canal",
};

const PAGE_SIZE_OPTIONS = [18, 36, 54, 96];

export default function HubLeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilterKey>("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<{ name?: string; phone?: string; email?: string; client_profile_id?: string; source_channel?: string }>({});

  // Pagination & sort state
  const [pageSize, setPageSize] = useState(18);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState<"recent" | "name_asc" | "name_desc" | "oldest">("recent");

  const accountId = (() => {
    try {
      const imp = sessionStorage.getItem("ner_impersonate");
      if (imp) { const p = JSON.parse(imp); if (new Date(p.expires_at) > new Date()) return p.account_id; }
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0); }, [search, channelFilter, pageSize, sortBy]);

  const auditLoggedRef = useRef(false);

  useEffect(() => {
    if (!accountId) return;
    fetchPage();

    // Audit log: first load only
    if (!auditLoggedRef.current) {
      auditLoggedRef.current = true;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          logAccess({ accountId, userId: user.id, action: "viewed", entityType: "contacts_list" });
        }
      })();
    }
  }, [accountId, currentPage, pageSize, channelFilter, sortBy]);

  async function fetchPage() {
    setLoading(true);
    const from = currentPage * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("client_profiles")
      .select("id, first_name, middle_name, last_name, email, phone, source_channel, source_detail, created_at", { count: "exact" })
      .eq("account_id", accountId)
      .eq("is_test", false)
      .eq("contact_stage", "lead");

    // Sort
    if (sortBy === "name_asc") {
      query = query.order("first_name", { ascending: true });
    } else if (sortBy === "name_desc") {
      query = query.order("first_name", { ascending: false });
    } else if (sortBy === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // Server-side channel filter
    if (channelFilter !== "all") {
      if (channelFilter === "sin-canal") {
        query = query.is("source_channel", null);
      } else if (channelFilter === "otro") {
        // "otro" = not null AND not in known channels
        query = query.not("source_channel", "is", null)
          .not("source_channel", "in", `(${KNOWN_CHANNELS.join(",")})`);
      } else {
        query = query.eq("source_channel", channelFilter);
      }
    }

    // Server-side search
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`);
    }

    const { data, count } = await query.range(from, to);
    setLeads((data as any) || []);
    setTotalCount(count || 0);
    setLoading(false);
  }

  // Debounced search
  const [searchDebounce, setSearchDebounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDebounce), 300);
    return () => clearTimeout(t);
  }, [searchDebounce]);

  // Re-fetch when search changes (debounced)
  useEffect(() => {
    if (!accountId) return;
    fetchPage();
  }, [search]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const getName = (c: LeadProfile) => normalizeClientName([c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre");
  const getInitials = (c: LeadProfile) => ((c.first_name?.[0] || "") + (c.last_name?.[0] || "")).toUpperCase() || "?";

  function openIntakeForLead(lead: LeadProfile) {
    const classified = classifyChannel(lead.source_channel);
    setPrefillData({
      name: getName(lead),
      phone: lead.phone || undefined,
      email: lead.email || undefined,
      client_profile_id: lead.id,
      source_channel: KNOWN_CHANNELS.includes(classified.key) ? classified.key : undefined,
    });
    setIntakeOpen(true);
  }

  function handleIntakeSuccess() {
    if (prefillData?.client_profile_id) {
      setLeads(prev => prev.filter(l => l.id !== prefillData.client_profile_id));
      setTotalCount(prev => Math.max(0, prev - 1));
      toast.success(`${prefillData.name || 'Contacto'} movido a Consultas ✅`, { duration: 4000 });
    }
    setIntakeOpen(false);
    setPrefillData({});
    navigate('/hub/consultations');
  }

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Fixed top: Header */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <UserSearch className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Contactos</h1>
              <p className="text-xs text-muted-foreground">{totalCount.toLocaleString("es")} contactos registrados</p>
            </div>
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px] h-9 text-xs bg-muted/50 border-border gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="name_asc">Nombre A-Z</SelectItem>
              <SelectItem value="name_desc">Nombre Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fixed top: Search */}
        <div className="relative shrink-0 mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchDebounce}
            onChange={(e) => setSearchDebounce(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>

        {/* Fixed top: Channel filters */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 mt-2">
          {CHANNEL_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setChannelFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                channelFilter === f.key
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Scrollable cards area */}
        <div className="flex-1 overflow-y-auto mt-2 min-h-0 flex flex-col">
          {loading ? (
            <div className="grid grid-cols-3 gap-2 flex-1">
              {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-full min-h-[60px] rounded-lg" />)}
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <UserSearch className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">{search ? "Sin resultados" : "Sin contactos"}</h3>
              <p className="text-sm text-muted-foreground">{search ? "Intenta con otro término." : "Sincroniza contactos desde tu CRM."}</p>
            </div>
          ) : (
            <motion.div
              key={`page-${currentPage}-${channelFilter}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-3 gap-2 flex-1 auto-rows-fr"
            >
              {leads.map((lead) => {
                const classified = classifyChannel(lead.source_channel);
                const displayLabel = CHANNEL_DISPLAY[classified.key] || classified.label;
                const badgeStyle = getChannelBadgeStyle(classified.key);
                const createdDate = new Date(lead.created_at);

                return (
                  <div
                    key={lead.id}
                    className="group bg-card border border-border rounded-lg px-3 py-2.5 transition-all hover:border-amber-500/30 hover:bg-card/80 flex flex-col justify-between"
                  >
                    {/* Top row: avatar + name + consulta icon */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                        {getInitials(lead)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => navigate(`/hub/clients/${lead.id}`)}
                          className="font-semibold text-foreground truncate block hover:text-amber-400 transition-colors text-base leading-tight"
                        >
                          {getName(lead)}
                        </button>
                        <Badge className={`mt-0.5 text-[10px] leading-none px-1.5 py-0.5 border ${badgeStyle}`}>
                          {displayLabel}
                        </Badge>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openIntakeForLead(lead); }}
                        className="shrink-0 w-7 h-7 rounded-md border border-amber-500/20 flex items-center justify-center text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-all"
                        title="Iniciar consulta"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom rows: phone + date, then email */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {lead.phone ? (
                        <span className="flex items-center gap-1 shrink-0"><Phone className="w-3 h-3 shrink-0" />{lead.phone}</span>
                      ) : null}
                      <span className="flex items-center gap-1 shrink-0 ml-auto"><Calendar className="w-3 h-3" />{format(createdDate, "d MMM", { locale: es })}</span>
                    </div>
                    {lead.email ? (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground min-w-0">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate" title={lead.email}>{lead.email}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Fixed bottom: Pagination bar */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-border py-2 shrink-0">
            {/* Page info */}
            <p className="text-xs text-muted-foreground">
              Página <span className="font-semibold text-foreground">{currentPage + 1}</span> de{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
              <span className="ml-2 text-muted-foreground/70">
                ({(currentPage * pageSize + 1).toLocaleString("es")}–{Math.min((currentPage + 1) * pageSize, totalCount).toLocaleString("es")} de {totalCount.toLocaleString("es")})
              </span>
            </p>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Page size selector */}
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

              {/* Prev / Next */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-8 px-2 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </Button>

                {/* Page number quick jumps (show up to 5 pages) */}
                <div className="flex items-center gap-0.5 mx-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i;
                    } else if (currentPage < 3) {
                      pageNum = i;
                    } else if (currentPage > totalPages - 4) {
                      pageNum = totalPages - 7 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                          pageNum === currentPage
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-8 px-2 text-xs gap-1"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {intakeOpen && (
        <IntakeWizard
          open={intakeOpen}
          onOpenChange={(o) => { if (!o) { setIntakeOpen(false); setPrefillData({}); } }}
          prefill={prefillData}
          onCreated={handleIntakeSuccess}
        />
      )}
    </HubLayout>
  );
}
