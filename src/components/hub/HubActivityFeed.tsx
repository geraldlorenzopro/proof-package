import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, FileText, FolderOpen, Scale, Clock, ArrowRight,
  CheckCircle2, AlertCircle, PenLine, Activity
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "client" | "case" | "form" | "vawa" | "tool";
  title: string;
  subtitle?: string;
  timestamp: string;
  status?: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  client: { icon: UserPlus, color: "text-jarvis", bg: "bg-jarvis/10" },
  case: { icon: FolderOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  form: { icon: FileText, color: "text-accent", bg: "bg-accent/10" },
  vawa: { icon: Scale, color: "text-rose-400", bg: "bg-rose-500/10" },
  tool: { icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10" },
};

const STATUS_BADGE: Record<string, { label: string; icon: any; class: string }> = {
  completed: { label: "Completado", icon: CheckCircle2, class: "text-emerald-400 bg-emerald-500/10" },
  draft: { label: "Borrador", icon: PenLine, class: "text-accent bg-accent/10" },
  pending: { label: "Pendiente", icon: AlertCircle, class: "text-muted-foreground bg-muted" },
  in_progress: { label: "En progreso", icon: Clock, class: "text-jarvis bg-jarvis/10" },
};

export default function HubActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    try {
      const [casesRes, formsRes, clientsRes, vawaRes] = await Promise.all([
        supabase
          .from("client_cases")
          .select("id, client_name, case_type, status, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("form_submissions")
          .select("id, form_type, client_name, status, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("client_profiles")
          .select("id, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("vawa_cases")
          .select("id, client_name, status, updated_at")
          .order("updated_at", { ascending: false })
          .limit(3),
      ]);

      const all: ActivityItem[] = [];

      casesRes.data?.forEach(c => all.push({
        id: `case-${c.id}`,
        type: "case",
        title: `Caso ${c.case_type}`,
        subtitle: c.client_name,
        timestamp: c.updated_at,
        status: c.status,
      }));

      formsRes.data?.forEach(f => all.push({
        id: `form-${f.id}`,
        type: "form",
        title: `Formulario ${f.form_type?.toUpperCase()}`,
        subtitle: f.client_name || undefined,
        timestamp: f.updated_at,
        status: f.status,
      }));

      clientsRes.data?.forEach(c => all.push({
        id: `client-${c.id}`,
        type: "client",
        title: "Nuevo cliente registrado",
        subtitle: [c.first_name, c.last_name].filter(Boolean).join(" ") || undefined,
        timestamp: c.created_at,
      }));

      vawaRes.data?.forEach(v => all.push({
        id: `vawa-${v.id}`,
        type: "vawa",
        title: "Caso VAWA",
        subtitle: v.client_name,
        timestamp: v.updated_at,
        status: v.status,
      }));

      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(all.slice(0, 10));
    } catch (err) {
      console.error("Activity feed error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted/50" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted/50 rounded w-3/4" />
                <div className="h-2.5 bg-muted/30 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-8 text-center">
        <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
        <p className="text-xs text-muted-foreground/50 mt-1">Crea tu primer caso o cliente para comenzar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {items.map((item, i) => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.tool;
          const Icon = cfg.icon;
          const statusCfg = item.status ? STATUS_BADGE[item.status] : null;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className="group rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-3.5 hover:bg-card/50 hover:border-border/50 transition-all duration-200 cursor-default"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    {statusCfg && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusCfg.class}`}>
                        <statusCfg.icon className="w-2.5 h-2.5" />
                        {statusCfg.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground/40 shrink-0">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
