import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, TrendingDown, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface CreditData {
  balance: number;
  monthly_allowance: number;
  used_this_month: number;
  reset_date: string | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  agent_slug: string | null;
  created_at: string;
}

export default function HubCreditsWidget({ accountId }: { accountId: string }) {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadCredits();
  }, [accountId]);

  async function loadCredits() {
    const { data } = await supabase
      .from("ai_credits")
      .select("balance, monthly_allowance, used_this_month, reset_date")
      .eq("account_id", accountId)
      .single();
    if (data) setCredits(data as any);
  }

  async function openUsage() {
    setShowUsage(true);
    const { data } = await supabase
      .from("ai_credit_transactions")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setTransactions(data as any);
  }

  if (!credits) return null;

  const pct = credits.monthly_allowance > 0 ? (credits.balance / credits.monthly_allowance) * 100 : 0;
  const barColor = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";
  const daysUntilReset = credits.reset_date
    ? Math.max(0, Math.ceil((new Date(credits.reset_date).getTime() - Date.now()) / 86400000))
    : null;

  const AGENT_EMOJIS: Record<string, string> = { felix: "📋", nina: "✍️", max: "📊" };

  return (
    <>
      <button
        onClick={openUsage}
        className="w-full p-3 rounded-xl border border-border/30 bg-card/50 hover:bg-card/80 transition-all text-left group"
      >
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-3.5 h-3.5 text-jarvis" />
          <span className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider">Créditos AI</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">{credits.balance}/{credits.monthly_allowance}</span>
          {daysUntilReset !== null && (
            <span className="text-[9px] text-muted-foreground/50">
              Renueva en {daysUntilReset}d
            </span>
          )}
        </div>
      </button>

      <Dialog open={showUsage} onOpenChange={setShowUsage}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-jarvis" />
              Uso de Créditos AI
            </DialogTitle>
            <DialogDescription>
              {credits.balance} de {credits.monthly_allowance} créditos disponibles
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{Math.round(pct)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Usados este mes: {credits.used_this_month}
              {daysUntilReset !== null && ` · Se renuevan en ${daysUntilReset} días`}
            </p>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin transacciones aún</p>
            ) : (
              transactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-muted/10">
                  <span className="text-sm">{t.agent_slug ? AGENT_EMOJIS[t.agent_slug] || "🤖" : "💰"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">
                      {t.description || t.type}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { locale: es, addSuffix: true })}
                    </p>
                  </div>
                  <span className={`text-xs font-mono font-bold ${t.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
