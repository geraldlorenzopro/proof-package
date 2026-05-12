import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Plus, Search, Copy, Trash2, Pencil,
  Download, MoreHorizontal, Clock, CheckCircle2,
  Send, Sparkles, Lock, ArrowRight, X, Briefcase,
  Users, Home, Plane, DollarSign, Shield, BookOpen,
  Scale, User, Check, ChevronRight,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
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
  { slug: "i-765", name: "I-765", fullName: "I-765 · Permiso de Trabajo (EAD)", description: "Autorización de empleo", category: "Empleo", status: "available" },
  { slug: "i-140", name: "I-140", fullName: "Immigrant Petition for Alien Workers", description: "Petición de inmigrante trabajador", category: "Empleo", status: "coming_soon" },
  { slug: "i-130", name: "I-130", fullName: "I-130 · Petición Familiar (matrimonio, padres, hijos)", description: "Petición de familiar extranjero · BETA (sin PDF oficial aún)", category: "Familia", status: "beta" },
  { slug: "i-130a", name: "I-130A", fullName: "Supplemental Information for Spouse Beneficiary", description: "Suplemento para cónyuge beneficiario", category: "Familia", status: "coming_soon" },
  { slug: "i-129f", name: "I-129F", fullName: "Petition for Alien Fiancé(e)", description: "Visa K-1 para prometido(a)", category: "Familia", status: "coming_soon" },
  { slug: "i-751", name: "I-751", fullName: "Petition to Remove Conditions on Residence", description: "Remover condiciones de residencia", category: "Familia", status: "coming_soon" },
  { slug: "i-485", name: "I-485", fullName: "Application to Register Permanent Residence", description: "Ajuste de estatus", category: "Residencia", status: "coming_soon" },
  { slug: "ar-11", name: "AR-11", fullName: "Alien's Change of Address Card", description: "Cambio de dirección", category: "Residencia", status: "coming_soon" },
  { slug: "i-90", name: "I-90", fullName: "Application to Replace Permanent Resident Card", description: "Renovar / reemplazar Green Card", category: "Renovación", status: "coming_soon" },
  { slug: "i-131", name: "I-131", fullName: "Application for Travel Document", description: "Advance Parole y documentos de viaje", category: "Viaje", status: "coming_soon" },
  { slug: "i-864", name: "I-864", fullName: "Affidavit of Support Under Section 213A", description: "Declaración jurada de manutención", category: "Soporte", status: "coming_soon" },
  { slug: "i-864a", name: "I-864A", fullName: "Contract Between Sponsor and Household Member", description: "Contrato co-patrocinador", category: "Soporte", status: "coming_soon" },
  { slug: "i-589", name: "I-589", fullName: "Application for Asylum and for Withholding of Removal", description: "Solicitud de asilo", category: "Asilo / Protección", status: "coming_soon" },
  { slug: "i-821", name: "I-821", fullName: "Application for Temporary Protected Status", description: "Estatus de Protección Temporal (TPS)", category: "Asilo / Protección", status: "coming_soon" },
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
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Beneficiary selection modal
  const [selectedForm, setSelectedForm] = useState<FormCatalogItem | null>(null);
  const [beneficiaryModalOpen, setBeneficiaryModalOpen] = useState(false);
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [clientSearch, setClientSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
  const [accountIdRef, setAccountIdRef] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    const [profileRes, subsRes, accRes] = await Promise.all([
      supabase.from("profiles").select("firm_name").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("form_submissions")
        .select("id, form_type, status, client_name, client_email, form_data, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      supabase.rpc("user_account_id", { _user_id: session.user.id }),
    ]);
    if (profileRes.data?.firm_name) setFirmName(profileRes.data.firm_name);
    if (subsRes.error) {
      toast({ title: "Error", description: subsRes.error.message, variant: "destructive" });
    } else {
      setSubmissions((subsRes.data as unknown as Submission[]) || []);
    }
    if (accRes.data) {
      setAccountIdRef(accRes.data as string);
      // Load client count
      const { count } = await supabase
        .from("client_profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accRes.data as string);
      setClientCount(count || 0);
    }
    setLoading(false);
  };

  // Search clients for beneficiary modal
  useEffect(() => {
    if (!accountIdRef || !beneficiaryModalOpen) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const q = clientSearch.trim().toLowerCase();
      let query = supabase
        .from("client_profiles")
        .select("id, first_name, last_name, email")
        .eq("account_id", accountIdRef)
        .order("last_name", { ascending: true })
        .limit(50);
      if (q) {
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
      }
      const { data: clients } = await query;
      if (clients) setClientProfiles(clients);
      setSearchLoading(false);
    }, 300);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [clientSearch, accountIdRef, beneficiaryModalOpen]);

  // Load initial clients when modal opens
  useEffect(() => {
    if (beneficiaryModalOpen && accountIdRef && clientProfiles.length === 0) {
      setClientSearch("");
    }
  }, [beneficiaryModalOpen]);

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
    if (form.status === "available" || form.status === "beta") {
      setCatalogOpen(false);
      setSelectedForm(form);
      setSelectedBeneficiaryId(null);
      setClientSearch("");
      setBeneficiaryModalOpen(true);
    } else {
      toast({ title: `${form.name} — Próximamente`, description: "Este formulario estará disponible pronto." });
    }
  };

  const handleProceedToForm = () => {
    setBeneficiaryModalOpen(false);
    navigate("/dashboard/smart-forms/new", {
      state: {
        formType: selectedForm?.slug,
        beneficiaryId: selectedBeneficiaryId,
      },
    });
  };

  const handleSkipBeneficiary = () => {
    setBeneficiaryModalOpen(false);
    navigate("/dashboard/smart-forms/new", {
      state: {
        formType: selectedForm?.slug,
        beneficiaryId: null,
      },
    });
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
  // Separamos los disponibles (incluye beta) de los próximamente.
  // Los disponibles van arriba sin agrupar por categoría — son pocos y queremos foco.
  // Los "próximamente" van debajo en accordion colapsado por categoría.
  const availableForms = filteredCatalog.filter(f => f.status === "available" || f.status === "beta");
  const comingSoonByCategory = CATEGORIES.map(cat => ({
    category: cat,
    forms: filteredCatalog.filter(f => f.category === cat && f.status === "coming_soon"),
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
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Formularios</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-7.5">
              Llena, guarda y envía formularios USCIS desde acá
            </p>
          </div>
          <Button
            onClick={() => setCatalogOpen(true)}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/10"
          >
            <Plus className="w-4 h-4" /> Nuevo Formulario
          </Button>
        </div>

        {/* ═══════ STAT CARDS (filters) ═══════ */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
            { key: "all", label: "Total" },
            { key: "draft", label: "Borrador" },
            { key: "completed", label: "Completado" },
            { key: "sent", label: "Enviado" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-all cursor-pointer",
                filterStatus === key
                  ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                  : "border-border/30 bg-card/50 hover:border-border/60"
              )}
            >
              <p className={cn(
                "text-2xl font-bold",
                filterStatus === key ? "text-primary" : "text-foreground"
              )}>
                {counts[key]}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* ═══════ SEARCH BAR ═══════ */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-10 bg-secondary/50 border-border/40 h-10 text-sm"
            placeholder="Buscar por cliente, email o tipo de formulario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ═══════ SUBMISSIONS TABLE ═══════ */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border/40 bg-card/30">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-1">
              {submissions.length === 0 ? "No hay formularios aún" : "Sin resultados para tu búsqueda"}
            </p>
            <p className="text-xs text-muted-foreground/60 mb-4">
              {submissions.length === 0 ? "Cuando armes un I-130 o I-765 va a aparecer acá" : "Intenta con otro término"}
            </p>
            {submissions.length === 0 && (
              <Button onClick={() => setCatalogOpen(true)} variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Crear formulario
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-card/50">
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
                  <div className="min-w-0">
                    <span className="text-sm text-foreground font-medium">
                      {sub.form_type.toUpperCase()}{sub.form_type === "i-765" ? " (EAD)" : catalogItem ? ` (${catalogItem.category})` : ""}
                    </span>
                  </div>
                  <div>
                    <Badge variant={cfg.variant} className="text-xs gap-1.5 px-3 py-1">
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
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
                        {sub.status === "completed" && sub.form_type === "i-765" && (
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

        {/* ═══════ CATALOG MODAL ═══════ */}
        <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-lg font-bold">Nuevo Formulario</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Selecciona el formulario USCIS que deseas completar</DialogDescription>
            </DialogHeader>
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
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
              {/* DISPONIBLES (incluye beta) — arriba, sin agrupar */}
              {availableForms.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Disponibles ahora</span>
                  </div>
                  <div className="space-y-1">
                    {availableForms.map(form => {
                      const isBeta = form.status === "beta";
                      return (
                        <button
                          key={form.slug}
                          onClick={() => handleFormClick(form)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-primary/10 cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-primary/15 text-primary">
                            {form.name}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{form.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{form.description}</p>
                          </div>
                          {isBeta && (
                            <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 px-1.5 py-0.5 rounded shrink-0">BETA</span>
                          )}
                          <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PRÓXIMAMENTE — colapsado por defecto, accordion al fondo */}
              {comingSoonByCategory.length > 0 && (
                <div className="border-t border-border/30 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowComingSoon(s => !s)}
                    className="w-full flex items-center justify-between gap-2 text-left hover:opacity-80 transition-opacity"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Próximamente · {comingSoonByCategory.reduce((sum, g) => sum + g.forms.length, 0)} formularios
                    </span>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", showComingSoon && "rotate-90")} />
                  </button>
                  {showComingSoon && (
                    <div className="mt-3 space-y-3">
                      {comingSoonByCategory.map(group => {
                        const CatIcon = CATEGORY_ICONS[group.category] || FileText;
                        return (
                          <div key={group.category}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <CatIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{group.category}</span>
                            </div>
                            <div className="space-y-0.5">
                              {group.forms.map(form => (
                                <button
                                  key={form.slug}
                                  onClick={() => handleFormClick(form)}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left opacity-60 cursor-default"
                                >
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted/50 text-muted-foreground">
                                    {form.name}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{form.fullName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{form.description}</p>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full shrink-0">Próximo</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {availableForms.length === 0 && comingSoonByCategory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No se encontraron formularios</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ BENEFICIARY SELECTION MODAL ═══════ */}
        <Dialog open={beneficiaryModalOpen} onOpenChange={setBeneficiaryModalOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-5 pt-5 pb-2">
              <div className="flex items-center gap-2 mb-1">
                {selectedForm && (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {selectedForm.name}
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg font-bold">¿Para quién es este formulario?</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Busca al cliente en tu base de datos o llena los datos desde cero
              </DialogDescription>
            </DialogHeader>

            {/* Search */}
            <div className="px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 bg-secondary/50 border-border/40 text-sm"
                  placeholder={`Buscar en ${clientCount.toLocaleString()} contactos...`}
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  autoFocus
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Client list */}
            <div className="flex-1 overflow-y-auto px-5 min-h-0">
              {clientProfiles.length === 0 && clientCount === 0 ? (
                <div className="text-center py-8">
                  <User className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
                  <p className="text-sm text-muted-foreground">Sin contactos registrados</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Puedes continuar y llenar los datos manualmente</p>
                </div>
              ) : clientProfiles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    {searchLoading ? "Buscando..." : "Sin resultados — intenta otra búsqueda"}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/20 divide-y divide-border/10 mb-2">
                  {clientProfiles.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedBeneficiaryId(selectedBeneficiaryId === c.id ? null : c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors text-sm",
                        selectedBeneficiaryId === c.id ? "bg-primary/10" : "hover:bg-secondary/60"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                        selectedBeneficiaryId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {(c.first_name?.[0] || "").toUpperCase()}{(c.last_name?.[0] || "").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {c.last_name || ""}{c.last_name && c.first_name ? ", " : ""}{c.first_name || ""}
                        </p>
                        {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                      </div>
                      {selectedBeneficiaryId === c.id && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                  {clientProfiles.length >= 50 && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      Mostrando primeros 50 de {clientCount.toLocaleString()} — escribe para filtrar
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/20">
              <Button variant="ghost" size="sm" onClick={handleSkipBeneficiary} className="text-muted-foreground">
                No está en mi lista — empezar en blanco
              </Button>
              <Button
                onClick={handleProceedToForm}
                disabled={!selectedBeneficiaryId}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </Button>
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
