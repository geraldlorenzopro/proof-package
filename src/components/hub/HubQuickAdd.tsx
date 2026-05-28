/**
 * HubQuickAdd — Quick actions accionables en el right rail del Hub Inicio.
 *
 * Patrón universal validado en research (Hub v8 2026-05-28):
 *   - PracticePanther "Quick Create" — support.practicepanther.com
 *   - MyCase "Quick Actions" — supportcenter.mycase.com
 *   - Salesforce Homepage Assistant
 *
 * 4 acciones del paralegal hispano (Vanessa) en su día típico — ACTIVADAS
 * 2026-05-28 (antes eran toast.info placeholder):
 *   1. + Cliente   → NewClientModal stage='client' (reusa modal existente)
 *   2. + Tarea     → QuickTaskModal (nuevo, standalone — case_id opcional)
 *   3. + Consulta  → IntakeWizard con skipGhlPush=true (sin sync GHL todavía)
 *   4. + Nota      → QuickNoteModal (nuevo, requiere caso por schema)
 *
 * Auditoría línea-por-línea pre-build (4 agentes paralelos) confirmó que
 * Cliente + Consulta ya existían reusables; Tarea + Nota requirieron build
 * nuevo por falta de modal standalone en el repo.
 */
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, ListPlus, MessageSquarePlus, FileText, Plus } from "lucide-react";
import NewClientModal from "@/components/workspace/NewClientModal";
import IntakeWizard from "@/components/intake/IntakeWizard";
import QuickTaskModal from "./QuickTaskModal";
import QuickNoteModal from "./QuickNoteModal";

export default function HubQuickAdd() {
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);

  return (
    <>
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
            onClick={() => setNewClientOpen(true)}
          />
          <QuickActionButton
            icon={<ListPlus className="w-3.5 h-3.5" />}
            label="Tarea"
            tone="purple"
            onClick={() => setNewTaskOpen(true)}
          />
          <QuickActionButton
            icon={<MessageSquarePlus className="w-3.5 h-3.5" />}
            label="Consulta"
            tone="amber"
            onClick={() => setIntakeOpen(true)}
          />
          <QuickActionButton
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Nota"
            tone="slate"
            onClick={() => setNewNoteOpen(true)}
          />
        </div>
      </section>

      {/* Modals — 4 acciones del paralegal */}
      <NewClientModal
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        stage="client"
        onCreated={(_, clientName) => {
          toast.success(`${clientName} agregado a tus clientes`, {
            description: "Disponible en /hub/clients cuando se active la sección.",
            duration: 3500,
          });
        }}
      />

      <QuickTaskModal
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
      />

      <IntakeWizard
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        skipGhlPush
        onCreated={() => {
          toast.success("Consulta registrada", {
            description: "El lead quedó guardado en tu pipeline.",
            duration: 3500,
          });
        }}
      />

      <QuickNoteModal
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
      />
    </>
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
