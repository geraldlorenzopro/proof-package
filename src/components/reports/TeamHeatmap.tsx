/**
 * TeamHeatmap — productividad del equipo por paralegal (wireframe W-27).
 *
 * Ola 3.3.e. Muestra para cada miembro del equipo:
 *   - Casos activos asignados
 *   - Casos cerrados últimos 30d
 *   - Días promedio de cierre (closed_at - created_at)
 *   - % casos con AI usage (via events table — futuro)
 *
 * Implementación MVP:
 *   - Query agregada por assigned_to en client_cases
 *   - Join con profiles para full_name
 *   - Display tabla simple, NO heatmap visual aún (mejora UX en P2)
 *
 * RLS-friendly: account_members filtra automáticamente la firma del Owner.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemberStats {
  user_id: string;
  full_name: string;
  active_cases: number;
  closed_30d: number;
  avg_close_days: number | null;
}

interface Props {
  accountId: string | null;
  isDemo?: boolean;
}

const DEMO_TEAM: MemberStats[] = [
  { user_id: "demo-1", full_name: "Vanessa Martínez", active_cases: 18, closed_30d: 4, avg_close_days: 72 },
  { user_id: "demo-2", full_name: "Carlos Ramírez", active_cases: 14, closed_30d: 3, avg_close_days: 84 },
  { user_id: "demo-3", full_name: "María González", active_cases: 10, closed_30d: 2, avg_close_days: 91 },
];

const CLOSED_FILTER = "(completed,archived,cancelled)";

export function TeamHeatmap({ accountId, isDemo = false }: Props) {
  const [team, setTeam] = useState<MemberStats[]>(() => (isDemo ? DEMO_TEAM : []));
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setTeam(DEMO_TEAM);
      setLoading(false);
      return;
    }
    if (!accountId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

        // 1) Members de la firma con full_name
        const { data: members, error: memErr } = await supabase
          .from("account_members")
          .select("user_id, profiles:user_id(full_name)")
          .eq("account_id", accountId)
          .eq("is_active", true);

        if (memErr) {
          if (!cancelled) {
            setError("team_load_failed");
            setLoading(false);
          }
          return;
        }

        if (!members || members.length === 0) {
          if (!cancelled) {
            setTeam([]);
            setLoading(false);
          }
          return;
        }

        // 2) Para cada miembro, queries paralelas de stats
        const memberStats: MemberStats[] = await Promise.all(
          members.map(async (m: any) => {
            const userId = m.user_id as string;
            const fullName =
              (m.profiles?.full_name as string | null) || "Sin nombre";

            const [activeRes, closedRes, recentClosedRes] = await Promise.all([
              supabase
                .from("client_cases")
                .select("id", { count: "exact", head: true })
                .eq("account_id", accountId)
                .eq("assigned_to", userId)
                .not("status", "in", CLOSED_FILTER),

              supabase
                .from("client_cases")
                .select("id", { count: "exact", head: true })
                .eq("account_id", accountId)
                .eq("assigned_to", userId)
                .eq("status", "completed")
                .gte("closed_at", thirtyDaysAgo),

              supabase
                .from("client_cases")
                .select("created_at, closed_at")
                .eq("account_id", accountId)
                .eq("assigned_to", userId)
                .eq("status", "completed")
                .gte("closed_at", ninetyDaysAgo)
                .not("closed_at", "is", null),
            ]);

            const closedRows = recentClosedRes.data ?? [];
            const validDiffs = closedRows
              .filter((c: any) => c.closed_at !== null)
              .map((c: any) =>
                (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 86400000
              )
              .filter((d) => Number.isFinite(d))
              .map((d) => Math.max(0, d));

            const avgDays =
              validDiffs.length === 0
                ? null
                : Math.round(validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length);

            return {
              user_id: userId,
              full_name: fullName,
              active_cases: activeRes.count ?? 0,
              closed_30d: closedRes.count ?? 0,
              avg_close_days: avgDays,
            };
          })
        );

        if (cancelled) return;

        // Ordenar: más casos activos primero
        memberStats.sort((a, b) => b.active_cases - a.active_cases);
        setTeam(memberStats);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("team_load_failed");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, isDemo]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando equipo…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-2 text-sm">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">No pudimos cargar el equipo</p>
          <p className="text-xs text-muted-foreground mt-0.5">Refrescá la página o consultá a soporte.</p>
        </div>
      </div>
    );
  }

  if (team.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
        <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p>Aún no tenés miembros activos en el equipo.</p>
      </div>
    );
  }

  // Max active cases para normalizar barra heatmap
  const maxActive = Math.max(...team.map((m) => m.active_cases), 1);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Equipo</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {team.length} {team.length === 1 ? "miembro" : "miembros"}
        </span>
      </div>
      <div className="divide-y divide-border">
        {team.map((m) => {
          const intensity = m.active_cases / maxActive;
          return (
            <div key={m.user_id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate">{m.full_name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {m.active_cases} activos · {m.closed_30d} cerrados 30d
                  {m.avg_close_days !== null && (
                    <> · {m.avg_close_days}d promedio</>
                  )}
                </span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all",
                    intensity > 0.8 ? "bg-primary" :
                    intensity > 0.5 ? "bg-primary/70" :
                    intensity > 0.2 ? "bg-primary/50" :
                    "bg-primary/30"
                  )}
                  style={{ width: `${Math.max(intensity * 100, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
