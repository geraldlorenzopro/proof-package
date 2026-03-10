import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  UserPlus, FileText, FolderOpen, Scale,
  CheckCircle2, AlertCircle, PenLine, Activity, Upload
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "client" | "case" | "form" | "vawa" | "tool";
  title: string;
  subtitle?: string;
  timestamp: string;
}

const TYPE_ICON: Record<string, any> = {
  client: UserPlus,
  case: FolderOpen,
  form: FileText,
  vawa: Scale,
  tool: Activity,
};

const TYPE_COLOR: Record<string, { text: string; bg: string }> = {
  client: { text: "text-jarvis", bg: "bg-jarvis/10" },
  case: { text: "text-emerald-400", bg: "bg-emerald-500/10" },
  form: { text: "text-accent", bg: "bg-accent/10" },
  vawa: { text: "text-rose-400", bg: "bg-rose-500/10" },
  tool: { text: "text-purple-400", bg: "bg-purple-500/10" },
};

function groupByDay(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const groups: Record<string, ActivityItem[]> = {};
  const labels: Record<string, string> = {};

  for (const item of items) {
    const d = new Date(item.timestamp);
    const key = format(d, "yyyy-MM-dd");
    if (!groups[key]) {
      groups[key] = [];
      labels[key] = isToday(d) ? "Hoy" : isYesterday(d) ? "Ayer" : format(d, "d MMM yyyy", { locale: es });
    }
    groups[key].push(item);
  }

  return Object.keys(groups).map(key => ({ label: labels[key], items: groups[key] }));
}

export default function HubActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadActivity(); }, []);

  async function loadActivity() {
    try {
      const [casesRes, formsRes, clientsRes, vawaRes] = await Promise.all([
        supabase.from("client_cases").select("id, client_name, case_type, updated_at").order("updated_at", { ascending: false }).limit(3),
        supabase.from("form_submissions").select("id, form_type, client_name, updated_at").order("updated_at", { ascending: false }).limit(3),
        supabase.from("client_profiles").select("id, first_name, last_name, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("vawa_cases").select("id, client_name, updated_at").order("updated_at", { ascending: false }).limit(2),
      ]);

      const all: ActivityItem[] = [];

      casesRes.data?.forEach(c => all.push({
        id: `case-${c.id}`, type: "case",
        title: `Caso ${c.case_type} creado`,
        subtitle: c.client_name,
        timestamp: c.updated_at,
      }));

      formsRes.data?.forEach(f => all.push({
        id: `form-${f.id}`, type: "form",
        title: `Formulario ${f.form_type?.toUpperCase()} completado`,
        subtitle: f.client_name || undefined,
        timestamp: f.updated_at,
      }));

      clientsRes.data?.forEach(c => all.push({
        id: `client-${c.id}`, type: "client",
        title: "Nuevo cliente registrado",
        subtitle: [c.first_name, c.last_name].filter(Boolean).join(" ") || undefined,
        timestamp: c.created_at,
      }));

      vawaRes.data?.forEach(v => all.push({
        id: `vawa-${v.id}`, type: "vawa",
        title: "Caso VAWA actualizado",
        subtitle: v.client_name,
        timestamp: v.updated_at,
      }));

      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(all.slice(0, 5));
    } catch (err) {
      console.error("Activity feed error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 py-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 rounded-md bg-muted/30" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted/30 rounded w-2/3" />
              <div className="h-2 bg-muted/20 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-4">
        <Activity className="w-5 h-5 text-muted-foreground/20 mx-auto mb-1" />
        <p className="text-[11px] text-muted-foreground/50">Sin actividad reciente</p>
      </div>
    );
  }

  const groups = groupByDay(items);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item, i) => {
              const Icon = TYPE_ICON[item.type] || Activity;
              const colors = TYPE_COLOR[item.type] || TYPE_COLOR.tool;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  className="flex items-center gap-2.5 py-1.5 rounded-md"
                >
                  <div className={`w-6 h-6 rounded-md ${colors.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3 h-3 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground/90 leading-tight truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {item.subtitle && (
                        <span className="text-[11px] text-muted-foreground/60 truncate">{item.subtitle}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground/30 shrink-0">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
