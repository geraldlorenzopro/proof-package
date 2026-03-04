import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Plus, Search, Copy, Trash2, Pencil,
  Download, MoreHorizontal, Clock, CheckCircle2,
  Send, Sparkles, Lock, ArrowRight, X, Briefcase,
  Users, Home, Plane, DollarSign, Shield, BookOpen,
  Scale,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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

// ═══════ FULL USCIS FORMS CATALOG ═══════
type FormCatalogItem = {
  slug: string;
  name: string;
  fullName: string;
  description: string;
  category: string;
  status: "available" | "coming_soon" | "beta";
};

const CATEGORY_ICONS: Record<string, typeof Briefcase> = {
  "Empleo": Briefcase,
  "Familia": Users,
  "Residencia": Home,
  "Viaje": Plane,
  "Soporte": DollarSign,
  "Asilo / Protección": Shield,
  "Ciudadanía": BookOpen,
  "Renovación": Scale,
};

const FORMS_CATALOG: FormCatalogItem[] = [
  // Empleo
  { slug: "i-765", name: "I-765", fullName: "Application for Employment Authorization", description: "Permiso de trabajo (EAD)", category: "Empleo", status: "available" },
  { slug: "i-140", name: "I-140", fullName: "Immigrant Petition for Alien Workers", description: "Petición de inmigrante trabajador", category: "Empleo", status: "coming_soon" },
  // Familia
  { slug: "i-130", name: "I-130", fullName: "Petition for Alien Relative", description: "Petición de familiar extranjero", category: "Familia", status: "coming_soon" },
  { slug: "i-130a", name: "I-130A", fullName: "Supplemental Information for Spouse Beneficiary", description: "Suplemento para cónyuge beneficiario", category: "Familia", status: "coming_soon" },
  { slug: "i-129f", name: "I-129F", fullName: "Petition for Alien Fiancé(e)", description: "Visa K-1 para prometido(a)", category: "Familia", status: "coming_soon" },
  { slug: "i-751", name: "I-751", fullName: "Petition to Remove Conditions on Residence", description: "Remover condiciones de residencia", category: "Familia", status: "coming_soon" },
  // Residencia
  { slug: "i-485", name: "I-485", fullName: "Application to Register Permanent Residence", description: "Ajuste de estatus", category: "Residencia", status: "coming_soon" },
  { slug: "ar-11", name: "AR-11", fullName: "Alien's Change of Address Card", description: "Cambio de dirección", category: "Residencia", status: "coming_soon" },
  { slug: "i-90", name: "I-90", fullName: "Application to Replace Permanent Resident Card", description: "Renovar / reemplazar Green Card", category: "Renovación", status: "coming_soon" },
  // Viaje
  { slug: "i-131", name: "I-131", fullName: "Application for Travel Document", description: "Advance Parole y documentos de viaje", category: "Viaje", status: "coming_soon" },
  // Soporte
  { slug: "i-864", name: "I-864", fullName: "Affidavit of Support Under Section 213A", description: "Declaración jurada de manutención", category: "Soporte", status: "coming_soon" },
  { slug: "i-864a", name: "I-864A", fullName: "Contract Between Sponsor and Household Member", description: "Contrato co-patrocinador", category: "Soporte", status: "coming_soon" },
  // Asilo / Protección
  { slug: "i-589", name: "I-589", fullName: "Application for Asylum and for Withholding of Removal", description: "Solicitud de asilo", category: "Asilo / Protección", status: "coming_soon" },
  { slug: "i-821", name: "I-821", fullName: "Application for Temporary Protected Status", description: "Estatus de Protección Temporal (TPS)", category: "Asilo / Protección", status: "coming_soon" },
  // Ciudadanía
  { slug: "n-400", name: "N-400", fullName: "Application for Naturalization", description: "Solicitud de ciudadanía", category: "Ciudadanía", status: "coming_soon" },
];

const CATEGORIES = [...new Set(FORMS_CATALOG.map(f => f.category))];

export default function SmartFormsList() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [firmName, setFirmName] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  useEffect(() => { loadData(); }, []);

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
      setCatalogOpen(false);
      navigate("/dashboard/smart-forms/new");
    } else {
      toast({ title: `${form.name} — Próximamente`, description: "Este formulario estará disponible pronto." });
    }
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

  // Catalog filtering
  const filteredCatalog = FORMS_CATALOG.filter(f =>
    !catalogSearch ||
    f.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    f.fullName.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    f.description.toLowerCase().includes(catalogSearch.toLowerCase())
  );
  const groupedCatalog = CATEGORIES.map(cat => ({
    category: cat,
    forms: filteredCatalog.filter(f => f.category === cat),
  })).filter(g => g.forms.length > 0);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="h-6 w-48 bg-muted rounded mb-4 animate-pulse" />
      <div className="h-10 w-full bg-muted/60 rounded-lg mb-6 animate-pulse" />
      <div className="space-y-3">
        {[1,2,3,4].map(i => (
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
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ═══════ HEADER ═══════ */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Smart Forms</h1>
              <p className="text-xs text-muted-foreground">
                {submissions.length} formulario{submissions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setCatalogOpen(true)}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/10"
          >
            <Plus className="w-4 h-4" /> Nuevo Formulario
          </Button>
        </div>

        {/* ═══════ SEARCH BAR + FILTERS ═══════ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10 bg-secondary/50 border-border/40 h-10 text-sm"
              placeholder="Buscar por cliente, email o tipo de formulario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-secondary/40 rounded-lg p-0.5 shrink-0">
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
        </div>

        {/* ═══════ SUBMISSIONS TABLE ═══════ */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border/40 bg-card/30">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-1">
              {submissions.length === 0 ? "No hay formularios aún" : "Sin resultados para tu búsqueda"}
            </p>
            <p className="text-xs text-muted-foreground/60 mb-4">
              {submissions.length === 0 ? "Comienza creando tu primer formulario inteligente" : "Intenta con otro término"}
            </p>
            {submissions.length === 0 && (
              <Button onClick={() => setCatalogOpen(true)} variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Crear formulario
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-card/50">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_100px_100px_100px_44px] gap-4 px-4 py-2.5 bg-secondary/50 text-[11px] text-muted-foreground uppercase tracking-wider font-medium border-b border-border/20">
              <span>Cliente</span>
              <span>Formulario</span>
              <span>Estado</span>
              <span>Creado</span>
              <span>Actualizado</span>
              <span></span>
            </div>

            {filtered.map(sub => {
              const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.draft;
              const StatusIcon = cfg.icon;
              const catalogItem = FORMS_CATALOG.find(f => f.slug === sub.form_type);
              return (
                <div
                  key={sub.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_100px_100px_44px] gap-2 md:gap-4 px-4 py-3 border-t border-border/10 hover:bg-secondary/30 transition-colors items-center cursor-pointer group"
                  onClick={() => navigate(`/dashboard/smart-forms/${sub.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{sub.client_name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.client_email || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">
                      {sub.form_type.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground truncate hidden lg:inline">
                      {catalogItem?.fullName || ""}
                    </span>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {/* ═══════ NEW FORM CATALOG MODAL ═══════ */}
        <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-lg font-bold">Nuevo Formulario</DialogTitle>
              <p className="text-xs text-muted-foreground">Selecciona el formulario USCIS que deseas completar</p>
            </DialogHeader>

            {/* Search inside modal */}
            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 bg-secondary/50 border-border/40 text-sm"
                  placeholder="Buscar formulario..."
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Categorized list */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
              {groupedCatalog.map(group => {
                const CatIcon = CATEGORY_ICONS[group.category] || FileText;
                return (
                  <div key={group.category}>
                    <div className="flex items-center gap-2 mb-2">
                      <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.category}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.forms.map(form => {
                        const isAvailable = form.status === "available";
                        return (
                          <button
                            key={form.slug}
                            onClick={() => handleFormClick(form)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                              isAvailable
                                ? "hover:bg-accent/10 cursor-pointer group"
                                : "opacity-50 cursor-default"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                              isAvailable
                                ? "bg-accent/15 text-accent"
                                : "bg-muted/50 text-muted-foreground"
                            )}>
                              {form.name}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{form.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">{form.description}</p>
                            </div>
                            {isAvailable ? (
                              <ArrowRight className="w-4 h-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full shrink-0">
                                Próximo
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {groupedCatalog.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No se encontraron formularios
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ DELETE CONFIRMATION ═══════ */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar formulario?</AlertDialogTitle>
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
    </div>
  );
}
