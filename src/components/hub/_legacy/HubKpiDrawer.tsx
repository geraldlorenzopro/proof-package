import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Briefcase, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export type KpiType = "clientes" | "activos" | "accion" | "completados";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: KpiType;
  accountId: string;
}

export default function HubKpiDrawer({ open, onOpenChange, type, accountId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) loadData();
  }, [open, type]);

  async function loadData() {
    setLoading(true);
    try {
      if (type === "clientes") {
        const { data } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name, email, phone, created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(100);
        setRows(data || []);
      } else if (type === "activos") {
        const { data } = await supabase
          .from("client_cases")
          .select("id, client_name, case_type, pipeline_stage, assigned_to, client_profile_id")
          .eq("account_id", accountId)
          .not("status", "eq", "completed")
          .order("updated_at", { ascending: false })
          .limit(100);
        setRows(data || []);
      } else if (type === "accion") {
        // Cases where ball_in_court = team and not completed
        const { data } = await supabase
          .from("client_cases")
          .select("id, client_name, case_type, pipeline_stage, ball_in_court, assigned_to")
          .eq("account_id", accountId)
          .eq("ball_in_court", "team")
          .not("status", "eq", "completed")
          .order("updated_at", { ascending: false })
          .limit(100);
        setRows(data || []);
      } else if (type === "completados") {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data } = await supabase
          .from("client_cases")
          .select("id, client_name, case_type, pipeline_stage, updated_at")
          .eq("account_id", accountId)
          .eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString())
          .order("updated_at", { ascending: false })
          .limit(100);
        setRows(data || []);
      }
    } catch (err) {
      console.error("KPI drawer load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<KpiType, string> = {
    clientes: "Clientes",
    activos: "Casos Activos",
    accion: "Requieren Acción",
    completados: "Completados Este Mes",
  };

  const icons: Record<KpiType, any> = {
    clientes: User,
    activos: Briefcase,
    accion: AlertTriangle,
    completados: CheckCircle2,
  };

  const Icon = icons[type];

  function goToCase(caseId: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    sessionStorage.setItem("ner_auth_redirect", `/dashboard/case-engine/${caseId}`);
    navigate(`/dashboard/case-engine/${caseId}`);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] bg-background border-l border-border/30 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/20">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Icon className="w-5 h-5 text-jarvis" />
            {titles[type]}
            <Badge variant="secondary" className="text-[10px] ml-auto">{rows.length}</Badge>
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No hay registros
          </div>
        ) : (
          <div className="space-y-1 pt-3">
            {type === "clientes" && rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/50 px-3 py-2.5 hover:bg-foreground/[0.04] transition-colors">
                <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "Sin nombre"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.email || r.phone || "Sin contacto"}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {r.created_at ? format(new Date(r.created_at), "dd/MM") : ""}
                </span>
              </div>
            ))}

            {(type === "activos" || type === "accion" || type === "completados") && rows.map((r) => (
              <button
                key={r.id}
                onClick={() => goToCase(r.id)}
                className="w-full flex items-center gap-3 rounded-lg border border-border/20 bg-card/50 px-3 py-2.5 hover:bg-foreground/[0.04] transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  type === "completados" ? "bg-emerald-500/10" : type === "accion" ? "bg-amber-500/10" : "bg-accent/10"
                }`}>
                  <Briefcase className={`w-4 h-4 ${
                    type === "completados" ? "text-emerald-400" : type === "accion" ? "text-amber-400" : "text-accent"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.client_name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{r.case_type}</span>
                    {r.pipeline_stage && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/30">
                        {r.pipeline_stage}
                      </Badge>
                    )}
                  </div>
                </div>
                {type === "accion" && (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] shrink-0">
                    Equipo
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
