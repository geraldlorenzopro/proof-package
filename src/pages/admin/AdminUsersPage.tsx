import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, UserRound } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  firm_name: string | null;
  account_id: string | null;
  role: string | null;
  plan: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-amber-500/20 text-amber-400",
  admin: "bg-cyan-500/20 text-cyan-400",
  member: "bg-white/10 text-white/60",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const { data, error } = await supabase.functions.invoke("admin-get-all-users");
    if (!error && data && !data.error) setUsers(data);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      if (q && !u.email?.toLowerCase().includes(q) && !u.full_name?.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, search, roleFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-white">Gestión de Usuarios</h1>
        <p className="text-sm text-white/40">{users.length} usuarios en el sistema</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="pl-9 bg-white/5 border-white/10 text-white"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-white/[0.03] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-white/40 font-medium px-4 py-3">Usuario</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Email</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Firma</th>
                <th className="text-center text-white/40 font-medium px-4 py-3">Rol</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Último acceso</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{u.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.firm_name ? (
                      <button
                        className="text-cyan-400 text-xs hover:underline"
                        onClick={() => u.account_id && navigate(`/admin/accounts/${u.account_id}`)}
                      >
                        {u.firm_name}
                      </button>
                    ) : (
                      <span className="text-white/20 text-xs">Sin firma</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.role ? (
                      <Badge className={ROLE_BADGE[u.role] || ROLE_BADGE.member}>
                        {u.role}
                      </Badge>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("es-ES") : "Nunca"}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(u.created_at).toLocaleDateString("es-ES")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-white/30 text-sm">
            No se encontraron usuarios
          </div>
        )}
      </Card>
    </div>
  );
}
