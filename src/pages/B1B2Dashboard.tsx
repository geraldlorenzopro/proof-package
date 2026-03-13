import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Shield, Plus, Copy, Check, ExternalLink,
  Search, Users, ChevronRight, AlertTriangle, Plane,
  CircleDot, CheckCircle2, Clock, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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

const ALL_STAGES = Object.keys(STAGE_LABELS);

export default function B1B2Dashboard() {
  const { accountCid } = useParams<{ accountCid: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
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
      // resolve-client-portal returns all cases for account
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

  const copyClientLink = (c: B1B2Case) => {
    const link = `${window.location.origin}/case-track/${c.access_token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(c.id);
    toast({ title: "Link copiado", description: `Link de ${c.client_name} copiado al portapapeles.` });
    setTimeout(() => setCopiedId(null), 2000);
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
      // Reload cases
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
    count: cases.filter(c => c.pipeline_stage === slug).length,
  })).filter(s => s.count > 0);

  const getDaysAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getStageIndex = (stage: string) => ALL_STAGES.indexOf(stage);
  const getProgressPct = (stage: string) => {
    const idx = getStageIndex(stage);
    return ALL_STAGES.length > 0 ? Math.round(((Math.max(idx, 0) + 1) / ALL_STAGES.length) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plane className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Casos B1/B2</h1>
              <p className="text-xs text-muted-foreground">{accountName}</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{cases.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <CircleDot className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Activos</span>
            </div>
            <p className="text-2xl font-bold">{totalActive}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span className="text-xs font-medium text-muted-foreground">Completados</span>
            </div>
            <p className="text-2xl font-bold">{totalCompleted}</p>
          </div>
        </div>

        {/* Stage Pills */}
        {stageDistribution.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setStageFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !stageFilter
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              Todos ({cases.length})
            </button>
            {stageDistribution.map(s => (
              <button
                key={s.slug}
                onClick={() => setStageFilter(stageFilter === s.slug ? null : s.slug)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  stageFilter === s.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent border-border/50 text-muted-foreground hover:border-border"
                }`}
              >
                {s.label} ({s.count})
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Case List */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Plane className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {cases.length === 0
                ? "No hay casos B1/B2 aún. Crea el primer cliente."
                : "No se encontraron resultados."}
            </p>
            {cases.length === 0 && (
              <Button variant="outline" onClick={() => setShowNew(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Crear primer caso
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

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border/50 bg-card hover:border-border/80 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm truncate">{c.client_name}</h3>
                          {isCompleted && (
                            <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/20">
                              Completado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {STAGE_LABELS[c.pipeline_stage] || c.pipeline_stage}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {days}d
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyClientLink(c)}
                          title="Copiar link del cliente"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(`${window.location.origin}/case-track/${c.access_token}`, "_blank")}
                          title="Ver como cliente"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/b1b2-admin/${accountCid}`)}
                          title="Abrir detalle"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 p-3 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Dashboard B1/B2 • {accountName} • {cases.length} caso{cases.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* New Case Modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-primary" />
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
              Crear Caso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
