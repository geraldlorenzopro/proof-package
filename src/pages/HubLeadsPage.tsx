import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import {
  Search, UserSearch,
  Phone, Mail, Calendar, Loader2, MessageSquare, Clock, Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
  { key: "importado", label: "Importados" },
  { key: "otro", label: "Otro" },
] as const;

type ChannelFilterKey = (typeof CHANNEL_FILTERS)[number]["key"];

// Canonical channel keys from intake wizard
const KNOWN_CHANNELS = [
  "whatsapp", "instagram", "facebook", "tiktok", "referido",
  "anuncio", "website", "llamada", "walk-in", "youtube",
];

// Sources that mean "imported from external CRM"
const IMPORT_SOURCES = ["docketwise", "crm", "import"];

function classifyChannel(raw: string | null): { key: string; label: string } {
  if (!raw) return { key: "sin-canal", label: "Sin canal" };
  const lower = raw.toLowerCase().trim();

  // Direct match with known channels
  for (const ch of KNOWN_CHANNELS) {
    if (lower === ch || lower.startsWith(ch)) return { key: ch, label: ch };
  }
  // Legacy "referral" → referido
  if (lower === "referral" || lower.startsWith("referido")) return { key: "referido", label: "Referido" };

  // Import sources
  if (IMPORT_SOURCES.some(s => lower.includes(s))) return { key: "importado", label: "Importado" };

  // Long campaign names or unknown → "otro" with truncated label
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
    importado: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };
  return map[key] || "bg-muted/50 text-muted-foreground border-border";
}

const CHANNEL_DISPLAY: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", referido: "Referido", anuncio: "Anuncio / Ads",
  website: "Website", llamada: "Llamada", "walk-in": "Walk-in",
  youtube: "YouTube", importado: "Importado", "sin-canal": "Sin canal",
};

export default function HubLeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilterKey>("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<{ name?: string; phone?: string; email?: string; client_profile_id?: string; source_channel?: string }>({});
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
    fetchLeads();
  }, [accountId]);

  async function fetchLeads() {
    setLoading(true);
    const [profilesRes, countRes] = await Promise.all([
      supabase
        .from("client_profiles")
        .select("id, first_name, middle_name, last_name, email, phone, source_channel, source_detail, created_at")
        .eq("account_id", accountId)
        .eq("is_test", false)
        .eq("contact_stage", "lead")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from("client_profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("is_test", false)
        .eq("contact_stage", "lead"),
    ]);
    if (profilesRes.data) setLeads(profilesRes.data as any);
    setTotalCount(countRes.count || 0);
    setLoading(false);
  }

  async function loadMore() {
    setLoadingMore(true);
    const from = leads.length;
    const { data } = await supabase
      .from("client_profiles")
      .select("id, first_name, middle_name, last_name, email, phone, source_channel, source_detail, created_at")
      .eq("account_id", accountId)
      .eq("is_test", false)
      .eq("contact_stage", "lead")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (data) setLeads(prev => [...prev, ...(data as any)]);
    setLoadingMore(false);
  }

  const getName = (c: LeadProfile) => normalizeClientName([c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") || "Sin nombre");
  const getInitials = (c: LeadProfile) => ((c.first_name?.[0] || "") + (c.last_name?.[0] || "")).toUpperCase() || "?";

  function matchesChannel(c: LeadProfile): boolean {
    if (channelFilter === "all") return true;
    const classified = classifyChannel(c.source_channel);
    return classified.key === channelFilter;
  }

  const filtered = leads.filter((c) => {
    const q = search.toLowerCase();
    const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
    if (q && !fullName.includes(q) && !c.email?.toLowerCase().includes(q) && !c.phone?.includes(q)) return false;
    return matchesChannel(c);
  });

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

  function handleIntakeSuccess(result: any) {
    if (prefillData?.client_profile_id) {
      setLeads(prev => prev.filter(l => l.id !== prefillData.client_profile_id));
      setTotalCount(prev => Math.max(0, prev - 1));
      toast.success(
        `${prefillData.name || 'Contacto'} movido a Consultas ✅`,
        { duration: 4000 }
      );
    }
    setIntakeOpen(false);
    setPrefillData({});
    navigate('/hub/consultations');
  }

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <UserSearch className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Contactos</h1>
              <p className="text-xs text-muted-foreground">{totalCount.toLocaleString("es")} contactos registrados</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, email o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/50 border-border" />
        </div>

        {/* Channel filters — aligned with intake wizard */}
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length.toLocaleString("es")} resultados</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UserSearch className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">{search ? "Sin resultados" : "Sin contactos"}</h3>
            <p className="text-sm text-muted-foreground">{search ? "Intenta con otro término." : "Sincroniza contactos desde tu CRM."}</p>
          </div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.03 } } }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((lead) => {
                const classified = classifyChannel(lead.source_channel);
                const displayLabel = CHANNEL_DISPLAY[classified.key] || classified.label;
                const badgeStyle = getChannelBadgeStyle(classified.key);
                const createdDate = new Date(lead.created_at);

                return (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative bg-card border border-border rounded-xl p-4 text-left transition-all hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5"
                  >
                    {/* Header: avatar + name + badge */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
                        {getInitials(lead)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => navigate(`/hub/clients/${lead.id}`)}
                          className="font-semibold text-foreground truncate block hover:text-amber-400 transition-colors text-sm"
                        >
                          {getName(lead)}
                        </button>
                        <Badge className={`mt-1 text-[10px] border ${badgeStyle}`}>
                          {displayLabel}
                        </Badge>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {/* Date + time */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{format(createdDate, "d MMM yyyy", { locale: es })}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{format(createdDate, "h:mm a")}</span>
                      </div>
                      {/* Source detail (campaign, referral name, etc.) */}
                      {lead.source_detail && (
                        <div className="flex items-center gap-2">
                          <Info className="w-3 h-3 shrink-0" />
                          <span className="truncate italic text-muted-foreground/70" title={lead.source_detail}>
                            {lead.source_detail.length > 35 ? lead.source_detail.slice(0, 32) + "…" : lead.source_detail}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full gap-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
                      onClick={(e) => { e.stopPropagation(); openIntakeForLead(lead); }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Iniciar consulta
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && totalCount > leads.length && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Cargar más → ({leads.length.toLocaleString("es")} de {totalCount.toLocaleString("es")})
            </Button>
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
