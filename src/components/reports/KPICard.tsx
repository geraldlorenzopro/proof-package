/**
 * KPICard — card individual de KPI para dashboards.
 *
 * Spec en DESIGN-SYSTEM.md §addendum (componentes de medición).
 *
 * Usage:
 *   <KPICard
 *     label="Casos activos"
 *     value={42}
 *     trend={{ direction: 'up', delta: '+5', period: 'esta semana' }}
 *     threshold={{ status: 'good' }}
 *     onClick={() => navigate('/hub/cases')}
 *   />
 *
 * Click dispara evento `report.drill_down` con target.
 */

import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

export interface KPICardProps {
  label: string;
  value: number | string;
  trend?: {
    direction: "up" | "down" | "flat";
    delta: string;
    period?: string;
  };
  threshold?: {
    status: "good" | "warning" | "critical" | "neutral";
    benchmark?: string;
  };
  helpText?: string;
  /** Para drill-down: id del KPI (se loguea en report.drill_down) */
  kpiId?: string;
  onClick?: () => void;
  loading?: boolean;
}

const TREND_ICONS = {
  up: ArrowUp,
  down: ArrowDown,
  flat: ArrowRight,
};

// Verde = trend up es bueno EXCEPTO para métricas donde menos es mejor (RFE, churn).
// Para esos casos pasar `goodDirection='down'` en threshold.benchmark string.
const TREND_COLORS = {
  up: "text-green-600 dark:text-green-400",
  down: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
};

const STATUS_DOT = {
  good: "bg-green-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  neutral: "bg-muted-foreground",
};

export function KPICard({
  label,
  value,
  trend,
  threshold,
  helpText,
  kpiId,
  onClick,
  loading = false,
}: KPICardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;

  function handleClick() {
    if (!onClick) return;
    void trackEvent("report.drill_down", {
      properties: { kpi: kpiId ?? label, target: "kpi_card" },
    });
    onClick();
  }

  return (
    <div
      onClick={onClick ? handleClick : undefined}
      className={cn(
        "bg-card border border-border rounded-xl p-4 flex flex-col gap-2",
        "transition-shadow",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/40"
      )}
      title={helpText}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        {threshold && (
          <span
            className={cn("w-2 h-2 rounded-full mt-1", STATUS_DOT[threshold.status])}
            aria-label={`Status: ${threshold.status}`}
          />
        )}
      </div>

      <div className="text-3xl font-bold text-foreground tabular-nums">
        {loading ? (
          <span className="inline-block w-16 h-8 bg-muted animate-pulse rounded" />
        ) : (
          value
        )}
      </div>

      {trend && !loading && (
        <div className={cn("flex items-center gap-1 text-xs", TREND_COLORS[trend.direction])}>
          {TrendIcon && <TrendIcon className="w-3 h-3" />}
          <span className="font-medium tabular-nums">{trend.delta}</span>
          {trend.period && (
            <span className="text-muted-foreground">· {trend.period}</span>
          )}
        </div>
      )}

      {threshold?.benchmark && !loading && (
        <span className="text-[10px] text-muted-foreground">
          {threshold.benchmark}
        </span>
      )}
    </div>
  );
}
