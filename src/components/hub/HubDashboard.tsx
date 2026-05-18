import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Calendar,
  ChevronRight,
  X, AlertCircle, FolderOpen,
  AlertTriangle, ExternalLink,
  Clock, FileText, CheckSquare, Sparkles, RefreshCw, BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFeed } from "@/hooks/useFeed";
import { useHubKpis } from "@/hooks/useHubKpis";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import type { FeedItemKind, FeedItemSeverity } from "@/types/feed";
import IntakeWizard from "../intake/IntakeWizard";
import HubFocusedWidgets from "./HubFocusedWidgets";
import HubCrisisBar from "./HubCrisisBar";
import HubTeamWidget from "./HubTeamWidget";
// Hub Canonical W-04: widgets movidos a sus rutas dedicadas.
// AITeamCard → /hub/ai · MyPerformanceWidget → /hub/reports
// VirtualOfficeCard → /hub/consultations
// Voice call inline eliminado 2026-05-18: ElevenLabs siempre-on era ~$3.6k/mes
// con 8 firmas. Voice queda solo para grabar consultas presenciales en
// /hub/consultations/:id. Mic del briefing es STT (Web Speech API gratis).
import { useDemoMode, DEMO_BRIEFING_TEXT } from "@/hooks/useDemoData";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Recursos oficiales — 4 primarios visibles + 4 secundarios en dropdown "+4"
const PRIMARY_RESOURCES = [
  { label: "Visa Bulletin", desc: "Fechas de prioridad del mes", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html", source: "DOS", chipClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" },
  { label: "Tiempos USCIS", desc: "Tiempos por tipo de caso", url: "https://egov.uscis.gov/processing-times/", source: "USCIS", chipClass: "bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20" },
  { label: "EOIR Avisos", desc: "Cortes de inmigración", url: "https://www.justice.gov/eoir/notices-and-press-releases", source: "EOIR", chipClass: "bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20" },
  { label: "Federal Register", desc: "Reglas y propuestas", url: "https://www.federalregister.gov/agencies/state-department", source: "FR", chipClass: "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20" },
];

const SECONDARY_RESOURCES = [
  { label: "NVC Timeframes", desc: "Tiempos del Centro Nacional de Visas", url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html", source: "DOS" },
  { label: "US Visa News", desc: "Noticias del Departamento de Estado", url: "https://travel.state.gov/content/travel/en/News/visas-news.html", source: "DOS" },
  { label: "USCIS Alertas", desc: "Alertas y actualizaciones urgentes", url: "https://www.uscis.gov/newsroom/alerts", source: "USCIS" },
  { label: "USCIS Noticias", desc: "Comunicados de prensa oficiales", url: "https://www.uscis.gov/newsroom/news-releases", source: "USCIS" },
];

const KIND_ICON: Record<FeedItemKind, typeof AlertTriangle> = {
  deadline_overdue: AlertTriangle,
  deadline_upcoming: Clock,
  task_pending: CheckSquare,
  doc_uploaded: FileText,
  intake_completed: FolderOpen,
  case_stale: Calendar,
};

const SEVERITY_STYLES: Record<FeedItemSeverity, {
  border: string; bg: string; iconBg: string; iconColor: string; metaColor: string;
}> = {
  critical: {
    border: "border-red-500/40",
    bg: "bg-gradient-to-br from-red-500/10 to-red-500/[0.02]",
    iconBg: "bg-red-500/15 border-red-500/30",
    iconColor: "text-red-400",
    metaColor: "text-red-400",
  },
  high: {
    border: "border-amber-500/40",
    bg: "bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02]",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconColor: "text-amber-400",
    metaColor: "text-amber-400",
  },
  medium: {
    border: "border-sky-500/30",
    bg: "bg-gradient-to-br from-sky-500/[0.06] to-sky-500/[0.01]",
    iconBg: "bg-sky-500/10 border-sky-500/25",
    iconColor: "text-sky-400",
    metaColor: "text-sky-400",
  },
  low: {
    border: "border-border/40",
    bg: "bg-card/40",
    iconBg: "bg-muted/40 border-border/30",
    iconColor: "text-muted-foreground",
    metaColor: "text-muted-foreground",
  },
};

interface Props {
  accountId: string;
  accountName: string;
  staffName?: string;
  userRole?: string | null;
  canAccessApp?: (slug: string) => boolean;
  showOnboardingBanner?: boolean;
  onTriggerOnboarding?: () => void;
}

export default function HubDashboard({
  accountId, accountName, staffName, showOnboardingBanner, onTriggerOnboarding
}: Props) {
  const navigate = useNavigate();
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // KPIs derivados — useHubKpis (Sprint D #9 quick win, wired Fase 3 cleanup 2026-05-18)
  const { activeCases, todayAppointmentsCount, pendingTasks, closedThisWeek, tasksDoneRatio } = useHubKpis(accountId);

  // Feed (zona 2A)
  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed, isRefetching: feedRefetching } = useFeed(accountId);

  // Morning briefing inteligente (Camila + Claude) — el wow factor.
  // Si falla o no llega, fallback al briefing v1 derivado de KPIs (más abajo).
  const { data: morningBriefing } = useMorningBriefing(accountId);

  // Chat input
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals + popups
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [openingResource, setOpeningResource] = useState<{label: string; url: string} | null>(null);
  const [showSecondaryResources, setShowSecondaryResources] = useState(false);
  const secondaryResourcesTriggerRef = useRef<HTMLButtonElement>(null);
  const secondaryResourcesPopupRef = useRef<HTMLDivElement>(null);

  // ESC handler + focus trap del popup secundario (a11y — Victoria QA spec)
  useEffect(() => {
    if (!showSecondaryResources) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowSecondaryResources(false);
        secondaryResourcesTriggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    // Focus en el primer item del popup al abrir
    const t = setTimeout(() => {
      secondaryResourcesPopupRef.current?.querySelector<HTMLButtonElement>("button[role='menuitem']")?.focus();
    }, 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [showSecondaryResources]);

  // Resolver nombre del usuario
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        setResolvedName(profile?.full_name || user.user_metadata?.full_name as string || user.email?.split("@")[0] || null);
      } catch {}
    })();
  }, []);

  const demoMode = useDemoMode();
  // En demo mode: fuerza nombre del attorney del demo, ignora session real
  const firstName = demoMode
    ? "Pablo"
    : ((resolvedName || staffName || "").split(" ")[0] || "");
  const greeting = useMemo(() => {
    const lh = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false }).format(new Date()));
    if (lh < 12) return "Buenos días";
    if (lh < 18) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  // Briefing inteligente — prioridad 1: Claude/Camila (hub-morning-briefing
  // edge fn con prosa narrativa que menciona clientes por nombre).
  // Si la edge fn aún no respondió o falló, fallback al v1 derivado de KPIs.
  const briefingText = useMemo(() => {
    // DEMO MODE: usar briefing fijo realista de Méndez Immigration Law
    if (demoMode) return DEMO_BRIEFING_TEXT;
    // Prioridad 1: briefing inteligente Claude (con nombres de clientes)
    if (morningBriefing?.briefing_text && !morningBriefing.meta.fallback_used) {
      return morningBriefing.briefing_text;
    }

    // Fallback v1 — derivado de feed + KPIs sin LLM
    const items = feedData?.items || [];
    const critical = items.filter(i => i.severity === "critical").length;
    const high = items.filter(i => i.severity === "high").length;
    const tasksAreSane = pendingTasks > 0 && pendingTasks <= 100;

    if (pendingTasks > 100 && critical === 0 && high === 0) {
      return `Sin urgencias hoy. Tu cola tiene ${pendingTasks} tareas pendientes — considera archivar las muy viejas para mantenerla limpia.`;
    }

    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} ${critical === 1 ? "asunto crítico" : "asuntos críticos"}`);
    if (high > 0) parts.push(`${high} ${high === 1 ? "urgente" : "urgentes"}`);
    if (todayAppointmentsCount > 0) parts.push(`${todayAppointmentsCount} ${todayAppointmentsCount === 1 ? "cita hoy" : "citas hoy"}`);
    if (tasksAreSane && parts.length < 3) parts.push(`${pendingTasks} ${pendingTasks === 1 ? "tarea pendiente" : "tareas pendientes"}`);

    if (parts.length === 0) {
      return "Todo al día. Sin urgencias por ahora.";
    }
    return `Hoy tienes ${parts.join(", ")}.`;
  }, [demoMode, morningBriefing, feedData, todayAppointmentsCount, pendingTasks]);

  // Action chips: prioridad al briefing Claude (chips contextuales con
  // nombre del cliente). Si no llegó, fallback al feed top-3.
  const briefingChips = useMemo(() => {
    if (morningBriefing?.chips && morningBriefing.chips.length > 0) {
      return morningBriefing.chips.map((c, idx) => ({
        id: `briefing_${idx}`,
        label: c.label,
        sublabel: undefined,
        severity: c.severity,
        href: c.href,
        kind: undefined,
      }));
    }
    return null;
  }, [morningBriefing]);

  // Top 3 chips de acción contextual.
  // Prioridad 1: chips del briefing Claude (mencionan cliente por nombre).
  // Prioridad 2: top 3 items del feed.
  const actionChips = useMemo(() => {
    if (demoMode) return []; // demo: suprime chips (action contextual va vía HubFocusedWidgets)
    if (briefingChips && briefingChips.length > 0) return briefingChips;
    const items = (feedData?.items || []).slice(0, 3);
    return items.map(item => ({
      id: item.id,
      label: item.title,
      sublabel: item.actionLabel,
      severity: item.severity,
      href: item.actionHref,
      kind: item.kind,
    }));
  }, [demoMode, briefingChips, feedData]);

  // Resto del feed (items 4+) para la cola priorizada
  const queueItems = useMemo(() => {
    return (feedData?.items || []).slice(0, 4);
  }, [feedData]);

  function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    navigate("/hub/chat", {
      state: { initialMessage: msg, accountId, accountName, staffName },
    });
  }

  function toggleSTT() {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "es-419";
    r.interimResults = false;
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  }

  return (
    <>
      {/* ═══ COCKPIT — layout estática 60/30/10 sin scroll en 1366×768 ═══ */}
      <div
        className="h-[100dvh] w-full overflow-hidden flex flex-col bg-background relative"
        style={{ width: "calc(100vw - 72px)" }}
      >

        {/* Onboarding banner */}
        {showOnboardingBanner && !bannerDismissed && (
          <div className="bg-amber-500/10 border-b border-amber-500/15 px-6 py-2 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-200/90">¡Completá la configuración de tu oficina!</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onTriggerOnboarding} className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1">
                Completar <ChevronRight className="w-3 h-3" />
              </button>
              <button onClick={() => setBannerDismissed(true)} className="text-amber-400/50 hover:text-amber-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main content — 3 zonas verticales */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-8 py-4 max-w-[1400px] w-full mx-auto">

          {/* ═══ ZONA 0 — CRISIS BAR (rojo arriba antes que prosa larga) ═══ */}
          {/* Decisión 2026-05-11 post-debate con Mr. Lorenzo: los ojos del abogado
              buscan rojo instintivamente. Crisis va PRIMERO, briefing después. */}
          <HubCrisisBar accountId={accountId} />

          {/* ═══ ZONA 1 — BRIEFING HERO (60% del peso visual) ═══ */}
          <section className="shrink-0 rounded-2xl px-7 py-5 border border-jarvis/20 bg-gradient-to-br from-jarvis/5 via-card/60 to-card/40 shadow-lg shadow-jarvis/5 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-6">
              {/* Camila + briefing */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-jarvis-glow via-jarvis to-jarvis-dim shadow-lg shadow-jarvis/40 animate-pulse"
                    style={{ animationDuration: "3s" }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1.5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-jarvis/80 font-semibold">Camila · briefing del día</p>
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">
                    {demoMode
                      ? <>{greeting}, <span className="text-jarvis">Pablo</span>.</>
                      : (morningBriefing?.greeting
                          ? (() => {
                              const parts = morningBriefing.greeting.split(",");
                              if (parts.length >= 2) {
                                return <>{parts[0]}, <span className="text-jarvis">{parts.slice(1).join(",").trim()}</span>.</>;
                              }
                              return <>{morningBriefing.greeting}.</>;
                            })()
                          : <>{greeting}{firstName ? <>, <span className="text-jarvis">{firstName}</span></> : ""}.</>)
                    }
                  </h2>
                  <p className="text-[13px] text-foreground/85 leading-relaxed">{briefingText}</p>
                </div>
              </div>

              {/* Camila input — chat de texto + dictado (STT). Sin voice call. */}
              <div className="shrink-0 flex flex-col items-end gap-1.5 self-start min-w-[300px]">
                <div className="flex items-center gap-1.5 bg-card/80 border border-border/40 focus-within:border-jarvis/40 rounded-xl px-3 py-2 transition-all w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Pregúntale a Camila..."
                    className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/40"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <button
                    onClick={toggleSTT}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isListening
                        ? "bg-red-500/20 text-red-400"
                        : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                    }`}
                    title="Dictar texto al campo"
                    aria-label="Dictar texto al campo"
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className="w-7 h-7 rounded-lg bg-jarvis/15 hover:bg-jarvis/25 flex items-center justify-center transition-all disabled:opacity-30"
                    title="Enviar"
                    aria-label="Enviar"
                  >
                    <Send className="w-3.5 h-3.5 text-jarvis" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-medium">
                  El micrófono dicta al texto · no llama por voz
                </span>
              </div>
            </div>

            {/* 3 chips de acción contextual del briefing */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {feedLoading && (
                <div className="text-[11px] text-muted-foreground/40">Camila está priorizando tu día...</div>
              )}
              {!demoMode && !feedLoading && actionChips.length === 0 && (
                <button
                  onClick={() => setIntakeOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-jarvis/30 bg-jarvis/10 text-[11px] font-medium text-jarvis hover:bg-jarvis/15 transition"
                >
                  <Sparkles className="w-3 h-3" /> Iniciar consulta nueva
                </button>
              )}
              {actionChips.map(chip => {
                const styles = SEVERITY_STYLES[chip.severity];
                return (
                  <button
                    key={chip.id}
                    onClick={() => navigate(chip.href)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border ${styles.border} ${styles.bg} text-[11px] font-medium ${styles.iconColor} hover:scale-[1.02] transition-all`}
                  >
                    <span className="truncate max-w-[180px]">{chip.label}</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })}
              {feedData && feedData.totalPotential > actionChips.length && (
                <button
                  onClick={() => refetchFeed()}
                  disabled={feedRefetching}
                  className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition disabled:opacity-50"
                  title="Refrescar feed"
                >
                  <RefreshCw className={`w-3 h-3 ${feedRefetching ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

          </section>

          {/* ═══ ZONA 2 — 4 KPI CARDS (acción primero) ═══ */}
          {/* Hub Canonical W-04 (Morning Delivery 2026-05-16): el Hub tiene SOLO
              CrisisBar + Briefing + 4 KPIs + Equipo + Stats. Widgets MyPerformance /
              VirtualOffice / AITeam fueron movidos a sus rutas dedicadas
              (/hub/reports, /hub/consultations, /hub/ai). */}
          <section className="flex-1 min-h-0 overflow-y-auto space-y-3">
            <HubFocusedWidgets accountId={accountId} attorneyName={resolvedName || staffName || undefined} />

            {/* ═══ ZONA 3 — WIDGET TU EQUIPO NER (decisión 2026-05-18, ver mockup v6.1) ═══ */}
            {/* Acción inmediata arriba, equipo como soporte abajo. Patrón Linear/Stripe. */}
            {!demoMode && <HubTeamWidget accountId={accountId} />}
          </section>

          {/* ═══ ZONA 4 — PULSO + RECURSOS (10%) ═══ — ocultar en demo (HubFocusedWidgets ya muestra pulse + news + resources) */}
          {!demoMode && (
          <section className="shrink-0 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm px-4 py-2.5 flex items-center gap-5 flex-wrap">
            {/* Pulse mini KPIs */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button onClick={() => navigate("/hub/cases?filter=closed")} className="flex items-baseline gap-1.5 hover:opacity-80 transition">
                <span className="text-base font-semibold text-foreground tabular-nums">{closedThisWeek}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">cerrados sem.</span>
              </button>
              <div className="w-px h-5 bg-border/30" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-foreground tabular-nums">{tasksDoneRatio}<span className="text-[10px]">%</span></span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">tareas hechas</span>
              </div>
              <div className="w-px h-5 bg-border/30" />
              <button onClick={() => navigate("/hub/cases")} className="flex items-baseline gap-1.5 hover:opacity-80 transition">
                <span className="text-base font-semibold text-foreground tabular-nums">{activeCases}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">casos activos</span>
              </button>
              <div className="w-px h-5 bg-border/30" />
              <button onClick={() => navigate("/hub/cases")} className="flex items-baseline gap-1.5 hover:opacity-80 transition" title={`${pendingTasks} tareas pendientes${pendingTasks > 99 ? " — considerá archivar las muy viejas" : ""}`}>
                <span className="text-base font-semibold text-amber-400 tabular-nums">
                  {pendingTasks.toLocaleString("es-ES")}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">tareas pend.</span>
              </button>
            </div>

            <div className="w-px h-5 bg-border/40" />

            {/* Recursos: 4 inline + dropdown "+4" */}
            <div className="relative flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mr-0.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Oficiales
              </span>
              {PRIMARY_RESOURCES.map(r => (
                <button
                  key={r.label}
                  onClick={() => setOpeningResource({ label: r.label, url: r.url })}
                  title={r.desc}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition ${r.chipClass}`}
                >
                  {r.source}
                </button>
              ))}
              <button
                ref={secondaryResourcesTriggerRef}
                onClick={() => setShowSecondaryResources(v => !v)}
                className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                title="Más recursos oficiales"
                aria-expanded={showSecondaryResources}
                aria-haspopup="menu"
                aria-controls="secondary-resources-menu"
              >
                +{SECONDARY_RESOURCES.length}
              </button>

              {/* Dropdown popup +4 — spec Valerie/Victoria 2026-05-03 */}
              {showSecondaryResources && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onPointerDown={() => setShowSecondaryResources(false)}
                    aria-hidden="true"
                  />
                  <div
                    ref={secondaryResourcesPopupRef}
                    id="secondary-resources-menu"
                    role="menu"
                    aria-label="Más recursos oficiales"
                    className="absolute bottom-full right-0 mb-2 z-50 w-[320px] rounded-xl border border-border/40 bg-card shadow-2xl shadow-black/40 backdrop-blur-xl p-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150"
                  >
                    <div className="flex items-center justify-between px-2 py-1">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60 font-semibold">
                        Más recursos oficiales
                      </p>
                      <span className="text-[9px] text-muted-foreground/40 font-mono">ESC</span>
                    </div>
                    {SECONDARY_RESOURCES.map(r => (
                      <button
                        key={r.label}
                        role="menuitem"
                        onClick={() => {
                          setOpeningResource({ label: r.label, url: r.url });
                          setShowSecondaryResources(false);
                        }}
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted/40 focus:bg-muted/40 focus:outline-none transition flex items-center gap-2"
                      >
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border border-border/40 text-muted-foreground/70 shrink-0">{r.source}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground/90 truncate">{r.label}</p>
                          <p className="text-[9px] text-muted-foreground/60 truncate">{r.desc}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
          )}

        </div>
      </div>

      {/* Modals */}
      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />

      {openingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpeningResource(null)}>
          <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 w-[320px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-jarvis" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">Saliendo de NER momentáneamente</p>
              <p className="text-xs text-muted-foreground">Se abrirá <span className="font-medium text-foreground">{openingResource.label}</span> en una nueva pestaña. Tu sesión no se cerrará.</p>
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => setOpeningResource(null)} className="flex-1 py-2 rounded-xl border border-border/40 text-xs text-muted-foreground hover:bg-muted/20 transition-all">Cancelar</button>
              <button onClick={() => { window.open(openingResource.url, "_blank", "noopener,noreferrer"); setOpeningResource(null); }} className="flex-1 py-2 rounded-xl bg-jarvis/15 border border-jarvis/20 text-xs font-medium text-jarvis hover:bg-jarvis/25 transition-all">Abrir ↗</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

