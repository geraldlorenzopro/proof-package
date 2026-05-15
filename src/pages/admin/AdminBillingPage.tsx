import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Building2, Loader2, AlertTriangle } from "lucide-react";
import { useTrackPageView } from "@/hooks/useTrackPageView";

const PLAN_PRICES: Record<string, number> = {
  essential: 147,
  professional: 297,
  elite: 497,
  enterprise: 997,
};

const PLAN_BADGE: Record<string, string> = {
  essential: "bg-muted text-muted-foreground",
  professional: "bg-cyan-500/20 text-cyan-400",
  elite: "bg-amber-500/20 text-amber-400",
  enterprise: "bg-purple-500/20 text-purple-400",
};

interface Account {
  id: string;
  account_name: string;
  plan: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminBillingPage() {
  useTrackPageView("admin.billing");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase.functions.invoke("admin-get-all-accounts");
    if (data && !data.error) setAccounts(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  const activeAccounts = accounts.filter((a) => a.is_active);
  const mrr = activeAccounts.reduce((sum, a) => sum + (PLAN_PRICES[a.plan] || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-white">Billing</h1>
        <p className="text-sm text-white/40">Estado financiero de la plataforma</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white/[0.03] border-white/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/40">MRR Total</span>
            </div>
            <p className="text-2xl font-bold text-white">${mrr.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-white/40">ARR Proyectado</span>
            </div>
            <p className="text-2xl font-bold text-white">${(mrr * 12).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/5">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/40">Firmas Activas</span>
            </div>
            <p className="text-2xl font-bold text-white">{activeAccounts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/[0.03] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-white/40 font-medium px-4 py-3">Firma</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Plan</th>
                <th className="text-right text-white/40 font-medium px-4 py-3">MRR</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Inicio</th>
                <th className="text-center text-white/40 font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white font-medium">{acc.account_name}</td>
                  <td className="px-4 py-3">
                    <Badge className={PLAN_BADGE[acc.plan] || PLAN_BADGE.essential}>{acc.plan}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                    ${(PLAN_PRICES[acc.plan] || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(acc.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={acc.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                      {acc.is_active ? "Al día" : "Inactiva"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-400/80">
          Integración con Stripe pendiente — Sprint 12 del roadmap
        </p>
      </div>
    </div>
  );
}
