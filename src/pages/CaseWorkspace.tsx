import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, FileText, Shield,
  ClipboardList, Scale, Clock, ChevronRight, TrendingUp,
  Calendar, Users, Zap, Eye
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ── Mock data ── */
const MOCK_CASE = {
  clientName: "María García López",
  caseType: "VAWA – Self-Petition",
  status: "in_progress" as const,
  priorityDate: "2024-08-15",
  createdAt: "2024-06-01",
  progress: 62,
};

const MOCK_ALERTS = [
  { id: "1", severity: "critical" as const, message: "Declaración jurada vence en 5 días", tool: "Affidavit" },
  { id: "2", severity: "warning" as const, message: "Faltan 3 evidencias requeridas para el paquete", tool: "Evidence" },
  { id: "3", severity: "info" as const, message: "Screener VAWA completado – elegible", tool: "VAWA" },
];

const MOCK_TOOLS = [
  { slug: "screener", label: "Screener VAWA", icon: Shield, status: "complete" as const, progress: 100, route: "/dashboard/vawa-screener" },
  { slug: "checklist", label: "Lista de Evidencia", icon: ClipboardList, status: "in_progress" as const, progress: 62, route: "/dashboard/vawa-checklist" },
  { slug: "affidavit", label: "Declaración Jurada", icon: Scale, status: "pending" as const, progress: 0, route: "/dashboard/affidavit" },
  { slug: "forms", label: "Smart Forms (I-360)", icon: FileText, status: "pending" as const, progress: 0, route: "/dashboard/smart-forms" },
];

const MOCK_TIMELINE = [
  { date: "2024-06-01", event: "Caso creado", type: "system" },
  { date: "2024-06-15", event: "Screener VAWA completado – Elegible", type: "tool" },
  { date: "2024-07-02", event: "Cliente subió 12 evidencias", type: "client" },
  { date: "2024-07-20", event: "Checklist actualizado – 62% completo", type: "tool" },
  { date: "2024-08-01", event: "Alerta: declaración jurada próxima a vencer", type: "alert" },
];

const severityStyles = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-accent/40 bg-accent/10 text-accent",
  info: "border-primary/40 bg-primary/10 text-primary",
};

const severityIcon = {
  critical: AlertTriangle,
  warning: Clock,
  info: CheckCircle2,
};

const toolStatusStyles = {
  complete: "text-emerald-400",
  in_progress: "text-primary",
  pending: "text-muted-foreground",
};

const toolStatusLabels = {
  complete: "Completado",
  in_progress: "En progreso",
  pending: "Pendiente",
};

const timelineTypeStyles: Record<string, string> = {
  system: "border-muted-foreground/30 bg-muted",
  tool: "border-primary/30 bg-primary/10",
  client: "border-accent/30 bg-accent/10",
  alert: "border-destructive/30 bg-destructive/10",
};

export default function CaseWorkspace() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background lg:ml-64">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/dashboard/cases")}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground truncate">{MOCK_CASE.clientName}</h1>
              <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                {MOCK_CASE.caseType}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Creado {new Date(MOCK_CASE.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
            DEMO
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="glow-border rounded-xl p-4 bg-card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progreso del caso</span>
            <span className="text-sm font-bold text-primary">{MOCK_CASE.progress}%</span>
          </div>
          <Progress value={MOCK_CASE.progress} className="h-2" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">Screener → Checklist → Declaración → Formularios</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Priority: {new Date(MOCK_CASE.priorityDate).toLocaleDateString("es-ES")}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {MOCK_ALERTS.length > 0 && (
          <div className="space-y-2 mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-accent" />
              Alertas del caso
            </h2>
            {MOCK_ALERTS.map((alert) => {
              const Icon = severityIcon[alert.severity];
              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${severityStyles[alert.severity]}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm flex-1">{alert.message}</span>
                  <Badge variant="secondary" className="text-[10px]">{alert.tool}</Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Herramientas</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Tools tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MOCK_TOOLS.map((tool) => (
                <button
                  key={tool.slug}
                  onClick={() => navigate(tool.route)}
                  className="glow-border rounded-xl p-4 bg-card hover:border-primary/30 transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                        <tool.icon className={`w-4.5 h-4.5 ${toolStatusStyles[tool.status]}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{tool.label}</p>
                        <p className={`text-[10px] font-medium ${toolStatusStyles[tool.status]}`}>
                          {toolStatusLabels[tool.status]}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  {tool.status !== "pending" && (
                    <Progress value={tool.progress} className="h-1.5" />
                  )}
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Timeline tab */}
          <TabsContent value="timeline">
            <div className="relative pl-6">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {MOCK_TIMELINE.map((item, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[14px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${timelineTypeStyles[item.type]}`} />
                    <div className="glow-border rounded-lg p-3 bg-card">
                      <p className="text-sm text-foreground">{item.event}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(item.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
