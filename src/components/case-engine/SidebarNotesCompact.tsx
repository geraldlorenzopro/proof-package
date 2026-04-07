import { useState } from "react";
import { MessageSquare, Plus, Pin, Pencil, Trash2, Loader2, Sparkles, AlertTriangle, CheckCircle2, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
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
  onViewAll?: () => void;
}

const typeConfig: Record<string, { icon: any; color: string; label: string; border: string }> = {
  general: { icon: MessageSquare, color: "text-muted-foreground", label: "General", border: "border-l-muted-foreground/40" },
  milestone: { icon: Sparkles, color: "text-emerald-400", label: "Hito", border: "border-l-emerald-400" },
  alert: { icon: AlertTriangle, color: "text-destructive", label: "Alerta", border: "border-l-destructive" },
  decision: { icon: CheckCircle2, color: "text-blue-400", label: "Decisión", border: "border-l-blue-400" },
  communication: { icon: Phone, color: "text-amber-400", label: "Comunicación", border: "border-l-amber-400" },
};

const MAX_VISIBLE = 3;

export default function SidebarNotesCompact({ notes, caseId, accountId, onNoteAdded, onViewAll }: Props) {
  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const visible = sorted.slice(0, MAX_VISIBLE);
  const remaining = sorted.length - MAX_VISIBLE;

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      await supabase.from("case_notes").insert({
        case_id: caseId, account_id: accountId, author_id: user.id,
        author_name: profile?.full_name || "Staff", content: content.trim(), note_type: noteType,
      });
      setContent(""); setAdding(false); onNoteAdded();
      toast.success("Nota agregada");
    } catch (err: any) { toast.error(err.message || "Error"); }
    finally { setSaving(false); }
  }

  async function handleEdit(noteId: string) {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      await supabase.from("case_notes").update({ content: editContent.trim() }).eq("id", noteId);
      setEditingId(null); onNoteAdded(); toast.success("Nota actualizada");
    } catch (err: any) { toast.error(err.message || "Error"); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from("case_notes").delete().eq("id", deleteId);
    setDeleteId(null); onNoteAdded(); toast.success("Nota eliminada");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-jarvis" />
          <span className="text-xs font-bold text-foreground">Notas</span>
          <Badge variant="outline" className="text-[9px]">{notes.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setAdding(!adding)} title="Nueva nota">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Inline add form */}
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-lg border border-jarvis/20 bg-card p-3 space-y-2">
              <div className="flex gap-1 flex-wrap">
                {Object.entries(typeConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setNoteType(key)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold transition-all ${
                        noteType === key ? `${cfg.color} bg-card border border-border shadow-sm` : "text-muted-foreground"
                      }`}>
                      <Icon className="w-2.5 h-2.5" />{cfg.label}
                    </button>
                  );
                })}
              </div>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escribir nota..." className="min-h-[50px] text-xs" />
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setAdding(false)}>Cancelar</Button>
                <Button size="sm" className="h-6 text-[10px]" onClick={handleSave} disabled={saving || !content.trim()}>
                  {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Guardar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sorted.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-3">Sin notas</p>
      ) : (
        <div className="space-y-1.5">
          {visible.map(note => {
            const cfg = typeConfig[note.note_type] || typeConfig.general;
            const Icon = cfg.icon;
            const isEditing = editingId === note.id;
            return (
              <div key={note.id} className={`rounded-lg border bg-card/50 p-2.5 border-l-[3px] ${cfg.border} group`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[40px] text-xs" autoFocus />
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-5 text-[9px]" onClick={() => setEditingId(null)}>Cancelar</Button>
                      <Button size="sm" className="h-5 text-[9px]" onClick={() => handleEdit(note.id)} disabled={editSaving}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-foreground leading-snug line-clamp-2">{note.content}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Icon className={`w-2.5 h-2.5 ${cfg.color}`} />
                      <span className="text-[9px] text-muted-foreground">{note.author_name || "Staff"}</span>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <span className="text-[9px] text-muted-foreground">{format(new Date(note.created_at), "d MMM", { locale: es })}</span>
                      {note.is_pinned && <Pin className="w-2.5 h-2.5 text-jarvis" />}
                      <div className="ml-auto flex gap-0.5">
                        <button onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                          className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Editar">
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button onClick={() => setDeleteId(note.id)}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {remaining > 0 && onViewAll && (
            <button onClick={onViewAll} className="w-full text-center text-[10px] text-jarvis hover:underline py-1">
              Ver todas ({sorted.length})
            </button>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta nota?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
