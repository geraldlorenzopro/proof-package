/**
 * KPIStrip — container horizontal de KPI cards.
 *
 * Responsive: 2 cols mobile, 3 cols tablet, hasta 6 cols desktop.
 * Sin background propio (heredado del padre).
 *
 * Spec en DESIGN-SYSTEM.md §addendum.
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
}

export function KPIStrip({ children, className }: Props) {
  return (
    <div
      className={cn(
        "grid gap-3",
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        className
      )}
    >
      {children}
    </div>
  );
}
