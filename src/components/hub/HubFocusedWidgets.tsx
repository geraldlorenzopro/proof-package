import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Signature, Eye, Calendar, Landmark, AlertCircle, ArrowRight, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDemoMode, DEMO_SIGNATURES, DEMO_REVIEWS, DEMO_CONSULTATIONS, DEMO_INTERVIEWS,
  DEMO_PULSE, DEMO_CRISIS, DEMO_NEWS,
} from "@/hooks/useDemoData";

// Hub Focused Widgets — responde 4 preguntas del abogado de inmigración:
// 1. ¿Qué se necesita firmar? — packets USCIS, NVC docs, contratos
// 2. ¿Qué requiere mi revisión? — RFEs respondidas, memos drafted
// 3. ¿Cuántas consultas tengo hoy? — citas con clientes
// 4. ¿Qué entrevistas USCIS/NVC/Embajada próximas? — biometrics, consular interviews
//
// Focus: USCIS + NVC + Embajada (las 3 agencias principales para 8 firmas).
// Court/ICE/CBP/Aeropuerto postponed (sprint 3+).

interface Props {
  accountId: string;
  attorneyName?: string;
}

interface SignatureItem {
  id: string;
  case_id: string;
  client_name: string;
  case_type: string | null;
  agency: "USCIS" | "NVC" | "EMB" | null;
  meta: string;
}

interface ReviewItem {
  id: string;
  case_id: string;
  client_name: string;
  title: string;
  agency: "USCIS" | "NVC" | "EMB" | null;
  drafted_by_name: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
}

interface ConsultationItem {
  id: string;
  time: string;
  client_name: string;
  title: string;
}

interface InterviewItem {
  case_id: string;
  client_name: string;
  case_type: string | null;
  agency: "USCIS" | "NVC" | "EMB";
  date: string;
  date_label: string;
  location: string | null;
}

function agencyBadgeClass(agency: string | null): string {
  switch (agency) {
    case "USCIS":
      return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
    case "NVC":
      return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    case "EMB":
      return "bg-orange-500/20 text-orange-300 border border-orange-500/30";
    default:
      return "bg-muted/30 text-muted-foreground border border-border";
  }
}

function inferAgencyFromCase(c: any): "USCIS" | "NVC" | "EMB" | null {
  if (c.emb_interview_date || c.cas_interview_date) return "EMB";
  if (c.nvc_case_number) return "NVC";
  const receipts = c.uscis_receipt_numbers;
  if (receipts && (Array.isArray(receipts) ? receipts.length > 0 : Object.keys(receipts || {}).length > 0)) return "USCIS";
  if (c.process_stage === "uscis") return "USCIS";
  if (c.process_stage === "nvc") return "NVC";
  if (c.process_stage === "embajada") return "EMB";
  return null;
}

export default function HubFocusedWidgets({ accountId }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  // En demo mode: click en cualquier item caso lanza toast en vez de navegar
  // (los IDs demo no existen en /case-engine, rompería).
  function openCase(caseId: string) {
    if (demoMode) {
      toast.info("Vista demo · navegación a caso desactivada", {
        description: "En producción, este click abre el case engine completo.",
        duration: 3000,
      });
      return;
    }
    navigate(`/case-engine/${caseId}`);
  }
  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [pulse, setPulse] = useState<{
    active: number; zombies: number; orphans: number; newLeads: number;
    approvalRate: number; teamActive?: string; mrr?: string;
  }>({
    active: 0, zombies: 0, orphans: 0, newLeads: 0, approvalRate: 0,
  });
  const [crisis, setCrisis] = useState<{ case_id: string; title: string; subtitle: string } | null>(null);
  const [news, setNews] = useState<Array<{ source: "USCIS" | "NVC" | "Embajada" | "AI"; text: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // DEMO MODE — sustituye queries reales con data mock realista de "Méndez Immigration Law"
    if (demoMode) {
      setSignatures(DEMO_SIGNATURES.map(s => ({
        id: s.id, case_id: s.case_id, client_name: s.client_name,
        case_type: s.case_type, agency: s.agency, meta: s.meta,
      })));
      setReviews(DEMO_REVIEWS.map(r => ({
        id: r.id, case_id: r.case_id, client_name: r.client_name, title: r.title,
        agency: r.agency, drafted_by_name: r.drafted_by, is_overdue: r.is_overdue,
        days_until_due: r.days_until,
      })));
      setConsultations(DEMO_CONSULTATIONS);
      setInterviews(DEMO_INTERVIEWS.map(i => ({
        case_id: i.case_id, client_name: i.client_name, case_type: i.case_type,
        agency: i.agency, date: "", date_label: i.date_label, location: i.location,
      })));
      setPulse({
        active: DEMO_PULSE.active_cases, zombies: DEMO_PULSE.zombies_30d,
        orphans: DEMO_PULSE.no_supervisor, newLeads: DEMO_PULSE.leads_today,
        approvalRate: DEMO_PULSE.approval_rate_30d,
        teamActive: DEMO_PULSE.team_active,
        mrr: "$48K",
      });
      setCrisis(DEMO_CRISIS);
      setNews(DEMO_NEWS);
      setLoading(false);
      return;
    }
    if (!accountId) return;
    loadAll();
  }, [accountId, demoMode]);

  async function loadAll() {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const in7d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const [
        sigTasksRes,
        reviewTasksRes,
        apptsRes,
        casesForInterviewsRes,
        activeCountRes,
        approvedRes,
        deniedRes,
        leadsRes,
      ] = await Promise.all([
        // Para firmar: tareas críticas pendientes o con título indicando firma/packet
        supabase
          .from("case_tasks")
          .select("id, case_id, title, priority, status, due_date, case_id")
          .eq("account_id", accountId)
          .neq("status", "completed")
          .neq("status", "archived")
          .or("title.ilike.%firm%,title.ilike.%sign%,title.ilike.%packet%,priority.eq.critical")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(20),

        // Para revisar: tareas con título indicando RFE o revisión
        supabase
          .from("case_tasks")
          .select("id, case_id, title, due_date, created_by_name, status")
          .eq("account_id", accountId)
          .neq("status", "completed")
          .neq("status", "archived")
          .or("title.ilike.%rfe%,title.ilike.%revis%,title.ilike.%review%")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(10),

        // Consultas hoy
        supabase
          .from("appointments")
          .select("id, title, start_date, status, client_id")
          .eq("account_id", accountId)
          .gte("start_date", todayStart.toISOString())
          .lte("start_date", todayEnd.toISOString())
          .neq("status", "cancelled")
          .order("start_date", { ascending: true })
          .limit(6),

        // Entrevistas próximas (7d) — USCIS biometrics, NVC interviews, Embassy
        supabase
          .from("client_cases")
          .select("id, client_name, case_type, interview_date, interview_time, interview_type, interview_city, emb_interview_date, emb_interview_time, cas_interview_date, cas_interview_time, process_stage, nvc_case_number, uscis_receipt_numbers")
          .eq("account_id", accountId)
          .or(`interview_date.gte.${todayStr},emb_interview_date.gte.${todayStr},cas_interview_date.gte.${todayStr}`)
          .limit(20),

        // Pulse: activos
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).neq("status", "completed"),

        // Aprobados 30d
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("process_stage", "aprobado").gte("updated_at", monthAgo),

        // Negados 30d (para approval rate)
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).in("process_stage", ["negado", "admin-processing"]).gte("updated_at", monthAgo),

        // Leads nuevos hoy (client_profiles created today, sin caso)
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("created_at", todayStart.toISOString()),
      ]);

      // Cargar nombres de clientes para tareas
      const caseIds = new Set<string>();
      (sigTasksRes.data || []).forEach((t: any) => t.case_id && caseIds.add(t.case_id));
      (reviewTasksRes.data || []).forEach((t: any) => t.case_id && caseIds.add(t.case_id));
      (apptsRes.data || []).forEach((a: any) => a.client_id && caseIds.add(a.client_id));

      const casesByIdMap: Record<string, any> = {};
      if (caseIds.size > 0) {
        const { data: casesInfo } = await supabase
          .from("client_cases")
          .select("id, client_name, case_type, process_stage, nvc_case_number, uscis_receipt_numbers, emb_interview_date, cas_interview_date")
          .in("id", Array.from(caseIds));
        (casesInfo || []).forEach((c: any) => { casesByIdMap[c.id] = c; });
      }

      // Procesar PARA FIRMAR (top 5)
      const sigItems: SignatureItem[] = (sigTasksRes.data || [])
        .slice(0, 5)
        .map((t: any) => {
          const c = casesByIdMap[t.case_id] || {};
          return {
            id: t.id,
            case_id: t.case_id,
            client_name: c.client_name || "Cliente",
            case_type: c.case_type,
            agency: inferAgencyFromCase(c),
            meta: t.due_date ? formatRelativeDate(t.due_date) : "—",
          };
        });

      // Procesar PARA REVISAR (top 4)
      const reviewItems: ReviewItem[] = (reviewTasksRes.data || [])
        .slice(0, 4)
        .map((t: any) => {
          const c = casesByIdMap[t.case_id] || {};
          const days = t.due_date ? daysUntil(t.due_date) : null;
          return {
            id: t.id,
            case_id: t.case_id,
            client_name: c.client_name || "Cliente",
            title: t.title,
            agency: inferAgencyFromCase(c),
            drafted_by_name: t.created_by_name,
            is_overdue: days !== null && days < 0,
            days_until_due: days,
          };
        });

      // Procesar CONSULTAS HOY
      const clientIds = (apptsRes.data || []).map((a: any) => a.client_id).filter(Boolean);
      const clientNamesMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name")
          .in("id", clientIds);
        (profiles || []).forEach((p: any) => {
          clientNamesMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Cliente";
        });
      }
      const consultItems: ConsultationItem[] = (apptsRes.data || []).slice(0, 5).map((a: any) => ({
        id: a.id,
        time: formatTime(a.start_date),
        client_name: a.client_id ? clientNamesMap[a.client_id] || "Cliente" : "Cliente",
        title: a.title || "Consulta",
      }));

      // Procesar ENTREVISTAS PRÓXIMAS (7d) — USCIS biometrics, NVC, Embajada
      const interviewItems: InterviewItem[] = [];
      const inSevenDays = new Date(in7d + "T23:59:59");
      const todayDate = new Date(todayStr + "T00:00:00");
      (casesForInterviewsRes.data || []).forEach((c: any) => {
        // USCIS interview (biometrics, naturalization)
        if (c.interview_date) {
          const d = new Date(c.interview_date + "T00:00:00");
          if (d >= todayDate && d <= inSevenDays) {
            interviewItems.push({
              case_id: c.id,
              client_name: c.client_name,
              case_type: c.case_type,
              agency: "USCIS",
              date: c.interview_date,
              date_label: formatRelativeDate(c.interview_date),
              location: c.interview_city,
            });
          }
        }
        // Embassy
        if (c.emb_interview_date) {
          const d = new Date(c.emb_interview_date + "T00:00:00");
          if (d >= todayDate && d <= inSevenDays) {
            interviewItems.push({
              case_id: c.id,
              client_name: c.client_name,
              case_type: c.case_type,
              agency: "EMB",
              date: c.emb_interview_date,
              date_label: formatRelativeDate(c.emb_interview_date),
              location: c.interview_city,
            });
          }
        }
        // CAS (administrative/consular)
        if (c.cas_interview_date) {
          const d = new Date(c.cas_interview_date + "T00:00:00");
          if (d >= todayDate && d <= inSevenDays) {
            interviewItems.push({
              case_id: c.id,
              client_name: c.client_name,
              case_type: c.case_type,
              agency: "NVC",
              date: c.cas_interview_date,
              date_label: formatRelativeDate(c.cas_interview_date),
              location: null,
            });
          }
        }
      });
      interviewItems.sort((a, b) => a.date.localeCompare(b.date));

      // Pulse metrics
      const active = activeCountRes.count || 0;
      const approved = approvedRes.count || 0;
      const denied = deniedRes.count || 0;
      const total = approved + denied;
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

      // Crisis: peor item con due_date más cercano en review (RFE crítico)
      const worstRfe = reviewItems
        .filter(r => r.is_overdue || (r.days_until_due !== null && r.days_until_due <= 2))
        .sort((a, b) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999))[0];
      if (worstRfe) {
        const daysText = worstRfe.is_overdue
          ? `venció hace ${Math.abs(worstRfe.days_until_due ?? 0)}d`
          : `vence en ${worstRfe.days_until_due}d`;
        setCrisis({
          case_id: worstRfe.case_id,
          title: `${worstRfe.title} — ${worstRfe.client_name}`,
          subtitle: `${daysText}${worstRfe.drafted_by_name ? ` · drafted por ${worstRfe.drafted_by_name}` : " · sin empezar"}`,
        });
      } else {
        setCrisis(null);
      }

      setSignatures(sigItems);
      setReviews(reviewItems);
      setConsultations(consultItems);
      setInterviews(interviewItems.slice(0, 5));
      setPulse({
        active,
        zombies: 0, // requires more query, leave 0 for now
        orphans: 0,
        newLeads: leadsRes.count || 0,
        approvalRate: rate,
      });
    } catch (err) {
      console.error("HubFocusedWidgets load error", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Crisis bar movida a HubCrisisBar.tsx — ahora se renderiza ARRIBA del briefing en HubDashboard (decisión 2026-05-11: rojo arriba, contexto narrativo después) */}

      {/* 4 WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* PARA FIRMAR */}
        <Widget
          icon={<Signature className="w-4 h-4 text-purple-400" />}
          iconBg="bg-purple-500/15 border border-purple-500/40"
          title="Para firmar"
          count={signatures.length}
          countColor="text-purple-400"
          onSeeAll={() => navigate("/hub/cases")}
          emptyText="Nada pendiente de firma"
        >
          {signatures.map(s => (
            <li
              key={s.id}
              onClick={() => openCase(s.case_id)}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/40 cursor-pointer"
            >
              {s.agency && (
                <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0", agencyBadgeClass(s.agency))}>
                  {s.agency}
                </span>
              )}
              <span className="text-[11px] truncate flex-1">
                {s.client_name}
                {s.case_type && <span className="text-muted-foreground"> · {s.case_type}</span>}
              </span>
              <span className="text-[9px] text-muted-foreground shrink-0">{s.meta}</span>
            </li>
          ))}
        </Widget>

        {/* PARA REVISAR */}
        <Widget
          icon={<Eye className="w-4 h-4 text-amber-400" />}
          iconBg="bg-amber-500/15 border border-amber-500/40"
          title="Para revisar"
          count={reviews.length}
          countColor="text-amber-400"
          onSeeAll={() => navigate("/hub/cases")}
          emptyText="Nada pendiente revisión"
        >
          {reviews.map(r => (
            <li
              key={r.id}
              onClick={() => openCase(r.case_id)}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/40 cursor-pointer"
            >
              {r.agency && (
                <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0", agencyBadgeClass(r.agency))}>
                  {r.agency}
                </span>
              )}
              <span className={cn("text-[11px] truncate flex-1", r.is_overdue && "text-rose-400 font-semibold")}>
                {r.title}
              </span>
              {r.is_overdue && (
                <span className="text-[9px] text-rose-400 font-bold shrink-0">⚠️</span>
              )}
            </li>
          ))}
        </Widget>

        {/* CONSULTAS HOY */}
        <Widget
          icon={<Calendar className="w-4 h-4 text-blue-400" />}
          iconBg="bg-blue-500/15 border border-blue-500/40"
          title="Consultas hoy"
          count={consultations.length}
          countColor="text-blue-400"
          onSeeAll={() => navigate("/hub/agenda")}
          emptyText="Sin consultas hoy"
        >
          {consultations.map(c => (
            <li
              key={c.id}
              className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40"
            >
              <span className="text-[10px] text-blue-400 font-semibold tabular-nums shrink-0">{c.time}</span>
              <span className="text-[11px] truncate flex-1">
                {c.client_name}
                <span className="text-muted-foreground"> · {c.title}</span>
              </span>
            </li>
          ))}
        </Widget>

        {/* ENTREVISTAS PRÓXIMAS (7d) */}
        <Widget
          icon={<Landmark className="w-4 h-4 text-orange-400" />}
          iconBg="bg-orange-500/15 border border-orange-500/40"
          title="Entrevistas (7d)"
          count={interviews.length}
          countColor="text-orange-400"
          onSeeAll={() => navigate("/hub/cases")}
          emptyText="Sin entrevistas próximas"
        >
          {interviews.map(i => (
            <li
              key={`${i.case_id}-${i.date}`}
              onClick={() => openCase(i.case_id)}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/40 cursor-pointer"
            >
              <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0", agencyBadgeClass(i.agency))}>
                {i.agency}
              </span>
              <span className="text-[11px] truncate flex-1">
                {i.client_name}
                {i.case_type && <span className="text-muted-foreground"> · {i.case_type}</span>}
              </span>
              <span className="text-[9px] text-muted-foreground shrink-0">{i.date_label}</span>
            </li>
          ))}
        </Widget>
      </div>

      {/* PULSE — métricas completas del portfolio. Métricas clickeables navegan a página relevante. */}
      <div className="flex items-center justify-center gap-5 px-4 py-2 bg-card/40 border border-border rounded-lg flex-wrap">
        <PulseMetric value={pulse.active} label="Casos activos" onClick={() => navigate("/hub/cases")} />
        {pulse.zombies > 0 && <><PulseDivider /><PulseMetric value={pulse.zombies} label="Zombies +30d" valueColor="text-amber-400" onClick={() => navigate("/hub/cases?filter=zombies")} /></>}
        {pulse.orphans > 0 && <><PulseDivider /><PulseMetric value={pulse.orphans} label="Sin supervisor" valueColor="text-rose-400" onClick={() => navigate("/hub/cases?filter=no-supervisor")} /></>}
        <PulseDivider />
        <PulseMetric value={pulse.newLeads} label="Leads hoy" valueColor="text-blue-400" onClick={() => navigate("/hub/leads")} />
        <PulseDivider />
        <PulseMetric value={`${pulse.approvalRate}%`} label="Aprobación 30d" valueColor="text-emerald-400" onClick={() => navigate("/hub/reports")} />
        {pulse.teamActive && (<><PulseDivider /><PulseMetric value={pulse.teamActive} label="Equipo activo" valueColor="text-emerald-400" onClick={() => navigate("/hub/settings/office")} /></>)}
        {pulse.mrr && (<><PulseDivider /><PulseMetric value={pulse.mrr} label="MRR firma" onClick={() => navigate("/admin/billing")} /></>)}
      </div>

      {/* NEWS TICKER — solo cuando hay items (demo o news scrape futuro) */}
      {news.length > 0 && (
        <div className="bg-card/40 border border-border rounded-lg px-4 py-2.5">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1.5">
            Novedades del día (últimas 24h)
          </div>
          <div className="space-y-1">
            {news.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={cn(
                  "inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider min-w-[56px] text-center shrink-0",
                  n.source === "USCIS" && "bg-blue-500/20 text-blue-300",
                  n.source === "NVC" && "bg-amber-500/20 text-amber-300",
                  n.source === "Embajada" && "bg-orange-500/20 text-orange-300",
                  n.source === "AI" && "bg-purple-500/20 text-purple-300",
                )}>
                  {n.source === "AI" ? "Equipo IA" : n.source}
                </span>
                <span className="text-muted-foreground">{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECURSOS QUICK ACCESS — centrados (label + buttons) */}
      {demoMode && (
        <div className="flex items-center justify-center gap-2 flex-wrap px-3 py-2 bg-card/30 border border-border rounded-lg">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold mr-1">Recursos:</span>
          <a href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-border-strong bg-transparent transition-colors">Visa Bulletin</a>
          <a href="https://egov.uscis.gov/casestatus/landing.do" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border bg-transparent transition-colors">USCIS Case Status</a>
          <a href="https://egov.uscis.gov/processing-times/" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border bg-transparent transition-colors">USCIS Processing Times</a>
          <a href="https://ceac.state.gov/CEAC/" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border bg-transparent transition-colors">NVC CEAC</a>
          <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/wait-times.html" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border bg-transparent transition-colors">Embajadas wait times</a>
          <a href="https://www.justice.gov/eoir" target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground border border-border bg-transparent transition-colors">EOIR (Corte)</a>
        </div>
      )}
    </div>
  );
}

function Widget({
  icon, iconBg, title, count, countColor, onSeeAll, emptyText, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  count: number;
  countColor: string;
  onSeeAll: () => void;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col min-h-[200px]">
      {/* Header centrado — Mr. Lorenzo prefiere headers centrados (acción/label) */}
      <div className="flex items-center justify-center gap-2 pb-2 mb-2 border-b border-border/60 relative">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
        <div className="text-[12px] font-semibold text-foreground">{title}</div>
        <div className={cn("absolute right-0 text-[20px] font-bold tabular-nums leading-none", countColor)}>
          {count}
        </div>
      </div>
      {count === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[10px] text-muted-foreground/60 italic">
          {emptyText}
        </div>
      ) : (
        <ul className="flex-1 space-y-0.5 overflow-hidden">
          {children}
        </ul>
      )}
      {count > 0 && (
        <button
          onClick={onSeeAll}
          className="mt-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border border-border"
        >
          Ver todos
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function PulseMetric({ value, label, valueColor, onClick }: { value: string | number; label: string; valueColor?: string; onClick?: () => void }) {
  const content = (
    <>
      <div className={cn("text-[15px] font-bold tabular-nums leading-none", valueColor || "text-foreground")}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="flex flex-col gap-0.5 hover:opacity-80 transition-opacity cursor-pointer text-left" title={`Ver ${label}`}>
        {content}
      </button>
    );
  }
  return <div className="flex flex-col gap-0.5">{content}</div>;
}

function PulseDivider() {
  return <div className="w-px h-6 bg-border" />;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `hace ${Math.abs(diff)}d`;
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff < 7) return `en ${diff}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function daysUntil(iso: string): number {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
