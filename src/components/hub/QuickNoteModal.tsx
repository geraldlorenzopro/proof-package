/**
 * QuickNoteModal — Crea una nota rápida atada a un caso, para el botón
 * "+ Nota" del HubQuickAdd.
 *
 * Limitación schema: `case_notes.case_id` es NOT NULL. No se puede crear
 * nota standalone hoy. El modal requiere selector OBLIGATORIO de caso.
 * Si la firma no tiene casos activos, mostramos empty state honesto.
 *
 * Post-entrega ideal: migration que haga case_id nullable + agregue
 * client_profile_id opcional, para soportar notas tipo "Cliente Juan llamó
 * sin caso aún". Por hoy (2026-05-28 entrega 5 firmas) el constraint queda.
 *
 * Visibility: por ahora todas las notas se crean con default 'team' que
 * pone el schema. Visibility picker (radios horizontales team/attorney_only/
 * admin_only per CLAUDE.md spec) queda como deuda técnica post-entrega.
 *
 * Audit (2026-05-28): único otro INSERT a case_notes vive en
 * SidebarNotesCompact.tsx (inline acordeón dentro de case-engine, requiere
 * case_id desde props). Este modal complementa con flow "desde el Hub
 * quiero anotar algo sobre un caso sin abrirlo".
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (noteId: string) => void;
}

interface CaseOption {
  id: string;
  client_name: string;
  case_type: string | null;
}

const NOTE_TYPES = [
  { value: "general",       label: "General",       chip: "bg-slate-500/15 border-slate-500/30 text-slate-300" },
  { value: "communication", label: "Comunicación",  chip: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-accent" },
  { value: "milestone",     label: "Hito",          chip: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
  { value: "alert",         label: "Alerta",        chip: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
  { value: "decision",      label: "Decisión",      chip: "bg-purple-500/15 border-purple-500/30 text-purple-300" },
];

export default function QuickNoteModal({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [casesLoading, setCasesLoading] = useState(true);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [caseId, setCaseId] = useState<string>("");
  const [cases, setCases] = useState<CaseOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setContent("");
    setNoteType("general");
    setCaseId("");
    setCasesLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCasesLoading(false); return; }
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) { setCasesLoading(false); return; }
      const { data } = await supabase
        .from("client_cases")
        .select("id, client_name, case_type")
        .eq("account_id", accountId)
        .neq("status", "completed")
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(50);
      setCases((data as any) || []);
      // Auto-seleccionar el primero si existe — mejor UX
      if (data && data.length > 0) setCaseId((data[0] as any).id);
      setCasesLoading(false);
    })();
  }, [open]);

  async function handleCreate() {
    if (!content.trim()) {
      toast.error("Escribí el contenido de la nota");
      return;
    }
    if (!caseId) {
      toast.error("Seleccioná un caso al que atar la nota");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sesión expirada");
        setLoading(false);
        return;
      }
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) {
        toast.error("No se pudo determinar tu cuenta");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      const authorName = profile?.full_name || user.email?.split("@")[0] || "Usuario";

      const { data, error } = await supabase
        .from("case_notes")
        .insert({
          case_id: caseId,
          account_id: accountId,
          author_id: user.id,
          author_name: authorName,
          content: content.trim(),
          note_type: noteType,
        } as any)
        .select("id")
        .single();

      if (error) {
        console.error("[quick-note]", error);
        toast.error("Error al crear nota", { description: error.message });
        setLoading(false);
        return;
      }

      logAudit({
        action: "note.created" as any,
        entity_type: "note",
        entity_id: data.id,
        entity_label: content.trim().slice(0, 50),
        metadata: { from_hub_quick_add: true, case_id: caseId, note_type: noteType },
      });

      const linkedCase = cases.find(c => c.id === caseId);
      toast.success("Nota agregada", {
        description: linkedCase ? `Atada a ${linkedCase.client_name}` : "Guardada",
        duration: 3000,
      });

      onOpenChange(false);
      onCreated?.(data.id);
    } catch (err: any) {
      console.error(err);
      toast.error("Error inesperado", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  const hasNoCases = !casesLoading && cases.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-sora">
            <FileText className="w-5 h-5 text-cyan-accent" />
            Nueva nota rápida
          </DialogTitle>
        </DialogHeader>

        {hasNoCases ? (
          // Empty state: firma sin casos activos no puede crear nota standalone
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/25 mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground font-sora">
                Aún no tenés casos para anotar
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[280px] mx-auto">
                Las notas se atan siempre a un caso. Creá tu primer caso desde un lead y volvé acá.
              </p>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate("/hub/leads");
              }}
              className="bg-cyan-accent hover:bg-cyan-accent/90 text-deep-navy font-semibold"
              size="sm"
            >
              Ir a Leads
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note-case">Atar a caso *</Label>
              <select
                id="note-case"
                value={caseId}
                onChange={e => setCaseId(e.target.value)}
                disabled={loading || casesLoading}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-cyan-accent/50 focus:outline-none disabled:opacity-50"
              >
                {casesLoading ? (
                  <option value="">Cargando casos...</option>
                ) : (
                  <>
                    <option value="">Seleccioná un caso...</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.client_name}{c.case_type ? ` · ${c.case_type}` : ""}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-content">Contenido *</Label>
              <textarea
                id="note-content"
                placeholder="Cliente llamó preguntando por status DS-260. Le dije que esperamos receipt en 5d hábiles..."
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={loading}
                rows={4}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-cyan-accent/50 focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de nota</Label>
              <div className="grid grid-cols-5 gap-1">
                {NOTE_TYPES.map(t => {
                  const active = noteType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setNoteType(t.value)}
                      className={`px-1.5 py-1 rounded text-[9px] font-semibold border transition-all ${
                        active ? t.chip : "bg-white/[0.02] border-white/10 text-muted-foreground hover:bg-white/[0.05]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60">
              Visible para todo el equipo de tu firma · Los abogados pueden cambiar visibilidad después.
            </p>
          </div>
        )}

        {!hasNoCases && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading || !content.trim() || !caseId}
              className="bg-cyan-accent hover:bg-cyan-accent/90 text-deep-navy font-semibold gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar nota
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
