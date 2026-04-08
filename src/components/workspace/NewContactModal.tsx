import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2, UserPlus, MessageCircle, Instagram, Facebook, Music2, Users, Megaphone, Globe, Phone, DoorOpen, Youtube, MoreHorizontal, Magnet, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { COUNTRY_CODES } from "@/lib/countryCodes";
import { detectInternational, validateForCountry, parseExisting, PHONE_LABELS } from "@/lib/phoneDetect";
import { FREQUENT_COUNT } from "@/lib/countryCodes";
import PhoneInput from "@/components/shared/PhoneInput";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onCreated?: () => void;
}

/* ── Phone row sub-component ── */
interface PhoneRowProps {
  label: string;
  phoneLabel: string;
  onPhoneLabelChange: (v: string) => void;
  selectedCountry: string;
  selectedCode: string;
  selectedFlag: string;
  localDigits: string;
  isInternationalMode: boolean;
  rawInput: string;
  phoneValid: boolean | null;
  onCountrySelect: (iso: string, code: string, flag: string) => void;
  onPhoneChange: (val: string) => void;
  onPhoneBlur: () => void;
  onRemove?: () => void;
}

function PhoneRow({
  label, phoneLabel, onPhoneLabelChange,
  selectedCountry, selectedCode, selectedFlag,
  localDigits, isInternationalMode, rawInput,
  phoneValid, onCountrySelect, onPhoneChange, onPhoneBlur,
  onRemove,
}: PhoneRowProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (labelRef.current && !labelRef.current.contains(e.target as Node)) setShowLabelPicker(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = isInternationalMode ? rawInput : formatNational(localDigits, selectedCountry);
  const phoneInvalid = localDigits.length > 0 && localDigits.length < 7 && !isInternationalMode;
  const currentLabel = PHONE_LABELS.find(l => l.key === phoneLabel) || PHONE_LABELS[1];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        {onRemove && (
          <button type="button" onClick={onRemove} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-0">
        {/* Country dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button type="button" onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 border border-input border-r-0 bg-background rounded-l-xl px-2.5 py-2.5 hover:bg-secondary/50 transition-colors">
            <span className="text-xl leading-none">{selectedFlag}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 w-72 max-h-72 border border-border bg-background rounded-xl shadow-lg flex flex-col">
              <div className="p-2 border-b border-border">
                <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                  placeholder="Buscar país..." className="w-full border border-input bg-background rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
              </div>
              <div className="overflow-y-auto flex-1">
                {(() => {
                  const q = countrySearch.toLowerCase().trim();
                  const filtered = q
                    ? COUNTRY_CODES.map((c, idx) => ({ c, idx })).filter(({ c }) => c.name.toLowerCase().includes(q) || c.code.includes(q) || c.iso.toLowerCase().includes(q))
                    : COUNTRY_CODES.map((c, idx) => ({ c, idx }));
                  return filtered.map(({ c, idx }) => (
                    <div key={`${c.iso}-${idx}`}>
                      {!q && idx === FREQUENT_COUNT && <div className="border-t border-border my-1 mx-2" />}
                      <button type="button" onClick={() => { onCountrySelect(c.iso, c.code, c.flag); setShowDropdown(false); setCountrySearch(""); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary/50 transition-colors text-left ${selectedCountry === c.iso ? "bg-secondary/30" : ""}`}>
                        <span>{c.flag}</span><span className="font-medium">{c.code}</span><span className="text-muted-foreground text-xs truncate">{c.name}</span>
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Country code prefix */}
        {!isInternationalMode && (
          <div className="flex items-center border-y border-input bg-background px-2 py-2.5">
            <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">{selectedCode}</span>
          </div>
        )}

        {/* Phone input */}
        <div className="relative flex-1">
          <input type="tel" value={displayValue}
            onChange={e => onPhoneChange(e.target.value)} onBlur={onPhoneBlur}
            placeholder={isInternationalMode ? "+57 312 456 7890" : "Número de teléfono"}
            className="w-full border border-input border-l-0 border-r-0 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring pr-8" />
          {phoneValid === true && localDigits.length >= 7 && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
          {phoneValid === false && (localDigits.length >= 7 || (isInternationalMode && rawInput.length >= 4)) && <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />}
        </div>

        {/* Phone type selector */}
        <div className="relative" ref={labelRef}>
          <button type="button" onClick={() => setShowLabelPicker(!showLabelPicker)}
            className="flex items-center gap-1.5 border border-input border-l-0 bg-background rounded-r-xl px-3 py-2.5 text-sm hover:bg-secondary/50 transition-colors min-w-[100px]">
            <span className="text-xs">{currentLabel.emoji}</span>
            <span className="text-xs text-muted-foreground">{currentLabel.label}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
          </button>
          {showLabelPicker && (
            <div className="absolute top-full right-0 mt-1 z-50 w-44 border border-border bg-background rounded-xl shadow-lg overflow-hidden">
              {PHONE_LABELS.map(pl => (
                <button key={pl.key} type="button"
                  onClick={() => { onPhoneLabelChange(pl.key); setShowLabelPicker(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors text-left ${phoneLabel === pl.key ? "bg-secondary/30" : ""}`}>
                  <span>{pl.emoji}</span>
                  <span className={phoneLabel === pl.key ? "text-accent font-semibold" : "text-foreground"}>{pl.label}</span>
                  {phoneLabel === pl.key && <Check className="w-3 h-3 text-accent ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">Escribe + para detectar país automáticamente</p>
      {phoneInvalid && <p className="text-[10px] text-destructive mt-1">Mínimo 7 dígitos</p>}
      {phoneValid === false && localDigits.length >= 7 && <p className="text-[10px] text-yellow-400 mt-1">⚠️ Número no válido para {selectedCountry}</p>}
    </div>
  );
}

/* ── Main modal ── */
export default function NewContactModal({ open, onOpenChange, accountId, onCreated }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Primary phone
  const [countryIso, setCountryIso] = useState("US");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [intlMode, setIntlMode] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [phoneLabel, setPhoneLabel] = useState("mobile");

  // Secondary phone
  const [showSecond, setShowSecond] = useState(false);
  const [country2, setCountry2] = useState("US");
  const [digits2, setDigits2] = useState("");
  const [e164_2, setE164_2] = useState("");
  const [valid2, setValid2] = useState<boolean | null>(null);
  const [intl2, setIntl2] = useState(false);
  const [raw2, setRaw2] = useState("");
  const [label2, setLabel2] = useState("mobile");

  const cc1 = COUNTRY_CODES.find(c => c.iso === countryIso) || COUNTRY_CODES[0];
  const cc2 = COUNTRY_CODES.find(c => c.iso === country2) || COUNTRY_CODES[0];

  function reset() {
    setFirstName(""); setLastName(""); setEmail("");
    setChannel(""); setSourceDetail(""); setNotes("");
    setCountryIso("US"); setPhoneDigits(""); setPhoneE164(""); setPhoneValid(null);
    setIntlMode(false); setRawInput(""); setPhoneLabel("mobile");
    setShowSecond(false); setCountry2("US"); setDigits2(""); setE164_2(""); setValid2(null);
    setIntl2(false); setRaw2(""); setLabel2("mobile");
  }

  // Primary handlers
  function handleCountry1(iso: string, code: string) {
    setCountryIso(iso); setIntlMode(false); setRawInput("");
    if (phoneDigits) {
      const r = validateForCountry(phoneDigits, iso, code);
      setPhoneValid(r.isValid); setPhoneDigits(r.localNumber || phoneDigits); setPhoneE164(r.fullPhone);
    }
  }
  function handlePhone1Change(val: string) {
    if (val.startsWith("+")) {
      setIntlMode(true);
      const cleaned = "+" + val.slice(1).replace(/\D/g, "");
      if (cleaned.length > 16) return;
      setRawInput(cleaned); setPhoneDigits(""); setPhoneValid(null);
      if (cleaned.length >= 3) {
        const detected = detectInternational(cleaned);
        if (detected) { setCountryIso(detected.country); }
      }
      return;
    }
    setIntlMode(false); setRawInput("");
    const d = val.replace(/\D/g, "");
    if (d.length > 15) return;
    setPhoneDigits(d); setPhoneValid(null);
    const r = validateForCountry(d, countryIso, cc1.code);
    setPhoneValid(r.isValid); setPhoneE164(r.fullPhone);
  }
  function handlePhone1Blur() {
    if (intlMode && rawInput.startsWith("+") && rawInput.length >= 4) {
      const result = detectInternational(rawInput);
      if (result) {
        setCountryIso(result.country); setPhoneDigits(result.localNumber);
        setPhoneValid(result.isValid); setPhoneE164(result.fullPhone);
        setIntlMode(false); setRawInput("");
        return;
      }
      setPhoneValid(false); return;
    }
    if (phoneDigits.length >= 7) {
      const r = validateForCountry(phoneDigits, countryIso, cc1.code);
      setPhoneValid(r.isValid); setPhoneDigits(r.localNumber || phoneDigits); setPhoneE164(r.fullPhone);
    } else if (phoneDigits.length > 0) { setPhoneValid(false); }
  }

  // Secondary handlers
  function handleCountry2(iso: string, code: string) {
    setCountry2(iso); setIntl2(false); setRaw2("");
    if (digits2) {
      const r = validateForCountry(digits2, iso, code);
      setValid2(r.isValid); setDigits2(r.localNumber || digits2); setE164_2(r.fullPhone);
    }
  }
  function handlePhone2Change(val: string) {
    if (val.startsWith("+")) {
      setIntl2(true);
      const cleaned = "+" + val.slice(1).replace(/\D/g, "");
      if (cleaned.length > 16) return;
      setRaw2(cleaned); setDigits2(""); setValid2(null);
      if (cleaned.length >= 3) {
        const detected = detectInternational(cleaned);
        if (detected) { setCountry2(detected.country); }
      }
      return;
    }
    setIntl2(false); setRaw2("");
    const d = val.replace(/\D/g, "");
    if (d.length > 15) return;
    setDigits2(d); setValid2(null);
    const r = validateForCountry(d, country2, cc2.code);
    setValid2(r.isValid); setE164_2(r.fullPhone);
  }
  function handlePhone2Blur() {
    if (intl2 && raw2.startsWith("+") && raw2.length >= 4) {
      const result = detectInternational(raw2);
      if (result) {
        setCountry2(result.country); setDigits2(result.localNumber);
        setValid2(result.isValid); setE164_2(result.fullPhone);
        setIntl2(false); setRaw2("");
        return;
      }
      setValid2(false); return;
    }
    if (digits2.length >= 7) {
      const r = validateForCountry(digits2, country2, cc2.code);
      setValid2(r.isValid); setDigits2(r.localNumber || digits2); setE164_2(r.fullPhone);
    } else if (digits2.length > 0) { setValid2(false); }
  }

  const canSave = firstName.trim().length >= 2 && lastName.trim().length >= 2 && (phoneE164.length >= 8 || phoneDigits.length >= 5);

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
        phone: phoneE164 || phoneDigits,
        phone_label: phoneLabel,
        mobile_phone: showSecond ? (e164_2 || digits2 || null) : null,
        mobile_phone_label: showSecond ? label2 : "mobile",
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
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-base font-bold text-foreground">Nuevo contacto</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="px-5 py-4 flex gap-5">
          {/* Left — form */}
          <div className="flex-1 space-y-4 min-w-0">
            <p className="text-xs text-muted-foreground">Agrega un contacto al directorio sin programar consulta.</p>

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

            {/* Primary phone */}
            <PhoneRow
              label="Teléfono *"
              phoneLabel={phoneLabel}
              onPhoneLabelChange={setPhoneLabel}
              selectedCountry={countryIso}
              selectedCode={cc1.code}
              selectedFlag={cc1.flag}
              localDigits={phoneDigits}
              isInternationalMode={intlMode}
              rawInput={rawInput}
              phoneValid={phoneValid}
              onCountrySelect={(iso, code, flag) => handleCountry1(iso, code)}
              onPhoneChange={handlePhone1Change}
              onPhoneBlur={handlePhone1Blur}
            />

            {/* Secondary phone */}
            {showSecond ? (
              <PhoneRow
                label="Teléfono secundario"
                phoneLabel={label2}
                onPhoneLabelChange={setLabel2}
                selectedCountry={country2}
                selectedCode={cc2.code}
                selectedFlag={cc2.flag}
                localDigits={digits2}
                isInternationalMode={intl2}
                rawInput={raw2}
                phoneValid={valid2}
                onCountrySelect={(iso, code) => handleCountry2(iso, code)}
                onPhoneChange={handlePhone2Change}
                onPhoneBlur={handlePhone2Blur}
                onRemove={() => {
                  setShowSecond(false); setDigits2(""); setRaw2("");
                  setCountry2("US"); setE164_2(""); setValid2(null); setLabel2("mobile");
                }}
              />
            ) : (
              <button type="button" onClick={() => setShowSecond(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar otro teléfono
              </button>
            )}

            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com"
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {showDetail && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  {channel === "referido" ? "¿Quién lo refirió?" : channel === "lead-magnet" ? "¿Cuál lead magnet?" : channel === "anuncio" ? "¿Cuál campaña?" : "Detalle"}
                </label>
                <input type="text" value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="Detalle del origen..."
                  className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Etiqueta / nota</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Campaña Mayo 2026, Lista FB..."
                className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Right — channel grid */}
          <div className="w-[260px] shrink-0 space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Canal de origen</label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map(ch => {
                const Icon = ch.icon;
                const selected = channel === ch.key;
                return (
                  <button key={ch.key} onClick={() => setChannel(selected ? "" : ch.key)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      selected ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-border hover:border-foreground/20 bg-card"
                    }`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${ch.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[10px] font-semibold leading-tight text-center ${selected ? "text-accent" : "text-foreground"}`}>
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
            className="flex items-center gap-1.5 text-sm font-semibold bg-accent text-accent-foreground px-5 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Agregar contacto"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
