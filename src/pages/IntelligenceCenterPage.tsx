import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, BarChart3, Gauge, Users, Activity, TrendingUp,
  Target, Weight, AlertTriangle, CheckCircle2, Clock,
  Zap, CalendarClock, ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from "recharts";

// ═══ TYPES ═══
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

const CLIENT_WAIT_STAGES = new Set(["recopilacion-evidencias"]);
const CLIENT_BALL = "client";

const PERIOD_OPTIONS = [
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 365, label: "Este año" },
];

function stageLabel(s: string) {
  return STAGE_LABELS[s] || s.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function IntelligenceCenterPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<FirmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
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
      console.error("Intelligence Center load error:", e);
    } finally {
      setLoading(false);
    }
  }

  // ═══ DERIVED DATA ═══
  const netVelocity = data?.case_velocity.map(v => ({
    ...v,
    net_days: CLIENT_WAIT_STAGES.has(v.stage) ? 0 : v.avg_days_in_stage,
    is_client_time: CLIENT_WAIT_STAGES.has(v.stage),
  })) ?? [];

  const totalGrossDays = data?.case_velocity.reduce((s, v) => s + v.avg_days_in_stage, 0) ?? 0;
  const totalClientDays = netVelocity.filter(v => v.is_client_time).reduce((s, v) => s + v.avg_days_in_stage, 0);
  const totalNetDays = Math.max(0, totalGrossDays - totalClientDays);
  const efficiencyRatio = totalGrossDays > 0 ? Math.round((totalNetDays / totalGrossDays) * 100) : 100;

  const teamActionTotal = data?.pipeline_distribution.reduce((s, p) => s + p.team_action, 0) ?? 0;
  const clientActionTotal = data?.pipeline_distribution.reduce((s, p) => s + p.client_action, 0) ?? 0;
  const totalActive = data?.pipeline_distribution.reduce((s, p) => s + p.count, 0) ?? 0;

  const teamBottlenecks = data?.bottlenecks.filter(b => b.ball_in_court !== CLIENT_BALL) ?? [];

  const trendData = data?.monthly_trend.map(m => ({
    month: m.month.slice(5),
    opened: m.opened,
    closed: m.closed,
  })) ?? [];

  const pipelineData = data?.pipeline_distribution.slice(0, 8).map(p => ({
    name: stageLabel(p.stage).slice(0, 14),
    total: p.count,
    team: p.team_action,
    client: p.client_action,
  })) ?? [];

  const pieData = [
    { name: "Equipo", value: teamActionTotal, fill: "hsl(var(--jarvis))" },
    { name: "Cliente", value: clientActionTotal, fill: "hsl(195, 100%, 50%, 0.4)" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ TOP BAR ═══ */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 py-3">
          <button
            onClick={() => navigate("/hub")}
            className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-medium">Hub</span>
          </button>

          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-bold text-foreground tracking-wide">Centro de Inteligencia</h1>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-card border border-border/30 rounded-lg p-0.5">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${
                  period === opt.value
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "text-muted-foreground/50 hover:text-muted-foreground/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.header>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-5 py-6 space-y-6">

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[120px]" />
            ))}
          </div>
        ) : !data ? (
          <div className="text-center py-20">
            <BarChart3 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay datos suficientes para mostrar métricas.</p>
          </div>
        ) : (
          <>
            {/* ═══ ROW 1 — EFFICIENCY CLOCK (Hero) ═══ */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader icon={Gauge} label="Reloj de Eficiencia" subtitle="Net Case Velocity" color="text-accent" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                {/* Big efficiency gauge */}
                <div className="lg:col-span-1 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-6 flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-accent/60 font-bold mb-2">Eficiencia Neta</p>
                  <p className="font-display text-6xl font-black text-accent leading-none tracking-tighter">
                    {efficiencyRatio}%
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    del tiempo es productivo para la firma
                  </p>
                </div>

                {/* Breakdown */}
                <div className="lg:col-span-2 rounded-2xl border border-border/15 bg-card/50 p-5">
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <VelocityCard label="Tiempo Bruto" value={`${totalGrossDays.toFixed(1)}d`} color="text-muted-foreground/70" />
                    <VelocityCard label="Espera Cliente" value={`−${totalClientDays.toFixed(1)}d`} color="text-cyan-400" />
                    <VelocityCard label="Tiempo Neto" value={`${totalNetDays.toFixed(1)}d`} color="text-accent" highlight />
                  </div>

                  {/* Per-stage velocity bars */}
                  <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/40 font-bold mb-2">
                    Velocidad por Etapa (solo tiempo del equipo)
                  </p>
                  <div className="space-y-1.5">
                    {netVelocity.filter(v => !v.is_client_time).slice(0, 6).map((v, i) => {
                      const maxDays = Math.max(...netVelocity.filter(x => !x.is_client_time).map(x => x.net_days), 1);
                      const pct = (v.net_days / maxDays) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground/60 w-24 truncate font-medium">
                            {stageLabel(v.stage)}
                          </span>
                          <div className="flex-1 h-5 rounded bg-foreground/[0.03] relative overflow-hidden">
                            <div
                              className={`h-full rounded transition-all duration-700 ${
                                v.net_days > 14 ? "bg-rose-500/30" : v.net_days > 7 ? "bg-amber-500/25" : "bg-accent/25"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                            <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono font-bold text-foreground/50">
                              {v.net_days.toFixed(1)}d
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ═══ ROW 2 — WORKLOAD + PIPELINE ═══ */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {/* Weighted Workload */}
              <div>
                <SectionHeader icon={Weight} label="Carga del Equipo" subtitle="Ponderada por complejidad" color="text-violet-400" />
                <div className="rounded-2xl border border-border/15 bg-card/50 p-5 mt-3">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-wider">Pesos:</span>
                    <span className="text-[9px] text-emerald-400/80 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">Bajo 2pts</span>
                    <span className="text-[9px] text-jarvis/80 font-mono bg-jarvis/10 px-2 py-0.5 rounded">Medio 5pts</span>
                    <span className="text-[9px] text-rose-400/80 font-mono bg-rose-500/10 px-2 py-0.5 rounded">Alto 9pts</span>
                  </div>

                  <div className="space-y-2">
                    {data.team_productivity.map((member, idx) => {
                      const weightedPoints = member.active_cases * 5;
                      const maxPoints = Math.max(...data.team_productivity.map(m => m.active_cases * 5), 1);
                      const barWidth = (weightedPoints / maxPoints) * 100;
                      const isSaturated = weightedPoints >= 40;
                      const isHigh = weightedPoints >= 25;

                      return (
                        <div key={idx} className="flex items-center gap-3 group">
                          <div className="w-28 truncate">
                            <span className="text-xs font-semibold text-foreground/80">{member.member_name}</span>
                          </div>
                          <div className="flex-1 h-7 rounded-lg bg-foreground/[0.03] relative overflow-hidden">
                            <div
                              className={`h-full rounded-lg transition-all duration-700 ${
                                isSaturated ? "bg-gradient-to-r from-rose-500/40 to-rose-500/15"
                                : isHigh ? "bg-gradient-to-r from-amber-500/30 to-amber-500/10"
                                : "bg-gradient-to-r from-violet-500/30 to-violet-500/10"
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                            <span className="absolute inset-0 flex items-center px-3 text-[10px] font-mono font-bold text-foreground/60">
                              {weightedPoints} pts · {member.active_cases} casos
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 w-20 justify-end">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400/50" />
                            <span className="text-[10px] font-mono text-emerald-400/70">{member.completed_in_period}</span>
                          </div>
                          {isSaturated && (
                            <span className="flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {data.team_productivity.length === 0 && (
                      <p className="text-xs text-muted-foreground/50 text-center py-6">Sin datos de equipo</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pipeline Distribution */}
              <div>
                <SectionHeader icon={BarChart3} label="Pipeline Distribution" subtitle="Equipo vs Cliente por etapa" color="text-jarvis" />
                <div className="rounded-2xl border border-border/15 bg-card/50 p-5 mt-3">
                  {/* Summary donut */}
                  <div className="flex items-center gap-6 mb-4">
                    <div className="w-24 h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={40} strokeWidth={0}>
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-jarvis/70" />
                        <span className="text-xs text-foreground/70 font-medium">Equipo: {teamActionTotal}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-cyan-400/50" />
                        <span className="text-xs text-foreground/70 font-medium">Cliente: {clientActionTotal}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground/40">{totalActive} casos activos total</p>
                    </div>
                  </div>

                  {/* Stacked bar chart */}
                  {pipelineData.length > 0 && (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={pipelineData} barSize={20}>
                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground)/0.5)" }} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground)/0.5)" }} width={22} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="team" stackId="a" fill="hsl(var(--jarvis))" name="Equipo" />
                        <Bar dataKey="client" stackId="a" fill="hsl(195, 100%, 50%, 0.4)" radius={[4, 4, 0, 0]} name="Cliente" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </motion.section>

            {/* ═══ ROW 3 — TRENDS + COMPLETION ═══ */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <SectionHeader icon={TrendingUp} label="Tendencias Mensuales" subtitle="Crecimiento y completación" color="text-emerald-400" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                {/* Monthly trend chart */}
                <div className="lg:col-span-2 rounded-2xl border border-border/15 bg-card/50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-3.5 h-3.5 text-jarvis/60" />
                    <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                      Casos Abiertos vs Cerrados
                    </span>
                  </div>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground)/0.5)" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground)/0.5)" }} width={30} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="opened" stroke="hsl(195, 100%, 50%)" strokeWidth={2.5} dot={{ r: 4 }} name="Abiertos" />
                        <Line type="monotone" dataKey="closed" stroke="hsl(145, 70%, 50%)" strokeWidth={2.5} dot={{ r: 4 }} name="Cerrados" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 text-center py-10">Sin datos de tendencia</p>
                  )}
                </div>

                {/* Completion rate */}
                <div className="rounded-2xl border border-border/15 bg-card/50 p-5 flex flex-col items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-400/60 mb-3" />
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50 font-bold mb-2">
                    Tasa de Completación
                  </p>
                  <p className={`font-display text-5xl font-black leading-none tracking-tighter ${
                    data.task_metrics.completion_rate >= 70 ? "text-emerald-400"
                    : data.task_metrics.completion_rate >= 40 ? "text-amber-400"
                    : "text-rose-400"
                  }`}>
                    {data.task_metrics.completion_rate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    {data.task_metrics.completed}/{data.task_metrics.total} tareas
                  </p>

                  <div className="w-full mt-5 pt-4 border-t border-border/10 grid grid-cols-2 gap-3">
                    <MiniStat label="Pendientes" value={data.task_metrics.pending} color={data.task_metrics.pending > 10 ? "text-amber-400" : "text-muted-foreground/70"} />
                    <MiniStat label="Vencidas" value={data.task_metrics.overdue} color={data.task_metrics.overdue > 0 ? "text-rose-400" : "text-emerald-400"} />
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ═══ ROW 4 — BOTTLENECKS ═══ */}
            {teamBottlenecks.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <SectionHeader icon={ShieldAlert} label="Alertas de Cuellos de Botella" subtitle={`${teamBottlenecks.length} etapas con retraso`} color="text-rose-400" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
                  {teamBottlenecks.map((b, idx) => (
                    <div key={idx} className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-foreground/80">{stageLabel(b.stage)}</span>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${b.avg_days_stuck > 14 ? "bg-rose-400 animate-pulse" : "bg-amber-400"}`} />
                      </div>
                      <p className="font-display text-2xl font-black text-rose-400 leading-none">{b.stuck_cases}</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-1">~{b.avg_days_stuck} días promedio</p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══ HELPER COMPONENTS ═══ */

function SectionHeader({ icon: Icon, label, subtitle, color }: { icon: any; label: string; subtitle: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={`w-4 h-4 ${color}`} strokeWidth={2.5} />
      <h2 className={`text-xs font-display font-bold tracking-wide uppercase ${color}`}>{label}</h2>
      <span className="text-[10px] text-muted-foreground/40 font-medium">{subtitle}</span>
      <div className="h-px flex-1 bg-border/10" />
    </div>
  );
}

function VelocityCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`text-center p-3 rounded-xl ${highlight ? "bg-accent/[0.06] border border-accent/15" : ""}`}>
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 font-bold mb-1">{label}</p>
      <p className={`font-display text-2xl font-extrabold ${color} leading-none tracking-tighter`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`font-display text-xl font-extrabold ${color} leading-none`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold mt-1">{label}</p>
    </div>
  );
}
