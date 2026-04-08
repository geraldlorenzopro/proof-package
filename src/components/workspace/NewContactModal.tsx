import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, UserPlus, MessageCircle, Instagram, Facebook, Music2, Users, Megaphone, Globe, Phone, DoorOpen, Youtube, MoreHorizontal, Magnet, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { COUNTRY_CODES, FREQUENT_COUNT } from "@/lib/countryCodes";
import { detectInternational, validateForCountry, detectLocal10, parseExisting, getFlag } from "@/lib/phoneDetect";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  { key: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { key: "tiktok", label: "TikTok", icon: Music2, color: "text-foreground bg-foreground/10 border-foreground/20" },
  { key: "referido", label: "Referido", icon: Users, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  { key: "anuncio", label: "Ads", icon: Megaphone, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  { key: "website", label: "Website", icon: Globe, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  { key: "llamada", label: "Llamada", icon: Phone, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "walk-in", label: "Walk-in", icon: DoorOpen, color: "text-muted-foreground bg-muted/50 border-border" },
  { key: "youtube", label: "YouTube", icon: Youtube, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { key: "lead-magnet", label: "Lead Magnet", icon: Magnet, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  { key: "otro", label: "Otro", icon: MoreHorizontal, color: "text-muted-foreground bg-muted/50 border-border" },
];

function stripPhoneInput(val: string) {
  if (val.startsWith("+")) return "+" + val.slice(1).replace(/\D/g, "");
  return val.replace(/\D/g, "");
}
function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onCreated?: () => void;
}

export default function NewContactModal({ open, onOpenChange, accountId, onCreated }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Phone detection state
  const [countryCode, setCountryCode] = useState("US");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  function reset() {
    setFirstName(""); setLastName(""); setPhone(""); setEmail("");
    setChannel(""); setSourceDetail(""); setNotes("");
    setCountryCode("US"); setPhoneDisplay(""); setPhoneE164(""); setPhoneValid(null);
  }

  // Phone handlers (same logic as StepClient)
  function handlePhoneChange(raw: string) {
    const cleaned = stripPhoneInput(raw);

    if (cleaned.startsWith("+")) {
      const intl = detectInternational(cleaned);
      if (intl) {
        setCountryCode(intl.countryCode);
        setPhoneDisplay(intl.display);
        setPhoneE164(intl.e164);
        setPhoneValid(intl.valid);
        setPhone(intl.e164);
        return;
      }
      setPhoneDisplay(cleaned);
      setPhoneE164("");
      setPhoneValid(null);
      setPhone(cleaned);
      return;
    }

    const digits = cleaned.replace(/\D/g, "");
    if (countryCode === "US" && digits.length <= 10) {
      setPhoneDisplay(formatPhoneDisplay(digits));
    } else {
      setPhoneDisplay(digits);
    }

    const result = validateForCountry(digits, countryCode);
    setPhoneValid(result.valid);
    setPhoneE164(result.e164);
    setPhone(result.e164 || digits);
  }

  function handlePhoneBlur() {
    if (!phoneDisplay) return;
    const cleaned = stripPhoneInput(phoneDisplay);
    if (cleaned.startsWith("+")) {
      const intl = detectInternational(cleaned);
      if (intl) {
        setCountryCode(intl.countryCode);
        setPhoneDisplay(intl.display);
        setPhoneE164(intl.e164);
        setPhoneValid(intl.valid);
        setPhone(intl.e164);
        return;
      }
    }
    const digits = cleaned.replace(/\D/g, "");
    if (countryCode === "US" && digits.length === 10) {
      const local = detectLocal10(digits);
      if (local) {
        setPhoneDisplay(local.display);
        setPhoneE164(local.e164);
        setPhoneValid(local.valid);
        setPhone(local.e164);
      }
    }
  }

  function selectCountry(code: string) {
    setCountryCode(code);
    setShowCountryPicker(false);
    setCountrySearch("");
    if (phoneDisplay) {
      const digits = phoneDisplay.replace(/\D/g, "");
      const result = validateForCountry(digits, code);
      setPhoneValid(result.valid);
      setPhoneE164(result.e164);
      setPhone(result.e164 || digits);
    }
  }

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];
  const filteredCountries = countrySearch
    ? COUNTRY_CODES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.dial.includes(countrySearch) || c.code.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRY_CODES;

  const canSave = firstName.trim().length >= 2 && lastName.trim().length >= 2 && (phoneE164.length >= 8 || phone.trim().length >= 5);

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No auth");

      const { error } = await supabase.from("client_profiles").insert({
        account_id: accountId,
        created_by: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phoneE164 || phone.trim(),
        email: email.trim() || null,
        source_channel: channel || null,
        source_detail: sourceDetail.trim() || null,
        notes: notes.trim() || null,
      } as any);

      if (error) throw error;

      toast.success(`${firstName} ${lastName} agregado al directorio`);
      reset();
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar el contacto");
    } finally {
      setSaving(false);
    }
  }

  const showDetail = channel === "referido" || channel === "lead-magnet" || channel === "anuncio" || channel === "otro";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 bg-card border-border overflow-hidden [&>button.absolute]:hidden">
        {/* Header */}
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-jarvis" />
            </div>
            <h2 className="text-base font-bold text-foreground">Nuevo contacto</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — two columns, no scroll */}
        <div className="px-5 py-4 flex gap-5">
          {/* Left column — form fields */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre"
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellido *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido"
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {/* Phone with country picker */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Teléfono *</label>
              <div className="flex gap-2">
                <div className="relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex items-center gap-1.5 border border-input bg-background rounded-xl px-3 py-2.5 text-sm hover:bg-secondary transition-colors min-w-[90px]"
                  >
                    <span>{getFlag(selectedCountry.code)}</span>
                    <span className="text-muted-foreground">{selectedCountry.dial}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {showCountryPicker && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                      <div className="p-2 border-b border-border">
                        <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                          placeholder="Buscar país..."
                          className="w-full border border-input bg-background rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
                      </div>
                      {filteredCountries.map((c, i) => (
                        <button key={`${c.code}-${i}`}
                          onClick={() => selectCountry(c.code)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${c.code === countryCode ? "bg-jarvis/10 text-jarvis" : "text-foreground"}`}>
                          <span>{getFlag(c.code)}</span>
                          <span className="truncate flex-1 text-left">{c.name}</span>
                          <span className="text-muted-foreground">{c.dial}</span>
                          {c.code === countryCode && <Check className="w-3 h-3 text-jarvis" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 relative">
                  <input type="tel" value={phoneDisplay} onChange={e => handlePhoneChange(e.target.value)} onBlur={handlePhoneBlur}
                    placeholder="Número de teléfono"
                    className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  {phoneValid === true && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
                  {phoneValid === false && phoneDisplay.length > 3 && <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />}
                </div>
              </div>
              {phoneValid === false && phoneDisplay.length > 3 && (
                <p className="text-xs text-amber-400 mt-1">Número incompleto</p>
              )}
              {phoneValid === true && phoneE164 && (
                <p className="text-xs text-emerald-400 mt-1">✓ {phoneE164}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com"
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {/* Source detail (conditional) */}
            {showDetail && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  {channel === "referido" ? "¿Quién lo refirió?" : channel === "lead-magnet" ? "¿Cuál lead magnet?" : channel === "anuncio" ? "¿Cuál campaña?" : "Detalle"}
                </label>
                <input type="text" value={sourceDetail} onChange={e => setSourceDetail(e.target.value)}
                  placeholder="Detalle del origen..."
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Etiqueta / nota</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Campaña Mayo 2026, Lista FB..."
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Right column — channel selector */}
          <div className="w-[280px] shrink-0 space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Canal de origen</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map(ch => {
                const Icon = ch.icon;
                const selected = channel === ch.key;
                return (
                  <button key={ch.key}
                    onClick={() => setChannel(selected ? "" : ch.key)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      selected
                        ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30"
                        : "border-border hover:border-foreground/20 bg-card"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${ch.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[10px] font-semibold leading-tight text-center ${selected ? "text-jarvis" : "text-foreground"}`}>
                      {ch.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex justify-end gap-3">
          <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors hover:bg-secondary">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className="flex items-center gap-1.5 text-sm font-semibold bg-jarvis text-jarvis-foreground px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Agregar contacto"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
