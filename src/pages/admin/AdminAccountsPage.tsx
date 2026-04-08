import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Building2, Users, Briefcase, Search, Loader2, Eye, UserCheck, Plus,
} from "lucide-react";
import { toast } from "sonner";
import NewFirmModal from "@/components/admin/NewFirmModal";

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

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [showNewFirm, setShowNewFirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    const { data, error } = await supabase.functions.invoke("admin-get-all-accounts");
    if (!error && data && !data.error) setAccounts(data);
    setLoading(false);
  }

  async function handleToggleActive(acc: Account) {
    setToggling(acc.id);
    const { data, error } = await supabase.functions.invoke("admin-update-account", {
      body: { account_id: acc.id, is_active: !acc.is_active },
    });
    if (!error && data?.success) {
      toast.success(acc.is_active ? "Cuenta desactivada" : "Cuenta activada");
      loadAccounts();
    } else {
      toast.error("Error al actualizar");
    }
    setToggling(null);
  }

  async function handleChangePlan(accId: string, newPlan: string) {
    const { data, error } = await supabase.functions.invoke("admin-update-account", {
      body: { account_id: accId, plan: newPlan },
    });
    if (!error && data?.success) {
      toast.success("Plan actualizado");
      loadAccounts();
    } else {
      toast.error("Error al cambiar plan");
    }
  }

  async function handleImpersonate(acc: Account) {
    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { account_id: acc.id },
    });
    if (!error && data?.success) {
      sessionStorage.setItem("ner_impersonate", JSON.stringify({
        account_id: acc.id,
        account_name: acc.account_name,
        expires_at: data.expires_at,
      }));
      // Store impersonated account as the active account for Hub
      sessionStorage.setItem("ner_active_account_id", acc.id);
      toast.success(`Modo soporte: ${acc.account_name}`);
      navigate("/hub");
    } else {
      toast.error("Error al impersonar");
    }
  }

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (search && !a.account_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (planFilter !== "all" && a.plan !== planFilter) return false;
      if (statusFilter === "active" && !a.is_active) return false;
      if (statusFilter === "inactive" && a.is_active) return false;
      return true;
    });
  }, [accounts, search, planFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Gestión de Firmas</h1>
          <p className="text-sm text-white/40">{accounts.length} cuentas registradas</p>
        </div>
        <Button onClick={() => setShowNewFirm(true)} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nueva Firma
        </Button>
      </div>

      <NewFirmModal
        open={showNewFirm}
        onClose={() => setShowNewFirm(false)}
        onCreated={loadAccounts}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="pl-9 bg-white/5 border-white/10 text-white"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="essential">Essential</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="elite">Elite</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-white/[0.03] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-white/40 font-medium px-4 py-3">Firma</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Plan</th>
                <th className="text-center text-white/40 font-medium px-4 py-3">Status</th>
                <th className="text-center text-white/40 font-medium px-4 py-3">
                  <Users className="w-3.5 h-3.5 inline" />
                </th>
                <th className="text-center text-white/40 font-medium px-4 py-3">
                  <Briefcase className="w-3.5 h-3.5 inline" />
                </th>
                <th className="text-left text-white/40 font-medium px-4 py-3">GHL ID</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Registro</th>
                <th className="text-right text-white/40 font-medium px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((acc) => (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-white/30 shrink-0" />
                      <span className="text-white font-medium">{acc.account_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={acc.plan}
                      onValueChange={(v) => handleChangePlan(acc.id, v)}
                    >
                      <SelectTrigger className="w-[130px] h-7 text-xs bg-transparent border-white/10">
                        <Badge className={PLAN_BADGE[acc.plan] || PLAN_BADGE.essential}>
                          {acc.plan}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="essential">Essential</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={acc.is_active}
                      disabled={toggling === acc.id}
                      onCheckedChange={() => handleToggleActive(acc)}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-white/60">{acc.member_count}</td>
                  <td className="px-4 py-3 text-center text-white/60">{acc.case_count}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-mono text-white/30 truncate max-w-[120px] block">
                      {acc.external_crm_id || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(acc.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-white/40 hover:text-white"
                        onClick={() => navigate(`/admin/accounts/${acc.id}`)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-amber-400/60 hover:text-amber-400"
                        onClick={() => handleImpersonate(acc)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-white/30 text-sm">
            No se encontraron cuentas
          </div>
        )}
      </Card>
    </div>
  );
}
