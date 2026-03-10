import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Trash2,
  Search,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VawaCasesListProps {
  lang: "es" | "en";
}

interface VawaCase {
  id: string;
  client_name: string;
  client_email: string | null;
  status: string;
  checklist_progress: Record<string, boolean>;
  screener_answers: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: Record<"es" | "en", string> }> = {
  draft: {
    icon: AlertTriangle,
    color: "text-muted-foreground",
    label: { es: "Borrador", en: "Draft" },
  },
  screening: {
    icon: AlertTriangle,
    color: "text-amber-400",
    label: { es: "En Screening", en: "Screening" },
  },
  checklist: {
    icon: ClipboardList,
    color: "text-accent",
    label: { es: "En Checklist", en: "In Checklist" },
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    label: { es: "Completado", en: "Completed" },
  },
};

export default function VawaCasesList({ lang }: VawaCasesListProps) {
  const navigate = useNavigate();
  const [cases, setCases] = useState<VawaCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const t = (es: string, en: string) => (lang === "es" ? es : en);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("vawa_cases")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCases((data as unknown as VawaCase[]) || []);
    } catch (err) {
      console.error("Error loading cases:", err);
      toast.error(t("Error al cargar los casos", "Error loading cases"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("vawa_cases").delete().eq("id", deleteId);
      if (error) throw error;
      setCases((prev) => prev.filter((c) => c.id !== deleteId));
      toast.success(t("Caso eliminado", "Case deleted"));
    } catch (err) {
      toast.error(t("Error al eliminar", "Error deleting"));
    } finally {
      setDeleteId(null);
    }
  };

  const getProgress = (c: VawaCase) => {
    const progress = c.checklist_progress || {};
    const completed = Object.values(progress).filter(Boolean).length;
    const total = Object.keys(progress).length;
    if (total === 0) return null;
    return { completed, total, pct: Math.round((completed / total) * 100) };
  };

  const filtered = cases.filter((c) =>
    c.client_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      {cases.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por nombre...", "Search by name...")}
            className="pl-9"
          />
        </div>
      )}

      {/* Empty state */}
      {cases.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">
            {t("No hay casos VAWA guardados aún.", "No VAWA cases saved yet.")}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t(
              "Completa un screening y guarda el progreso del checklist para verlo aquí.",
              "Complete a screening and save the checklist progress to see it here."
            )}
          </p>
        </div>
      )}

      {/* Case list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((c) => {
            const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
            const Icon = cfg.icon;
            const prog = getProgress(c);
            const petType = c.screener_answers?.petitionerType || "";

            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-accent/30 transition-all cursor-pointer"
                onClick={() => navigate(`/dashboard/vawa-checklist?case=${c.id}`)}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Icon className={cn("w-5 h-5", cfg.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{c.client_name}</p>
                    {petType && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {petType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn("text-xs font-medium", cfg.color)}>
                      {cfg.label[lang]}
                    </span>
                    {prog && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${prog.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {prog.completed}/{prog.total}
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(c.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(c.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {search && filtered.length === 0 && cases.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          {t("Sin resultados para", "No results for")} "{search}"
        </p>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar este caso?", "Delete this case?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Esta acción no se puede deshacer. Se perderá todo el progreso del checklist.",
                "This action cannot be undone. All checklist progress will be lost."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t("Eliminar", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
