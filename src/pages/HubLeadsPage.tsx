import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import {
  Search, UserSearch, Plus,
   Phone, Mail, Calendar, MessageSquare, Clock, Info,
   ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, SortAsc, SortDesc, X, Trash2, CheckSquare, Square
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
import ContactQuickPanel from "@/components/hub/ContactQuickPanel";
import { useTrackPageView } from "@/hooks/useTrackPageView";

interface LeadProfile {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source_channel: string | null;
  source_detail: string | null;
  created_at: string;
  ghl_tags: string[] | null;
}

function isNewLead(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
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

const PAGE_SIZE_OPTIONS = [15, 30, 45, 90, 120];

export default function HubLeadsPage() {
  useTrackPageView("hub.leads");
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilterKey>("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [prefillData, setPrefillData] = useState<{ name?: string; phone?: string; email?: string; client_profile_id?: string; source_channel?: string }>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  // Pagination & sort state
  const [pageSize, setPageSize] = useState(15);
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
  const syncTriggeredRef = useRef(false);

  // Auto-sync GHL contacts on mount (throttled to 5 min)
  useEffect(() => {
    if (!accountId || syncTriggeredRef.current) return;
    syncTriggeredRef.current = true;

    (async () => {
      const lastSync = localStorage.getItem(`ghl_last_sync_${accountId}`);
      const now = Date.now();
      if (lastSync && now - parseInt(lastSync) < 5 * 60 * 1000) return;

      setSyncing(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-ghl-contacts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session.access_token}`,
            },
            body: JSON.stringify({ account_id: accountId, mode: "contacts", silent: true }),
          }
        );
        if (resp.ok) {
          localStorage.setItem(`ghl_last_sync_${accountId}`, now.toString());
        }
      } catch (e) {
        console.warn("Auto-sync failed:", e);
      } finally {
        setSyncing(false);
      }
    })();
  }, [accountId]);

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
      .select("id, first_name, middle_name, last_name, email, phone, notes, source_channel, source_detail, created_at, ghl_tags", { count: "exact" })
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
  const getName = (c: LeadProfile) => {
    const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");
    if (name) return normalizeClientName(name);
    if (c.phone) return c.phone;
    if (c.email) return c.email;
    return "Sin identificar";
  };
  const getInitials = (c: LeadProfile): { text: string; isUnknown: boolean } => {
    const hasName = !!(c.first_name || c.last_name);
    if (hasName) return { text: ((c.first_name?.[0] || "") + (c.last_name?.[0] || "")).toUpperCase() || "?", isUnknown: false };
    return { text: "?", isUnknown: true };
  };

  function openIntakeForLead(lead: LeadProfile) {
    const classified = classifyChannel(lead.source_channel);
    const channelKey = KNOWN_CHANNELS.includes(classified.key) ? classified.key : undefined;
    setPrefillData({
      name: getName(lead),
      phone: lead.phone || undefined,
      email: lead.email || undefined,
      client_profile_id: lead.id,
      source_channel: channelKey,
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

  async function handleBulkDelete() {
    if (selected.length === 0) return;
    // Get names before deleting for audit
    const deletedNames = leads.filter(l => selected.includes(l.id)).map(l => `${l.first_name || ""} ${l.last_name || ""}`.trim());
    await supabase
      .from("client_profiles")
      .update({ contact_stage: "inactive" as any, updated_at: new Date().toISOString() })
      .in("id", selected)
      .eq("account_id", accountId);
    // Audit log each deletion
    const { logAudit } = await import("@/lib/auditLog");
    for (let i = 0; i < selected.length; i++) {
      logAudit({
        action: "client.deleted" as any,
        entity_type: "client",
        entity_id: selected[i],
        entity_label: deletedNames[i] || "Contacto",
        metadata: { bulk: true, count: selected.length },
      });
    }
    setSelected([]);
    toast.success(`${selected.length} contactos eliminados`);
    fetchPage();
  }

  function toggleSelected(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
               <div className="flex items-center gap-2">
                 <h1 className="text-xl font-bold text-foreground">Contactos</h1>
                 {syncing && (
                   <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                     Sincronizando...
                   </span>
                 )}
               </div>
               <p className="text-xs text-muted-foreground">{totalCount.toLocaleString("es")} contactos registrados</p>
             </div>
           </div>

           <div className="flex items-center gap-2">
             <button
               onClick={() => { setPrefillData({}); setIntakeOpen(true); }}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
             >
               <Plus className="w-3.5 h-3.5" />
               Nuevo contacto
             </button>
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
         </div>

        {/* Fixed top: Search */}
        <div className="relative shrink-0 mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchDebounce}
            onChange={(e) => setSearchDebounce(e.target.value)}
            className="pl-10 pr-9 bg-muted/50 border-border"
          />
          {searchDebounce && (
            <button
              onClick={() => setSearchDebounce("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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

        {/* Bulk action bar */}
        {selected.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-card border border-border/40 shrink-0 mt-2">
            <span className="text-xs text-muted-foreground">
              {selected.length} seleccionados
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar seleccionados
            </button>
            <button
              onClick={() => setSelected([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Scrollable cards area */}
        <div className="flex-1 mt-2 min-h-0 flex flex-col">
          {loading ? (
             <div className="grid grid-cols-3 gap-2 flex-1 auto-rows-fr">
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
              className={`grid grid-cols-3 gap-1.5 ${leads.length < 9 ? 'content-start' : 'flex-1 auto-rows-fr'}`}
            >
              {leads.map((lead) => {
                const classified = classifyChannel(lead.source_channel);
                const displayLabel = CHANNEL_DISPLAY[classified.key] || classified.label;
                const badgeStyle = getChannelBadgeStyle(classified.key);
                const createdDate = new Date(lead.created_at);

                return (
                  <div
                    key={lead.id}
                    className={`group bg-card border rounded-lg px-3 py-2 transition-all hover:border-amber-500/30 hover:bg-card/80 flex flex-col justify-between ${
                      selected.includes(lead.id) ? "border-amber-500/40 bg-amber-500/5" : "border-border"
                    }`}
                  >
                    {/* Top row: checkbox + avatar + name + consulta icon */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelected(lead.id); }}
                        className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-amber-400 transition-colors"
                      >
                        {selected.includes(lead.id) ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                      {(() => {
                        const ini = getInitials(lead);
                        return (
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                            ini.isUnknown ? "bg-muted/50 text-muted-foreground" : "bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-400"
                          }`}>
                            {ini.text}
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setSelectedContact(lead.id)}
                          className="font-semibold text-foreground truncate block hover:text-amber-400 transition-colors text-base leading-tight"
                        >
                          {getName(lead)}
                        </button>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge className={`text-[10px] leading-none px-1.5 py-0.5 border ${badgeStyle}`}>
                            {displayLabel}
                          </Badge>
                          {isNewLead(lead.created_at) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                              NUEVO
                            </span>
                          )}
                        </div>
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
                        <span className="truncate no-underline decoration-transparent" style={{ textDecoration: 'none' }} title={lead.email}>{lead.email}</span>
                      </div>
                    ) : null}
                    {lead.ghl_tags && lead.ghl_tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {lead.ghl_tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border/20">
                            {tag}
                          </span>
                        ))}
                        {lead.ghl_tags.length > 2 && (
                          <span className="text-[9px] text-muted-foreground/50">+{lead.ghl_tags.length - 2}</span>
                        )}
                      </div>
                    )}
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
                  onClick={() => setCurrentPage(0)}
                  className="h-8 px-2 text-xs"
                  title="Primera página"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
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

                {/* Page number quick jumps (show up to 7 pages) */}
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(totalPages - 1)}
                  className="h-8 px-2 text-xs"
                  title="Última página"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
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
          initialStep={prefillData.client_profile_id ? 2 : 0}
          prefillChannel={prefillData.source_channel}
        />
      )}

      <ContactQuickPanel
        contactId={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        onStartIntake={(profileId, data) => {
          const channelKey = KNOWN_CHANNELS.includes(data.source_channel || "") ? data.source_channel : undefined;
          setPrefillData({ ...data, client_profile_id: profileId, source_channel: channelKey });
          setIntakeOpen(true);
        }}
      />
    </HubLayout>
  );
}
