import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import { useTrackPageView } from "@/hooks/useTrackPageView";

interface LogEntry {
  id: string;
  created_at: string;
  account_id: string;
  account_name: string;
  user_id: string;
  user_display_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  ip_address: string | null;
  metadata: any;
}

const CRITICAL_ACTIONS = ["admin.impersonate", "admin.account_updated", "auth.login_failed"];

export default function AdminLogsPage() {
  useTrackPageView("admin.logs");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    setLoading(true);
    const params: Record<string, string> = { limit: "200" };
    if (actionFilter !== "all") params.action = actionFilter;

    const queryStr = new URLSearchParams(params).toString();
    const { data, error } = await supabase.functions.invoke(`admin-get-logs?${queryStr}`, {
      method: "GET",
    });
    if (!error && data && !data.error) setLogs(data);
    setLoading(false);
  }

  useEffect(() => { loadLogs(); }, [actionFilter]);

  const filtered = search
    ? logs.filter((l) =>
        l.account_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.user_display_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.action?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

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
        <h1 className="text-xl font-bold text-white">Logs de Auditoría</h1>
        <p className="text-sm text-white/40">Actividad cross-tenant del sistema</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="pl-9 bg-white/5 border-white/10 text-white"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="client.created">client.created</SelectItem>
            <SelectItem value="case.created">case.created</SelectItem>
            <SelectItem value="case.updated">case.updated</SelectItem>
            <SelectItem value="form.submitted">form.submitted</SelectItem>
            <SelectItem value="admin.impersonate">admin.impersonate</SelectItem>
            <SelectItem value="admin.account_updated">admin.account_updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-white/[0.03] border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-white/40 font-medium px-4 py-3">Timestamp</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Firma</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Usuario</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Acción</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Entidad</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const isCritical = CRITICAL_ACTIONS.includes(log.action);
                const isExpanded = expanded === log.id;
                return (
                  <>
                    <tr
                      key={log.id}
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer ${
                        isCritical ? "bg-red-500/[0.03]" : ""
                      }`}
                      onClick={() => setExpanded(isExpanded ? null : log.id)}
                    >
                      <td className="px-4 py-2.5 text-white/40 text-xs font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-ES", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-white/60 text-xs">{log.account_name}</td>
                      <td className="px-4 py-2.5 text-white/60 text-xs">{log.user_display_name || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          className={
                            isCritical
                              ? "bg-red-500/20 text-red-400"
                              : "bg-white/5 text-white/50"
                          }
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-white/40 text-xs truncate max-w-[180px]">
                        {log.entity_label || log.entity_type}
                      </td>
                      <td className="px-4 py-2.5">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-white/20" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-white/20" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-detail`} className="border-b border-white/5">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="text-[11px] text-white/40 font-mono bg-white/[0.02] p-3 rounded-lg overflow-auto max-h-[200px]">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-white/30 text-sm">
            No se encontraron logs
          </div>
        )}
      </Card>
    </div>
  );
}
