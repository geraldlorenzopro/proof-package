import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Briefcase, AlertTriangle, Clock, FileText,
  CheckCircle2, Users, ArrowUpRight, ArrowDownRight,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import HubKpiDrawer, { type KpiType } from "./HubKpiDrawer";

interface AnalyticsData {
  activeCases: number;
  needAction: number;
  urgentDeadlines: number;
  formsInProgress: number;
  approvedThisMonth: number;
  totalClients: number;
  newCasesThisWeek: number;
  newClientsThisMonth: number;
}

interface Props {
  accountId: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HubAnalyticsCards({ accountId }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<KpiType>("clientes");

  useEffect(() => { if (accountId) loadAnalytics(); }, [accountId]);

  async function loadAnalytics() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(now.getDate() + 7);

      const [
        activeCasesRes, needActionRes, urgentDeadlinesRes,
        formsInProgressRes, approvedRes, totalClientsRes,
        newCasesWeekRes, newClientsMonthRes,
      ] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("ball_in_court", "team").not("status", "eq", "completed"),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "active")
          .lte("deadline_date", sevenDaysFromNow.toISOString().split("T")[0]),
        supabase.from("form_submissions").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "draft"),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString()),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("created_at", startOfWeek.toISOString()),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("created_at", startOfMonth.toISOString()),
      ]);

      setData({
        activeCases: activeCasesRes.count || 0,
        needAction: needActionRes.count || 0,
        urgentDeadlines: urgentDeadlinesRes.count || 0,
        formsInProgress: formsInProgressRes.count || 0,
        approvedThisMonth: approvedRes.count || 0,
        totalClients: totalClientsRes.count || 0,
        newCasesThisWeek: newCasesWeekRes.count || 0,
        newClientsThisMonth: newClientsMonthRes.count || 0,
      });
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncGhl() {
    setSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/sync-ghl-contacts`,
        { method: "GET" }
      );
      const json = await res.json();
      if (json.status === "ok") {
        toast.success("Función GHL activa. Envía un contacto desde GHL para sincronizar.");
      } else {
        toast.error("Error verificando la función de sincronización.");
      }
      // Reload analytics
      await loadAnalytics();
    } catch {
      toast.error("Error de conexión con la función de sincronización.");
    } finally {
      setSyncing(false);
    }
  }

  function openDrawer(type: KpiType) {
    setDrawerType(type);
    setDrawerOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/15 bg-card/30 animate-pulse h-[100px]" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[80px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const primaryCards = [
    {
      label: "Casos Activos",
      value: data.activeCases,
      icon: Briefcase,
      color: "text-accent",
      bg: "bg-accent/10",
      border: "border-accent/20",
      glow: "shadow-[0_0_20px_hsl(195_100%_50%/0.06)]",
      trend: data.newCasesThisWeek > 0 ? `+${data.newCasesThisWeek} esta semana` : "Sin nuevos",
      trendUp: data.newCasesThisWeek > 0,
      pulse: false,
      kpiType: "activos" as KpiType,
    },
    {
      label: "Clientes",
      value: data.totalClients,
      icon: Users,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      glow: "shadow-[0_0_20px_hsl(270_100%_50%/0.06)]",
      trend: data.newClientsThisMonth > 0 ? `+${data.newClientsThisMonth} este mes` : "Sin nuevos",
      trendUp: data.newClientsThisMonth > 0,
      pulse: false,
      kpiType: "clientes" as KpiType,
    },
  ];

  const secondaryCards = [
    {
      label: "Requieren Acción",
      value: data.needAction,
      icon: AlertTriangle,
      color: data.needAction > 0 ? "text-amber-400" : "text-emerald-400",
      bg: data.needAction > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
      border: data.needAction > 0 ? "border-amber-500/20" : "border-emerald-500/20",
      pulse: data.needAction > 5,
      kpiType: "accion" as KpiType,
    },
    {
      label: "Deadlines",
      subtitle: "próx. 7d",
      value: data.urgentDeadlines,
      icon: Clock,
      color: data.urgentDeadlines > 0 ? "text-rose-400" : "text-emerald-400",
      bg: data.urgentDeadlines > 0 ? "bg-rose-500/10" : "bg-emerald-500/10",
      border: data.urgentDeadlines > 0 ? "border-rose-500/20" : "border-emerald-500/20",
      pulse: data.urgentDeadlines > 0,
      kpiType: null as KpiType | null, // no drawer for deadlines yet
    },
    {
      label: "En Preparación",
      value: data.formsInProgress,
      icon: FileText,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      pulse: false,
      trend: null as string | null,
      kpiType: null as KpiType | null,
    },
    {
      label: "Completados",
      subtitle: "este mes",
      value: data.approvedThisMonth,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      pulse: false,
      trend: null as string | null,
      kpiType: "completados" as KpiType,
    },
  ];

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="space-y-3"
      >
        {/* PRIMARY ROW */}
        <div className="grid grid-cols-2 gap-3">
          {primaryCards.map((card, i) => (
            <motion.button
              key={card.label}
              custom={i}
              variants={fadeUp}
              onClick={() => openDrawer(card.kpiType)}
              className={`relative rounded-2xl border ${card.border} bg-card p-5 transition-all duration-300 hover:border-foreground/20 hover:scale-[1.01] cursor-pointer ${card.glow} text-left group`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold block mb-1">
                    {card.label}
                  </span>
                  {card.trend && (
                    <div className="flex items-center gap-1">
                      {card.trendUp && <ArrowUpRight className="w-3 h-3 text-emerald-400/70" />}
                      {!card.trendUp && <ArrowDownRight className="w-3 h-3 text-amber-400/70" />}
                      <span className={`text-[10px] font-medium ${
                        card.trendUp ? "text-emerald-400/60" : "text-amber-400/60"
                      }`}>
                        {card.trend}
                      </span>
                    </div>
                  )}
                </div>
                <p className={`font-display text-4xl font-black ${card.color} leading-none tracking-tighter`}>
                  {card.value}
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* SECONDARY ROW */}
        <div className="grid grid-cols-4 gap-3">
          {secondaryCards.map((card, i) => (
            <motion.button
              key={card.label}
              custom={i + 2}
              variants={fadeUp}
              onClick={() => card.kpiType && openDrawer(card.kpiType)}
              className={`relative rounded-xl border ${card.border} bg-card px-4 py-3.5 transition-all duration-300 hover:border-foreground/20 hover:scale-[1.02] cursor-pointer text-left group`}
            >
              {card.pulse && (
                <span className="absolute top-3 right-3 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold truncate">
                  {card.label}
                  {card.subtitle && <span className="text-muted-foreground/40 ml-1">{card.subtitle}</span>}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <p className={`font-display text-2xl font-extrabold ${card.color} leading-none tracking-tighter`}>
                  {card.value}
                </p>
                {card.trend && (
                  <span className="text-[9px] text-emerald-400/60 font-medium">{card.trend}</span>
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {/* SYNC GHL BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={handleSyncGhl}
            disabled={syncing}
            className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Contactos GHL
          </button>
        </div>
      </motion.div>

      <HubKpiDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        type={drawerType}
        accountId={accountId}
      />
    </>
  );
}
