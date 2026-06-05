/**
 * TaskDueDateInlineEdit — Round 6.
 *
 * Due date clickeable → Popover con shadcn Calendar.
 *
 * Valerie fix: NO usar input type="date" nativo (feo, rompe brand).
 * Usa Calendar component shadcn que mantiene paleta NER.
 *
 * Victoria race fix: defer rebucketing al onBlur (close popover),
 * NO en onChange. Sino el virtualizer reordena items mid-edit y
 * pierde focus.
 *
 * Optimistic update + rollback en error.
 */
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  taskId: string;
  currentDueDate: string | null;
  onChange: (newDueDate: string | null) => void;
  isDemoMode?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseISO(d: string | null): Date | undefined {
  if (!d) return undefined;
  // "YYYY-MM-DD" local
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return undefined;
  return new Date(y, m - 1, day);
}

function fmtISO(d: Date): string {
  // local date → YYYY-MM-DD (no UTC para evitar off-by-one)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDisplay(d: string | null): string {
  if (!d) return "Sin fecha";
  const date = parseISO(d);
  if (!date) return "Sin fecha";
  return format(date, "d MMM", { locale: es });
}

function dueTone(d: string | null): string {
  if (!d) return "text-slate-500";
  const date = parseISO(d);
  if (!date) return "text-slate-500";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "text-rose-400 font-semibold";
  if (diff === 0) return "text-amber-400 font-semibold";
  if (diff <= 3) return "text-amber-300";
  if (diff <= 7) return "text-cyan-accent";
  return "text-slate-400";
}

export default function TaskDueDateInlineEdit({
  taskId, currentDueDate, onChange, isDemoMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localDate, setLocalDate] = useState<string | null>(currentDueDate);

  useEffect(() => {
    setLocalDate(currentDueDate);
  }, [currentDueDate]);

  async function persist(newDate: string | null) {
    const oldDate = localDate;
    if (newDate === oldDate) return;

    setLocalDate(newDate);
    onChange(newDate);

    if (isDemoMode || !UUID_RE.test(taskId)) {
      toast.success(newDate ? `Fecha: ${fmtDisplay(newDate)}` : "Sin fecha", {
        duration: 1500,
        description: "Modo demo · cambio no persistido",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("case_tasks")
        .update({ due_date: newDate, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Sin permiso para cambiar fecha (RLS).");
      }
      toast.success(newDate ? `Fecha: ${fmtDisplay(newDate)}` : "Sin fecha", { duration: 1500 });
    } catch (err: any) {
      setLocalDate(oldDate);
      onChange(oldDate);
      toast.error("No se pudo cambiar fecha", { description: err?.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(d: Date | undefined) {
    const iso = d ? fmtISO(d) : null;
    setOpen(false); // Victoria fix: defer rebucket al close, no en onChange
    persist(iso);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={saving}
          className={`text-[11px] tabular-nums hover:underline underline-offset-2 disabled:opacity-50 transition-opacity ${dueTone(localDate)}`}
          title="Click para cambiar fecha"
        >
          {fmtDisplay(localDate)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 bg-deep-navy border border-cyan-accent/30 z-[9999]"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={parseISO(localDate)}
          onSelect={handleSelect}
          locale={es}
          initialFocus
          className="rounded-md border-0 bg-deep-navy"
        />
        {localDate && (
          <div className="p-2 border-t border-white/10">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[11px] h-7 text-slate-400 hover:text-rose-400"
              onClick={() => { setOpen(false); persist(null); }}
            >
              <X className="w-3 h-3 mr-1" />
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
