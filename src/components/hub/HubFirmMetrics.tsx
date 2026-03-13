import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, Users,
  CheckCircle2, Clock, BarChart3, Activity,
  ChevronDown, Zap, Target
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  LineChart, Line, CartesianGrid
} from "recharts";

interface FirmMetrics {
  case_velocity: Array<{ stage: string; transitions: number; avg_days_in_stage: number }>;
  bottlenecks: Array<{ stage: string; stuck_cases: number; avg_days_stuck: number; ball_in_court: string }>;
  team_productivity: Array<{ member_name: string; member_id: string; active_cases: number; completed_in_period: number; total_cases: number }>;
  task_metrics: { total: number; completed: number; pending: number; overdue: number; completion_rate: number };
  pipeline_distribution: Array<{ stage: string; count: number; team_action: number; client_action: number }>;
  monthly_trend: Array<{ month: string; opened: number; closed: number }>;
  period_days: number;
}

const STAGE_LABELS: Record<string, string> = {
  "caso-no-iniciado": "No Iniciado",
  "elegibilidad": "Elegibilidad",
  "recopilacion-evidencias": "Evidencias",
  "preparacion-formularios": "Formularios",
  "revision-qa": "Revisión QA",
  "filing": "Filing",
  "seguimiento-uscis": "Seguimiento",
  "aprobado": "Aprobado",
  "sin-etapa": "Sin Etapa",
};

function stageLabel(s: string) {
  return STAGE_LABELS[s] || s.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function HubFirmMetrics() {
  const [data, setData] = useState<FirmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_firm_metrics", { _days: period });
      if (!error && result && !(result as any).error) {
        setData(result as unknown as FirmMetrics);
      }
    } catch (e) {
      console.error("Metrics load error:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground/40" />
          <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
            Métricas de la Firma
          </h3>
          <div className="h-px flex-1 bg-border/15" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[90px]" />
          ))}
        </div>
      </section>
    );
  }

  if (!data) return null;

  const totalBottlenecked = data.bottlenecks.reduce((s, b) => s + b.stuck_cases, 0);
  const totalActive = data.pipeline_distribution.reduce((s, p) => s + p.count, 0);
  const teamActionTotal = data.pipeline_distribution.reduce((s, p) => s + p.team_action, 0);

  // Chart data for monthly trend
  const trendData = data.monthly_trend.map(m => ({
    month: m.month.slice(5), // "03" from "2026-03"
    opened: m.opened,
    closed: m.closed,
  }));

  // Pipeline distribution for bar chart
  const pipelineData = data.pipeline_distribution.slice(0, 6).map(p => ({
    name: stageLabel(p.stage).slice(0, 12),
    cases: p.count,
    team: p.team_action,
    client: p.client_action,
  }));

  return (
    <section className="space-y-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full group"
      >
        <BarChart3 className="w-4 h-4 text-jarvis/60" strokeWidth={2.5} />
        <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
          Métricas de la Firma
        </h3>
        <div className="h-px flex-1 bg-border/15" />
        {/* Period selector */}
        <div className="flex gap-1 mr-2" onClick={e => e.stopPropagation()}>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md transition-all ${
                period === d
                  ? "bg-jarvis/15 text-jarvis border border-jarvis/20"
                  : "text-muted-foreground/40 hover:text-muted-foreground/60"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/30 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25 }}
          className="space-y-3"
        >
          {/* ═══ TOP KPI ROW ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Task Completion Rate */}
            <MetricCard
              icon={Target}
              label="Tasa de Completación"
              value={`${data.task_metrics.completion_rate}%`}
              color={data.task_metrics.completion_rate >= 70 ? "emerald" : data.task_metrics.completion_rate >= 40 ? "amber" : "rose"}
              sub={`${data.task_metrics.completed}/${data.task_metrics.total} tareas`}
            />
            {/* Overdue Tasks */}
            <MetricCard
              icon={AlertTriangle}
              label="Tareas Vencidas"
              value={data.task_metrics.overdue}
              color={data.task_metrics.overdue > 0 ? "rose" : "emerald"}
              sub={data.task_metrics.overdue > 0 ? "Requieren atención" : "Al día"}
              pulse={data.task_metrics.overdue > 3}
            />
            {/* Bottlenecked Cases */}
            <MetricCard
              icon={Clock}
              label="Casos Estancados"
              value={totalBottlenecked}
              color={totalBottlenecked > 0 ? "amber" : "emerald"}
              sub={totalBottlenecked > 0 ? `> 7 días sin movimiento` : "Flujo normal"}
              pulse={totalBottlenecked > 5}
            />
            {/* Team Action Required */}
            <MetricCard
              icon={Zap}
              label="Acción del Equipo"
              value={teamActionTotal}
              color={teamActionTotal > 0 ? "jarvis" : "emerald"}
              sub={`de ${totalActive} activos`}
            />
          </div>

          {/* ═══ CHARTS ROW ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Monthly Trend */}
            {trendData.length > 0 && (
              <div className="rounded-xl border border-border/15 bg-card/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-jarvis/60" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Tendencia Mensual
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground)/0.5)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground)/0.5)" }} width={25} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    />
                    <Line type="monotone" dataKey="opened" stroke="hsl(195, 100%, 50%)" strokeWidth={2} dot={{ r: 3 }} name="Abiertos" />
                    <Line type="monotone" dataKey="closed" stroke="hsl(145, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} name="Cerrados" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pipeline Distribution */}
            {pipelineData.length > 0 && (
              <div className="rounded-xl border border-border/15 bg-card/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400/60" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Distribución Pipeline
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={pipelineData} barSize={16}>
                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground)/0.5)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground)/0.5)" }} width={20} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="team" stackId="a" fill="hsl(195, 100%, 50%)" radius={[0, 0, 0, 0]} name="Equipo" />
                    <Bar dataKey="client" stackId="a" fill="hsl(195, 100%, 50%, 0.3)" radius={[4, 4, 0, 0]} name="Cliente" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ═══ TEAM PRODUCTIVITY TABLE ═══ */}
          {data.team_productivity.length > 0 && (
            <div className="rounded-xl border border-border/15 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5 text-violet-400/60" />
                <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                  Productividad del Equipo
                </span>
                <Badge className="bg-muted text-muted-foreground text-[8px] border-border/20 ml-auto">
                  Últimos {period} días
                </Badge>
              </div>
              <div className="space-y-1.5">
                {data.team_productivity.map((member, idx) => {
                  const maxCases = Math.max(...data.team_productivity.map(m => m.active_cases), 1);
                  const barWidth = (member.active_cases / maxCases) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-3 group">
                      <div className="w-28 truncate">
                        <span className="text-xs font-semibold text-foreground/80">{member.member_name}</span>
                      </div>
                      <div className="flex-1 h-5 rounded-md bg-foreground/[0.03] relative overflow-hidden">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-jarvis/30 to-jarvis/10 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono font-bold text-foreground/60">
                          {member.active_cases} activos
                        </span>
                      </div>
                      <div className="flex items-center gap-1 w-20 justify-end">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400/50" />
                        <span className="text-[10px] font-mono text-emerald-400/70">{member.completed_in_period}</span>
                        <span className="text-[9px] text-muted-foreground/40">cerrados</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ BOTTLENECK ALERTS ═══ */}
          {data.bottlenecks.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70" />
                <span className="text-[10px] font-display font-bold tracking-widest uppercase text-amber-400/70">
                  Cuellos de Botella Detectados
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.bottlenecks.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg bg-card/50 border border-border/10 px-3 py-2">
                    <div className={`w-2 h-2 rounded-full ${b.avg_days_stuck > 14 ? "bg-rose-400" : "bg-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground/80">{stageLabel(b.stage)}</span>
                      <span className="text-[10px] text-muted-foreground/50 ml-2">
                        {b.ball_in_court === "client" ? "⏳ Cliente" : "👥 Equipo"}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-amber-400">{b.stuck_cases}</span>
                      <span className="text-[9px] text-muted-foreground/40 ml-1">casos</span>
                      <p className="text-[9px] text-muted-foreground/40">~{b.avg_days_stuck}d</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ CASE VELOCITY ═══ */}
          {data.case_velocity.length > 0 && (
            <div className="rounded-xl border border-border/15 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400/60" />
                <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                  Velocidad por Etapa
                </span>
                <span className="text-[9px] text-muted-foreground/40 ml-auto">Promedio días en cada etapa</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.case_velocity.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg bg-foreground/[0.03] border border-border/10 px-3 py-2">
                    <span className="text-[11px] font-semibold text-foreground/70">{stageLabel(v.stage)}</span>
                    <span className={`text-sm font-bold font-mono ${
                      v.avg_days_in_stage > 14 ? "text-rose-400" :
                      v.avg_days_in_stage > 7 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>
                      {v.avg_days_in_stage}d
                    </span>
                    <span className="text-[9px] text-muted-foreground/40">({v.transitions})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
}

// ═══ METRIC CARD COMPONENT ═══
function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
  pulse,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  pulse?: boolean;
}) {
  const colorMap: Record<string, { text: string; bg: string; border: string }> = {
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/20" },
    amber: { text: "text-amber-400", bg: "bg-amber-500/8", border: "border-amber-500/20" },
    rose: { text: "text-rose-400", bg: "bg-rose-500/8", border: "border-rose-500/20" },
    jarvis: { text: "text-jarvis", bg: "bg-jarvis/8", border: "border-jarvis/20" },
    violet: { text: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/20" },
  };

  const c = colorMap[color] || colorMap.jarvis;

  return (
    <div className={`relative rounded-xl border ${c.border} bg-card p-4 transition-all`}>
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color === "rose" ? "bg-rose-400" : "bg-amber-400"}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${color === "rose" ? "bg-rose-400" : "bg-amber-400"}`} />
        </span>
      )}
      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-3.5 h-3.5 ${c.text}`} />
      </div>
      <p className={`font-display text-2xl font-extrabold ${c.text} leading-none tracking-tighter`}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/70 font-bold mt-1.5">{label}</p>
      {sub && (
        <p className="text-[9px] text-muted-foreground/40 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
