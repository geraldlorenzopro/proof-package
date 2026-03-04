import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Plus, Search, Copy, Trash2, Pencil,
  Download, MoreHorizontal, Clock, CheckCircle2,
  Send, Sparkles, Lock, ArrowRight,
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

const STATUS_CONFIG: Record<string, { label: string; labelEs: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  draft: { label: "Draft", labelEs: "Borrador", variant: "secondary", icon: Clock },
  completed: { label: "Completed", labelEs: "Completado", variant: "default", icon: CheckCircle2 },
  sent: { label: "Sent", labelEs: "Enviado", variant: "outline", icon: Send },
};

// Forms catalog definition
type FormCatalogItem = {
  slug: string;
  name: string;
  fullName: string;
  description: string;
  category: string;
  status: "available" | "coming_soon" | "beta";
  icon: string;
};

const FORMS_CATALOG: FormCatalogItem[] = [
  {
    slug: "i-765",
    name: "I-765",
    fullName: "Application for Employment Authorization",
    description: "Permiso de trabajo (EAD) para solicitantes elegibles",
    category: "Empleo",
    status: "available",
    icon: "📋",
  },
  {
    slug: "i-130",
    name: "I-130",
    fullName: "Petition for Alien Relative",
    description: "Petición de familiar extranjero por ciudadano o residente",
    category: "Familia",
    status: "coming_soon",
    icon: "👨‍👩‍👧",
  },
  {
    slug: "i-485",
    name: "I-485",
    fullName: "Application to Register Permanent Residence",
    description: "Ajuste de estatus a residencia permanente",
    category: "Residencia",
    status: "coming_soon",
    icon: "🏠",
  },
  {
    slug: "i-131",
    name: "I-131",
    fullName: "Application for Travel Document",
    description: "Advance Parole y documentos de viaje",
    category: "Viaje",
    status: "coming_soon",
    icon: "✈️",
  },
  {
    slug: "i-864",
    name: "I-864",
    fullName: "Affidavit of Support",
    description: "Declaración jurada de manutención financiera",
    category: "Soporte",
    status: "coming_soon",
    icon: "💰",
  },
  {
    slug: "i-129f",
    name: "I-129F",
    fullName: "Petition for Alien Fiancé(e)",
    description: "Petición de visa K-1 para prometido(a)",
    category: "Familia",
    status: "coming_soon",
    icon: "💍",
  },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: "Disponible", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  beta: { label: "Beta", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  coming_soon: { label: "Próximamente", className: "bg-muted/60 text-muted-foreground border-border/40" },
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

  const handleFormClick = (form: FormCatalogItem) => {
    if (form.status === "available") {
      navigate("/dashboard/smart-forms/new");
    } else {
      toast({ title: `${form.name} — Próximamente`, description: "Este formulario estará disponible pronto." });
    }
  };

  // Filtering submissions
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
      <div className="mb-8">
        <div className="h-6 w-48 bg-muted rounded mb-2 animate-pulse" />
        <div className="h-4 w-64 bg-muted/60 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/50 p-4 animate-pulse h-36" />
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

        {/* ═══════ SECTION 1: FORMS CATALOG ═══════ */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Smart Forms</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-[42px]">
                Formularios inteligentes de USCIS con auto-llenado
              </p>
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {FORMS_CATALOG.map(form => {
              const badge = STATUS_BADGE[form.status];
              const isAvailable = form.status === "available";
              return (
                <button
                  key={form.slug}
                  onClick={() => handleFormClick(form)}
                  className={cn(
                    "group relative rounded-xl border p-4 text-left transition-all duration-200 flex flex-col",
                    isAvailable
                      ? "border-accent/30 bg-gradient-to-b from-accent/5 to-transparent hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5 cursor-pointer"
                      : "border-border/20 bg-card/30 opacity-60 cursor-default"
                  )}
                >
                  {/* Icon */}
                  <span className="text-2xl mb-2">{form.icon}</span>

                  {/* Form name */}
                  <p className={cn(
                    "font-bold text-sm",
                    isAvailable ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {form.name}
                  </p>

                  {/* Category */}
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 mb-2">
                    {form.category}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-3">
                    {form.description}
                  </p>

                  {/* Status badge */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                      badge.className
                    )}>
                      {badge.label}
                    </span>
                    {isAvailable && (
                      <ArrowRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    {!isAvailable && (
                      <Lock className="w-3 h-3 text-muted-foreground/40" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ SECTION 2: SUBMISSIONS TABLE ═══════ */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Mis Formularios</h2>
              <span className="text-xs text-muted-foreground">({submissions.length})</span>
            </div>
            <Button
              onClick={() => navigate("/dashboard/smart-forms/new")}
              size="sm"
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </Button>
          </div>

          {/* Filter tabs + search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="flex gap-1 bg-secondary/40 rounded-lg p-0.5">
              {(["all", "draft", "completed", "sent"] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filterStatus === st
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st === "all" ? "Todos" : STATUS_CONFIG[st]?.labelEs || st}
                  <span className="ml-1 text-[10px] opacity-60">{counts[st]}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 bg-secondary/60 border-border/50 h-8 text-sm"
                placeholder="Buscar cliente o email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border/40">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {submissions.length === 0 ? "No hay formularios aún" : "Sin resultados"}
              </p>
              {submissions.length === 0 && (
                <Button
                  onClick={() => navigate("/dashboard/smart-forms/new")}
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear primer formulario
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_100px_120px_120px_50px] gap-4 px-4 py-2 bg-secondary/40 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
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
                const StatusIcon = cfg.icon;
                return (
                  <div
                    key={sub.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_120px_120px_50px] gap-2 md:gap-4 px-4 py-3 border-t border-border/15 hover:bg-secondary/20 transition-colors items-center cursor-pointer"
                    onClick={() => navigate(`/dashboard/smart-forms/${sub.id}`)}
                  >
                    <div>
                      <p className="font-medium text-sm truncate">{sub.client_name || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub.client_email || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{FORMS_CATALOG.find(f => f.slug === sub.form_type)?.icon || "📋"}</span>
                      <span className="text-sm font-medium">{sub.form_type.toUpperCase()}</span>
                    </div>
                    <div>
                      <Badge variant={cfg.variant} className="text-[11px] gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {cfg.labelEs}
                      </Badge>
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
                          <Button variant="ghost" size="icon" className="h-7 w-7">
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
