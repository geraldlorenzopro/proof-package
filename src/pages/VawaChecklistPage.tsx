import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import nerLogo from "@/assets/ner-logo.png";
import { LangToggle } from "@/components/LangToggle";
import { useBackDestination } from "@/hooks/useBackDestination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VawaChecklist from "@/components/vawa/VawaChecklist";
import { generateChecklist, ChecklistCategory } from "@/components/vawa/vawaChecklistEngine";
import { VawaAnswers, getDefaultAnswers } from "@/components/vawa/vawaEngine";

export default function VawaChecklistPage() {
  const navigate = useNavigate();
  const { destination } = useBackDestination();
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get("case");
  
  const [lang, setLang] = useState<"es" | "en">("es");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<VawaAnswers>(getDefaultAnswers());
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(caseId);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const t = (es: string, en: string) => (lang === "es" ? es : en);

  useEffect(() => {
    if (caseId) {
      loadCase(caseId);
    } else {
      const stored = sessionStorage.getItem("vawa_checklist_data");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setAnswers(data.answers);
          setCategories(generateChecklist(data.answers));
          setClientName(data.answers.clientName || "");
          setLoading(false);
          sessionStorage.removeItem("vawa_checklist_data");
        } catch {
          setLoading(false);
          navigate("/dashboard/vawa-screener");
        }
      } else {
        setLoading(false);
        navigate("/dashboard/vawa-screener");
      }
    }
  }, [caseId]);

  const loadCase = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("vawa_cases")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const a = data.screener_answers as unknown as VawaAnswers;
      setAnswers(a);
      setCategories(generateChecklist(a));
      setProgress((data.checklist_progress as Record<string, boolean>) || {});
      setNotes((data.checklist_notes as Record<string, string>) || {});
      setClientName(data.client_name);
      setClientEmail(data.client_email || "");
      setCurrentCaseId(id);
    } catch (err) {
      console.error("Error loading case:", err);
      toast.error(t("Error al cargar el caso", "Error loading case"));
      navigate("/dashboard/vawa-screener");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentCaseId) {
      if (!clientName.trim()) {
        setShowSaveDialog(true);
        return;
      }
      await createCase();
    } else {
      await updateCase();
    }
  };

  const createCase = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("vawa_cases")
        .insert({
          professional_id: user.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          screener_answers: answers as any,
          screener_result: null,
          checklist_progress: progress as any,
          checklist_notes: notes as any,
          status: "checklist",
        })
        .select("id")
        .single();

      if (error) throw error;
      setCurrentCaseId(data.id);
      toast.success(t("Caso guardado", "Case saved"));
      window.history.replaceState(null, "", `/dashboard/vawa-checklist?case=${data.id}`);
    } catch (err: any) {
      console.error("Error creating case:", err);
      toast.error(err.message || t("Error al guardar", "Error saving"));
    } finally {
      setSaving(false);
      setShowSaveDialog(false);
    }
  };

  const updateCase = async () => {
    if (!currentCaseId) return;
    setSaving(true);
    try {
      const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
      const completedItems = Object.values(progress).filter(Boolean).length;
      const isComplete = completedItems === totalItems;

      const { error } = await supabase
        .from("vawa_cases")
        .update({
          checklist_progress: progress as any,
          checklist_notes: notes as any,
          status: isComplete ? "completed" : "checklist",
        })
        .eq("id", currentCaseId);

      if (error) throw error;
      toast.success(t("Progreso guardado", "Progress saved"));
    } catch (err: any) {
      console.error("Error updating case:", err);
      toast.error(err.message || t("Error al guardar", "Error saving"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!clientName.trim()) {
      toast.error(t("Ingrese el nombre del cliente", "Enter client name"));
      return;
    }
    await createCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <ClipboardList className="w-8 h-8 text-accent animate-pulse" />
          <p className="text-sm text-muted-foreground">{t("Cargando checklist...", "Loading checklist...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <button
            onClick={() => navigate(destination)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ClipboardList className="w-4 h-4 text-accent" />
            <span className="font-display text-xs tracking-wider text-accent">
              {t("DOCUMENT CHECKLIST", "DOCUMENT CHECKLIST")}
            </span>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full">
        <VawaChecklist
          categories={categories}
          answers={answers}
          lang={lang}
          progress={progress}
          onProgressChange={setProgress}
          notes={notes}
          onNotesChange={setNotes}
          onSave={handleSave}
          saving={saving}
        />
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Save className="w-5 h-5 text-accent" />
              {t("Guardar Caso VAWA", "Save VAWA Case")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Nombre del Cliente", "Client Name")} *</Label>
              <Input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder={t("Nombre completo", "Full name")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t("Email del Cliente (opcional)", "Client Email (optional)")}</Label>
              <Input
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1.5"
                type="email"
              />
            </div>
            <Button onClick={handleConfirmSave} disabled={saving} className="w-full gap-2 bg-accent text-accent-foreground">
              <Save className="w-4 h-4" />
              {saving ? t("Guardando...", "Saving...") : t("Guardar Caso", "Save Case")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
