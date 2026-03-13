import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Briefcase, AlertTriangle, Clock, FileText,
  CheckCircle2, Users, ArrowUpRight, ArrowDownRight
} from "lucide-react";

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

const fadeUp = {
  hidden: { opacity: 0, y: 6, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HubAnalyticsCards() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

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
          .not("status", "eq", "completed"),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("ball_in_court", "team").not("status", "eq", "completed"),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("status", "active")
          .lte("deadline_date", sevenDaysFromNow.toISOString().split("T")[0]),
        supabase.from("form_submissions").select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString()),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .gte("created_at", startOfWeek.toISOString()),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .gte("created_at", startOfMonth.toISOString()),
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

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[80px]" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[64px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ═══ PRIMARY KPIs (2 large) ═══
  const primaryCards = [
    {
      label: "Casos Activos",
      value: data.activeCases,
      icon: Briefcase,
      color: "text-jarvis",
      bg: "bg-jarvis/8",
      border: "border-jarvis/20",
      glow: "shadow-[0_0_15px_hsl(195_100%_50%/0.05)]",
      trend: data.newCasesThisWeek > 0 ? `+${data.newCasesThisWeek} esta semana` : null,
      trendUp: true,
    },
    {
      label: "Requieren Acción",
      value: data.needAction,
      icon: AlertTriangle,
      color: data.needAction > 0 ? "text-amber-400" : "text-emerald-400",
      bg: data.needAction > 0 ? "bg-amber-500/8" : "bg-emerald-500/8",
      border: data.needAction > 0 ? "border-amber-500/20" : "border-emerald-500/20",
      glow: data.needAction > 0 ? "shadow-[0_0_15px_hsl(38_100%_50%/0.05)]" : "",
      trend: data.needAction > 0 ? "Pendientes del equipo" : "Todo al día",
      trendUp: data.needAction === 0,
      pulse: data.needAction > 5,
    },
  ];

  // ═══ SECONDARY KPIs (4 compact) ═══
  const secondaryCards = [
    {
      label: "Deadlines",
      subtitle: "< 7d",
      value: data.urgentDeadlines,
      icon: Clock,
      color: data.urgentDeadlines > 0 ? "text-rose-400" : "text-emerald-400",
      bg: data.urgentDeadlines > 0 ? "bg-rose-500/8" : "bg-emerald-500/8",
      border: data.urgentDeadlines > 0 ? "border-rose-500/20" : "border-emerald-500/20",
      pulse: data.urgentDeadlines > 0,
    },
    {
      label: "Preparación",
      value: data.formsInProgress,
      icon: FileText,
      color: "text-cyan-400",
      bg: "bg-cyan-500/8",
      border: "border-cyan-500/20",
    },
    {
      label: "Completados",
      subtitle: "mes",
      value: data.approvedThisMonth,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/8",
      border: "border-emerald-500/20",
    },
    {
      label: "Clientes",
      value: data.totalClients,
      icon: Users,
      color: "text-violet-400",
      bg: "bg-violet-500/8",
      border: "border-violet-500/20",
      trend: data.newClientsThisMonth > 0 ? `+${data.newClientsThisMonth}` : null,
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-2"
    >
      {/* Primary row — 2 larger cards */}
      <div className="grid grid-cols-2 gap-2">
        {primaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            custom={i}
            variants={fadeUp}
            className={`relative rounded-xl border ${card.border} bg-card p-4 transition-all duration-300 hover:border-foreground/15 cursor-default ${card.glow}`}
          >
            {card.pulse && (
              <span className="absolute top-3 right-3 flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${card.color === "text-rose-400" ? "bg-rose-400" : "bg-amber-400"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${card.color === "text-rose-400" ? "bg-rose-400" : "bg-amber-400"}`} />
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">
                  {card.label}
                </span>
              </div>
              <p className={`font-display text-3xl font-extrabold ${card.color} leading-none tracking-tighter`}>
                {card.value}
              </p>
            </div>
            {card.trend && (
              <div className="flex items-center gap-1 mt-2 ml-11">
                {card.trendUp === true && <ArrowUpRight className="w-3 h-3 text-emerald-400/60" />}
                {card.trendUp === false && <ArrowDownRight className="w-3 h-3 text-amber-400/60" />}
                <span className={`text-[9px] font-medium ${
                  card.trendUp === true ? "text-emerald-400/50" :
                  card.trendUp === false ? "text-amber-400/50" :
                  "text-muted-foreground/40"
                }`}>
                  {card.trend}
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Secondary row — 4 compact cards */}
      <div className="grid grid-cols-4 gap-2">
        {secondaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            custom={i + 2}
            variants={fadeUp}
            className={`relative rounded-xl border ${card.border} bg-card px-3 py-3 transition-all duration-300 hover:border-foreground/15 cursor-default`}
          >
            {card.pulse && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
              </span>
            )}
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-6 h-6 rounded-md ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-3 h-3 ${card.color}`} />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold truncate">
                {card.label}
                {card.subtitle && <span className="text-muted-foreground/40 ml-1">{card.subtitle}</span>}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <p className={`font-display text-2xl font-extrabold ${card.color} leading-none tracking-tighter`}>
                {card.value}
              </p>
              {card.trend && (
                <span className="text-[9px] text-emerald-400/50 font-medium">{card.trend}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
