import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Pin, Plus, Sparkles, AlertTriangle, CheckCircle2, Loader2, Pencil, Trash2, Phone, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CaseNote {
  id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  note_type: string;
  is_pinned: boolean;
  created_at: string;
}

interface Props {
  notes: CaseNote[];
  caseId: string;
  accountId: string;
  onNoteAdded: () => void;
}

const typeConfig: Record<string, { icon: any; color: string; label: string; border: string }> = {
  general: { icon: MessageSquare, color: "text-muted-foreground", label: "General", border: "border-l-muted-foreground/40" },
  milestone: { icon: Sparkles, color: "text-emerald-400", label: "Hito", border: "border-l-emerald-400" },
  alert: { icon: AlertTriangle, color: "text-destructive", label: "Alerta", border: "border-l-destructive" },
  decision: { icon: CheckCircle2, color: "text-blue-400", label: "Decisión", border: "border-l-blue-400" },
  communication: { icon: Phone, color: "text-amber-400", label: "Comunicación", border: "border-l-amber-400" },
};

export default function CaseNotesPanel({ notes, caseId, accountId, onNoteAdded }: Props) {
  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { data: insertedNote, error } = await supabase.from("case_notes").insert({
        case_id: caseId,
        account_id: accountId,
        author_id: user.id,
        author_name: profile?.full_name || "Staff",
        content: content.trim(),
        note_type: noteType,
      }).select("id").single();

      if (error) throw error;

      // Push to GHL in background if client has ghl_contact_id
      if (insertedNote?.id) {
        (async () => {
          try {
            const { data: caseData } = await supabase.from("client_cases")
              .select("client_profile_id").eq("id", caseId).single();
            if (!caseData?.client_profile_id) return;
            const { data: cp } = await supabase.from("client_profiles")
              .select("ghl_contact_id").eq("id", caseData.client_profile_id).single();
            if (!cp?.ghl_contact_id) return;
            const { data: session } = await supabase.auth.getSession();
            if (!session.session) return;
            await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-note-to-ghl`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.session.access_token}`,
                },
                body: JSON.stringify({
                  account_id: accountId,
                  note_id: insertedNote.id,
                  ghl_contact_id: cp.ghl_contact_id,
                  content: content.trim(),
                  author_name: profile?.full_name || "Staff",
                }),
              }
            );
          } catch {}
        })();
      }

      setContent("");
      setAdding(false);
      onNoteAdded();
      toast.success("Nota agregada");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar nota");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(noteId: string) {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from("case_notes").update({
        content: editContent.trim(),
      }).eq("id", noteId);
      if (error) throw error;
      setEditingId(null);
      onNoteAdded();
      toast.success("Nota actualizada");
    } catch (err: any) {
      toast.error(err.message || "Error al editar nota");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("case_notes").delete().eq("id", deleteId);
      if (error) throw error;
      const { logAudit } = await import("@/lib/auditLog");
      logAudit({ action: "note.deleted" as any, entity_type: "note" as any, entity_id: deleteId, entity_label: "Nota eliminada" });
      setDeleteId(null);
      onNoteAdded();
      toast.success("Nota eliminada");
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar nota");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-jarvis" />
          <h3 className="text-sm font-bold text-foreground">Notas del Proceso</h3>
          <Badge variant="outline" className="text-[9px]">{notes.length}</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => setAdding(!adding)}
        >
          <Plus className="w-3 h-3" />
          Nota
        </Button>
      </div>

      {/* Add note form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-jarvis/20 bg-card p-4 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(typeConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setNoteType(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        noteType === key
                          ? `${cfg.color} bg-card border border-border shadow-sm`
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ej: El caso se encuentra en etapa de revisión de evidencias recibidas..."
                className="min-h-[80px] text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={saving || !content.trim()}>
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes list */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin notas aún</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((note, i) => {
            const cfg = typeConfig[note.note_type] || typeConfig.general;
            const Icon = cfg.icon;
            const isEditing = editingId === note.id;
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-xl border bg-card p-4 border-l-4 ${cfg.border} ${note.is_pinned ? "border-jarvis/20" : "border-border"} group relative`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[60px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>Cancelar</Button>
                          <Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleEdit(note.id)} disabled={editSaving || !editContent.trim()}>
                            {editSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={`text-[8px] ${cfg.color} border-current/20`}>{cfg.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{note.author_name || "Staff"}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(note.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                      </span>
                      {note.is_pinned && <Pin className="w-3 h-3 text-jarvis" />}
                    </div>
                  </div>

                  {/* Edit/Delete buttons — visible on hover */}
                  {!isEditing && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteId(note.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta nota?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
