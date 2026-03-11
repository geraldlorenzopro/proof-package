import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  UserPlus, FileText, FolderOpen, Scale,
  Activity, CheckCircle2, Clock, AlertCircle, Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

type ActivityStatus = "completed" | "pending" | "new" | "in_progress";

interface ActivityItem {
  id: string;
  type: "client" | "case" | "form" | "vawa" | "tool";
  title: string;
  subtitle?: string;
  timestamp: string;
  status: ActivityStatus;
}

const TYPE_ICON: Record<string, any> = {
  client: UserPlus,
  case: FolderOpen,
  form: FileText,
  vawa: Scale,
  tool: Activity,
};

const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string; bg: string; icon: any }> = {
  completed: { label: "Completado", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/20", icon: CheckCircle2 },
  pending: { label: "Pendiente", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/20", icon: Clock },
  new: { label: "Nuevo", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/20", icon: Eye },
  in_progress: { label: "En Proceso", color: "text-jarvis", bg: "bg-jarvis/15 border-jarvis/20", icon: Activity },
};

const TYPE_COLOR: Record<string, string> = {
  client: "text-jarvis",
  case: "text-emerald-400",
  form: "text-accent",
  vawa: "text-rose-400",
  tool: "text-purple-400",
};

export default function HubActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadActivity(); }, []);

  async function loadActivity() {
    try {
      const [casesRes, formsRes, clientsRes, vawaRes] = await Promise.all([
        supabase.from("client_cases").select("id, client_name, case_type, status, updated_at").order("updated_at", { ascending: false }).limit(4),
        supabase.from("form_submissions").select("id, form_type, client_name, status, updated_at").order("updated_at", { ascending: false }).limit(4),
        supabase.from("client_profiles").select("id, first_name, last_name, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("vawa_cases").select("id, client_name, status, updated_at").order("updated_at", { ascending: false }).limit(2),
      ]);

      const all: ActivityItem[] = [];

      casesRes.data?.forEach(c => {
        const status: ActivityStatus = c.status === "completed" ? "completed" : c.status === "pending" ? "pending" : "in_progress";
        all.push({
          id: `case-${c.id}`, type: "case",
          title: `Caso ${c.case_type}`,
          subtitle: c.client_name,
          timestamp: c.updated_at,
          status,
        });
      });

      formsRes.data?.forEach(f => {
        const status: ActivityStatus = f.status === "completed" || f.status === "submitted" ? "completed" : f.status === "draft" ? "pending" : "in_progress";
        all.push({
          id: `form-${f.id}`, type: "form",
          title: `Formulario ${f.form_type?.toUpperCase()}`,
          subtitle: f.client_name || undefined,
          timestamp: f.updated_at,
          status,
        });
      });

      clientsRes.data?.forEach(c => all.push({
        id: `client-${c.id}`, type: "client",
        title: "Nuevo cliente",
        subtitle: [c.first_name, c.last_name].filter(Boolean).join(" ") || undefined,
        timestamp: c.created_at,
        status: "new",
      }));

      vawaRes.data?.forEach(v => {
        const status: ActivityStatus = v.status === "completed" ? "completed" : v.status === "draft" ? "pending" : "in_progress";
        all.push({
          id: `vawa-${v.id}`, type: "vawa",
          title: "Caso VAWA",
          subtitle: v.client_name,
          timestamp: v.updated_at,
          status,
        });
      });

      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(all.slice(0, 8));
    } catch (err) {
      console.error("Activity feed error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse py-2 px-3">
            <div className="w-5 h-5 rounded bg-muted/20" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted/20 rounded w-1/2" />
              <div className="h-2 bg-muted/10 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-6">
        <Activity className="w-5 h-5 text-muted-foreground/20 mx-auto mb-1" />
        <p className="text-[11px] text-muted-foreground/40">Sin actividad reciente</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/10">
      {items.map((item, i) => {
        const Icon = TYPE_ICON[item.type] || Activity;
        const color = TYPE_COLOR[item.type] || "text-muted-foreground";
        const statusCfg = STATUS_CONFIG[item.status];

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className="flex items-center gap-3 py-2.5 px-2 group hover:bg-card/30 rounded transition-colors cursor-default"
          >
            <Icon className={`w-4 h-4 ${color} shrink-0 opacity-70`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground/80 truncate">{item.title}</p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${statusCfg.bg} ${statusCfg.color} shrink-0`}>
                  <statusCfg.icon className="w-3 h-3" />
                  {statusCfg.label}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {item.subtitle && (
                  <span className="text-xs text-muted-foreground/50 truncate">{item.subtitle}</span>
                )}
                <span className="text-[11px] text-muted-foreground/30 shrink-0">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: es })}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
