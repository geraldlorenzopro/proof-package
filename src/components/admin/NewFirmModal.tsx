import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewFirmModal({ open, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firmName: "",
    email: "",
    plan: "essential",
    attorneyName: "",
    phone: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleCreate() {
    if (!form.firmName.trim() || !form.email.trim()) {
      setError("Nombre de firma y email son requeridos");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("provision-account", {
        body: {
          account_name: form.firmName,
          email: form.email,
          plan: form.plan,
          phone: form.phone || null,
        },
      });

      if (fnErr || data?.error) {
        throw new Error(data?.error || data?.detail || fnErr?.message || "Error al crear firma");
      }

      // Send firm_welcome email (non-blocking)
      supabase.functions.invoke("send-email", {
        body: {
          template_type: "firm_welcome",
          to_email: form.email,
          to_name: form.attorneyName || form.firmName,
          account_id: data?.account_id,
          variables: {
            attorney_name: form.attorneyName || form.firmName,
            firm_name: form.firmName,
          },
        },
      }).catch(() => {});

      toast.success("Firma creada exitosamente");
      setForm({ firmName: "", email: "", plan: "essential", attorneyName: "", phone: "" });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Firma</DialogTitle>
          <DialogDescription className="text-white/50">
            Crear una nueva cuenta de firma en NER
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-white/70 text-xs">Nombre de la firma *</Label>
            <Input
              value={form.firmName}
              onChange={(e) => set("firmName", e.target.value)}
              placeholder="Ej: Lopez Law Group"
              className="bg-white/5 border-white/10 text-white"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-white/70 text-xs">Email del owner *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="owner@firm.com"
              className="bg-white/5 border-white/10 text-white"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-white/70 text-xs">Plan *</Label>
            <Select value={form.plan} onValueChange={(v) => set("plan", v)} disabled={loading}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="essential">Essential</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-white/70 text-xs">Nombre del abogado</Label>
            <Input
              value={form.attorneyName}
              onChange={(e) => set("attorneyName", e.target.value)}
              placeholder="Opcional"
              className="bg-white/5 border-white/10 text-white"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-white/70 text-xs">Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Opcional"
              className="bg-white/5 border-white/10 text-white"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-white/50">
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear firma"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
