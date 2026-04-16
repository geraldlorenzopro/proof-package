import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import HubLayout from "@/components/hub/HubLayout";
import { motion } from "framer-motion";
import {
  Shield, UserPlus, FolderOpen, FileText, Upload, Scale,
  Activity, LogIn, LogOut, Trash2, Edit, Eye, RefreshCw,
  Search, ChevronLeft, ChevronRight, Tag, Calendar as CalendarIcon,
  Settings2, Users
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AuditEntry {
  id: string;
  user_id: string;
  user_display_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/* ═══ Module mapping ═══ */
const MODULE_MAP: Record<string, { label: string; icon: any }> = {
  client: { label: "Contactos", icon: Users },
  client_profile: { label: "Contactos", icon: Users },
  contacts_list: { label: "Contactos", icon: Users },
  case: { label: "Casos", icon: FolderOpen },
  client_case: { label: "Casos", icon: FolderOpen },
  form: { label: "Formularios", icon: FileText },
  evidence: { label: "Evidencia", icon: Upload },
  vawa: { label: "VAWA", icon: Scale },
  tool: { label: "Herramienta", icon: Settings2 },
  auth: { label: "Auth", icon: Shield },
  consultation_room: { label: "Consultas", icon: CalendarIcon },
  tag: { label: "Tag", icon: Tag },
  settings: { label: "Config", icon: Settings2 },
  task: { label: "Tareas", icon: Activity },
  note: { label: "Notas", icon: FileText },
  document: { label: "Documentos", icon: FileText },
};

/* ═══ Action labels & colors ═══ */
const ACTION_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  "client.created": { label: "Creado", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "client.updated": { label: "Editado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "client.deleted": { label: "Eliminado", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "client.bulk_deleted": { label: "Eliminación masiva", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "case.created": { label: "Creado", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "case.updated": { label: "Editado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "case.status_changed": { label: "Etapa cambiada", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "case.deleted": { label: "Eliminado", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "form.created": { label: "Creado", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "form.submitted": { label: "Enviado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "form.updated": { label: "Editado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "form.deleted": { label: "Eliminado", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "evidence.uploaded": { label: "Subido", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "evidence.deleted": { label: "Eliminado", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "vawa.created": { label: "Creado", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "vawa.updated": { label: "Editado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "tool.used": { label: "Usado", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "auth.login": { label: "Login", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "auth.logout": { label: "Logout", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
  "tag.added": { label: "Tag agregado", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
  "tag.removed": { label: "Tag removido", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "task.created": { label: "Creada", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "task.completed": { label: "Completada", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "task.deleted": { label: "Eliminada", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "note.created": { label: "Creada", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "note.deleted": { label: "Eliminada", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "document.uploaded": { label: "Subido", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
  "document.deleted": { label: "Eliminado", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "member.removed": { label: "Removido", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "settings.updated": { label: "Editado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  "ghl_push_failed": { label: "Error sync", color: "text-red-600", bgColor: "bg-red-50 border-red-200" },
  "admin.account_updated": { label: "Admin edit", color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200" },
};

function getActionConfig(action: string) {
  if (ACTION_CONFIG[action]) return ACTION_CONFIG[action];
  if (action.startsWith("viewed_")) return { label: "Visto", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" };
  if (action.includes("created") || action.includes("uploaded")) return { label: "Creado", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" };
  if (action.includes("deleted") || action.includes("removed")) return { label: "Eliminado", color: "text-red-600", bgColor: "bg-red-50 border-red-200" };
  if (action.includes("updated") || action.includes("changed") || action.includes("modified")) return { label: "Editado", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" };
  if (action.includes("viewed")) return { label: "Visto", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" };
  return { label: action, color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" };
}

const READABLE_ACTIONS: Record<string, string> = {
  "viewed_contacts_list": "Lista de contactos",
  "viewed_client_profile": "Perfil de contacto",
  "viewed_client_case": "Caso de cliente",
  "viewed_consultation_room": "Sala de consulta",
  "client.created": "Nuevo contacto",
  "client.updated": "Contacto editado",
  "client.deleted": "Contacto eliminado",
  "case.created": "Nuevo caso",
  "case.updated": "Caso editado",
  "case.deleted": "Caso eliminado",
  "auth.login": "Inicio de sesión",
  "auth.logout": "Cierre de sesión",
  "task.created": "Nueva tarea",
  "task.deleted": "Tarea eliminada",
  "note.created": "Nueva nota",
  "note.deleted": "Nota eliminada",
  "document.uploaded": "Documento subido",
  "document.deleted": "Documento eliminado",
  "member.removed": "Miembro removido",
  "form.created": "Formulario creado",
  "ghl_push_failed": "Error de sincronización",
  "admin.account_updated": "Cuenta actualizada",
};

function getReadableAction(action: string): string {
  return READABLE_ACTIONS[action] || action.replace(/\./g, " ").replace(/_/g, " ");
}

  const baseType = entry.entity_type.replace("_list", "").replace("client_profile", "client").replace("client_case", "case").replace("consultation_room", "consultation_room");
  return MODULE_MAP[baseType] || MODULE_MAP[entry.entity_type] || { label: entry.entity_type, icon: Activity };
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700", "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700",
];

function getAvatarColor(userId: string) {
  const idx = userId.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

const PAGE_SIZE = 20;

const MODULE_FILTER_OPTIONS = [
  { value: "all", label: "Module - All" },
  { value: "client", label: "Contactos" },
  { value: "case", label: "Casos" },
  { value: "form", label: "Formularios" },
  { value: "evidence", label: "Evidencia" },
  { value: "vawa", label: "VAWA" },
  { value: "auth", label: "Auth" },
  { value: "task", label: "Tareas" },
  { value: "note", label: "Notas" },
  { value: "document", label: "Documentos" },
  { value: "settings", label: "Config" },
];

const ACTION_FILTER_OPTIONS = [
  { value: "all", label: "Acción - Todas" },
  { value: "created", label: "Creado" },
  { value: "updated", label: "Editado" },
  { value: "deleted", label: "Eliminado" },
  { value: "viewed", label: "Visto" },
  { value: "login", label: "Login" },
];

export default function HubAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // Load unique users for filter
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("user_id, user_display_name")
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) {
        const unique = new Map<string, string>();
        (data as any[]).forEach((d) => {
          if (d.user_id && !unique.has(d.user_id)) {
            unique.set(d.user_id, d.user_display_name || "Usuario");
          }
        });
        setUsers(Array.from(unique.entries()).map(([id, name]) => ({ id, name })));
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("id, user_id, user_display_name, action, entity_type, entity_id, entity_label, metadata, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Module filter maps to entity_type patterns
      if (moduleFilter !== "all") {
        const entityTypes: string[] = [];
        if (moduleFilter === "client") entityTypes.push("client", "client_profile", "contacts_list");
        else if (moduleFilter === "case") entityTypes.push("case", "client_case");
        else if (moduleFilter === "auth") entityTypes.push("auth");
        else entityTypes.push(moduleFilter);
        query = query.in("entity_type", entityTypes);
      }

      // Action filter
      if (actionFilter !== "all") {
        query = query.ilike("action", `%${actionFilter}%`);
      }

      // User filter
      if (userFilter !== "all") {
        query = query.eq("user_id", userFilter);
      }

      // Search by entity_label or entity_id
      if (search.trim()) {
        query = query.or(`entity_label.ilike.%${search.trim()}%,entity_id.ilike.%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setEntries((data as unknown as AuditEntry[]) || []);
      setTotal(count || 0);
    } catch (err) {
      console.error("[AuditPage]", err);
    } finally {
      setLoading(false);
    }
  }, [page, moduleFilter, actionFilter, userFilter, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <HubLayout>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Audit Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track and monitor all system activities, user actions, and data changes across your account
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPage(0); load(); }}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Select users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULE_FILTER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr] gap-4 px-4 py-3 bg-muted/30 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Done By</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</span>
          </div>

          {loading ? (
            <div className="space-y-0">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr] gap-4 px-4 py-3.5 animate-pulse border-b border-border/50">
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-muted/30 rounded w-3/4" />
                    <div className="h-2.5 bg-muted/15 rounded w-1/2" />
                  </div>
                  <div className="h-3.5 bg-muted/20 rounded w-2/3 self-center" />
                  <div className="h-6 bg-muted/15 rounded w-20 self-center" />
                  <div className="h-3.5 bg-muted/20 rounded w-3/4 self-center" />
                  <div className="h-3.5 bg-muted/15 rounded w-full self-center" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No audit logs found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Actions will appear here automatically</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {entries.map((entry, i) => {
                const module = getModule(entry);
                const ModuleIcon = module.icon;
                const actionCfg = getActionConfig(entry.action);
                const avatarColor = getAvatarColor(entry.user_id || "0");

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015, duration: 0.15 }}
                    className="grid grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr] gap-4 px-4 py-3 hover:bg-muted/10 transition-colors"
                  >
                    {/* Name + ID */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.entity_label || getReadableAction(entry.action)}
                      </p>
                      {entry.entity_id && entry.entity_id.length > 8 && (
                        <p className="text-[11px] text-muted-foreground/50 truncate font-mono">
                          {entry.entity_id.slice(0, 20)}
                        </p>
                      )}
                    </div>

                    {/* Module */}
                    <div className="flex items-center gap-2 min-w-0">
                      <ModuleIcon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      <span className="text-sm text-foreground/70">{module.label}</span>
                    </div>

                    {/* Action Badge */}
                    <div className="flex items-center">
                      <Badge
                        variant="outline"
                        className={`${actionCfg.bgColor} ${actionCfg.color} border text-xs font-medium px-2.5 py-0.5`}
                      >
                        {actionCfg.label}
                      </Badge>
                    </div>

                    {/* Done By */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${avatarColor}`}>
                        {getInitials(entry.user_display_name || "U")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground/80 truncate">
                          {entry.user_display_name || "UNKNOWN"}
                        </p>
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center min-w-0">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy", { locale: es })}
                        <br />
                        <span className="text-muted-foreground/50">
                          at {format(new Date(entry.created_at), "h:mm a")}
                        </span>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Rows per page: {PAGE_SIZE} &nbsp;·&nbsp; {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(0)}
              >
                <ChevronLeft className="w-3.5 h-3.5" /><ChevronLeft className="w-3.5 h-3.5 -ml-2" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = page < 3 ? i : page - 2 + i;
                if (pageNum >= totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" /><ChevronRight className="w-3.5 h-3.5 -ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </HubLayout>
  );
}
