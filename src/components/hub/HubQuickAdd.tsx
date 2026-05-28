/**
 * HubQuickAdd — Quick actions accionables en el right rail del Hub Inicio.
 *
 * Patrón universal validado en research (Hub v8 2026-05-28):
 *   - PracticePanther "Quick Create" — support.practicepanther.com
 *   - MyCase "Quick Actions" — supportcenter.mycase.com
 *   - Salesforce Homepage Assistant
 *
 * 4 acciones del paralegal hispano (Vanessa) en su día típico:
 *   1. + Nuevo cliente (entra ya como contratado, GHL hizo la venta)
 *   2. + Nueva tarea (acción operativa interna)
 *   3. + Nueva consulta (intake nuevo lead que vino sin GHL)
 *   4. + Nueva nota rápida (apuntar algo sin perder contexto)
 *
 * Cada acción dispara navegación o modal según corresponda. En demo mode
 * se dispara toast informativo "Próximamente · X disponible en Fase Y".
 */
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus, ListPlus, MessageSquarePlus, FileText, Plus } from "lucide-react";

export default function HubQuickAdd() {
  const navigate = useNavigate();

  const handleNewClient = () => {
    toast.info("Nuevo cliente", {
      description: "Llega con Fase 2 (Sprint Clientes).",
      duration: 2500,
    });
  };

  const handleNewTask = () => {
    toast.info("Nueva tarea", {
      description: "Modal de tareas disponible cuando se active el módulo de Tareas.",
      duration: 2500,
    });
  };

  const handleNewConsultation = () => {
    toast.info("Nueva consulta", {
      description: "Pasa a /hub/consultations cuando se active esa sección.",
      duration: 2500,
    });
  };

  const handleNewNote = () => {
    toast.info("Nueva nota rápida", {
      description: "Camila puede tomarla por vos. Decile: 'Camila, anotá…'",
      duration: 3000,
    });
  };

  return (
    <section className="rounded-2xl border border-cyan-accent/15 bg-gradient-to-br from-ai-blue/[0.05] to-card/30 backdrop-blur-sm p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[11px] font-bold flex items-center gap-1.5 text-foreground font-sora">
          <Plus className="w-3.5 h-3.5 text-cyan-accent" />
          Acción rápida
        </h4>
        <span className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wider">
          ⌘N
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QuickActionButton
          icon={<UserPlus className="w-3.5 h-3.5" />}
          label="Cliente"
          tone="cyan"
          onClick={handleNewClient}
        />
        <QuickActionButton
          icon={<ListPlus className="w-3.5 h-3.5" />}
          label="Tarea"
          tone="purple"
          onClick={handleNewTask}
        />
        <QuickActionButton
          icon={<MessageSquarePlus className="w-3.5 h-3.5" />}
          label="Consulta"
          tone="amber"
          onClick={handleNewConsultation}
        />
        <QuickActionButton
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Nota"
          tone="slate"
          onClick={handleNewNote}
        />
      </div>
    </section>
  );
}

function QuickActionButton({
  icon, label, tone, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "cyan" | "purple" | "amber" | "slate";
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    cyan:   "bg-cyan-accent/10 border-cyan-accent/25 text-cyan-accent hover:bg-cyan-accent/20",
    purple: "bg-purple-500/10 border-purple-500/25 text-purple-300 hover:bg-purple-500/20",
    amber:  "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20",
    slate:  "bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${tones[tone]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
