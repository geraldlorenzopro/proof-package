import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Send, ExternalLink, Clock, ChevronLeft, ChevronRight, PlusCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import ChannelLogo from "@/components/intake/ChannelLogo";
import IntakeWizard from "@/components/intake/IntakeWizard";
import HubLayout from "@/components/hub/HubLayout";

const TOPIC_LABELS: Record<string, string> = {
  "proceso:familia": "Residencia / Green Card por familia",
  "proceso:ajuste-estatus": "Ajuste de estatus",
  "proceso:consular": "Proceso consular",
  "proceso:naturalizacion": "Ciudadanía / Naturalización",
  "proceso:ead-documentos": "Permiso de trabajo",
  "proceso:visa-temporal": "Visa temporal",
  "proceso:empleo-inversion": "Green Card por trabajo",
  "proceso:asilo-humanitario": "Asilo humanitario",
  "proceso:proteccion-especial": "Protección especial",
  "proceso:waiver": "Perdón migratorio",
  "proceso:corte-ice-cbp": "Corte / ICE / Frontera",
  "proceso:otro": "Otro tema",
};

interface ConsultationRow {
  id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_profile_id: string | null;
  entry_channel: string | null;
  urgency_level: string | null;
  consultation_topic: string | null;
  consultation_topic_tag: string | null;
  status: string | null;
  created_at: string | null;
  appointment_id: string | null;
  pre_intake_token: string | null;
  pre_intake_sent: boolean;
  pre_intake_completed: boolean;
  converted_to_case: boolean;
  case_id: string | null;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "bg-red-500/15 text-red-400 border-red-500/20" },
  prioritario: { label: "Prioritario", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  informativo: { label: "Informativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
};

function getIntakeStatus(c: ConsultationRow) {
  if (c.converted_to_case) return { label: "Caso creado", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
  if (c.pre_intake_completed) return { label: "Intake completo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (c.pre_intake_sent) return { label: "Enviado", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" };
  return { label: "Pendiente", color: "bg-muted/50 text-muted-foreground border-border/30" };
}

const PERIOD_OPTIONS = [
  { label: "Hoy", value: "today" },
  { label: "Esta semana", value: "week" },
  { label: "Este mes", value: "month" },
  { label: "Todo", value: "all" },
];

const PAGE_SIZE = 20;

export default function ConsultationsPage() {
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState("");
  const [items, setItems] = useState<ConsultationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [intakeFilter, setIntakeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("month");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakePrefill, setIntakePrefill] = useState<any>(undefined);

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (accountId) loadData();
  }, [accountId, urgencyFilter, intakeFilter, periodFilter, page]);

  async function loadAccount() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: aid } = await supabase.rpc("user_account_id", { _user_id: user.id });
    if (aid) setAccountId(aid);
  }

  function getPeriodDate() {
    const now = new Date();
    switch (periodFilter) {
      case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case "week": { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString(); }
      case "month": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      default: return null;
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      let query = supabase
        .from("intake_sessions")
        .select("id, client_first_name, client_last_name, client_phone, client_profile_id, entry_channel, urgency_level, consultation_topic, consultation_topic_tag, status, created_at", { count: "exact" })
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (urgencyFilter !== "all") query = query.eq("urgency_level", urgencyFilter);
      const periodDate = getPeriodDate();
      if (periodDate) query = query.gte("created_at", periodDate);

      const { data: sessions, count } = await query;
      setTotal(count || 0);

      if (!sessions || sessions.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, intake_session_id, pre_intake_token, pre_intake_sent, pre_intake_completed, converted_to_case, case_id")
        .in("intake_session_id", sessionIds);

      const apptMap = new Map((appointments || []).map((a: any) => [a.intake_session_id, a]));

      let merged: ConsultationRow[] = sessions.map((s: any) => {
        const appt = apptMap.get(s.id);
        return {
          ...s,
          appointment_id: appt?.id || null,
          pre_intake_token: appt?.pre_intake_token || null,
          pre_intake_sent: appt?.pre_intake_sent || false,
          pre_intake_completed: appt?.pre_intake_completed || false,
          converted_to_case: appt?.converted_to_case || false,
          case_id: appt?.case_id || null,
        };
      });

      if (intakeFilter === "completed") merged = merged.filter(m => m.pre_intake_completed);
      else if (intakeFilter === "sent") merged = merged.filter(m => m.pre_intake_sent && !m.pre_intake_completed);
      else if (intakeFilter === "pending") merged = merged.filter(m => !m.pre_intake_sent && !m.converted_to_case);

      setItems(merged);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(item: ConsultationRow) {
    navigate(`/hub/consultations/${item.id}`);
  }

  async function sendWhatsApp(e: React.MouseEvent, item: ConsultationRow) {
    e.stopPropagation();
    if (!item.pre_intake_token || !item.appointment_id) return;
    const preIntakeUrl = `${window.location.origin}/intake/${item.pre_intake_token}`;
    const phone = (item.client_phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(`Hola ${item.client_first_name || ""}, antes de su consulta necesitamos que complete este formulario: ${preIntakeUrl}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    await supabase.from("appointments").update({ pre_intake_sent: true } as any).eq("id", item.appointment_id);
    toast.success("Pre-intake enviado por WhatsApp");
    loadData();
  }

  const filtered = searchQuery
    ? items.filter(i => {
        const name = `${i.client_first_name || ""} ${i.client_last_name || ""}`.toLowerCase();
        const phone = (i.client_phone || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
    : items;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <HubLayout>
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Consultas</h1>
            <p className="text-sm text-muted-foreground">{total} registros</p>
          </div>
        </div>
        <Button onClick={() => { setIntakePrefill(undefined); setIntakeOpen(true); }} size="sm" className="gap-1.5">
          <PlusCircle className="w-4 h-4" /> Nueva Consulta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex gap-1">
          {[{ label: "Todas", value: "all" }, ...Object.entries(URGENCY_CONFIG).map(([k, v]) => ({ label: v.label, value: k }))].map(opt => (
            <button key={opt.value} onClick={() => { setUrgencyFilter(opt.value); setPage(0); }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${urgencyFilter === opt.value ? "bg-accent/10 border-accent/30 text-accent" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {[
            { label: "Todos", value: "all" },
            { label: "Completado", value: "completed" },
            { label: "Enviado", value: "sent" },
            { label: "Pendiente", value: "pending" },
          ].map(opt => (
            <button key={opt.value} onClick={() => { setIntakeFilter(opt.value); setPage(0); }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${intakeFilter === opt.value ? "bg-accent/10 border-accent/30 text-accent" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => { setPeriodFilter(opt.value); setPage(0); }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${periodFilter === opt.value ? "bg-accent/10 border-accent/30 text-accent" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No se encontraron consultas</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((item) => {
            const name = `${item.client_first_name || ""} ${item.client_last_name || ""}`.trim();
            const initial = (item.client_first_name || "?").charAt(0).toUpperCase();
            const urgency = URGENCY_CONFIG[item.urgency_level || ""];
            const intakeStatus = getIntakeStatus(item);
            const timeAgo = item.created_at
              ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })
              : "";

            return (
              <div
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card hover:border-border transition-all text-left cursor-pointer group"
              >
                {/* Avatar with initial */}
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-accent">{initial}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.client_profile_id ? (
                      <span
                        onClick={(e) => { e.stopPropagation(); navigate(`/hub/clients/${item.client_profile_id}`); }}
                        className="text-sm font-semibold text-foreground truncate hover:text-jarvis transition-colors cursor-pointer underline decoration-jarvis/30 underline-offset-2"
                      >{name || "Sin nombre"}</span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground truncate">{name || "Sin nombre"}</span>
                    )}
                    {item.client_phone && <span className="text-[10px] text-muted-foreground/50 font-mono">{item.client_phone}</span>}
                    <span className="text-[10px] text-muted-foreground/40">{timeAgo}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ChannelLogo channel={item.entry_channel || "otro"} size={14} showLabel={false} />
                    {(item.consultation_topic_tag || item.consultation_topic) && (
                      <span className="text-[11px] text-muted-foreground/60 truncate">{TOPIC_LABELS[item.consultation_topic_tag || ""] || item.consultation_topic_tag || item.consultation_topic}</span>
                    )}
                  </div>
                </div>

                {urgency && <Badge variant="outline" className={`${urgency.color} text-[8px] shrink-0`}>{urgency.label}</Badge>}
                <Badge variant="outline" className={`${intakeStatus.color} text-[8px] shrink-0`}>
                  {intakeStatus.label}
                </Badge>

                {!item.pre_intake_sent && !item.converted_to_case && item.pre_intake_token && item.client_phone && (
                  <button onClick={(e) => sendWhatsApp(e, item)}
                    className="text-[10px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg border border-accent/20 hover:bg-accent/10 transition-all">
                    <Send className="w-3 h-3" /> WhatsApp
                  </button>
                )}
                {item.converted_to_case && item.case_id && (
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/case-engine/${item.case_id}`); }}
                    className="text-[10px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg border border-accent/20 hover:bg-accent/10 transition-all">
                    <ExternalLink className="w-3 h-3" /> Ver caso
                  </button>
                )}
                {item.client_profile_id && !item.converted_to_case && (
                  <button onClick={(e) => {
                    e.stopPropagation();
                    setIntakePrefill({
                      name: `${item.client_first_name || ""} ${item.client_last_name || ""}`.trim(),
                      phone: item.client_phone || undefined,
                      client_profile_id: item.client_profile_id || undefined,
                    });
                    setIntakeOpen(true);
                  }}
                    className="text-[10px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg border border-accent/20 hover:bg-accent/10 transition-all">
                    <Plus className="w-3 h-3" /> Nueva consulta
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} prefill={intakePrefill} />
    </div>
    </HubLayout>
  );
}
