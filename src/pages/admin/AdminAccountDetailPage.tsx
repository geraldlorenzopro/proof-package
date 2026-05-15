import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Building2, Users, Briefcase, Loader2, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useTrackPageView } from "@/hooks/useTrackPageView";

interface Account {
  id: string;
  account_name: string;
  plan: string;
  is_active: boolean;
  max_users: number;
  phone: string | null;
  external_crm_id: string | null;
  created_at: string;
  member_count: number;
  case_count: number;
  client_count: number;
}

const PLAN_BADGE: Record<string, string> = {
  essential: "bg-muted text-muted-foreground",
  professional: "bg-cyan-500/20 text-cyan-400",
  elite: "bg-amber-500/20 text-amber-400",
  enterprise: "bg-purple-500/20 text-purple-400",
};

export default function AdminAccountDetailPage() {
  useTrackPageView("admin.firm_detail");
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadAccount(); }, [accountId]);

  async function loadAccount() {
    const { data } = await supabase.functions.invoke("admin-get-all-accounts");
    if (data && !data.error) {
      const acc = (data as Account[]).find((a) => a.id === accountId);
      setAccount(acc || null);
    }
    setLoading(false);
  }

  async function handleUpdate(updates: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("admin-update-account", {
      body: { account_id: accountId, ...updates },
    });
    if (!error && data?.success) {
      toast.success("Cuenta actualizada");
      loadAccount();
    } else {
      toast.error("Error al actualizar");
    }
  }

  async function handleImpersonate() {
    if (!account) return;
    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { account_id: account.id },
    });
    if (!error && data?.success) {
      sessionStorage.setItem("ner_impersonate", JSON.stringify({
        account_id: account.id,
        account_name: account.account_name,
        expires_at: data.expires_at,
      }));
      navigate("/hub");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  if (!account) {
    return <p className="text-white/50 text-center py-20">Cuenta no encontrada</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white"
          onClick={() => navigate("/admin/accounts")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">{account.account_name}</h1>
          <p className="text-sm text-white/40">Detalle de cuenta</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/[0.03] border-white/5">
          <CardHeader><CardTitle className="text-sm text-white/60">Información</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-xs text-white/40">Plan</span>
              <Select value={account.plan} onValueChange={(v) => handleUpdate({ plan: v })}>
                <SelectTrigger className="w-[140px] h-7 text-xs bg-transparent border-white/10">
                  <Badge className={PLAN_BADGE[account.plan]}>{account.plan}</Badge>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="essential">Essential</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40">Activa</span>
              <Switch
                checked={account.is_active}
                onCheckedChange={(v) => handleUpdate({ is_active: v })}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/40">GHL ID</span>
              <span className="text-xs text-white/50 font-mono">{account.external_crm_id || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/40">Registro</span>
              <span className="text-xs text-white/50">
                {new Date(account.created_at).toLocaleDateString("es-ES")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/5">
          <CardHeader><CardTitle className="text-sm text-white/60">Métricas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Users className="w-3 h-3" /> Miembros
              </span>
              <span className="text-white font-bold">{account.member_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Casos activos
              </span>
              <span className="text-white font-bold">{account.case_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Clientes
              </span>
              <span className="text-white font-bold">{account.client_count}</span>
            </div>
            <Button
              className="w-full mt-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
              onClick={handleImpersonate}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Entrar como esta firma
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
