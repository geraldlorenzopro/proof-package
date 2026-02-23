import { useState } from "react";
import { FileText, Loader2, User, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Lang = "es" | "en";

const T = {
  es: {
    title: "Generar Reporte PDF",
    subtitle: "Ingresa los datos del cliente para personalizar el reporte profesional.",
    name: "Nombre completo",
    namePh: "Ej: Juan Pérez",
    email: "Correo electrónico",
    emailPh: "cliente@email.com",
    phone: "Teléfono (opcional)",
    phonePh: "+1 (555) 123-4567",
    generate: "Generar Reporte PDF",
    generating: "Generando…",
    required: "Nombre y correo son requeridos.",
  },
  en: {
    title: "Generate PDF Report",
    subtitle: "Enter client details to customize the professional report.",
    name: "Full name",
    namePh: "E.g.: John Doe",
    email: "Email address",
    emailPh: "client@email.com",
    phone: "Phone (optional)",
    phonePh: "+1 (555) 123-4567",
    generate: "Generate PDF Report",
    generating: "Generating…",
    required: "Name and email are required.",
  },
};

interface CSPALeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; email: string; phone: string }) => void;
  loading: boolean;
  lang: Lang;
}

export default function CSPALeadCaptureModal({
  open, onOpenChange, onSubmit, loading, lang,
}: CSPALeadCaptureModalProps) {
  const t = T[lang];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) {
      setError(t.required);
      return;
    }
    setError("");
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-jarvis/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground">
            <FileText className="w-5 h-5 text-accent" />
            {t.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{t.subtitle}</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />{t.name}
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />{t.email}
            </Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} type="email" className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />{t.phone}
            </Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePh} className="bg-secondary border-border" />
          </div>
          {error && <p className="text-destructive text-xs font-medium">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading} className="w-full gradient-gold text-accent-foreground font-semibold">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.generating}</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" />{t.generate}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
