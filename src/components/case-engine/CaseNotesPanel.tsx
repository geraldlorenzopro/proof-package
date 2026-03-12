import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Pin, Plus, Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

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

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  milestone: { icon: Sparkles, color: "text-jarvis", label: "Hito" },
  decision: { icon: CheckCircle2, color: "text-emerald-400", label: "Decisión" },
  alert: { icon: AlertTriangle, color: "text-destructive", label: "Alerta" },
};

export default function CaseNotesPanel({ notes, caseId, accountId, onNoteAdded }: Props) {
  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("milestone");
  const [saving, setSaving] = useState(false);

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

      const { error } = await supabase.from("case_notes").insert({
        case_id: caseId,
        account_id: accountId,
        author_id: user.id,
        author_name: profile?.full_name || "Staff",
        content: content.trim(),
        note_type: noteType,
      });

      if (error) throw error;
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
              <div className="flex gap-2">
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
            const cfg = typeConfig[note.note_type] || typeConfig.milestone;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-xl border bg-card p-4 ${note.is_pinned ? "border-jarvis/20" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground">{note.author_name || "Staff"}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(note.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                      </span>
                      {note.is_pinned && <Pin className="w-3 h-3 text-jarvis" />}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
