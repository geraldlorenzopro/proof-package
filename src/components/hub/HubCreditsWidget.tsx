import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Battery, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface CreditData {
  balance: number;
  monthly_allowance: number;
  used_this_month: number;
  reset_date: string | null;
}

const AGENT_COSTS = [
  { name: "Felix", cost: 5 },
  { name: "Nina", cost: 10 },
  { name: "Max", cost: 10 },
];

export default function HubCreditsWidget({ accountId }: { accountId: string }) {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("ai_credits")
      .select("balance, monthly_allowance, used_this_month, reset_date")
      .eq("account_id", accountId)
      .single()
      .then(({ data }) => { if (data) setCredits(data as any); });
  }, [accountId]);

  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  if (!credits) return null;

  const pct = credits.monthly_allowance > 0 ? (credits.balance / credits.monthly_allowance) * 100 : 0;
  const barColor = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";
  const daysUntilReset = credits.reset_date
    ? Math.max(0, Math.ceil((new Date(credits.reset_date).getTime() - Date.now()) / 86400000))
    : null;
  const isLow = credits.balance < 200;

  return (
    <div className="relative" ref={panelRef}>
      {/* Collapsed — just icon + bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-[44px] mx-auto flex flex-col items-center gap-1.5 py-2 rounded-lg hover:bg-muted/40 transition-all"
      >
        <Battery className={`w-4 h-4 ${pct > 50 ? "text-emerald-400" : pct > 20 ? "text-amber-400" : "text-red-400"}`} />
        <div className="w-8 h-1 rounded-full bg-muted/30 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </button>

      {/* Expanded panel — slides right */}
      {expanded && (
        <div
          className="fixed z-50 bg-card border border-border rounded-r-xl shadow-xl p-4 animate-in slide-in-from-left-2 duration-200"
          style={{ left: 72, bottom: 60, width: 220 }}
        >
          <h4 className="text-xs font-bold text-foreground mb-2">Créditos AI</h4>
          <p className="text-lg font-extrabold font-mono text-foreground leading-none">
            {credits.balance.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {credits.monthly_allowance.toLocaleString()}</span>
          </p>

          <div className="mt-2 h-2 rounded-full bg-muted/30 overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>

          <p className="text-[10px] text-muted-foreground mt-1">
            {Math.round(pct)}% disponibles
          </p>
          {daysUntilReset !== null && (
            <p className="text-[10px] text-muted-foreground/60">Se renueva en {daysUntilReset} días</p>
          )}

          {isLow && (
            <div className="flex items-center gap-1.5 mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-[10px] font-semibold text-red-400">Créditos bajos — Recargar</span>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
            {AGENT_COSTS.map(a => (
              <div key={a.name} className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{a.name}</span>
                <span className="text-muted-foreground/60">{a.cost} cr/sesión</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
