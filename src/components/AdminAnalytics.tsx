import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Users, Zap, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface UsageStats {
  total: number;
  by_tool: { tool_slug: string; action: string; count: number }[];
  by_account: { account_name: string; account_id: string; count: number }[];
  by_day: { day: string; tool_slug: string; count: number }[];
  period_days: number;
}

const TOOL_LABELS: Record<string, string> = {
  cspa: 'CSPA Calculator',
  evidence: 'Evidence Organizer',
  affidavit: 'Affidavit Calculator',
  'uscis-analyzer': 'USCIS Analyzer',
};

const CHART_COLORS = [
  'hsl(195, 100%, 50%)',  // jarvis cyan
  'hsl(43, 85%, 52%)',    // gold accent
  'hsl(158, 64%, 38%)',   // green
  'hsl(280, 70%, 55%)',   // purple
  'hsl(15, 80%, 55%)',    // orange
];

export default function AdminAnalytics() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');

  useEffect(() => {
    loadStats();
  }, [days]);

  async function loadStats() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_usage_stats', { _days: parseInt(days) });
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      if (d.error) {
        console.error('Stats error:', d.error);
      } else {
        setStats(d as unknown as UsageStats);
      }
    }
    setLoading(false);
  }

  // Aggregate daily data for stacked bar chart
  function getDailyChartData() {
    if (!stats?.by_day) return [];
    const dayMap: Record<string, Record<string, number>> = {};
    for (const entry of stats.by_day) {
      const d = entry.day;
      if (!dayMap[d]) dayMap[d] = {};
      dayMap[d][entry.tool_slug] = (dayMap[d][entry.tool_slug] || 0) + entry.count;
    }
    return Object.entries(dayMap).map(([day, tools]) => ({
      day: new Date(day).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      ...tools,
    }));
  }

  // Aggregate tool totals for pie chart
  function getToolPieData() {
    if (!stats?.by_tool) return [];
    const toolMap: Record<string, number> = {};
    for (const entry of stats.by_tool) {
      toolMap[entry.tool_slug] = (toolMap[entry.tool_slug] || 0) + entry.count;
    }
    return Object.entries(toolMap).map(([slug, count]) => ({
      name: TOOL_LABELS[slug] || slug,
      value: count,
    }));
  }

  const toolSlugs = [...new Set(stats?.by_day?.map(d => d.tool_slug) || [])];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-jarvis" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="text-center py-12">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No se pudieron cargar las estadísticas</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-jarvis" />
          Analytics de Uso
        </h2>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
            <SelectItem value="365">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glow-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-jarvis" />
              <span className="text-xs text-muted-foreground">Total eventos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glow-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Herramientas activas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{getToolPieData().length}</p>
          </CardContent>
        </Card>
        <Card className="glow-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-jarvis" />
              <span className="text-xs text-muted-foreground">Cuentas activas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.by_account.length}</p>
          </CardContent>
        </Card>
        <Card className="glow-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Promedio/día</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats.period_days > 0 ? Math.round(stats.total / stats.period_days) : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Daily usage bar chart */}
        <Card className="md:col-span-2 glow-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Uso diario por herramienta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getDailyChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 30%, 16%)" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(210, 15%, 50%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(210, 15%, 50%)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(220, 25%, 10%)',
                      border: '1px solid hsl(195, 100%, 50%, 0.2)',
                      borderRadius: '8px',
                      color: 'hsl(210, 30%, 90%)',
                    }}
                  />
                  {toolSlugs.map((slug, i) => (
                    <Bar
                      key={slug}
                      dataKey={slug}
                      stackId="a"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      name={TOOL_LABELS[slug] || slug}
                      radius={i === toolSlugs.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tool distribution pie */}
        <Card className="glow-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Distribución</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getToolPieData()}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {getToolPieData().map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: 'hsl(210, 15%, 50%)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(220, 25%, 10%)',
                      border: '1px solid hsl(195, 100%, 50%, 0.2)',
                      borderRadius: '8px',
                      color: 'hsl(210, 30%, 90%)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top accounts table */}
      <Card className="glow-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Top Cuentas por Uso</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.by_account.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin datos en este período</p>
          ) : (
            <div className="space-y-2">
              {stats.by_account.map((acc, i) => (
                <div key={acc.account_id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                    <span className="text-sm text-foreground">{acc.account_name || 'Sin cuenta'}</span>
                  </div>
                  <Badge variant="outline" className="border-jarvis/30 text-jarvis">
                    {acc.count} eventos
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
