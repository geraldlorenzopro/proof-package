import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IMMIGRATION_STATUSES } from "@/lib/immigrationStatuses";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface Props {
  clientId: string;
  onUpdated?: () => void;
}

interface QuickData {
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string;
  email: string;
  immigration_status: string;
  source_channel: string;
  notes: string;
}

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "referido", label: "Referido" },
  { value: "anuncio", label: "Anuncio / Ads" },
  { value: "website", label: "Website" },
  { value: "llamada", label: "Llamada" },
  { value: "walk-in", label: "Walk-in" },
  { value: "youtube", label: "YouTube" },
  { value: "otro", label: "Otro" },
];

export default function ClientQuickEditor({ clientId, onUpdated }: Props) {
  const [data, setData] = useState<QuickData>({
    first_name: "",
    middle_name: "",
    last_name: "",
    phone: "",
    email: "",
    immigration_status: "",
    source_channel: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("client_profiles")
        .select("first_name, middle_name, last_name, phone, email, immigration_status, source_channel, notes")
        .eq("id", clientId)
        .single();

      if (p) {
        setData({
          first_name: p.first_name || "",
          middle_name: p.middle_name || "",
          last_name: p.last_name || "",
          phone: p.phone || "",
          email: p.email || "",
          immigration_status: p.immigration_status || "",
          source_channel: (p as any).source_channel || "",
          notes: p.notes || "",
        });
      }
      setLoading(false);
    })();
  }, [clientId]);

  const set = (field: keyof QuickData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    if (!data.first_name.trim() || !data.last_name.trim()) {
      toast.error("Nombre y apellido son requeridos");
      return;
    }
    setSaving(true);
    const payload: Record<string, string | null> = {
      first_name: data.first_name.trim() || null,
      middle_name: data.middle_name.trim() || null,
      last_name: data.last_name.trim() || null,
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      immigration_status: data.immigration_status || null,
      source_channel: data.source_channel || null,
      notes: data.notes.trim() || null,
    };

    const { error } = await supabase
      .from("client_profiles")
      .update(payload)
      .eq("id", clientId);

    if (error) {
      toast.error("Error al guardar");
    } else {
      logAudit({
        action: "client.updated",
        entity_type: "client",
        entity_id: clientId,
        entity_label: `${data.first_name} ${data.last_name}`.trim() || undefined,
      });
      onUpdated?.();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-jarvis animate-spin" />
      </div>
    );
  }

  const fieldClass = "bg-muted/50 border-border focus:border-jarvis/50 text-sm h-9";

  return (
    <div className="space-y-4">
      {/* Row 1: Nombre + Segundo nombre + Apellido */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nombre *</Label>
          <Input
            className={fieldClass}
            value={data.first_name}
            onChange={(e) => set("first_name", e.target.value)}
            placeholder="Nombre"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Segundo nombre</Label>
          <Input
            className={fieldClass}
            value={data.middle_name}
            onChange={(e) => set("middle_name", e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Apellido *</Label>
          <Input
            className={fieldClass}
            value={data.last_name}
            onChange={(e) => set("last_name", e.target.value)}
            placeholder="Apellido"
          />
        </div>
      </div>

      {/* Row 2: Teléfono */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Teléfono</Label>
        <Input
          className={fieldClass}
          value={data.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+1 (000) 000-0000"
        />
      </div>

      {/* Row 3: Email — full width */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Email</Label>
        <Input
          className={fieldClass}
          type="email"
          value={data.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="correo@email.com"
        />
      </div>

      {/* Row 4: Estatus migratorio */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Estatus migratorio</Label>
        <Select value={data.immigration_status} onValueChange={(v) => set("immigration_status", v)}>
          <SelectTrigger className={fieldClass}>
            <SelectValue placeholder="Seleccionar estatus" />
          </SelectTrigger>
          <SelectContent>
            {IMMIGRATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 5: Canal de entrada */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Canal de entrada</Label>
        <Select value={data.source_channel} onValueChange={(v) => set("source_channel", v)}>
          <SelectTrigger className={fieldClass}>
            <SelectValue placeholder="¿Por dónde llegó?" />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((ch) => (
              <SelectItem key={ch.value} value={ch.value}>
                {ch.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 6: Notas — bigger */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Notas</Label>
        <Textarea
          className="bg-muted/50 border-border focus:border-jarvis/50 text-sm min-h-[100px] resize-y"
          value={data.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Notas sobre este contacto..."
        />
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-jarvis hover:bg-jarvis/90 gap-2"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Guardar cambios
      </Button>
    </div>
  );
}
