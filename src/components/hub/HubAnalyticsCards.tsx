import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  FolderOpen, FileText, Users, Scale, TrendingUp, TrendingDown, Minus, FileSearch
} from "lucide-react";

interface AnalyticsData {
  totalCases: number;
  totalForms: number;
  totalVawa: number;
  totalClients: number;
  clientsThisMonth: number;
  pendingForms: number;
  analyzedToday: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HubAnalyticsCards() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

  async function loadAnalytics() {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [casesRes, formsRes, vawaRes, clientsTotalRes, clientsMonthRes, pendingFormsRes, analyzedRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true }),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }),
        supabase.from("vawa_cases").select("id", { count: "exact", head: true }),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth.toISOString()),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("analysis_history").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
      ]);

      setData({
        totalCases: casesRes.count || 0,
        totalForms: formsRes.count || 0,
        totalVawa: vawaRes.count || 0,
        totalClients: clientsTotalRes.count || 0,
        clientsThisMonth: clientsMonthRes.count || 0,
        pendingForms: pendingFormsRes.count || 0,
        analyzedToday: analyzedRes.count || 0,
      });
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/20 bg-card/20 p-3 animate-pulse h-[72px]" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Casos Activos",
      value: data.totalCases,
      icon: FolderOpen,
      color: "text-emerald-400",
      bg: "bg-emerald-500/8",
      border: "border-emerald-500/15",
      trend: null as string | null,
    },
    {
      label: "En Preparación",
      value: data.pendingForms,
      icon: FileText,
      color: "text-accent",
      bg: "bg-accent/8",
      border: "border-accent/15",
      trend: data.totalForms > 0 ? `${data.totalForms} total` : null,
    },
    {
      label: "Docs Analizados Hoy",
      value: data.analyzedToday,
      icon: FileSearch,
      color: "text-purple-400",
      bg: "bg-purple-500/8",
      border: "border-purple-500/15",
      trend: null,
    },
    {
      label: "Clientes",
      value: data.totalClients,
      icon: Users,
      color: "text-jarvis",
      bg: "bg-jarvis/8",
      border: "border-jarvis/15",
      trend: data.clientsThisMonth > 0 ? `+${data.clientsThisMonth} este mes` : null,
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-2.5"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          variants={fadeUp}
          className={`relative rounded-lg border ${card.border} bg-card/30 backdrop-blur-sm p-3 transition-all duration-200 hover:bg-card/50 group cursor-default`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">{card.label}</span>
            <div className={`w-6 h-6 rounded-md ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-3 h-3 ${card.color}`} />
            </div>
          </div>
          <p className={`font-display text-xl font-bold ${card.color} leading-none`}>{card.value}</p>
          {card.trend && (
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-[9px] text-emerald-400/80 font-medium">{card.trend}</span>
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
