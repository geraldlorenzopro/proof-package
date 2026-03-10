import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Users, FileText, FolderOpen, Scale, TrendingUp
} from "lucide-react";

interface AnalyticsData {
  totalCases: number;
  totalForms: number;
  totalVawa: number;
  clientsThisMonth: number;
  clientsTotal: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HubAnalyticsCards() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [casesRes, formsRes, vawaRes, clientsMonthRes, clientsTotalRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true }),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }),
        supabase.from("vawa_cases").select("id", { count: "exact", head: true }),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth.toISOString()),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }),
      ]);

      setData({
        totalCases: casesRes.count || 0,
        totalForms: formsRes.count || 0,
        totalVawa: vawaRes.count || 0,
        clientsThisMonth: clientsMonthRes.count || 0,
        clientsTotal: clientsTotalRes.count || 0,
      });
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Casos",
      icon: FolderOpen,
      value: data.totalCases,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Formularios",
      icon: FileText,
      value: data.totalForms,
      color: "text-accent",
      bg: "bg-accent/10",
      border: "border-accent/20",
    },
    {
      label: "Clientes",
      icon: Users,
      value: data.clientsTotal,
      color: "text-jarvis",
      bg: "bg-jarvis/10",
      border: "border-jarvis/20",
      highlight: data.clientsThisMonth > 0 ? `+${data.clientsThisMonth} este mes` : undefined,
    },
    {
      label: "VAWA",
      icon: Scale,
      value: data.totalVawa,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          variants={fadeUp}
          className={`relative overflow-hidden rounded-xl border ${card.border} bg-card/40 backdrop-blur-sm p-4 transition-all duration-200 hover:bg-card/60`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</span>
          </div>
          <p className={`font-display text-2xl font-bold ${card.color}`}>{card.value}</p>
          {card.highlight && (
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">{card.highlight}</span>
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
