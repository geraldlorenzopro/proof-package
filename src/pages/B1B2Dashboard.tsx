import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Plus, Copy, Check, ExternalLink,
  Search, Users, ChevronRight, AlertTriangle, Plane,
  CircleDot, CheckCircle2, Clock, Send, Eye,
  TrendingUp, ArrowRight, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface B1B2Case {
  id: string;
  client_name: string;
  case_type: string;
  process_type: string;
  pipeline_stage: string;
  status: string;
  access_token: string;
  created_at: string;
}

const STAGE_LABELS: Record<string, string> = {
  "consulta-inicial": "Consulta Inicial",
  "ds160-proceso": "DS-160 En Proceso",
  "ds160-completado": "DS-160 Completado",
  "cita-cas": "Cita CAS",
  "huellas": "Huellas",
  "preparacion": "Preparación",
  "entrevista": "Entrevista",
  "resultado": "Resultado",
};

const STAGE_ICONS: Record<string, string> = {
  "consulta-inicial": "💬",
  "ds160-proceso": "📝",
  "ds160-completado": "✅",
  "cita-cas": "📅",
  "huellas": "🖐",
  "preparacion": "📋",
  "entrevista": "🎤",
  "resultado": "🏆",
};

const ALL_STAGES = Object.keys(STAGE_LABELS);

export default function B1B2Dashboard() {
  const { accountCid: paramCid } = useParams<{ accountCid: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [resolvedCid, setResolvedCid] = useState(paramCid || "");
  const [cidInput, setCidInput] = useState("");
  const [loading, setLoading] = useState(!!paramCid);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<B1B2Case[]>([]);
  const [accountName, setAccountName] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New case modal
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const accountCid = paramCid || resolvedCid;

  const loadCases = useCallback(async () => {
    if (!accountCid) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("resolve-client-portal", {
        body: { cid: accountCid },
      });
      if (fnErr) throw fnErr;
      if (!data) {
        setError("Cuenta no encontrada.");
        return;
      }
      setAccountName(data.account_name || "");
      setCases(data.cases || []);
    } catch (e) {
      console.error(e);
      setError("Error al cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, [accountCid]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const getClientLink = (c: B1B2Case) => `${window.location.origin}/case-track/${c.access_token}`;

  const copyClientLink = (c: B1B2Case) => {
    navigator.clipboard.writeText(getClientLink(c));
    setCopiedId(c.id);
    toast({ title: "Link copiado", description: `Link de ${c.client_name} copiado al portapapeles.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareWhatsApp = (c: B1B2Case) => {
    const link = getClientLink(c);
    const msg = encodeURIComponent(`Hola ${c.client_name}, aquí puedes ver el progreso de tu caso de visa B1/B2:\n${link}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const createCase = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("b1b2-create-case", {
        body: {
          account_cid: accountCid,
          client_name: newName.trim(),
          client_email: newEmail.trim() || undefined,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Caso creado", description: `${newName} agregado exitosamente.` });
      setShowNew(false);
      setNewName("");
      setNewEmail("");
      setLoading(true);
      await loadCases();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "No se pudo crear el caso.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Filters
  const filtered = cases.filter(c => {
    if (search && !c.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (stageFilter && c.pipeline_stage !== stageFilter) return false;
    return true;
  });

  // Stats
  const totalActive = cases.filter(c => c.status !== "completed").length;
  const totalCompleted = cases.filter(c => c.status === "completed").length;
  const stageDistribution = ALL_STAGES.map(slug => ({
    slug,
    label: STAGE_LABELS[slug],
    icon: STAGE_ICONS[slug],
    count: cases.filter(c => c.pipeline_stage === slug).length,
  }));

  const getDaysAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getStageIndex = (stage: string) => ALL_STAGES.indexOf(stage);
  const getProgressPct = (stage: string) => {
    const idx = getStageIndex(stage);
    return ALL_STAGES.length > 0 ? Math.round(((Math.max(idx, 0) + 1) / ALL_STAGES.length) * 100) : 0;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  // No CID — entry screen
  if (!accountCid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Plane className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Portal B1/B2</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de Visas de Turismo</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (cidInput.trim()) {
                setResolvedCid(cidInput.trim());
                setLoading(true);
              }
            }}
            className="space-y-3"
          >
            <Input
              placeholder="ID de cuenta"
              value={cidInput}
              onChange={e => setCidInput(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full gap-2" disabled={!cidInput.trim()}>
              Acceder al Portal
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Find the most "advanced" stage for the hero stat
  const avgProgress = cases.length > 0
    ? Math.round(cases.reduce((sum, c) => sum + getProgressPct(c.pipeline_stage), 0) / cases.length)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Branded Header ── */}
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Plane className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Portal de Visas B1/B2</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{accountName} • {cases.length} cliente{cases.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <Button onClick={() => setShowNew(true)} className="gap-2 shadow-lg shadow-primary/10">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Cliente</span>
            </Button>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <Users className="w-4 h-4 text-primary mb-2" />
            <p className="text-2xl font-bold">{cases.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Total Clientes</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[hsl(var(--jarvis))]/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <CircleDot className="w-4 h-4 text-[hsl(var(--jarvis))] mb-2" />
            <p className="text-2xl font-bold">{totalActive}</p>
            <p className="text-[10px] text-muted-foreground font-medium">En Proceso</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <CheckCircle2 className="w-4 h-4 text-accent mb-2" />
            <p className="text-2xl font-bold">{totalCompleted}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Completados</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <TrendingUp className="w-4 h-4 text-primary mb-2" />
            <p className="text-2xl font-bold">{avgProgress}%</p>
            <p className="text-[10px] text-muted-foreground font-medium">Progreso Prom.</p>
          </div>
        </div>

        {/* ── Pipeline Funnel ── */}
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Plane className="w-3.5 h-3.5" />
            Pipeline de Etapas
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {stageDistribution.map((s, i) => {
              const isActive = stageFilter === s.slug;
              const hasClients = s.count > 0;
              return (
                <button
                  key={s.slug}
                  onClick={() => setStageFilter(isActive ? null : s.slug)}
                  className={`flex-1 min-w-[80px] rounded-lg p-2.5 text-center transition-all border ${
                    isActive
                      ? "bg-primary/10 border-primary/30 shadow-sm"
                      : hasClients
                      ? "bg-card/80 border-border/30 hover:border-border/60"
                      : "bg-transparent border-border/10 opacity-40"
                  }`}
                >
                  <span className="text-lg block mb-0.5">{s.icon}</span>
                  <p className={`text-xl font-bold ${isActive ? "text-primary" : hasClients ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.count}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{s.label}</p>
                </button>
              );
            })}
          </div>
          {stageFilter && (
            <button
              onClick={() => setStageFilter(null)}
              className="mt-2 text-[10px] text-primary hover:underline"
            >
              ✕ Limpiar filtro
            </button>
          )}
        </div>

        {/* ── Search ── */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre de cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* ── Case List ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
              <Plane className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {cases.length === 0 ? "No hay clientes aún" : "Sin resultados"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {cases.length === 0 ? "Agrega tu primer cliente para comenzar" : "Intenta con otro término de búsqueda"}
              </p>
            </div>
            {cases.length === 0 && (
              <Button onClick={() => setShowNew(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Agregar Primer Cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => {
              const stageIdx = getStageIndex(c.pipeline_stage);
              const pct = getProgressPct(c.pipeline_stage);
              const days = getDaysAgo(c.created_at);
              const isCopied = copiedId === c.id;
              const isCompleted = c.status === "completed";
              const initials = getInitials(c.client_name);

              return (
                <div
                  key={c.id}
                  className="group rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:border-border/80 hover:bg-card/80 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                        isCompleted
                          ? "bg-accent/15 text-accent"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-sm truncate">{c.client_name}</h3>
                          {isCompleted && (
                            <Badge variant="outline" className="text-[8px] bg-accent/10 text-accent border-accent/20 shrink-0">
                              ✓ Completado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg leading-none">{STAGE_ICONS[c.pipeline_stage] || "📄"}</span>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {STAGE_LABELS[c.pipeline_stage] || c.pipeline_stage}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">•</span>
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {days}d
                          </span>
                        </div>
                      </div>

                      {/* Stage Dots Mini-Pipeline */}
                      <div className="hidden sm:flex items-center gap-[3px] shrink-0">
                        {ALL_STAGES.map((s, i) => (
                          <div
                            key={s}
                            className={`w-2 h-2 rounded-full transition-all ${
                              i < stageIdx ? "bg-accent" :
                              i === stageIdx ? "bg-primary ring-2 ring-primary/30" :
                              "bg-muted"
                            }`}
                            title={STAGE_LABELS[s]}
                          />
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-60 hover:opacity-100"
                          onClick={() => shareWhatsApp(c)}
                          title="Enviar por WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-60 hover:opacity-100"
                          onClick={() => copyClientLink(c)}
                          title="Copiar link del cliente"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-60 hover:opacity-100"
                          onClick={() => window.open(getClientLink(c), "_blank")}
                          title="Ver como cliente"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-60 hover:opacity-100"
                          onClick={() => navigate(`/b1b2-admin/${accountCid}`)}
                          title="Gestionar caso"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress bar — mobile visible */}
                    <div className="mt-3 sm:hidden">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-muted-foreground font-medium">Progreso</span>
                        <span className="text-[9px] font-bold text-primary">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-muted-foreground/50">
            Portal B1/B2 • {accountName} • Powered by NER
          </p>
        </div>
      </div>

      {/* ── New Case Modal ── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plane className="w-4 h-4 text-primary" />
              </div>
              Nuevo Cliente B1/B2
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-name">Nombre del cliente *</Label>
              <Input
                id="client-name"
                placeholder="Juan Pérez"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="client-email">Email (opcional)</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="juan@email.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button
              onClick={createCase}
              disabled={!newName.trim() || creating}
              className="gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
