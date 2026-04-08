import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Send, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import ChannelLogo from "../intake/ChannelLogo";

interface RecentConsultation {
  id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_profile_id: string | null;
  entry_channel: string | null;
  urgency_level: string | null;
  consultation_topic: string | null;
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

function getIntakeStatus(c: RecentConsultation) {
  if (c.converted_to_case) return { label: "Caso creado", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
  if (c.pre_intake_completed) return { label: "Intake completo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (c.pre_intake_sent) return { label: "Enviado", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" };
  return { label: "Pendiente", color: "bg-muted/50 text-muted-foreground border-border/30" };
}

interface Props {
  accountId: string;
  maxItems?: number;
}

export default function HubRecentConsultations({ accountId, maxItems }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecentConsultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [accountId]);

  async function loadData() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: sessions } = await supabase
        .from("intake_sessions")
        .select("id, client_first_name, client_last_name, client_phone, client_profile_id, entry_channel, urgency_level, consultation_topic, status, created_at")
        .eq("account_id", accountId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!sessions || sessions.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Filter out test profiles
      const profileIds = sessions.map(s => (s as any).client_profile_id).filter(Boolean);
      let testProfileIds = new Set<string>();
      if (profileIds.length > 0) {
        const { data: testProfiles } = await supabase
          .from("client_profiles")
          .select("id")
          .in("id", profileIds)
          .eq("is_test", true);
        testProfileIds = new Set((testProfiles || []).map(p => p.id));
      }
      const filteredSessions = sessions.filter((s: any) => !s.client_profile_id || !testProfileIds.has(s.client_profile_id));

      const sessionIds = filteredSessions.map((s: any) => s.id);
      if (sessionIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, intake_session_id, pre_intake_token, pre_intake_sent, pre_intake_completed, converted_to_case, case_id")
        .in("intake_session_id", sessionIds);

      const apptMap = new Map((appointments || []).map((a: any) => [a.intake_session_id, a]));

      const merged: RecentConsultation[] = filteredSessions.map((s: any) => {
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

      setItems(merged);
    } catch (err) {
      console.error("Error loading consultations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function sendPreIntake(e: React.MouseEvent, item: RecentConsultation) {
    e.stopPropagation();
    if (!item.pre_intake_token || !item.appointment_id) return;
    const preIntakeUrl = `${window.location.origin}/intake/${item.pre_intake_token}`;
    const phone = (item.client_phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(`Hola ${item.client_first_name || ""}, antes de su consulta necesitamos que complete este formulario: ${preIntakeUrl}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");

    await supabase.from("appointments").update({ pre_intake_sent: true } as any).eq("id", item.appointment_id);
    toast.success("Pre-intake enviado");
    loadData();
  }

  // FIX 4: Navigate to client profile on row click
  function handleRowClick(item: RecentConsultation) {
    if (item.client_profile_id) {
      navigate(`/hub/clients/${item.client_profile_id}`);
    } else if (item.converted_to_case && item.case_id) {
      navigate(`/case-engine/${item.case_id}`);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
          <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
            Consultas Recientes
          </h3>
          <div className="h-px flex-1 bg-border/15 ml-2" />
        </div>
        <button
          onClick={() => navigate("/hub/consultations")}
          className="text-[11px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
        >
          Ver todas <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1.5">
        {items.slice(0, maxItems ?? items.length).map((item) => {
          const name = `${item.client_first_name || ""} ${item.client_last_name || ""}`.trim();
          const urgency = URGENCY_CONFIG[item.urgency_level || ""];
          const intakeStatus = getIntakeStatus(item);
          const timeAgo = item.created_at
            ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })
            : "";

          return (
            <div
              key={item.id}
              onClick={() => handleRowClick(item)}
              className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card hover:border-border transition-all text-left group cursor-pointer"
            >
              {/* Channel logo instead of emoji */}
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <ChannelLogo channel={item.entry_channel || "otro"} size={18} showLabel={false} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{name || "Sin nombre"}</span>
                  <span className="text-[10px] text-muted-foreground/50">{timeAgo}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.consultation_topic && (
                    <span className="text-[11px] text-muted-foreground/60 truncate">{item.consultation_topic}</span>
                  )}
                </div>
              </div>

              {urgency && (
                <Badge variant="outline" className={`${urgency.color} text-[8px] shrink-0`}>{urgency.label}</Badge>
              )}
              <Badge variant="outline" className={`${intakeStatus.color} text-[8px] shrink-0`}>
                {intakeStatus.label}
              </Badge>

              {/* Actions */}
              {!item.pre_intake_sent && !item.converted_to_case && item.pre_intake_token && (
                <button
                  onClick={(e) => sendPreIntake(e, item)}
                  className="text-[10px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg border border-accent/20 hover:bg-accent/10 transition-all"
                >
                  <Send className="w-3 h-3" /> Enviar
                </button>
              )}
              {item.converted_to_case && item.case_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/case-engine/${item.case_id}`); }}
                  className="text-[10px] font-semibold text-accent hover:text-accent/80 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg border border-accent/20 hover:bg-accent/10 transition-all"
                >
                  <ExternalLink className="w-3 h-3" /> Ver caso
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
