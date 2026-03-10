import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Users, FileText, FolderOpen,
  Scale, BarChart3, CheckCircle2, Clock, AlertCircle
} from "lucide-react";

interface CasesByStatus {
  pending: number;
  in_progress: number;
  completed: number;
}

interface AnalyticsData {
  casesByStatus: CasesByStatus;
  formsCompleted: number;
  formsDraft: number;
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

      const [
        casePendingRes, caseProgressRes, caseCompletedRes,
        formCompletedRes, formDraftRes,
        vawaRes,
        clientsMonthRes, clientsTotalRes
      ] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("client_cases").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("client_cases").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("vawa_cases").select("id", { count: "exact", head: true }),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth.toISOString()),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }),
      ]);

      setData({
        casesByStatus: {
          pending: casePendingRes.count || 0,
          in_progress: caseProgressRes.count || 0,
          completed: caseCompletedRes.count || 0,
        },
        formsCompleted: formCompletedRes.count || 0,
        formsDraft: formDraftRes.count || 0,
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
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-4 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const totalCases = data.casesByStatus.pending + data.casesByStatus.in_progress + data.casesByStatus.completed;

  const cards = [
    {
      label: "Pipeline de Casos",
      icon: FolderOpen,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      value: totalCases,
      breakdown: [
        { label: "Pendientes", value: data.casesByStatus.pending, icon: AlertCircle, color: "text-muted-foreground" },
        { label: "En progreso", value: data.casesByStatus.in_progress, icon: Clock, color: "text-jarvis" },
        { label: "Completados", value: data.casesByStatus.completed, icon: CheckCircle2, color: "text-emerald-400" },
      ],
    },
    {
      label: "Formularios",
      icon: FileText,
      color: "text-accent",
      bg: "bg-accent/10",
      value: data.formsCompleted + data.formsDraft,
      breakdown: [
        { label: "Completados", value: data.formsCompleted, icon: CheckCircle2, color: "text-emerald-400" },
        { label: "Borradores", value: data.formsDraft, icon: Clock, color: "text-accent" },
      ],
    },
    {
      label: "Clientes",
      icon: Users,
      color: "text-jarvis",
      bg: "bg-jarvis/10",
      value: data.clientsTotal,
      highlight: data.clientsThisMonth > 0 ? `+${data.clientsThisMonth} este mes` : undefined,
    },
    {
      label: "Casos VAWA",
      icon: Scale,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      value: data.totalVawa,
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="grid grid-cols-2 gap-3"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          custom={i}
          variants={fadeUp}
          className="relative overflow-hidden rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 hover:bg-card/50 hover:border-border/50 transition-all duration-200"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</span>
          </div>

          <p className={`font-display text-2xl font-bold ${card.color} mb-1`}>{card.value}</p>

          {card.highlight && (
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">{card.highlight}</span>
            </div>
          )}

          {card.breakdown && (
            <div className="space-y-1 mt-2">
              {card.breakdown.map(b => (
                <div key={b.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <b.icon className={`w-2.5 h-2.5 ${b.color}`} />
                    <span className="text-[10px] text-muted-foreground">{b.label}</span>
                  </div>
                  <span className={`text-xs font-semibold ${b.color}`}>{b.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Glass accent */}
          <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br from-jarvis/5 to-transparent pointer-events-none" />
        </motion.div>
      ))}
    </motion.div>
  );
}
