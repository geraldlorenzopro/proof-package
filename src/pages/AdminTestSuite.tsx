import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Circle, FlaskConical, ArrowLeft,
  ChevronDown, ChevronRight, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

type TestStatus = "pending" | "passed" | "failed";

interface TestItem {
  id: string;
  label: string;
  details?: string[];
  link?: string;
  status: TestStatus;
  notes: string;
}

interface TestGroup {
  id: string;
  title: string;
  emoji: string;
  items: TestItem[];
  expanded: boolean;
}

const INITIAL_GROUPS: TestGroup[] = [
  {
    id: "intake", title: "Intake y Casos", emoji: "📥", expanded: true,
    items: [
      { id: "i1", label: "Crear nuevo caso via IntakeWizard", link: "/hub", status: "pending", notes: "" },
      { id: "i2", label: "AI detecta el tipo de caso correctamente", status: "pending", notes: "" },
      { id: "i3", label: "File number se genera automáticamente", status: "pending", notes: "" },
      { id: "i4", label: "El caso aparece en el Hub", link: "/hub", status: "pending", notes: "" },
    ],
  },
  {
    id: "consultation", title: "Consulta Memory", emoji: "🧠", expanded: false,
    items: [
      { id: "c1", label: "Iniciar consulta con timer", link: "/hub", status: "pending", notes: "" },
      { id: "c2", label: "Tomar notas en tiempo real", status: "pending", notes: "" },
      { id: "c3", label: "Auto-save funciona (esperar 10 seg)", status: "pending", notes: "" },
      { id: "c4", label: "Finalizar consulta activa AI", status: "pending", notes: "" },
      { id: "c5", label: "AI genera resumen de la consulta", status: "pending", notes: "" },
      { id: "c6", label: "Decision gate funciona", status: "pending", notes: "" },
      { id: "c7", label: "Sync con GHL (si está configurado)", status: "pending", notes: "" },
    ],
  },
  {
    id: "agents", title: "Agentes AI", emoji: "🤖", expanded: false,
    items: [
      { id: "a1", label: "Felix llena formulario N-400", details: ["¿Campos correctos?", "¿No inventa datos?", "¿Marca [FALTA] correctamente?"], status: "pending", notes: "" },
      { id: "a2", label: "Nina ensambla el paquete", details: ["¿Cover letter profesional?", "¿Índice correcto?", "¿No da asesoría legal?"], status: "pending", notes: "" },
      { id: "a3", label: "Max evalúa el paquete", details: ["¿No da probabilidades?", "¿Disclaimer visible?", "¿Detecta problemas reales?"], status: "pending", notes: "" },
      { id: "a4", label: "Créditos se descuentan correctamente", status: "pending", notes: "" },
    ],
  },
  {
    id: "emails", title: "Emails", emoji: "📧", expanded: false,
    items: [
      { id: "e1", label: "Email de bienvenida se envía", status: "pending", notes: "" },
      { id: "e2", label: "El historial de emails aparece en el caso", status: "pending", notes: "" },
    ],
  },
  {
    id: "appointments", title: "Citas y Pre-Intake", emoji: "📅", expanded: false,
    items: [
      { id: "ap1", label: "Crear cita manual desde el Hub", link: "/hub", status: "pending", notes: "" },
      { id: "ap2", label: "El link /intake/:token funciona", status: "pending", notes: "" },
      { id: "ap3", label: "Cliente puede llenar el pre-intake", status: "pending", notes: "" },
      { id: "ap4", label: "La cita aparece en 'Consultas de hoy'", link: "/hub", status: "pending", notes: "" },
    ],
  },
  {
    id: "office", title: "Oficina y Configuración", emoji: "🏢", expanded: false,
    items: [
      { id: "o1", label: "Office Setup guarda correctamente", link: "/hub/settings/office", status: "pending", notes: "" },
      { id: "o2", label: "El prefijo de expediente funciona", status: "pending", notes: "" },
      { id: "o3", label: "Los tipos de caso están activos", status: "pending", notes: "" },
    ],
  },
  {
    id: "security", title: "Seguridad", emoji: "🔒", expanded: false,
    items: [
      { id: "s1", label: "Un usuario no puede ver datos de otra firma", status: "pending", notes: "" },
      { id: "s2", label: "El Panel Admin no es accesible para usuarios normales", link: "/admin", status: "pending", notes: "" },
      { id: "s3", label: "Los agentes AI tienen disclaimers", status: "pending", notes: "" },
    ],
  },
];

export default function AdminTestSuite() {
  const navigate = useNavigate();
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  const [groups, setGroups] = useState<TestGroup[]>(() => {
    try {
      const saved = localStorage.getItem("ner_test_suite");
      return saved ? JSON.parse(saved) : INITIAL_GROUPS;
    } catch { return INITIAL_GROUPS; }
  });

  useEffect(() => {
    localStorage.setItem("ner_test_suite", JSON.stringify(groups));
  }, [groups]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive font-bold">Acceso denegado — Solo platform admin</p>
      </div>
    );
  }

  function toggleGroup(gid: string) {
    setGroups(g => g.map(gr => gr.id === gid ? { ...gr, expanded: !gr.expanded } : gr));
  }

  function setItemStatus(gid: string, iid: string, status: TestStatus) {
    setGroups(g => g.map(gr => gr.id === gid ? { ...gr, items: gr.items.map(it => it.id === iid ? { ...it, status } : it) } : gr));
  }

  function setItemNotes(gid: string, iid: string, notes: string) {
    setGroups(g => g.map(gr => gr.id === gid ? { ...gr, items: gr.items.map(it => it.id === iid ? { ...it, notes } : it) } : gr));
  }

  function resetAll() {
    setGroups(INITIAL_GROUPS);
    localStorage.removeItem("ner_test_suite");
  }

  const allItems = groups.flatMap(g => g.items);
  const passed = allItems.filter(i => i.status === "passed").length;
  const failed = allItems.filter(i => i.status === "failed").length;
  const pending = allItems.filter(i => i.status === "pending").length;
  const total = allItems.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <FlaskConical className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-bold text-foreground">Test Suite — NER Immigration AI</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold font-mono text-foreground">{pct}%</p>
            <p className="text-[10px] text-muted-foreground">Completado</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <p className="text-2xl font-bold font-mono text-emerald-400">{passed}</p>
            <p className="text-[10px] text-emerald-400/60">Aprobado</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
            <p className="text-2xl font-bold font-mono text-red-400">{failed}</p>
            <p className="text-[10px] text-red-400/60">Falló</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold font-mono text-muted-foreground">{pending}</p>
            <p className="text-[10px] text-muted-foreground">Pendiente</p>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" className="text-xs" onClick={resetAll}>
            Reiniciar todo
          </Button>
        </div>

        {/* Groups */}
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/10 transition-colors"
              >
                <span className="text-lg">{group.emoji}</span>
                <span className="flex-1 text-sm font-bold text-foreground">{group.title}</span>
                <Badge variant="outline" className="text-[9px] font-mono">
                  {group.items.filter(i => i.status === "passed").length}/{group.items.length}
                </Badge>
                {group.expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>

              {group.expanded && (
                <div className="border-t border-border/30 divide-y divide-border/20">
                  {group.items.map(item => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        {/* Status icon */}
                        <button
                          onClick={() => {
                            const next: TestStatus = item.status === "pending" ? "passed" : item.status === "passed" ? "failed" : "pending";
                            setItemStatus(group.id, item.id, next);
                          }}
                          className="mt-0.5 shrink-0"
                        >
                          {item.status === "passed" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                          {item.status === "failed" && <XCircle className="w-5 h-5 text-red-400" />}
                          {item.status === "pending" && <Circle className="w-5 h-5 text-muted-foreground/30" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.status === "passed" ? "text-emerald-400 line-through" : item.status === "failed" ? "text-red-400" : "text-foreground"}`}>
                            {item.label}
                          </p>
                          {item.details && (
                            <ul className="mt-1 space-y-0.5">
                              {item.details.map((d, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground pl-2">• {d}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.link && (
                            <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1" onClick={() => navigate(item.link!)}>
                              <ExternalLink className="w-3 h-3" /> Probar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[9px] px-2 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                            onClick={() => setItemStatus(group.id, item.id, "passed")}
                          >✓</Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[9px] px-2 text-red-400 border-red-500/20 hover:bg-red-500/10"
                            onClick={() => setItemStatus(group.id, item.id, "failed")}
                          >✗</Button>
                        </div>
                      </div>

                      {/* Notes */}
                      <Textarea
                        placeholder="Notas del resultado..."
                        value={item.notes}
                        onChange={e => setItemNotes(group.id, item.id, e.target.value)}
                        className="text-[11px] min-h-[32px] h-8 resize-none bg-muted/10"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}