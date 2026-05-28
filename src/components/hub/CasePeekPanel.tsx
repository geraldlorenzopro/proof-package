/**
 * CasePeekPanel — Panel peek lateral 480px (Linear/Things pattern).
 *
 * Validado por Lovable como diferenciador clave: el 70% de queries
 * telefónicas se resuelven sin abrir el case-engine completo.
 *
 * Paridad visual estricta con mockup NER-HUB-CASOS-FASE-C-V2.html:
 *   - position fixed right-0 top-0 bottom-0 w-[480px]
 *   - bg deep-navy/96 + backdrop-blur-xl
 *   - border-l cyan-accent/25
 *   - shadow -20px 0 60px black/40
 *   - Sticky header con avatar + nombre + tipo + status + owner
 *   - Body: ⚠ atención urgente + 📝 últimas notas + ✅ tareas + Quick actions + Abrir expediente
 *   - Keyboard: ESC cierra · ↑↓ navega casos (futuro) · ⏎ abre expediente
 */
import { useEffect } from "react";
import { X, AlertTriangle, FileText, Zap, Phone, Mail, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import { useCasePeekData } from "@/hooks/useCasePeekData";
import type { PipelineCase } from "@/hooks/useCasePipeline";

interface Props {
  c: PipelineCase | null;
  ownerName?: string | null;
  onClose: () => void;
  onOpenCase: () => void;
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function gradientFor(id: string | null | undefined): string {
  if (!id) return "from-slate-500 to-slate-700";
  const grads = [
    "from-[#2563EB] to-[#22D3EE]",
    "from-[#f59e0b] to-[#ef4444]",
    "from-[#8b5cf6] to-[#ec4899]",
    "from-[#10b981] to-[#06b6d4]",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return grads[Math.abs(h) % grads.length];
}

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  const time = new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (days === 0) return `hoy ${time}`;
  if (days === 1) return `ayer ${time}`;
  if (days < 7) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function dueLabel(due: string | null): { label: string; tone: string } {
  if (!due) return { label: "Sin fecha", tone: "text-slate-400" };
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const ddmm = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (diff < 0) return { label: `Venció ${ddmm} (${Math.abs(diff)}d)`, tone: "text-rose-400" };
  if (diff <= 3) return { label: `Vence ${ddmm} (${diff}d)`, tone: "text-rose-400" };
  if (diff <= 7) return { label: `Vence ${ddmm} (${diff}d)`, tone: "text-amber-300" };
  return { label: `Vence ${ddmm} (${diff}d)`, tone: "text-slate-400" };
}

export default function CasePeekPanel({ c, ownerName, onClose, onOpenCase }: Props) {
  const peek = useCasePeekData(c?.id ?? null);

  // ESC cierra · Enter abre expediente
  useEffect(() => {
    if (!c) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !(e.target as HTMLElement)?.matches("input,textarea,select")) onOpenCase();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [c, onClose, onOpenCase]);

  if (!c) return null;

  // Alertas derivadas
  const alerts: Array<{ icon: typeof Zap; iconClass: string; title: string; subtitle: string }> = [];
  const now = Date.now();

  if (c.rfe_deadline) {
    const rfeMs = new Date(c.rfe_deadline + "T00:00:00").getTime();
    const daysLeft = Math.ceil((rfeMs - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 7) {
      const ddmm = new Date(c.rfe_deadline + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      alerts.push({
        icon: FileText,
        iconClass: "bg-rose-500/20 text-rose-300",
        title: `RFE vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"} (${ddmm})`,
        subtitle: "USCIS pide evidencia adicional. Respuesta urgente.",
      });
    }
  }

  if (c.last_client_activity_at) {
    const lastMs = new Date(c.last_client_activity_at).getTime();
    const daysSilent = Math.floor((now - lastMs) / 86400000);
    if (daysSilent >= 10) {
      alerts.push({
        icon: Phone,
        iconClass: "bg-cyan-500/20 text-cyan-300",
        title: `Cliente sin contacto hace ${daysSilent} día${daysSilent === 1 ? "" : "s"}`,
        subtitle: "Camila sugiere llamar para confirmar estado.",
      });
    }
  }

  if ((c.overdue_tasks_count ?? 0) > 0) {
    alerts.push({
      icon: Zap,
      iconClass: "bg-rose-500/20 text-rose-300",
      title: `Felix: ${c.overdue_tasks_count} tarea${c.overdue_tasks_count === 1 ? "" : "s"} vencida${c.overdue_tasks_count === 1 ? "" : "s"}`,
      subtitle: "Revisar checklist antes del próximo paso.",
    });
  }

  const clientGrad = gradientFor(c.id);
  const ownerGrad = gradientFor(c.assigned_to);

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 w-[480px] bg-deep-navy/[0.96] backdrop-blur-xl border-l border-cyan-accent/25 shadow-[-20px_0_60px_rgba(0,0,0,0.4)] z-50 overflow-y-auto"
      role="complementary"
      aria-label="Vista rápida del caso"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-deep-navy/95 backdrop-blur-xl px-5 py-4 border-b border-white/8 flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${clientGrad} flex items-center justify-center text-[13px] font-bold text-white shrink-0`}>
            {initials(c.client_name)}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold font-sora text-white truncate">{c.client_name}</h2>
            <p className="text-[11px] text-slate-400 truncate">
              {getCaseTypeLabel(c.case_type)}
              {c.file_number && <> · <span className="font-mono">{c.file_number}</span></>}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {c.process_stage && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-ai-blue/15 border-ai-blue/30 text-blue-200">
                  {c.process_stage.toUpperCase()}
                </span>
              )}
              {c.assigned_to && (
                <>
                  <span className="text-[10px] text-slate-500">·</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${ownerGrad} flex items-center justify-center text-[7px] font-bold text-white`}>
                      {initials(ownerName)}
                    </div>
                    <span className="text-[10px] text-slate-300">{ownerName || "Staff"}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white p-1 shrink-0" title="Cerrar (ESC)">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* ⚠ Atención urgente */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              Atención urgente
            </h4>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.08] p-3 space-y-2">
              {alerts.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${a.iconClass}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-rose-200">{a.title}</p>
                      <p className="text-[10px] text-rose-300/70 mt-0.5">{a.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 📝 Últimas notas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">📝 Últimas notas</h4>
            <button className="text-[10px] text-cyan-accent hover:text-cyan-accent/80 flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>
          {peek.loading ? (
            <div className="space-y-1.5">
              {[0,1,2].map(i => <div key={i} className="h-14 rounded-md bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : peek.notes.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic px-3">Sin notas todavía.</p>
          ) : (
            <div className="space-y-1.5">
              {peek.notes.map(n => (
                <div key={n.id} className="rounded-md bg-white/[0.03] border border-white/8 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-cyan-accent">{n.author_name}</span>
                    <span className="text-[9px] text-slate-500 tabular-nums">{relativeDate(n.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ Tareas pendientes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              ✅ Tareas pendientes
              {peek.tasks.length > 0 && <span className="text-rose-400 normal-case ml-1">{peek.tasks.length}</span>}
            </h4>
            <button className="text-[10px] text-cyan-accent hover:text-cyan-accent/80 flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>
          {peek.loading ? (
            <div className="space-y-1.5">
              {[0,1].map(i => <div key={i} className="h-12 rounded-md bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : peek.tasks.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic px-3">Sin tareas pendientes.</p>
          ) : (
            <div className="space-y-1.5">
              {peek.tasks.map(t => {
                const due = dueLabel(t.due_date);
                const isUrgent = due.tone.includes("rose");
                return (
                  <div key={t.id} className={`rounded-md bg-white/[0.03] border px-3 py-2 flex items-start gap-2 ${isUrgent ? "border-rose-500/20" : "border-white/8"}`}>
                    <input type="checkbox" className="mt-0.5 accent-cyan-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-200 truncate">{t.title}</p>
                      <p className={`text-[9px] mt-0.5 ${due.tone}`}>
                        {due.label}
                        {t.assigned_to_name && <> · Asignada a {t.assigned_to_name}</>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toast.info("Próximamente", { description: "Camila voice + dialing integrado en Sprint Comms.", duration: 3000 })}
            className="px-3 py-2 rounded-lg bg-cyan-accent/15 border border-cyan-accent/30 text-cyan-accent text-[11px] font-semibold hover:bg-cyan-accent/25 flex items-center justify-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" /> Llamar
          </button>
          <button
            type="button"
            onClick={() => toast.info("Próximamente", { description: "Email via Resend integrado en Sprint Comms.", duration: 3000 })}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-semibold hover:bg-white/[0.08] flex items-center justify-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
        </div>

        {/* Abrir expediente completo */}
        <button
          onClick={onOpenCase}
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-ai-blue to-cyan-accent text-white text-[12px] font-bold font-sora hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-ai-blue/30"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir expediente completo
        </button>

        {/* Atajos teclado */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[9px] text-slate-500 leading-relaxed flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-0.5 font-mono border border-white/10 rounded px-1 py-0.5">ESC</span> cerrar peek
            <span className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-0.5 font-mono border border-white/10 rounded px-1 py-0.5">⏎</span> abrir expediente
          </p>
        </div>
      </div>
    </aside>
  );
}
