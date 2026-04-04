import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Building2, Users, TrendingUp, Briefcase, Calendar,
  Loader2, ArrowRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const PLAN_PRICES: Record<string, number> = {
  essential: 147,
  professional: 297,
  elite: 497,
  enterprise: 997,
};

const PLAN_COLORS: Record<string, string> = {
  essential: "hsl(210, 15%, 50%)",
  professional: "hsl(195, 100%, 50%)",
  elite: "hsl(43, 85%, 52%)",
  enterprise: "hsl(280, 70%, 55%)",
};

const PLAN_BADGE: Record<string, string> = {
  essential: "bg-muted text-muted-foreground",
  professional: "bg-cyan-500/20 text-cyan-400",
  elite: "bg-amber-500/20 text-amber-400",
  enterprise: "bg-purple-500/20 text-purple-400",
};

interface Metrics {
  mrr: number;
  arr: number;
  total_accounts: number;
  active_accounts: number;
  total_users: number;
  new_accounts_30d: number;
  new_users_30d: number;
  active_cases: number;
  total_cases: number;
  total_clients: number;
  plan_distribution: Record<string, { count: number; revenue: number }>;
  recent_accounts: Array<{
    id: string;
    account_name: string;
    plan: string;
    created_at: string;
    is_active: boolean;
  }>;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    const { data, error } = await supabase.functions.invoke("admin-get-metrics");
    if (!error && data && !data.error) setMetrics(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  if (!metrics) {
    return <p className="text-white/50 text-center py-20">Error loading metrics</p>;
  }

  const kpis = [
    { label: "MRR", value: `$${metrics.mrr.toLocaleString()}`, icon: DollarSign, color: "text-emerald-400" },
    { label: "Firmas Activas", value: metrics.active_accounts, icon: Building2, color: "text-cyan-400" },
    { label: "Usuarios", value: metrics.total_users, icon: Users, color: "text-blue-400" },
    { label: "Nuevas (30d)", value: metrics.new_accounts_30d, icon: Calendar, color: "text-amber-400" },
    { label: "Casos Activos", value: metrics.active_cases, icon: Briefcase, color: "text-purple-400" },
    { label: "ARR Proyectado", value: `$${metrics.arr.toLocaleString()}`, icon: TrendingUp, color: "text-emerald-400" },
  ];

  const pieData = Object.entries(metrics.plan_distribution).map(([plan, d]) => ({
    name: plan.charAt(0).toUpperCase() + plan.slice(1),
    value: d.count,
    revenue: d.revenue,
    fill: PLAN_COLORS[plan] || "#666",
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
        <p className="text-sm text-white/40">Vista global de la plataforma NER</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-white/[0.03] border-white/5">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-white/40">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-white/[0.03] border-white/5">
          <CardContent className="pt-4 px-4">
            <p className="text-sm text-white/40 mb-3">Distribución por Plan</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220, 20%, 10%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value} firmas — $${props.payload.revenue.toLocaleString()}/mo`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {pieData.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
                    <span className="text-white/70">{p.name}</span>
                  </div>
                  <span className="text-white/50">
                    {p.value} firmas = ${p.revenue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Accounts */}
        <Card className="bg-white/[0.03] border-white/5">
          <CardContent className="pt-4 px-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-white/40">Últimas Firmas Registradas</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-white/40 hover:text-white"
                onClick={() => navigate("/admin/accounts")}
              >
                Ver todas <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {metrics.recent_accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/accounts/${acc.id}`)}
                >
                  <div>
                    <p className="text-sm text-white font-medium">{acc.account_name}</p>
                    <p className="text-[10px] text-white/30">
                      {new Date(acc.created_at).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={PLAN_BADGE[acc.plan] || PLAN_BADGE.essential}>
                      {acc.plan}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${acc.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
