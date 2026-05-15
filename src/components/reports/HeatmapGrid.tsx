/**
 * HeatmapGrid — Grid de intensidad normalizada (Sprint B #8).
 *
 * DS §addendum L1109. Cada celda colorea con opacidad proporcional al
 * valor sobre el rango [min, max]. AI Blue base, opacity progresiva.
 *
 * Usage:
 *   <HeatmapGrid
 *     rows={[
 *       { label: "Vanessa", values: [4,6,3,5,7,4,6] },
 *       { label: "Carlos",  values: [3,4,2,5,5,3,4] },
 *     ]}
 *     columns={["L","M","M","J","V","S","D"]}
 *   />
 */

import { cn } from "@/lib/utils";

interface HeatmapRow {
  label: string;
  values: number[];
}

interface Props {
  rows: HeatmapRow[];
  columns: string[];
  /** Sufijo para tooltips (ej. "casos cerrados") */
  unit?: string;
  /** Tamaño cell. Default sm */
  cellSize?: "xs" | "sm" | "md";
  className?: string;
}

const CELL_SIZE_CLASS: Record<NonNullable<Props["cellSize"]>, string> = {
  xs: "w-5 h-5",
  sm: "w-7 h-7",
  md: "w-9 h-9",
};

function getIntensity(value: number, min: number, max: number): number {
  if (max === min) return value > 0 ? 0.5 : 0;
  return (value - min) / (max - min);
}

function intensityToOpacity(t: number): number {
  // 0-1 → 0.08-0.95 (siempre visible si value > 0)
  return 0.08 + t * 0.87;
}

export function HeatmapGrid({ rows, columns, unit, cellSize = "sm", className }: Props) {
  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className={cn("p-4 text-center text-sm text-muted-foreground", className)}>
        Sin datos
      </div>
    );
  }

  const allValues = rows.flatMap((r) => r.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground pr-2"></th>
            {columns.map((col, i) => (
              <th key={i} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="text-xs font-medium text-foreground pr-2 whitespace-nowrap">
                {row.label}
              </td>
              {row.values.map((value, ci) => {
                const t = getIntensity(value, min, max);
                const opacity = value === 0 ? 0 : intensityToOpacity(t);
                return (
                  <td key={ci}>
                    <div
                      className={cn(
                        "rounded flex items-center justify-center text-[10px] font-medium tabular-nums",
                        CELL_SIZE_CLASS[cellSize],
                        value > 0 ? "text-foreground" : "text-muted-foreground/40"
                      )}
                      style={{
                        backgroundColor: `hsl(220 83% 53% / ${opacity})`,
                        border: value === 0 ? "1px dashed hsl(var(--border))" : "none",
                      }}
                      title={`${row.label} · ${columns[ci]} · ${value}${unit ? " " + unit : ""}`}
                    >
                      {value > 0 ? value : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <div className="flex gap-0.5">
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((op, i) => (
            <div
              key={i}
              className={cn("rounded-sm", cellSize === "xs" ? "w-3 h-3" : "w-4 h-4")}
              style={{ backgroundColor: `hsl(220 83% 53% / ${op})` }}
            />
          ))}
        </div>
        <span>Más</span>
      </div>
    </div>
  );
}
