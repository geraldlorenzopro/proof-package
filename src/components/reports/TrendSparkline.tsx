/**
 * TrendSparkline — Sparkline SVG inline para KPI cards (Sprint B #8).
 *
 * DS §addendum L1082. SVG inline puro para evitar inflar bundle con
 * recharts/d3. Acepta array de números y los renderiza como path SVG.
 *
 * Usage:
 *   <TrendSparkline data={[3,5,8,12,15,18,22]} color="primary" />
 *   <TrendSparkline data={[100,98,95,90,85]} color="red" />
 */

import { cn } from "@/lib/utils";

interface Props {
  data: number[];
  color?: "primary" | "cyan" | "green" | "red" | "amber" | "muted";
  width?: number;
  height?: number;
  className?: string;
}

const COLOR_CLASS: Record<NonNullable<Props["color"]>, string> = {
  primary: "stroke-primary",
  cyan: "stroke-[hsl(188_86%_53%)]",
  green: "stroke-emerald-500",
  red: "stroke-red-500",
  amber: "stroke-amber-500",
  muted: "stroke-muted-foreground",
};

export function TrendSparkline({
  data,
  color = "primary",
  width = 80,
  height = 24,
  className,
}: Props) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const padY = 2;
  const drawableH = height - padY * 2;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = padY + drawableH - ((v - min) / range) * drawableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${points.join(" L ")}`;

  // Fill area gradient
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
      aria-hidden="true"
    >
      <path d={areaD} fill="currentColor" opacity={0.08} className={COLOR_CLASS[color]} />
      <path d={pathD} fill="none" strokeWidth={1.5} className={COLOR_CLASS[color]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
