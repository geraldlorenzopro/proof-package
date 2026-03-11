import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Shield, UserPlus, FolderOpen, FileText, Upload, Scale,
  Activity, LogIn, LogOut, Trash2, Edit, Eye, RefreshCw,
  Filter, ChevronDown
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditEntry {
  id: string;
  user_display_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_ICON: Record<string, any> = {
  "client.created": UserPlus,
  "client.updated": Edit,
  "client.deleted": Trash2,
  "case.created": FolderOpen,
  "case.updated": Edit,
  "case.status_changed": Activity,
  "case.deleted": Trash2,
  "form.created": FileText,
  "form.submitted": FileText,
  "form.updated": Edit,
  "form.deleted": Trash2,
  "evidence.uploaded": Upload,
  "evidence.deleted": Trash2,
  "vawa.created": Scale,
  "vawa.updated": Edit,
  "tool.used": Activity,
  "auth.login": LogIn,
  "auth.logout": LogOut,
};

const ACTION_LABEL: Record<string, string> = {
  "client.created": "Creó cliente",
  "client.updated": "Editó cliente",
  "client.deleted": "Eliminó cliente",
  "case.created": "Creó caso",
  "case.updated": "Editó caso",
  "case.status_changed": "Cambió estado",
  "case.deleted": "Eliminó caso",
  "form.created": "Creó formulario",
  "form.submitted": "Envió formulario",
  "form.updated": "Editó formulario",
  "form.deleted": "Eliminó formulario",
  "evidence.uploaded": "Subió evidencia",
  "evidence.deleted": "Eliminó evidencia",
  "vawa.created": "Creó caso VAWA",
  "vawa.updated": "Editó caso VAWA",
  "tool.used": "Usó herramienta",
  "auth.login": "Inició sesión",
  "auth.logout": "Cerró sesión",
};

const ENTITY_COLORS: Record<string, string> = {
  client: "text-jarvis",
  case: "text-emerald-400",
  form: "text-cyan-400",
  evidence: "text-accent",
  vawa: "text-rose-400",
  tool: "text-purple-400",
  auth: "text-muted-foreground",
};

const SEVERITY_COLOR: Record<string, { bg: string; text: string }> = {
  create: { bg: "bg-emerald-500/15 border-emerald-500/20", text: "text-emerald-400" },
  update: { bg: "bg-blue-500/15 border-blue-500/20", text: "text-blue-400" },
  delete: { bg: "bg-red-500/15 border-red-500/20", text: "text-red-400" },
  auth: { bg: "bg-amber-500/15 border-amber-500/20", text: "text-amber-400" },
  use: { bg: "bg-purple-500/15 border-purple-500/20", text: "text-purple-400" },
};

function getActionSeverity(action: string): string {
  if (action.includes("created") || action.includes("uploaded")) return "create";
  if (action.includes("deleted")) return "delete";
  if (action.includes("updated") || action.includes("changed") || action.includes("submitted")) return "update";
  if (action.startsWith("auth.")) return "auth";
  return "use";
}

export default function HubAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [limit, setLimit] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs" as any)
        .select("id, user_display_name, action, entity_type, entity_id, entity_label, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filterEntity !== "all") {
        query = query.eq("entity_type", filterEntity);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries((data as unknown as AuditEntry[]) || []);
    } catch (err) {
      console.error("[AuditLog]", err);
    } finally {
      setLoading(false);
    }
  }, [filterEntity, limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-jarvis" />
          <h2 className="text-lg font-bold text-foreground">Registro de Auditoría</h2>
          <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[9px] font-display uppercase tracking-wider">
            Compliance
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border/50">
              <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="client">Clientes</SelectItem>
              <SelectItem value="case">Casos</SelectItem>
              <SelectItem value="form">Formularios</SelectItem>
              <SelectItem value="evidence">Evidencia</SelectItem>
              <SelectItem value="vawa">VAWA</SelectItem>
              <SelectItem value="auth">Autenticación</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={load} className="h-8 w-8 p-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_1.5fr_1fr_140px] gap-3 px-4 py-2.5 bg-muted/10 border-b border-border/20">
          <span className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Usuario</span>
          <span className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Acción</span>
          <span className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Entidad</span>
          <span className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Fecha</span>
        </div>

        {loading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.5fr_1fr_140px] gap-3 px-4 py-3 animate-pulse border-b border-border/10">
                <div className="h-3 bg-muted/20 rounded w-3/4" />
                <div className="h-3 bg-muted/20 rounded w-1/2" />
                <div className="h-3 bg-muted/20 rounded w-2/3" />
                <div className="h-3 bg-muted/10 rounded w-full" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10">
            <Shield className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/50">Sin registros de auditoría</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Las acciones del staff aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {entries.map((entry, i) => {
              const Icon = ACTION_ICON[entry.action] || Activity;
              const label = ACTION_LABEL[entry.action] || entry.action;
              const entityColor = ENTITY_COLORS[entry.entity_type] || "text-muted-foreground";
              const severity = getActionSeverity(entry.action);
              const sevStyle = SEVERITY_COLOR[severity] || SEVERITY_COLOR.use;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className="grid grid-cols-[1fr_1.5fr_1fr_140px] gap-3 px-4 py-2.5 hover:bg-card/60 transition-colors"
                >
                  {/* User */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-jarvis/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-jarvis">
                        {(entry.user_display_name || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-foreground/80 truncate font-medium">
                      {entry.user_display_name || "Sistema"}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 ${sevStyle.text} shrink-0`} />
                    <span className="text-xs text-foreground/70 truncate">{label}</span>
                    <div className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${sevStyle.bg} ${sevStyle.text} shrink-0`}>
                      {severity === "create" ? "Crear" : severity === "update" ? "Editar" : severity === "delete" ? "Eliminar" : severity === "auth" ? "Auth" : "Uso"}
                    </div>
                  </div>

                  {/* Entity */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs font-medium ${entityColor} truncate`}>
                      {entry.entity_label || entry.entity_type}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center min-w-0">
                    <span className="text-[11px] text-muted-foreground/40" title={format(new Date(entry.created_at), "PPpp", { locale: es })}>
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load more */}
      {entries.length >= limit && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLimit(l => l + 25)}
            className="text-xs text-muted-foreground gap-1.5"
          >
            <ChevronDown className="w-3 h-3" />
            Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}
