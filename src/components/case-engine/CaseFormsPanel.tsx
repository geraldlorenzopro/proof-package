import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  FileText, Plus, Download, Pencil, Loader2, Clock, CheckCircle2, Lock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { generateI765Pdf } from "@/lib/i765PdfGenerator";
import { fillI765Pdf } from "@/lib/i765FormFiller";
import { toast } from "sonner";

interface FormSubmission {
  id: string;
  form_type: string;
  status: string;
  created_at: string;
  form_data: any;
  client_name: string | null;
}

const AVAILABLE_FORMS = [
  { type: "i-765", label: "I-765 — Permiso de Trabajo (EAD)", available: true, icon: "📋" },
  { type: "n-400", label: "N-400 — Naturalización", available: false, icon: "🗽" },
  { type: "i-485", label: "I-485 — Ajuste de Estatus", available: false, icon: "📄" },
  { type: "i-131", label: "I-131 — Advance Parole", available: false, icon: "✈️" },
];

interface Props {
  caseId: string;
  accountId: string;
  clientProfileId?: string | null;
  clientName?: string;
}

export default function CaseFormsPanel({ caseId, accountId, clientProfileId, clientName }: Props) {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    loadForms();
  }, [caseId]);

  async function loadForms() {
    const { data } = await supabase
      .from("form_submissions")
      .select("id, form_type, status, created_at, form_data, client_name")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    setForms((data as FormSubmission[]) || []);
    setLoading(false);
  }

  function handleCreateForm(formType: string) {
    setShowSelector(false);
    navigate("/dashboard/smart-forms/new", {
      state: {
        fromCase: true,
        caseId,
        accountId,
        formType,
        beneficiaryId: clientProfileId || null,
      },
    });
  }

  function handleEditForm(formId: string) {
    navigate(`/dashboard/smart-forms/${formId}`, {
      state: {
        fromCase: true,
        caseId,
        accountId,
      },
    });
  }

  async function handleDownloadPdf(form: FormSubmission) {
    try {
      if (form.form_type === "i-765" && form.form_data) {
        await fillI765Pdf(form.form_data);
        toast.success("PDF USCIS generado");
      }
    } catch {
      toast.error("Error al generar PDF");
    }
  }

  async function handleDownloadSummary(form: FormSubmission) {
    try {
      if (form.form_type === "i-765" && form.form_data) {
        generateI765Pdf(form.form_data);
        toast.success("Resumen PDF generado");
      }
    } catch {
      toast.error("Error al generar resumen");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  // Empty state
  if (forms.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-semibold text-foreground mb-1">Sin formularios en este caso</p>
          <p className="text-xs text-muted-foreground mb-6">
            Crea un formulario USCIS para este caso. Los datos del cliente se llenarán automáticamente.
          </p>
          <Button
            onClick={() => setShowSelector(true)}
            className="gap-2 bg-accent hover:bg-accent/90"
          >
            <Plus className="w-4 h-4" />
            Crear formulario USCIS
          </Button>

          <div className="mt-8 text-left max-w-sm mx-auto">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
              Formularios disponibles
            </p>
            <div className="space-y-2">
              {AVAILABLE_FORMS.map(f => (
                <div
                  key={f.type}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    f.available
                      ? "border-accent/20 bg-accent/5 cursor-pointer hover:bg-accent/10"
                      : "border-border/30 bg-muted/20 opacity-50"
                  }`}
                  onClick={() => f.available && handleCreateForm(f.type)}
                >
                  <span className="text-lg">{f.icon}</span>
                  <span className={`text-xs font-medium flex-1 ${f.available ? "text-foreground" : "text-muted-foreground"}`}>
                    {f.label}
                  </span>
                  {f.available ? (
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                  ) : (
                    <Badge variant="outline" className="text-[8px]">
                      <Lock className="w-2.5 h-2.5 mr-1" />
                      Próximamente
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <FormSelectorModal
          open={showSelector}
          onClose={() => setShowSelector(false)}
          onSelect={handleCreateForm}
        />
      </div>
    );
  }

  // List of forms
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Formularios del Caso</h3>
          <Badge variant="outline" className="text-[9px]">{forms.length}</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => setShowSelector(true)}
        >
          <Plus className="w-3 h-3" />
          Nuevo formulario
        </Button>
      </div>

      <div className="space-y-2">
        {forms.map((form, i) => (
          <motion.div
            key={form.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 hover:border-accent/20 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-lg shrink-0">
                📋
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {form.form_type.toUpperCase()}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      form.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {form.status === "completed" ? "Completado" : "Borrador"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {form.client_name && (
                    <span className="text-[11px] text-muted-foreground">{form.client_name}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(form.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => handleEditForm(form.id)}
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => handleDownloadPdf(form)}
                >
                  <Download className="w-3 h-3" />
                  USCIS PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => handleDownloadSummary(form)}
                >
                  <Download className="w-3 h-3" />
                  Resumen
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <FormSelectorModal
        open={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={handleCreateForm}
      />
    </div>
  );
}

function FormSelectorModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Crear formulario USCIS
          </DialogTitle>
          <DialogDescription>
            Selecciona el formulario que deseas preparar para este caso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {AVAILABLE_FORMS.map(f => (
            <button
              key={f.type}
              disabled={!f.available}
              onClick={() => f.available && onSelect(f.type)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                f.available
                  ? "border-accent/20 bg-accent/5 hover:bg-accent/10 hover:border-accent/40 cursor-pointer"
                  : "border-border/30 bg-muted/20 opacity-40 cursor-not-allowed"
              }`}
            >
              <span className="text-xl">{f.icon}</span>
              <span className={`text-sm font-medium flex-1 ${f.available ? "text-foreground" : "text-muted-foreground"}`}>
                {f.label}
              </span>
              {!f.available && (
                <Badge variant="outline" className="text-[8px]">Próximamente</Badge>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
