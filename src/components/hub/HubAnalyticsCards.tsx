import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Briefcase, AlertTriangle, Clock, FileText,
  CheckCircle2, Users, TrendingUp, ArrowUpRight, ArrowDownRight
} from "lucide-react";

interface AnalyticsData {
  activeCases: number;
  needAction: number;
  urgentDeadlines: number;
  formsInProgress: number;
  approvedThisMonth: number;
  totalClients: number;
  // trends
  newCasesThisWeek: number;
  newClientsThisMonth: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
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
        activeCasesRes,
        needActionRes,
        urgentDeadlinesRes,
        formsInProgressRes,
        approvedRes,
        totalClientsRes,
        newCasesWeekRes,
        newClientsMonthRes,
      ] = await Promise.all([
        // Active cases (not completed/closed)
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .not("status", "eq", "completed"),
        // Cases needing team action (ball_in_court = 'team')
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("ball_in_court", "team").not("status", "eq", "completed"),
        // Deadlines within 7 days
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("status", "active")
          .lte("deadline_date", sevenDaysFromNow.toISOString().split("T")[0]),
        // Draft forms in progress
        supabase.from("form_submissions").select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        // Cases approved this month (pipeline_stage contains 'aprobado' or status = 'approved')
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString()),
        // Total clients
        supabase.from("client_profiles").select("id", { count: "exact", head: true }),
        // New cases this week
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .gte("created_at", startOfWeek.toISOString()),
        // New clients this month
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
      <div className="grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[88px]" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Casos Activos",
      value: data.activeCases,
      icon: Briefcase,
      color: "text-jarvis",
      bg: "bg-jarvis/8",
      border: "border-jarvis/20",
      glow: "shadow-[0_0_20px_hsl(195_100%_50%/0.06)]",
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
      glow: data.needAction > 0 ? "shadow-[0_0_20px_hsl(38_100%_50%/0.06)]" : "",
      trend: data.needAction > 0 ? "Pendientes del equipo" : "Todo al día",
      trendUp: data.needAction === 0,
      pulse: data.needAction > 5,
    },
    {
      label: "Deadlines",
      subtitle: "< 7 días",
      value: data.urgentDeadlines,
      icon: Clock,
      color: data.urgentDeadlines > 0 ? "text-rose-400" : "text-emerald-400",
      bg: data.urgentDeadlines > 0 ? "bg-rose-500/8" : "bg-emerald-500/8",
      border: data.urgentDeadlines > 0 ? "border-rose-500/20" : "border-emerald-500/20",
      glow: data.urgentDeadlines > 0 ? "shadow-[0_0_20px_hsl(0_100%_50%/0.06)]" : "",
      trend: data.urgentDeadlines > 0 ? "Próximos a vencer" : "Sin urgencias",
      trendUp: data.urgentDeadlines === 0,
      pulse: data.urgentDeadlines > 0,
    },
    {
      label: "En Preparación",
      value: data.formsInProgress,
      icon: FileText,
      color: "text-cyan-400",
      bg: "bg-cyan-500/8",
      border: "border-cyan-500/20",
      glow: "",
      trend: data.formsInProgress > 0 ? "Formularios draft" : null,
      trendUp: null,
    },
    {
      label: "Completados",
      subtitle: "este mes",
      value: data.approvedThisMonth,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/8",
      border: "border-emerald-500/20",
      glow: data.approvedThisMonth > 0 ? "shadow-[0_0_20px_hsl(145_100%_40%/0.06)]" : "",
      trend: data.approvedThisMonth > 0 ? `${data.approvedThisMonth} cerrados` : "—",
      trendUp: data.approvedThisMonth > 0,
    },
    {
      label: "Clientes",
      value: data.totalClients,
      icon: Users,
      color: "text-violet-400",
      bg: "bg-violet-500/8",
      border: "border-violet-500/20",
      glow: "",
      trend: data.newClientsThisMonth > 0 ? `+${data.newClientsThisMonth} este mes` : null,
      trendUp: true,
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="grid grid-cols-3 gap-3"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          variants={fadeUp}
          className={`relative rounded-2xl border ${card.border} bg-card p-5 transition-all duration-300 hover:border-foreground/15 group cursor-default ${card.glow}`}
        >
          {/* Pulse dot for urgent items */}
          {card.pulse && (
            <span className="absolute top-3.5 right-3.5 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${card.color === "text-rose-400" ? "bg-rose-400" : "bg-amber-400"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${card.color === "text-rose-400" ? "bg-rose-400" : "bg-amber-400"}`} />
            </span>
          )}

          {/* Icon */}
          <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
            <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
          </div>

          {/* Value */}
          <p className={`font-display text-4xl font-extrabold ${card.color} leading-none tracking-tighter`}>
            {card.value}
          </p>

          {/* Label */}
          <div className="mt-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground/80 font-bold leading-none">
              {card.label}
            </span>
            {(card as any).subtitle && (
              <span className="text-[10px] text-muted-foreground/50 ml-1.5 font-medium">
                {(card as any).subtitle}
              </span>
            )}
          </div>

          {/* Trend */}
          {card.trend && (
            <div className="flex items-center gap-1 mt-2">
              {card.trendUp === true && <ArrowUpRight className="w-3 h-3 text-emerald-400/70" />}
              {card.trendUp === false && <ArrowDownRight className="w-3 h-3 text-amber-400/70" />}
              <span className={`text-[10px] font-medium leading-none ${
                card.trendUp === true ? "text-emerald-400/60" :
                card.trendUp === false ? "text-amber-400/60" :
                "text-muted-foreground/40"
              }`}>
                {card.trend}
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
