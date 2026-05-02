import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  AlertTriangle, Users, CheckCircle2, Clock, BarChart3, Activity,
  ChevronDown, Zap, Target, TrendingUp, CalendarClock, ShieldAlert,
  Weight, Gauge
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
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

// ═══ CLIENT-WAIT STAGES — excluded from Net Case Velocity ═══
const CLIENT_WAIT_STAGES = new Set([
  "recopilacion-evidencias", // client gathering docs
]);

const CLIENT_BALL = "client";

// ═══ COMPLEXITY WEIGHTS — effort multipliers by case type ═══
const CASE_COMPLEXITY: Record<string, { points: number; level: string }> = {
  "I-90":  { points: 2, level: "Bajo" },
  "I-751": { points: 2, level: "Bajo" },
  "N-400": { points: 5, level: "Medio" },
  "I-130": { points: 5, level: "Medio" },
  "I-485": { points: 5, level: "Medio" },
  "I-765": { points: 5, level: "Medio" },
  "I-131": { points: 2, level: "Bajo" },
  "I-140": { points: 9, level: "Alto" },
  "EB-1":  { points: 9, level: "Alto" },
  "O-1":   { points: 9, level: "Alto" },
  "Asilo": { points: 9, level: "Alto" },
  "PERM":  { points: 9, level: "Alto" },
  "VAWA":  { points: 9, level: "Alto" },
};

function getComplexityPoints(caseType: string): number {
  return CASE_COMPLEXITY[caseType]?.points ?? 5; // default Medium
}

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/15 bg-card/30 animate-pulse h-[90px]" />
          ))}
        </div>
      </section>
    );
  }

  if (!data) return null;

  // ═══ DERIVED DATA ═══
  const totalBottlenecked = data.bottlenecks.reduce((s, b) => s + b.stuck_cases, 0);
  const teamBottlenecks = data.bottlenecks.filter(b => b.ball_in_court !== CLIENT_BALL);
  const totalActive = data.pipeline_distribution.reduce((s, p) => s + p.count, 0);
  const teamActionTotal = data.pipeline_distribution.reduce((s, p) => s + p.team_action, 0);
  const clientActionTotal = data.pipeline_distribution.reduce((s, p) => s + p.client_action, 0);

  // ═══ NET CASE VELOCITY — subtract client wait time ═══
  const netVelocity = data.case_velocity.map(v => {
    const isClientStage = CLIENT_WAIT_STAGES.has(v.stage);
    return {
      ...v,
      net_days: isClientStage ? 0 : v.avg_days_in_stage,
      is_client_time: isClientStage,
    };
  });
  const totalGrossDays = data.case_velocity.reduce((s, v) => s + v.avg_days_in_stage, 0);
  const totalClientDays = netVelocity.filter(v => v.is_client_time).reduce((s, v) => s + v.avg_days_in_stage, 0);
  const totalNetDays = Math.max(0, totalGrossDays - totalClientDays);

  const trendData = data.monthly_trend.map(m => ({
    month: m.month.slice(5),
    opened: m.opened,
    closed: m.closed,
  }));

  const pipelineData = data.pipeline_distribution.slice(0, 6).map(p => ({
    name: stageLabel(p.stage).slice(0, 12),
    cases: p.count,
    team: p.team_action,
    client: p.client_action,
  }));

  const hasUrgency = teamBottlenecks.length > 0 || data.task_metrics.overdue > 0;

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
          className="space-y-4"
        >
          {/* ════════════════════════════════════════════════════════
               NIVEL 2 — 🔴 URGENCIAS
             ════════════════════════════════════════════════════════ */}
          <div>
            <SectionLabel icon={ShieldAlert} label="Urgencias" color={hasUrgency ? "text-rose-400/80" : "text-emerald-400/60"} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {/* Bottlenecks internos */}
              <div className={`rounded-xl border p-4 ${
                teamBottlenecks.length > 0
                  ? "border-rose-500/25 bg-rose-500/[0.04]"
                  : "border-emerald-500/20 bg-emerald-500/[0.03]"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className={`w-3.5 h-3.5 ${teamBottlenecks.length > 0 ? "text-rose-400/80" : "text-emerald-400/60"}`} />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Bottlenecks Internos
                  </span>
                  {totalBottlenecked > 0 && (
                    <Badge className="ml-auto bg-rose-500/15 text-rose-400 border-rose-500/20 text-[8px]">
                      {totalBottlenecked} casos
                    </Badge>
                  )}
                </div>
                {teamBottlenecks.length > 0 ? (
                  <div className="space-y-1.5">
                    {teamBottlenecks.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-lg bg-card/60 border border-border/10 px-3 py-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${b.avg_days_stuck > 14 ? "bg-rose-400 animate-pulse" : "bg-amber-400"}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-foreground/80">{stageLabel(b.stage)}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-rose-400">{b.stuck_cases}</span>
                          <span className="text-[9px] text-muted-foreground/40 ml-1">· ~{b.avg_days_stuck}d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400/70 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sin cuellos de botella internos
                  </p>
                )}
              </div>

              {/* Tareas vencidas + velocity alerts */}
              <div className={`rounded-xl border p-4 ${
                data.task_metrics.overdue > 0
                  ? "border-amber-500/25 bg-amber-500/[0.04]"
                  : "border-emerald-500/20 bg-emerald-500/[0.03]"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock className={`w-3.5 h-3.5 ${data.task_metrics.overdue > 0 ? "text-amber-400/80" : "text-emerald-400/60"}`} />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Tareas & Deadlines Críticos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MiniKpi
                    label="Vencidas"
                    value={data.task_metrics.overdue}
                    color={data.task_metrics.overdue > 0 ? "rose" : "emerald"}
                    pulse={data.task_metrics.overdue > 3}
                  />
                  <MiniKpi
                    label="Pendientes"
                    value={data.task_metrics.pending}
                    color={data.task_metrics.pending > 10 ? "amber" : "muted"}
                  />
                </div>

                {data.case_velocity.filter(v => v.avg_days_in_stage > 14).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/10">
                    <p className="text-[9px] uppercase tracking-widest text-rose-400/60 font-bold mb-1.5">Etapas lentas (&gt;14d)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.case_velocity.filter(v => v.avg_days_in_stage > 14).map((v, i) => (
                        <span key={i} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/15 rounded-md px-2 py-0.5 font-mono font-bold">
                          {stageLabel(v.stage)} · {v.avg_days_in_stage}d
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════
               NIVEL 3 — 🟡 FLUJO DE TRABAJO
             ════════════════════════════════════════════════════════ */}
          <div>
            <SectionLabel icon={Activity} label="Flujo de Trabajo" color="text-jarvis/80" />

            {/* Two-lane summary */}
            <div className="grid grid-cols-2 gap-2.5 mt-2">
              <div className="rounded-xl border border-jarvis/15 bg-jarvis/[0.03] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5 text-jarvis/70" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Acción del Equipo
                  </span>
                </div>
                <p className="font-display text-3xl font-extrabold text-jarvis leading-none tracking-tighter">
                  {teamActionTotal}
                </p>
                <p className="text-[9px] text-muted-foreground/40 mt-1">
                  casos requieren acción interna
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.03] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400/70" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Esperando al Cliente
                  </span>
                </div>
                <p className="font-display text-3xl font-extrabold text-cyan-400 leading-none tracking-tighter">
                  {clientActionTotal}
                </p>
                <p className="text-[9px] text-muted-foreground/40 mt-1">
                  casos pendientes de cliente
                </p>
              </div>
            </div>

            {/* Net Case Velocity — Efficiency Clock */}
            <div className="rounded-xl border border-jarvis/15 bg-card/50 p-4 mt-2.5">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-3.5 h-3.5 text-jarvis/60" />
                <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                  Reloj de Eficiencia (Net Velocity)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold mb-1">Tiempo Bruto</p>
                  <p className="font-display text-2xl font-extrabold text-muted-foreground/70 leading-none">{totalGrossDays.toFixed(1)}<span className="text-xs font-normal ml-0.5">d</span></p>
                </div>
                <div className="text-center border-x border-border/10">
                  <p className="text-[9px] uppercase tracking-widest text-cyan-400/60 font-bold mb-1">Espera Cliente</p>
                  <p className="font-display text-2xl font-extrabold text-cyan-400/70 leading-none">−{totalClientDays.toFixed(1)}<span className="text-xs font-normal ml-0.5">d</span></p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-jarvis/70 font-bold mb-1">Tiempo Neto</p>
                  <p className="font-display text-2xl font-extrabold text-jarvis leading-none">{totalNetDays.toFixed(1)}<span className="text-xs font-normal ml-0.5">d</span></p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/30 mt-2 text-center">
                La eficiencia del equipo se mide solo sobre el tiempo bajo su responsabilidad
              </p>
            </div>

            {/* Pipeline distribution chart */}
            {pipelineData.length > 0 && (
              <div className="rounded-xl border border-border/15 bg-card/50 p-4 mt-2.5">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Pipeline por Etapa
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-jarvis/70" />
                      <span className="text-[8px] text-muted-foreground/50">Equipo</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-cyan-400/50" />
                      <span className="text-[8px] text-muted-foreground/50">Cliente</span>
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={pipelineData} barSize={18}>
                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground)/0.5)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground)/0.5)" }} width={20} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="team" stackId="a" fill="hsl(var(--jarvis))" radius={[0, 0, 0, 0]} name="Equipo" />
                    <Bar dataKey="client" stackId="a" fill="hsl(195, 100%, 50%, 0.4)" radius={[4, 4, 0, 0]} name="Cliente" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════
               NIVEL 4 — 👥 CARGA DEL EQUIPO (Weighted)
             ════════════════════════════════════════════════════════ */}
          {data.team_productivity.length > 0 && (
            <div>
              <SectionLabel icon={Weight} label="Carga del Equipo (Ponderada)" color="text-violet-400/80" />

              <div className="rounded-xl border border-border/15 bg-card/50 p-4 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-violet-400/60" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Esfuerzo por Miembro
                  </span>
                  <Badge className="bg-muted text-muted-foreground text-[8px] border-border/20 ml-auto">
                    Últimos {period}d
                  </Badge>
                </div>

                {/* Complexity legend */}
                <div className="flex items-center gap-3 mb-3 mt-2">
                  <span className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-wider">Pesos:</span>
                  <span className="text-[8px] text-emerald-400/70 font-mono">Bajo 2pts</span>
                  <span className="text-[8px] text-jarvis/70 font-mono">Medio 5pts</span>
                  <span className="text-[8px] text-rose-400/70 font-mono">Alto 9pts</span>
                </div>

                <div className="space-y-1.5">
                  {data.team_productivity.map((member, idx) => {
                    // Weighted: active_cases * avg complexity (approximated as 5 since we don't have per-member case types from this RPC)
                    const weightedPoints = member.active_cases * 5; // Default medium weight
                    const maxPoints = Math.max(...data.team_productivity.map(m => m.active_cases * 5), 1);
                    const barWidth = (weightedPoints / maxPoints) * 100;
                    const isSaturated = weightedPoints >= 40;
                    const isHigh = weightedPoints >= 25;

                    return (
                      <div key={idx} className="flex items-center gap-3 group">
                        <div className="w-28 truncate">
                          <span className="text-xs font-semibold text-foreground/80">{member.member_name}</span>
                        </div>
                        <div className="flex-1 h-6 rounded-md bg-foreground/[0.03] relative overflow-hidden">
                          <div
                            className={`h-full rounded-md transition-all duration-500 ${
                              isSaturated
                                ? "bg-gradient-to-r from-rose-500/40 to-rose-500/15"
                                : isHigh
                                ? "bg-gradient-to-r from-amber-500/30 to-amber-500/10"
                                : "bg-gradient-to-r from-jarvis/30 to-jarvis/10"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono font-bold text-foreground/60">
                            {weightedPoints} pts · {member.active_cases} casos
                          </span>
                        </div>
                        <div className="flex items-center gap-1 w-20 justify-end">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400/50" />
                          <span className="text-[10px] font-mono text-emerald-400/70">{member.completed_in_period}</span>
                          <span className="text-[9px] text-muted-foreground/40">cerr.</span>
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
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
               NIVEL 5 — 🟢 TENDENCIAS Y PIPELINE
             ════════════════════════════════════════════════════════ */}
          <div>
            <SectionLabel icon={TrendingUp} label="Tendencias" color="text-emerald-400/80" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {/* Monthly Trend */}
              {trendData.length > 0 && (
                <div className="rounded-xl border border-border/15 bg-card/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5 text-jarvis/60" />
                    <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                      Casos Abiertos vs Cerrados
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

              {/* Completion Rate + Velocity Summary */}
              <div className="rounded-xl border border-border/15 bg-card/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span className="text-[10px] font-display font-bold tracking-widest uppercase text-muted-foreground/60">
                    Tasa de Completación
                  </span>
                </div>

                <div className="flex items-end gap-3 mb-4">
                  <p className={`font-display text-4xl font-extrabold leading-none tracking-tighter ${
                    data.task_metrics.completion_rate >= 70 ? "text-emerald-400" :
                    data.task_metrics.completion_rate >= 40 ? "text-amber-400" :
                    "text-rose-400"
                  }`}>
                    {data.task_metrics.completion_rate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 pb-1">
                    {data.task_metrics.completed}/{data.task_metrics.total} tareas
                  </p>
                </div>

                {data.case_velocity.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold mb-1.5">
                      Velocidad Neta por Etapa
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {netVelocity.filter(v => !v.is_client_time).slice(0, 5).map((v, i) => (
                        <span
                          key={i}
                          className={`text-[10px] border rounded-md px-2 py-0.5 font-mono font-bold ${
                            v.avg_days_in_stage > 14
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/15"
                              : v.avg_days_in_stage > 7
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                          }`}
                        >
                          {stageLabel(v.stage)} · {v.net_days.toFixed(1)}d
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}

/* ═══ SECTION LABEL ═══ */
function SectionLabel({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`text-[9px] font-display font-bold tracking-[0.3em] uppercase ${color}`}>
        {label}
      </span>
      <div className="h-px flex-1 bg-border/10" />
    </div>
  );
}

/* ═══ MINI KPI ═══ */
function MiniKpi({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  const colorMap: Record<string, { text: string; bg: string }> = {
    rose: { text: "text-rose-400", bg: "bg-rose-500/10" },
    amber: { text: "text-amber-400", bg: "bg-amber-500/10" },
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10" },
    muted: { text: "text-muted-foreground/70", bg: "bg-foreground/[0.03]" },
  };
  const c = colorMap[color] || colorMap.muted;

  return (
    <div className={`rounded-lg ${c.bg} border border-border/10 px-3 py-2 relative`}>
      {pulse && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
        </span>
      )}
      <p className={`font-display text-2xl font-extrabold ${c.text} leading-none tracking-tighter`}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-bold mt-1">{label}</p>
    </div>
  );
}
