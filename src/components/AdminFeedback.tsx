import { useState, useEffect, useMemo } from "react";
import { Star, MessageSquare, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  calculation_id: string | null;
}

export default function AdminFeedback() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cspa_feedback" as any)
        .select("id, rating, comment, created_at, calculation_id")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as any as FeedbackRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    if (!rows.length) return { avg: 0, total: 0, dist: [0, 0, 0, 0, 0] };
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    rows.forEach((r) => { sum += r.rating; dist[r.rating - 1]++; });
    return { avg: sum / rows.length, total: rows.length, dist };
  }, [rows]);

  const labels = ["Muy mala", "Mala", "Regular", "Buena", "Excelente"];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glow-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground font-display">
                {stats.avg.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground ml-1">/ 5</span>
              </p>
              <p className="text-xs text-muted-foreground">Promedio general</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glow-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground font-display">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total evaluaciones</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glow-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground font-display">
                {rows.filter((r) => r.comment).length}
              </p>
              <p className="text-xs text-muted-foreground">Con comentarios</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating distribution */}
      <Card className="glow-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Distribución de ratings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = stats.dist[star - 1];
            const pct = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-24 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-3.5 h-3.5",
                        i < star ? "text-accent fill-accent" : "text-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Comments list */}
      {rows.length === 0 ? (
        <Card className="text-center py-12">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">Aún no hay evaluaciones</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Evaluaciones recientes</h3>
          {rows.map((row) => (
            <Card key={row.id} className="hover:border-accent/20 transition-colors">
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <div className="flex gap-0.5 shrink-0 pt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-3.5 h-3.5",
                        i < row.rating ? "text-accent fill-accent" : "text-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  {row.comment ? (
                    <p className="text-sm text-foreground leading-relaxed">{row.comment}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {labels[row.rating - 1]} — sin comentario
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(row.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
