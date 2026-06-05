/**
 * CasePeekPanel — Panel peek lateral 480px (Linear/Things pattern, v2 2026-05-28).
 *
 * Diseño simplificado por Mr. Lorenzo:
 *   - Side panel, NO modal central (no bloquea ver el contexto)
 *   - Read-only preview: notas + tareas en vista compacta
 *   - SIN botones "Agregar" inline (todo se hace desde el expediente)
 *   - SIN Llamar / Email (comunicaciones via GHL, locked 2026-05-28)
 *   - CTA principal: "Abrir expediente completo"
 *   - ESC cierra · Enter abre expediente
 *
 * Width: 480px (Round 9 Mr. Lorenzo). Antes era 420px pero quedaba
 * apretado el preview de notas/tareas de 2 líneas.
 */
import { useEffect, useState } from "react";
import { X, AlertTriangle, FileText, Zap, ExternalLink, UserX, Target, Activity, CheckCircle2 } from "lucide-react";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import { useCasePeekData } from "@/hooks/useCasePeekData";
import { useCaseActionHistory } from "@/hooks/useCaseActionHistory";
import type { PipelineCase } from "@/hooks/useCasePipeline";
import NextActionChip from "./NextActionChip";
import type { NextActionPayload } from "@/lib/nextActionCatalog";

interface Props {
  c: PipelineCase | null;
  ownerName?: string | null;
  onClose: () => void;
  onOpenCase: () => void;
  /** Notifica al parent que cambió el next_action — para refrescar la tabla. */
  onNextActionChange?: (caseId: string, next: NextActionPayload | null) => void;
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
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function dueLabel(due: string | null): { label: string; tone: string } {
  if (!due) return { label: "Sin fecha", tone: "text-slate-400" };
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Venció hace ${Math.abs(diff)}d`, tone: "text-rose-400" };
  if (diff === 0) return { label: "Vence hoy", tone: "text-rose-400" };
  if (diff <= 3) return { label: `Vence en ${diff}d`, tone: "text-rose-400" };
  if (diff <= 7) return { label: `Vence en ${diff}d`, tone: "text-amber-300" };
  return { label: `Vence en ${diff}d`, tone: "text-slate-400" };
}

export default function CasePeekPanel({ c, ownerName, onClose, onOpenCase, onNextActionChange }: Props) {
  const peek = useCasePeekData(c?.id ?? null);
  const history = useCaseActionHistory(c?.id ?? null);

  // Local state del next_action para optimistic update sin re-fetch del pipeline
  const [localNextAction, setLocalNextAction] = useState<NextActionPayload | null>(c?.next_action ?? null);
  useEffect(() => {
    setLocalNextAction(c?.next_action ?? null);
  }, [c?.id, c?.next_action]);

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

  // Alertas críticas
  const alerts: Array<{ icon: typeof Zap; tone: string; title: string }> = [];
  const now = Date.now();

  if (c.rfe_deadline) {
    const rfeMs = new Date(c.rfe_deadline + "T00:00:00").getTime();
    const daysLeft = Math.ceil((rfeMs - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 7) {
      alerts.push({
        icon: FileText,
        tone: "rose",
        title: `RFE vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`,
      });
    }
  }

  if (c.last_client_activity_at) {
    const lastMs = new Date(c.last_client_activity_at).getTime();
    const daysSilent = Math.floor((now - lastMs) / 86400000);
    if (daysSilent >= 10) {
      alerts.push({
        icon: UserX,
        tone: "amber",
        title: `Sin actividad del cliente hace ${daysSilent}d`,
      });
    }
  }

  if ((c.overdue_tasks_count ?? 0) > 0) {
    alerts.push({
      icon: Zap,
      tone: "rose",
      title: `${c.overdue_tasks_count} tarea${c.overdue_tasks_count === 1 ? "" : "s"} vencida${c.overdue_tasks_count === 1 ? "" : "s"}`,
    });
  }

  const clientGrad = gradientFor(c.id);

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 w-[480px] bg-deep-navy/[0.97] backdrop-blur-xl border-l border-cyan-accent/25 shadow-[-20px_0_60px_rgba(0,0,0,0.4)] z-50 overflow-y-auto"
      role="complementary"
      aria-label="Vista rápida del caso"
    >
      {/* Header compacto */}
      <div className="sticky top-0 z-20 bg-deep-navy/95 backdrop-blur-xl px-5 py-4 border-b border-white/8">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${clientGrad} flex items-center justify-center text-sm font-bold text-white shrink-0 font-sora`}>
              {initials(c.client_name)}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold font-sora text-white truncate">{c.client_name}</h2>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {getCaseTypeLabel(c.case_type)}
                {c.file_number && <> · <span className="font-mono text-slate-500">{c.file_number}</span></>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 shrink-0 -mt-0.5" title="Cerrar (ESC)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meta inline: process_stage chip + owner (NO confundir con Responsable
            del ball-in-court, que es derivado del journey step) */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {c.process_stage && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-ai-blue/15 border-ai-blue/30 text-blue-200">
              {c.process_stage === "embajada" ? "Consular" : c.process_stage.toUpperCase()}
            </span>
          )}
          {ownerName ? (
            <span className="text-[10px] text-slate-400">
              Owner: <span className="text-slate-200 font-medium">{ownerName}</span>
            </span>
          ) : (
            <span className="text-[10px] text-rose-300 font-semibold">
              Sin owner asignado
            </span>
          )}
        </div>
      </div>

      {/* Body — read-only preview */}
      <div className="px-5 py-4 space-y-4">

        {/* Alertas (solo si hay) */}
        {alerts.length > 0 && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.08] p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Atención
              </h4>
            </div>
            {alerts.map((a, i) => {
              const Icon = a.icon;
              const toneClass = a.tone === "rose" ? "text-rose-200" : "text-amber-200";
              return (
                <div key={i} className="flex items-center gap-2">
                  <Icon className={`w-3 h-3 ${toneClass}`} />
                  <p className={`text-[11px] font-semibold ${toneClass}`}>{a.title}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Próximo paso — editor inline */}
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center gap-1">
            <Target className="w-3 h-3" />
            Próximo paso
          </h4>
          <NextActionChip
            caseId={c.id}
            processStage={c.process_stage}
            caseTypeKey={c.case_type}
            value={localNextAction}
            variant="full"
            onChange={(next) => {
              setLocalNextAction(next);
              onNextActionChange?.(c.id, next);
            }}
          />
        </div>

        {/* Round 9.23 — Pasos completados (audit trail).
            Solo se muestra si hay items o si la migration está aplicada.
            Cada item: chequeo verde + label + quién + cuándo. */}
        {history.history.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400/70" />
              Pasos completados
              <span className="text-emerald-400/70 ml-1 normal-case font-mono">· {history.history.length}</span>
            </h4>
            <div className="space-y-1">
              {history.history.slice(0, 4).map(h => (
                <div key={h.id} className="rounded-md bg-emerald-500/[0.04] border border-emerald-500/15 px-3 py-2 flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-200 leading-snug line-clamp-2 break-words">{h.action_label}</p>
                    {h.action_detail && (
                      <p className="text-[10px] text-slate-500 leading-snug line-clamp-1 break-words mt-0.5">{h.action_detail}</p>
                    )}
                    <div className="flex items-baseline justify-between mt-0.5 gap-2">
                      <span className="text-[9px] text-emerald-400/70 truncate">{h.completed_by_name || "Equipo"}</span>
                      <span className="text-[9px] text-slate-500 tabular-nums shrink-0">{relativeDate(h.completed_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {history.history.length > 4 && (
                <p className="text-[10px] text-slate-500 text-center pt-0.5">
                  +{history.history.length - 4} más en el expediente
                </p>
              )}
            </div>
          </div>
        )}

        {/* Últimas notas — preview read-only */}
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 flex items-center justify-between gap-2">
            <span>
              Últimas notas
              {peek.notes.length > 0 && <span className="text-cyan-accent/70 ml-1 normal-case font-mono">· {peek.notes.length}</span>}
            </span>
            {/* Round 9.19 CLAUDE.md UX rule + Valerie compliance signal:
                badge agregado de notas restringidas. Paralegal ve QUE EXISTEN
                pero NO el contenido (RLS + hierarchical visibility).
                Tooltip explica el rationale → educa al paralegal sobre el modelo. */}
            {peek.hiddenNotesCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-mono normal-case text-amber-300/80 bg-amber-500/[0.08] border border-amber-500/25 rounded px-1.5 py-0.5"
                title="Sólo los abogados pueden ver el contenido de estas notas"
              >
                🔒 {peek.hiddenNotesCount} privada{peek.hiddenNotesCount === 1 ? "" : "s"}
              </span>
            )}
          </h4>
          {peek.loading ? (
            <div className="space-y-1.5">
              {[0,1].map(i => <div key={i} className="h-12 rounded-md bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : peek.notes.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic px-1">Sin notas todavía.</p>
          ) : (
            <div className="space-y-1.5">
              {peek.notes.slice(0, 2).map(n => (
                <div key={n.id} className="rounded-md bg-white/[0.03] border border-white/8 px-3 py-2">
                  <div className="flex items-baseline justify-between mb-0.5 gap-2">
                    <span className="text-[10px] font-semibold text-cyan-accent truncate">{n.author_name}</span>
                    <span className="text-[9px] text-slate-500 tabular-nums shrink-0">{relativeDate(n.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">{n.body}</p>
                </div>
              ))}
              {peek.notes.length > 2 && (
                <p className="text-[10px] text-slate-500 text-center pt-0.5">
                  +{peek.notes.length - 2} más en el expediente
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tareas pendientes — preview read-only */}
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
            Tareas pendientes
            {peek.tasks.length > 0 && <span className="text-rose-400 ml-1 normal-case font-mono">· {peek.tasks.length}</span>}
          </h4>
          {peek.loading ? (
            <div className="space-y-1.5">
              {[0,1].map(i => <div key={i} className="h-11 rounded-md bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : peek.tasks.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic px-1">Sin tareas pendientes.</p>
          ) : (
            <div className="space-y-1.5">
              {peek.tasks.slice(0, 3).map(t => {
                const due = dueLabel(t.due_date);
                const isUrgent = due.tone.includes("rose");
                return (
                  <div key={t.id} className={`rounded-md bg-white/[0.03] border px-3 py-2 ${isUrgent ? "border-rose-500/25" : "border-white/8"}`}>
                    <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">{t.title}</p>
                    <div className="flex items-baseline justify-between mt-0.5 gap-2">
                      <span className={`text-[9px] ${due.tone}`}>{due.label}</span>
                      {t.assigned_to_name && (
                        <span className="text-[9px] text-slate-500 truncate">{t.assigned_to_name}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {peek.tasks.length > 3 && (
                <p className="text-[10px] text-slate-500 text-center pt-0.5">
                  +{peek.tasks.length - 3} más en el expediente
                </p>
              )}
            </div>
          )}
        </div>

        {/* Round 9.19 Valerie UX compliance: "Última actualización"
            visible al user + auditor. Señal SOC II básica de change tracking.
            updated_at se mantiene automáticamente por trigger Round 8 +
            queda en audit_logs con whitelist post Round 9.19. */}
        {c.updated_at && (
          <p className="text-[10px] text-slate-500 px-1 pt-1 border-t border-white/[0.04] flex items-center gap-1.5">
            <Activity className="w-2.5 h-2.5 text-slate-600" />
            Última actualización {relativeDate(c.updated_at)}
            {ownerName && <span className="text-slate-600">· asignado a <span className="text-slate-400">{ownerName}</span></span>}
          </p>
        )}

        {/* CTA principal */}
        <button
          onClick={onOpenCase}
          className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-ai-blue to-cyan-accent text-white text-[12px] font-bold font-sora hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-ai-blue/30 mt-2"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir expediente completo
        </button>

        {/* Atajos */}
        <p className="text-[9px] text-slate-500 text-center pt-1 flex items-center justify-center flex-wrap gap-x-2">
          <span className="inline-flex items-center font-mono border border-white/10 rounded px-1 py-0.5">ESC</span> cerrar
          <span className="text-slate-700">·</span>
          <span className="inline-flex items-center font-mono border border-white/10 rounded px-1 py-0.5">⏎</span> abrir expediente
        </p>
      </div>
    </aside>
  );
}
