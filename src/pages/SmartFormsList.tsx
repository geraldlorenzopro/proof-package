import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Plus, Search, Copy, Trash2, Pencil,
  Download, MoreHorizontal, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateI765Pdf } from "@/lib/i765PdfGenerator";
import { I765Data } from "@/components/smartforms/i765Schema";
import { cn } from "@/lib/utils";

type Submission = {
  id: string;
  form_type: string;
  status: string;
  client_name: string | null;
  client_email: string | null;
  form_data: I765Data;
  created_at: string;
  updated_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; labelEs: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", labelEs: "Borrador", variant: "secondary" },
  completed: { label: "Completed", labelEs: "Completado", variant: "default" },
  sent: { label: "Sent", labelEs: "Enviado", variant: "outline" },
};

const FORM_LABELS: Record<string, string> = {
  "i-765": "I-765 (EAD)",
};

export default function SmartFormsList() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [firmName, setFirmName] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }

    // Parallel fetch for speed
    const [profileRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("firm_name").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("form_submissions")
        .select("id, form_type, status, client_name, client_email, form_data, created_at, updated_at")
        .order("updated_at", { ascending: false }),
    ]);

    if (profileRes.data?.firm_name) setFirmName(profileRes.data.firm_name);
    if (subsRes.error) {
      toast({ title: "Error", description: subsRes.error.message, variant: "destructive" });
    } else {
      setSubmissions((subsRes.data as unknown as Submission[]) || []);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("form_submissions").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSubmissions(prev => prev.filter(s => s.id !== deleteId));
      toast({ title: "🗑️ Formulario eliminado" });
    }
    setDeleteId(null);
  };

  const handleDuplicate = async (sub: Submission) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: accId } = await supabase.rpc("user_account_id", { _user_id: session.user.id });
    if (!accId) return;

    const { data: inserted, error } = await supabase
      .from("form_submissions")
      .insert({
        account_id: accId as string,
        user_id: session.user.id,
        form_type: sub.form_type,
        form_version: "08/21/25",
        status: "draft",
        form_data: JSON.parse(JSON.stringify(sub.form_data)),
        client_name: sub.client_name ? `${sub.client_name} (copia)` : null,
        client_email: sub.client_email,
      })
      .select("id, form_type, status, client_name, client_email, form_data, created_at, updated_at")
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (inserted) {
      setSubmissions(prev => [inserted as unknown as Submission, ...prev]);
      toast({ title: "📋 Formulario duplicado" });
    }
  };

  const handleDownloadPdf = (sub: Submission) => {
    generateI765Pdf(sub.form_data, firmName || undefined);
  };

  // Filtering
  const filtered = submissions.filter(s => {
    const matchSearch = !search ||
      (s.client_name?.toLowerCase().includes(search.toLowerCase())) ||
      (s.client_email?.toLowerCase().includes(search.toLowerCase())) ||
      s.form_type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: submissions.length,
    draft: submissions.filter(s => s.status === "draft").length,
    completed: submissions.filter(s => s.status === "completed").length,
    sent: submissions.filter(s => s.status === "sent").length,
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold">Formularios</h1>
          </div>
          <p className="text-xs text-muted-foreground ml-7">Cargando formularios...</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-lg border border-border/30 bg-card/50 p-3 animate-pulse">
            <div className="h-8 w-12 bg-muted rounded mb-1" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="rounded-lg border border-border/30 bg-card/50 p-4 animate-pulse">
            <div className="h-4 w-48 bg-muted rounded mb-2" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Page title + action */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-bold">Formularios</h1>
            </div>
            <p className="text-xs text-muted-foreground ml-7">Formularios inteligentes para USCIS</p>
          </div>
          <Button onClick={() => navigate("/dashboard/smart-forms/new")} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4" /> Nuevo Formulario
          </Button>
        </div>


        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {(["all", "draft", "completed", "sent"] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                filterStatus === st
                  ? "border-accent/60 bg-accent/10"
                  : "border-border/30 bg-card/50 hover:border-border/60"
              )}
            >
              <p className="text-2xl font-bold">{counts[st]}</p>
              <p className="text-xs text-muted-foreground">
                {st === "all" ? "Total" : STATUS_CONFIG[st]?.labelEs || st}
              </p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-secondary/60 border-border/50"
              placeholder="Buscar por cliente, email o tipo de formulario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">
              {submissions.length === 0 ? "No hay formularios aún" : "Sin resultados"}
            </p>
            {submissions.length === 0 && (
              <Button onClick={() => navigate("/dashboard/smart-forms/new")} className="mt-4 gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4" /> Crear primer formulario
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_120px_140px_140px_60px] gap-4 px-4 py-2.5 bg-secondary/40 text-xs text-muted-foreground uppercase tracking-wider font-medium">
              <span>Cliente</span>
              <span>Formulario</span>
              <span>Estado</span>
              <span>Creado</span>
              <span>Actualizado</span>
              <span></span>
            </div>

            {/* Rows */}
            {filtered.map(sub => {
              const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.draft;
              return (
                <div
                  key={sub.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_140px_140px_60px] gap-2 md:gap-4 px-4 py-3 border-t border-border/20 hover:bg-secondary/20 transition-colors items-center cursor-pointer"
                  onClick={() => navigate(`/dashboard/smart-forms/${sub.id}`)}
                >
                  <div>
                    <p className="font-medium text-sm truncate">{sub.client_name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.client_email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm">{FORM_LABELS[sub.form_type] || sub.form_type}</span>
                  </div>
                  <div>
                    <Badge variant={cfg.variant} className="text-xs">{cfg.labelEs}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(sub.created_at).toLocaleDateString("es")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(sub.updated_at).toLocaleDateString("es")}
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/smart-forms/${sub.id}`)} className="gap-2">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(sub)} className="gap-2">
                          <Copy className="w-3.5 h-3.5" /> Duplicar
                        </DropdownMenuItem>
                        {sub.status === "completed" && (
                          <DropdownMenuItem onClick={() => handleDownloadPdf(sub)} className="gap-2">
                            <Download className="w-3.5 h-3.5" /> Descargar PDF
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(sub.id)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este formulario?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminarán todos los datos del formulario permanentemente.</AlertDialogDescription>
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
