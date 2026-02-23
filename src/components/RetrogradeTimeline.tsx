import { useState, useEffect, useMemo } from "react";
import { TrendingDown, Calendar, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, Area, ComposedChart,
} from "recharts";

type Lang = "es" | "en";

const T = {
  es: {
    title: "Historial de Retrogression",
    subtitle: "Movimiento de la Final Action Date a lo largo del tiempo",
    loading: "Cargando historial…",
    noData: "No hay datos para esta categoría/país.",
    current: "CURRENT",
    unavailable: "No Disponible",
    bulletinDate: "Fecha del Boletín",
    finalAction: "Final Action Date",
    totalBulletins: "Boletines analizados",
    currentPeriods: "Períodos CURRENT",
    retrogressions: "Retrogresiones detectadas",
    longestWait: "Mayor retroceso",
    months: "meses",
    priorityDate: "Tu Priority Date",
    showTable: "Ver tabla detallada",
    hideTable: "Ocultar tabla",
    year: "Año",
    month: "Mes",
    value: "Valor",
    status: "Estado",
    advanced: "Avanzó",
    retrogressed: "Retrocedió",
    unchanged: "Sin cambio",
    becameCurrent: "Se volvió CURRENT",
    monthNames: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  },
  en: {
    title: "Retrogression History",
    subtitle: "Final Action Date movement over time",
    loading: "Loading history…",
    noData: "No data for this category/country.",
    current: "CURRENT",
    unavailable: "Unavailable",
    bulletinDate: "Bulletin Date",
    finalAction: "Final Action Date",
    totalBulletins: "Bulletins analyzed",
    currentPeriods: "CURRENT periods",
    retrogressions: "Retrogressions detected",
    longestWait: "Largest setback",
    months: "months",
    priorityDate: "Your Priority Date",
    showTable: "Show detailed table",
    hideTable: "Hide table",
    year: "Year",
    month: "Month",
    value: "Value",
    status: "Status",
    advanced: "Advanced",
    retrogressed: "Retrogressed",
    unchanged: "Unchanged",
    becameCurrent: "Became CURRENT",
    monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
};

interface BulletinRow {
  bulletin_year: number;
  bulletin_month: number;
  final_action_date: string | null;
  is_current: boolean;
  raw_value: string | null;
}

interface ChartPoint {
  bulletinLabel: string;
  bulletinTimestamp: number;
  finalActionTimestamp: number | null;
  isCurrent: boolean;
  rawValue: string;
  bulletin_year: number;
  bulletin_month: number;
}

function dateToTimestamp(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getTime();
}

function timestampToDateStr(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function RetrogradeTimeline({
  category,
  chargeability,
  priorityDate,
  lang,
}: {
  category: string;
  chargeability: string;
  priorityDate?: string;
  lang: Lang;
}) {
  const t = T[lang];
  const [rows, setRows] = useState<BulletinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!category || !chargeability) return;
    setLoading(true);
    const fetchData = async () => {
      // Fetch in batches to avoid 1000-row limit
      let allRows: BulletinRow[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("visa_bulletin")
          .select("bulletin_year, bulletin_month, final_action_date, is_current, raw_value")
          .eq("category", category.toUpperCase())
          .eq("chargeability", chargeability.toUpperCase())
          .order("bulletin_year", { ascending: true })
          .order("bulletin_month", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) { console.error(error); break; }
        if (data && data.length > 0) {
          allRows = [...allRows, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setRows(allRows);
      setLoading(false);
    };
    fetchData();
  }, [category, chargeability]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return rows.map((r) => ({
      bulletinLabel: `${t.monthNames[r.bulletin_month - 1]} ${r.bulletin_year}`,
      bulletinTimestamp: new Date(r.bulletin_year, r.bulletin_month - 1, 1).getTime(),
      finalActionTimestamp: r.is_current
        ? new Date(r.bulletin_year, r.bulletin_month - 1, 1).getTime() // CURRENT = same as bulletin
        : r.final_action_date
        ? dateToTimestamp(r.final_action_date)
        : null,
      isCurrent: r.is_current,
      rawValue: r.raw_value ?? (r.is_current ? "CURRENT" : "—"),
      bulletin_year: r.bulletin_year,
      bulletin_month: r.bulletin_month,
    }));
  }, [rows, t.monthNames]);

  const stats = useMemo(() => {
    let currentPeriods = 0;
    let retrogressions = 0;
    let longestSetbackMonths = 0;
    let prevTimestamp: number | null = null;
    let wasCurrent = false;

    for (const point of chartData) {
      if (point.isCurrent) {
        if (!wasCurrent) currentPeriods++;
        wasCurrent = true;
      } else {
        wasCurrent = false;
      }

      if (point.finalActionTimestamp !== null && prevTimestamp !== null) {
        if (point.finalActionTimestamp < prevTimestamp) {
          retrogressions++;
          const diffMonths = Math.round((prevTimestamp - point.finalActionTimestamp) / (1000 * 60 * 60 * 24 * 30.44));
          if (diffMonths > longestSetbackMonths) longestSetbackMonths = diffMonths;
        }
      }
      if (point.finalActionTimestamp !== null) prevTimestamp = point.finalActionTimestamp;
    }

    return { total: chartData.length, currentPeriods, retrogressions, longestSetbackMonths };
  }, [chartData]);

  const priorityDateTimestamp = priorityDate ? dateToTimestamp(priorityDate) : null;

  // Filter to only points with data for the chart
  const validChartData = chartData.filter((p) => p.finalActionTimestamp !== null);

  if (loading) {
    return (
      <Card className="glow-border bg-card">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          <div className="animate-pulse">{t.loading}</div>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="glow-border bg-card">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">{t.noData}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="glow-border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.subtitle} — {category} / {chargeability}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: t.totalBulletins, value: stats.total },
            { label: t.currentPeriods, value: stats.currentPeriods },
            { label: t.retrogressions, value: stats.retrogressions },
            { label: t.longestWait, value: `${stats.longestSetbackMonths} ${t.months}` },
          ].map((s) => (
            <div key={s.label} className="bg-secondary rounded-lg px-3 py-2 border border-border text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-bold text-foreground text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={validChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="bulletinTimestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(ts) => {
                  const d = new Date(ts);
                  return `${d.getFullYear()}`;
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                interval="preserveStartEnd"
                tickCount={8}
              />
              <YAxis
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={timestampToDateStr}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as ChartPoint;
                  return (
                    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                      <p className="font-semibold text-foreground">{d.bulletinLabel}</p>
                      <p className="text-muted-foreground">
                        {t.finalAction}: {d.isCurrent ? <span className="text-accent font-bold">CURRENT</span> : <span className="text-foreground">{d.rawValue}</span>}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                dataKey="finalActionTimestamp"
                type="monotone"
                fill="hsl(var(--accent) / 0.1)"
                stroke="none"
              />
              <Line
                dataKey="finalActionTimestamp"
                type="monotone"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--accent))" }}
              />
              {priorityDateTimestamp && (
                <ReferenceLine
                  y={priorityDateTimestamp}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: t.priorityDate,
                    position: "right",
                    fill: "hsl(var(--destructive))",
                    fontSize: 11,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 bg-secondary/50 rounded-lg px-3 py-2 border border-border">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {lang === "es"
              ? "Cuando la línea sube, la fecha avanza (se acerca a ser current). Cuando baja, hay retrogression. Si tu Priority Date (línea roja) está por debajo de la línea dorada, tu visa aún no está disponible."
              : "When the line goes up, the date advances (closer to current). When it drops, there's retrogression. If your Priority Date (red line) is below the gold line, your visa isn't available yet."}
          </p>
        </div>

        {/* Toggle table */}
        <button
          onClick={() => setShowTable(!showTable)}
          className="flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
        >
          {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showTable ? t.hideTable : t.showTable}
        </button>

        {showTable && (
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t.bulletinDate}</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t.value}</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {[...chartData].reverse().map((row, i) => {
                  const prevRow = chartData[chartData.length - 1 - i - 1]; // previous in chronological order
                  let status = "";
                  let statusColor = "text-muted-foreground";
                  if (row.isCurrent) {
                    status = t.becameCurrent;
                    statusColor = "text-accent";
                  } else if (prevRow && row.finalActionTimestamp !== null && prevRow.finalActionTimestamp !== null) {
                    if (row.finalActionTimestamp > prevRow.finalActionTimestamp) {
                      status = t.advanced;
                      statusColor = "text-primary";
                    } else if (row.finalActionTimestamp < prevRow.finalActionTimestamp) {
                      status = t.retrogressed;
                      statusColor = "text-destructive";
                    } else {
                      status = t.unchanged;
                    }
                  }

                  return (
                    <tr key={`${row.bulletin_year}-${row.bulletin_month}`} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-3 py-1.5 text-foreground">{row.bulletinLabel}</td>
                      <td className={cn("px-3 py-1.5 font-medium", row.isCurrent ? "text-accent" : "text-foreground")}>{row.rawValue}</td>
                      <td className={cn("px-3 py-1.5 font-medium", statusColor)}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
