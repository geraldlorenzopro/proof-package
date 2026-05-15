import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, FileText, Sparkles, Eye, Download, AlertCircle, CheckCircle2,
  Clock, Send, FileCheck, FileSignature, ChevronRight,
} from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { useDemoMode, FORM_STATUS_LABELS, DemoForm, FormStatus } from "@/hooks/useDemoData";
import { useFormsList } from "@/hooks/useFormsList";
import { cn } from "@/lib/utils";
import { useTrackPageView } from "@/hooks/useTrackPageView";

// /hub/formularios — vista enfocada en USCIS forms del firm.
// Por ahora solo data demo (todo demo mode). Para real data: query a smart_forms
// table o equivalente.

const STATUS_TONE: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  violet: { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/40", icon: Sparkles },
  amber: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/40", icon: Eye },
  purple: { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/40", icon: FileSignature },
  blue: { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/40", icon: FileCheck },
  cyan: { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/40", icon: Send },
  rose: { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/40", icon: AlertCircle },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40", icon: CheckCircle2 },
};

const AGENCY_BADGE: Record<string, string> = {
  "USCIS": "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "NVC": "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  "Embajada": "bg-orange-500/20 text-orange-300 border border-orange-500/30",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `hace ${Math.abs(diff)}d`;
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff < 7) return `en ${diff}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function HubFormsPage() {
  useTrackPageView("hub.forms_legacy");
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FormStatus | "all">("all");
  const [agencyFilter, setAgencyFilter] = useState<"USCIS" | "NVC" | "Embajada" | "all">("all");

  // Resolver accountId del usuario logueado (solo en modo NO demo)
  useEffect(() => {
    if (demoMode) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: accId } = await supabase.rpc("user_account_id", { _user_id: session.user.id });
      if (accId) setAccountId(accId as string);
    })();
  }, [demoMode]);

  // useFormsList retorna DEMO_FORMS si demoMode, o form_submissions reales si accountId
  const { forms: allForms, loading: formsLoading } = useFormsList(accountId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allForms.filter(f => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (agencyFilter !== "all" && f.agency !== agencyFilter) return false;
      if (!q) return true;
      return (
        f.client_name.toLowerCase().includes(q) ||
        f.form_code.toLowerCase().includes(q) ||
        f.form_name.toLowerCase().includes(q) ||
        f.receipt_number?.toLowerCase().includes(q)
      );
    });
  }, [allForms, search, statusFilter, agencyFilter]);

  const counts = useMemo(() => {
    const c: Record<FormStatus | "total", number> = {
      total: allForms.length,
      "borrador-ia": 0, "revision-paralegal": 0, "revision-attorney": 0,
      "listo-firma": 0, "firmado": 0, "enviado-uscis": 0, "recibo-uscis": 0,
      "rfe": 0, "aprobado": 0,
    };
    allForms.forEach(f => { c[f.status]++; });
    return c;
  }, [allForms]);

  function openForm(f: DemoForm) {
    if (demoMode) {
      toast.info(`${f.form_code} — ${f.client_name}`, {
        description: `Vista demo · en producción abre el editor del formulario con preview PDF.`,
        duration: 3500,
      });
      return;
    }
    navigate(`/case-engine/${f.case_id}?tab=formularios`);
  }

  return (
    <HubLayout>
      <div className="max-w-[1400px] mx-auto px-4 py-5 space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Formularios USCIS</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {filtered.length} de {allForms.length} formularios
              {counts["listo-firma"] > 0 && (
                <span className="ml-2 text-purple-300 font-semibold">
                  · {counts["listo-firma"]} listos para tu firma
                </span>
              )}
              {counts["rfe"] > 0 && (
                <span className="ml-2 text-rose-400 font-semibold">
                  · {counts["rfe"]} con RFE pendiente
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* CTA persistente — siempre visible, no solo en empty state */}
            <button
              onClick={() => navigate("/dashboard/smart-forms")}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Nuevo formulario
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cliente, formulario, recibo USCIS…"
                className="h-8 w-72 pl-8 text-[11px] bg-card/60"
              />
            </div>
            <Select value={agencyFilter} onValueChange={v => setAgencyFilter(v as any)}>
              <SelectTrigger className="h-8 w-32 text-[11px] bg-card/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda agencia</SelectItem>
                <SelectItem value="USCIS">USCIS</SelectItem>
                <SelectItem value="NVC">NVC</SelectItem>
                <SelectItem value="Embajada">Embajada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="h-8 w-44 text-[11px] bg-card/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(FORM_STATUS_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status chips overview */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-semibold border transition-colors",
              statusFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Todos · {counts.total}
          </button>
          {(["borrador-ia", "revision-attorney", "listo-firma", "firmado", "enviado-uscis", "rfe", "aprobado"] as FormStatus[]).map(key => {
            const label = FORM_STATUS_LABELS[key];
            const tone = STATUS_TONE[label.color];
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(active ? "all" : key)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-semibold border transition-colors",
                  active
                    ? cn(tone.bg, tone.text, tone.border)
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label.label} · {counts[key]}
              </button>
            );
          })}
        </div>

        {/* Forms table */}
        {formsLoading ? (
          <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted/30 mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                {search || statusFilter !== "all" || agencyFilter !== "all"
                  ? "Ningún formulario coincide con tus filtros"
                  : allForms.length === 0
                    ? "Sin formularios generados todavía"
                    : "Sin formularios para mostrar"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {allForms.length === 0
                  ? "Generá tu primer formulario USCIS desde un caso o lanzá Felix IA."
                  : "Probá ajustar los filtros."}
              </p>
            </div>
            {allForms.length === 0 && !demoMode && (
              <button
                onClick={() => navigate("/dashboard/smart-forms")}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-1.5 rounded bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Crear formulario nuevo
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[80px_1fr_minmax(180px,1.4fr)_100px_120px_minmax(200px,1.6fr)_110px_40px] gap-3 px-4 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div>Form</div>
              <div>Cliente</div>
              <div>Status</div>
              <div className="text-center">Progreso</div>
              <div>Generado por</div>
              <div>Próxima acción</div>
              <div>Vence</div>
              <div></div>
            </div>

            {/* Rows */}
            {filtered.map(f => {
              const statusLabel = FORM_STATUS_LABELS[f.status];
              const tone = STATUS_TONE[statusLabel.color];
              const Icon = tone.icon;
              const isOverdue = f.next_action_due && new Date(f.next_action_due) < new Date(new Date().toDateString());
              return (
                <button
                  key={f.id}
                  onClick={() => openForm(f)}
                  className="w-full grid grid-cols-[80px_1fr_minmax(180px,1.4fr)_100px_120px_minmax(200px,1.6fr)_110px_40px] gap-3 px-4 py-2.5 border-t border-border/20 hover:bg-muted/15 transition-colors text-left items-center group"
                >
                  {/* Form code */}
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0", AGENCY_BADGE[f.agency])}>
                      {f.agency === "Embajada" ? "EMB" : f.agency}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-foreground">{f.form_code}</span>
                  </div>

                  {/* Cliente */}
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-foreground truncate group-hover:underline underline-offset-2 decoration-muted-foreground/30">
                      {f.client_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 truncate">
                      {f.form_name}
                      {f.receipt_number && <span className="ml-1 font-mono">· {f.receipt_number}</span>}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border",
                      tone.bg, tone.text, tone.border
                    )}>
                      <Icon className="w-3 h-3" />
                      {statusLabel.label}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden max-w-[60px]">
                      <div
                        className={cn(
                          "h-full transition-all",
                          f.progress_pct >= 100 ? "bg-emerald-500"
                            : f.progress_pct >= 70 ? "bg-blue-500"
                            : "bg-amber-500"
                        )}
                        style={{ width: `${f.progress_pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{f.progress_pct}%</span>
                  </div>

                  {/* Generated by */}
                  <div className="text-[11px] flex items-center gap-1">
                    {f.generated_by === "Felix IA" ? (
                      <>
                        <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="text-purple-300 font-medium">Felix IA</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{f.generated_by}</span>
                    )}
                  </div>

                  {/* Next action */}
                  <div className="text-[11px] text-muted-foreground truncate" title={f.next_action}>
                    {f.next_action}
                  </div>

                  {/* Due */}
                  <div className={cn("text-[11px] tabular-nums", isOverdue ? "text-rose-400 font-semibold" : "text-muted-foreground/80")}>
                    {f.next_action_due ? formatRelative(f.next_action_due) : "—"}
                  </div>

                  {/* Chevron */}
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer info — solo en demo. En producción mostraría stats reales */}
        {demoMode && allForms.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60 text-center italic mt-2">
            Felix IA generó {allForms.filter(f => f.generated_by === "Felix IA").length} de los {allForms.length} formularios overnight ·
            Promedio de tiempo de armado: 4.2 min/formulario (vs 45 min manual)
          </p>
        )}

      </div>
    </HubLayout>
  );
}
