import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock, AlertTriangle, CheckCircle2, Plus, X, Calendar,
  Timer, ChevronDown, ChevronUp, FileText, Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays, format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Deadline {
  id: string;
  client_name: string;
  case_type: string;
  deadline_type: string;
  deadline_date: string;
  receipt_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const DEADLINE_TYPES = [
  { value: "RFE", label: "Request for Evidence (RFE)", days: 87 },
  { value: "RFIE", label: "Request for Initial Evidence (RFIE)", days: 87 },
  { value: "NOID", label: "Notice of Intent to Deny (NOID)", days: 33 },
  { value: "NOIR", label: "Notice of Intent to Revoke (NOIR)", days: 33 },
  { value: "NOTT", label: "Notice of Intent to Terminate (NOTT)", days: 33 },
  { value: "Custom", label: "Otro / Custom", days: 30 },
];

function getUrgency(daysLeft: number): "critical" | "warning" | "ok" | "overdue" {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 14) return "warning";
  return "ok";
}

const URGENCY_CONFIG = {
  overdue: { bg: "bg-destructive/15", border: "border-destructive/40", text: "text-destructive", badge: "bg-destructive text-destructive-foreground", label: "VENCIDO" },
  critical: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", badge: "bg-destructive/90 text-destructive-foreground", label: "CRÍTICO" },
  warning: { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent", badge: "bg-accent text-accent-foreground", label: "ATENCIÓN" },
  ok: { bg: "bg-emerald-500/8", border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-400", label: "EN TIEMPO" },
};

export default function SlaTracker({ compact = false }: { compact?: boolean }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  // Form state
  const [formData, setFormData] = useState({
    client_name: "",
    deadline_type: "",
    received_date: format(new Date(), "yyyy-MM-dd"),
    receipt_number: "",
    notes: "",
  });

  const fetchDeadlines = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("case_deadlines")
      .select("*")
      .eq("status", "active")
      .order("deadline_date", { ascending: true });

    if (!error && data) setDeadlines(data as Deadline[]);
    setLoading(false);
  };

  useEffect(() => { fetchDeadlines(); }, []);

  const handleSubmit = async () => {
    if (!formData.client_name || !formData.deadline_type) {
      toast.error("Completa el nombre del cliente y tipo de deadline");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const deadlineInfo = DEADLINE_TYPES.find(d => d.value === formData.deadline_type);
    const receivedDate = new Date(formData.received_date);
    const deadlineDate = addDays(receivedDate, deadlineInfo?.days || 30);

    // Get account_id
    const { data: accountData } = await supabase.rpc("user_account_id", { _user_id: user.id });

    const { error } = await supabase.from("case_deadlines").insert({
      account_id: accountData,
      client_name: formData.client_name,
      case_type: deadlineInfo?.label || formData.deadline_type,
      deadline_type: formData.deadline_type,
      deadline_date: format(deadlineDate, "yyyy-MM-dd"),
      receipt_number: formData.receipt_number || null,
      notes: formData.notes || null,
      created_by: user.id,
    });

    if (error) {
      toast.error("Error al crear deadline");
      return;
    }

    toast.success(`Deadline agregado: ${formData.client_name} — vence ${format(deadlineDate, "dd MMM yyyy", { locale: es })}`);
    setFormData({ client_name: "", deadline_type: "", received_date: format(new Date(), "yyyy-MM-dd"), receipt_number: "", notes: "" });
    setShowForm(false);
    fetchDeadlines();
  };

  const markCompleted = async (id: string) => {
    await supabase.from("case_deadlines").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", id);
    toast.success("Deadline marcado como completado");
    fetchDeadlines();
  };

  const deleteDeadline = async (id: string) => {
    await supabase.from("case_deadlines").delete().eq("id", id);
    toast.success("Deadline eliminado");
    fetchDeadlines();
  };

  const sortedDeadlines = useMemo(() => {
    return [...deadlines].sort((a, b) => {
      const daysA = differenceInDays(new Date(a.deadline_date), new Date());
      const daysB = differenceInDays(new Date(b.deadline_date), new Date());
      return daysA - daysB;
    });
  }, [deadlines]);

  const alertCount = useMemo(() => {
    return deadlines.filter(d => {
      const days = differenceInDays(new Date(d.deadline_date), new Date());
      return days <= 14;
    }).length;
  }, [deadlines]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/30 bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Timer className="w-4 h-4 animate-pulse" />
          <span className="text-xs">Cargando deadlines...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full group"
      >
        <Timer className="w-3.5 h-3.5 text-muted-foreground/30" />
        <h3 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-muted-foreground/70">
          SLA Tracker
        </h3>
        {alertCount > 0 && (
          <Badge className="bg-destructive/20 text-destructive text-[8px] px-1.5 py-0 font-bold animate-pulse">
            {alertCount} {alertCount === 1 ? "alerta" : "alertas"}
          </Badge>
        )}
        <div className="h-px flex-1 bg-border/20" />
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/30" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/30" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {/* Deadline cards */}
            {sortedDeadlines.length === 0 && !showForm && (
              <div className="rounded-xl border border-border/20 bg-card/50 p-6 text-center">
                <Timer className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/60">No hay deadlines activos</p>
                <p className="text-[10px] text-muted-foreground/40 mt-1">Agrega uno con el botón de abajo</p>
              </div>
            )}

            {sortedDeadlines.map((deadline, i) => {
              const daysLeft = differenceInDays(new Date(deadline.deadline_date), new Date());
              const urgency = getUrgency(daysLeft);
              const config = URGENCY_CONFIG[urgency];

              return (
                <motion.div
                  key={deadline.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-xl border ${config.border} ${config.bg} p-3 group`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${config.badge} text-[8px] px-1.5 py-0 font-bold`}>
                          {config.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                          {deadline.deadline_type}
                        </span>
                        {deadline.receipt_number && (
                          <span className="text-[10px] text-muted-foreground/40 font-mono">
                            #{deadline.receipt_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate">
                        {deadline.client_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {deadline.case_type}
                      </p>
                    </div>

                    {/* Countdown */}
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-black tabular-nums ${config.text}`}>
                        {Math.abs(daysLeft)}
                      </p>
                      <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                        {daysLeft < 0 ? "días vencido" : "días"}
                      </p>
                      <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                        {format(new Date(deadline.deadline_date), "dd MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2">
                    {(() => {
                      const deadlineInfo = DEADLINE_TYPES.find(d => d.value === deadline.deadline_type);
                      const totalDays = deadlineInfo?.days || 30;
                      const elapsed = totalDays - daysLeft;
                      const pct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
                      return (
                        <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                              urgency === "overdue" ? "bg-destructive" :
                              urgency === "critical" ? "bg-destructive/80" :
                              urgency === "warning" ? "bg-accent" :
                              "bg-emerald-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => markCompleted(deadline.id)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Completado
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteDeadline(deadline.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </motion.div>
              );
            })}

            {/* Add form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-border/30 bg-card p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">Nuevo Deadline</h4>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowForm(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nombre del cliente"
                      value={formData.client_name}
                      onChange={e => setFormData(p => ({ ...p, client_name: e.target.value }))}
                      className="text-xs h-8"
                    />
                    <Select
                      value={formData.deadline_type}
                      onValueChange={v => setFormData(p => ({ ...p, deadline_type: v }))}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Tipo de notificación" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEADLINE_TYPES.map(d => (
                          <SelectItem key={d.value} value={d.value} className="text-xs">
                            {d.label} ({d.days}d)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div>
                      <label className="text-[10px] text-muted-foreground/60 block mb-1">Fecha de recibo</label>
                      <Input
                        type="date"
                        value={formData.received_date}
                        onChange={e => setFormData(p => ({ ...p, received_date: e.target.value }))}
                        className="text-xs h-8"
                      />
                    </div>
                    <Input
                      placeholder="# Recibo (opcional)"
                      value={formData.receipt_number}
                      onChange={e => setFormData(p => ({ ...p, receipt_number: e.target.value }))}
                      className="text-xs h-8"
                    />
                  </div>

                  <Input
                    placeholder="Notas (opcional)"
                    value={formData.notes}
                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                    className="text-xs h-8"
                  />

                  {/* Preview */}
                  {formData.deadline_type && formData.received_date && (
                    <div className="rounded-lg bg-muted/20 border border-border/20 px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      Vence: {format(
                        addDays(new Date(formData.received_date), DEADLINE_TYPES.find(d => d.value === formData.deadline_type)?.days || 30),
                        "dd MMMM yyyy",
                        { locale: es }
                      )}
                      <span className="text-muted-foreground/40">
                        ({DEADLINE_TYPES.find(d => d.value === formData.deadline_type)?.days || 30} días)
                      </span>
                    </div>
                  )}

                  <Button size="sm" className="w-full h-8 text-xs" onClick={handleSubmit}>
                    <Plus className="w-3 h-3 mr-1" /> Agregar Deadline
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!showForm && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-[10px] border-dashed border-border/30 text-muted-foreground/60 hover:text-foreground hover:border-border/50"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar Deadline USCIS
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
