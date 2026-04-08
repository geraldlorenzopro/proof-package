import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, ChevronDown, Check, AlertTriangle, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { COUNTRY_CODES, FREQUENT_COUNT } from "@/lib/countryCodes";
import { detectInternational, validateForCountry, parseExisting, getFlag, formatNational, PHONE_LABELS } from "@/lib/phoneDetect";
import type { IntakeData } from "../IntakeWizard";

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
  accountId: string;
}

interface ClientResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

interface DuplicateMatch {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

const RELATIONSHIPS = [
  { key: "solicitante", emoji: "👤", label: "Es el solicitante", desc: "La persona que necesita el beneficio migratorio" },
  { key: "familiar", emoji: "👨‍👩‍👧", label: "Es familiar del solicitante", desc: "Cónyuge, hijo, padre u otro familiar incluido" },
  { key: "patrocinador", emoji: "🤝", label: "Es el patrocinador", desc: "Quien firma la petición o el Affidavit of Support" },
  { key: "otro", emoji: "📋", label: "Otro rol", desc: "" },
];

/* ─── Phone row sub-component ─── */
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

        {/* Phone type selector (like GHL) */}
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

/* ─── Main StepClient ─── */
export default function StepClient({ data, update, accountId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Primary phone state
  const parsed = parseExisting(data.client_phone);
  const [selectedCountry, setSelectedCountry] = useState(parsed.country);
  const [selectedCode, setSelectedCode] = useState(parsed.code);
  const [selectedFlag, setSelectedFlag] = useState(parsed.flag);
  const [localDigits, setLocalDigits] = useState(parsed.local);
  const [isInternationalMode, setIsInternationalMode] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);

  // Secondary phone state
  const [showSecondPhone, setShowSecondPhone] = useState(!!data.client_mobile_phone);
  const parsed2 = parseExisting(data.client_mobile_phone);
  const [country2, setCountry2] = useState(parsed2.country);
  const [code2, setCode2] = useState(parsed2.code);
  const [flag2, setFlag2] = useState(parsed2.flag);
  const [digits2, setDigits2] = useState(parsed2.local);
  const [intlMode2, setIntlMode2] = useState(false);
  const [raw2, setRaw2] = useState("");
  const [valid2, setValid2] = useState<boolean | null>(null);

  const [phoneDupe, setPhoneDupe] = useState<DuplicateMatch | null>(null);
  const [phoneDupeDismissed, setPhoneDupeDismissed] = useState(false);
  const [emailDupe, setEmailDupe] = useState<DuplicateMatch | null>(null);

  // Sync primary E.164
  useEffect(() => {
    if (!localDigits) { update({ client_phone: "" }); return; }
    const result = validateForCountry(localDigits, selectedCountry, selectedCode);
    update({ client_phone: result.fullPhone });
  }, [localDigits, selectedCountry, selectedCode]);

  // Sync secondary E.164
  useEffect(() => {
    if (!digits2) { update({ client_mobile_phone: "" }); return; }
    const result = validateForCountry(digits2, country2, code2);
    update({ client_mobile_phone: result.fullPhone });
  }, [digits2, country2, code2]);

  // When existing client is selected, sync phone state
  useEffect(() => {
    const p = parseExisting(data.client_phone);
    if (p.local !== localDigits || p.country !== selectedCountry) {
      setSelectedFlag(p.flag); setSelectedCode(p.code); setSelectedCountry(p.country);
      setLocalDigits(p.local); setIsInternationalMode(false); setRawInput("");
    }
  }, [data.is_existing_client]);

  // Client search
  useEffect(() => {
    if (query.length < 2 || !accountId) { setResults([]); return; }
    const timer = setTimeout(() => searchClients(query), 300);
    return () => clearTimeout(timer);
  }, [query, accountId]);

  async function searchClients(q: string) {
    setSearching(true);
    const { data: clients } = await supabase
      .from("client_profiles")
      .select("id, first_name, last_name, phone, email")
      .eq("account_id", accountId)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(5);
    setResults(clients || []);
    setSearching(false);
  }

  function selectClient(client: ClientResult | DuplicateMatch) {
    update({
      client_profile_id: client.id, is_existing_client: true,
      client_first_name: client.first_name || "", client_last_name: client.last_name || "",
      client_phone: client.phone || "", client_email: client.email || "",
    });
    setQuery(""); setResults([]); setPhoneDupe(null); setPhoneDupeDismissed(false); setEmailDupe(null);
  }

  function clearClient() {
    update({ client_profile_id: null, is_existing_client: false, client_first_name: "", client_last_name: "", client_phone: "", client_email: "", client_mobile_phone: "" });
    setLocalDigits(""); setRawInput(""); setSelectedFlag("🇺🇸"); setSelectedCode("+1"); setSelectedCountry("US");
    setIsInternationalMode(false); setPhoneValid(null); setPhoneDupe(null); setPhoneDupeDismissed(false); setEmailDupe(null);
    setShowSecondPhone(false); setDigits2(""); setRaw2(""); setCountry2("US"); setCode2("+1"); setFlag2("🇺🇸");
  }

  // Primary phone handlers
  function handleCountrySelect(iso: string, code: string, flag: string) {
    setSelectedCountry(iso); setSelectedCode(code); setSelectedFlag(flag);
    setIsInternationalMode(false); setRawInput("");
    if (localDigits) {
      const result = validateForCountry(localDigits, iso, code);
      setPhoneValid(result.isValid); setLocalDigits(result.localNumber || localDigits);
      update({ client_phone: result.fullPhone });
    }
  }

  function handlePhoneChange(val: string) {
    if (val.startsWith("+")) {
      setIsInternationalMode(true);
      const cleaned = "+" + val.slice(1).replace(/\D/g, "");
      if (cleaned.length > 16) return;
      setRawInput(cleaned); setLocalDigits(""); setPhoneValid(null);
      if (cleaned.length >= 3) {
        const detected = detectInternational(cleaned);
        if (detected) {
          setSelectedFlag(detected.flag);
          setSelectedCountry(detected.country);
          setSelectedCode(detected.countryCode);
        }
      }
      return;
    }
    setIsInternationalMode(false); setRawInput("");
    const digits = val.replace(/\D/g, "");
    if (digits.length > 15) return;
    setLocalDigits(digits); setPhoneValid(null);
  }

  function handlePhoneBlur() {
    if (isInternationalMode && rawInput.startsWith("+") && rawInput.length >= 4) {
      const result = detectInternational(rawInput);
      if (result) {
        setSelectedFlag(result.flag); setSelectedCode(result.countryCode); setSelectedCountry(result.country);
        setLocalDigits(result.localNumber); setPhoneValid(result.isValid);
        update({ client_phone: result.fullPhone });
        setIsInternationalMode(false); setRawInput("");
        checkPhoneDuplicate(result.fullPhone);
        return;
      }
      setPhoneValid(false); checkPhoneDuplicate(rawInput);
      return;
    }
    if (localDigits.length >= 7) {
      const result = validateForCountry(localDigits, selectedCountry, selectedCode);
      setPhoneValid(result.isValid); setLocalDigits(result.localNumber || localDigits);
      update({ client_phone: result.fullPhone }); checkPhoneDuplicate(result.fullPhone);
    } else if (localDigits.length > 0) {
      setPhoneValid(false); checkPhoneDuplicate(data.client_phone);
    }
  }

  // Secondary phone handlers
  function handleCountry2(iso: string, code: string, flag: string) {
    setCountry2(iso); setCode2(code); setFlag2(flag); setIntlMode2(false); setRaw2("");
    if (digits2) {
      const result = validateForCountry(digits2, iso, code);
      setValid2(result.isValid); setDigits2(result.localNumber || digits2);
      update({ client_mobile_phone: result.fullPhone });
    }
  }

  function handlePhone2Change(val: string) {
    if (val.startsWith("+")) {
      setIntlMode2(true);
      const cleaned = "+" + val.slice(1).replace(/\D/g, "");
      if (cleaned.length > 16) return;
      setRaw2(cleaned); setDigits2(""); setValid2(null);
      if (cleaned.length >= 3) {
        const detected = detectInternational(cleaned);
        if (detected) {
          setFlag2(detected.flag);
          setCountry2(detected.country);
          setCode2(detected.countryCode);
        }
      }
      return;
    }
    setIntlMode2(false); setRaw2("");
    const d = val.replace(/\D/g, "");
    if (d.length > 15) return;
    setDigits2(d); setValid2(null);
  }

  function handlePhone2Blur() {
    if (intlMode2 && raw2.startsWith("+") && raw2.length >= 4) {
      const result = detectInternational(raw2);
      if (result) {
        setFlag2(result.flag); setCode2(result.countryCode); setCountry2(result.country);
        setDigits2(result.localNumber); setValid2(result.isValid);
        update({ client_mobile_phone: result.fullPhone });
        setIntlMode2(false); setRaw2("");
        return;
      }
      setValid2(false); return;
    }
    if (digits2.length >= 7) {
      const result = validateForCountry(digits2, country2, code2);
      setValid2(result.isValid); setDigits2(result.localNumber || digits2);
      update({ client_mobile_phone: result.fullPhone });
    } else if (digits2.length > 0) { setValid2(false); }
  }

  async function checkPhoneDuplicate(phone?: string) {
    const fullPhone = phone || data.client_phone;
    if (!fullPhone || fullPhone.length < 8 || !accountId || data.is_existing_client) { setPhoneDupe(null); return; }
    const { data: matches } = await supabase.from("client_profiles").select("id, first_name, last_name, email, phone").eq("account_id", accountId).eq("phone", fullPhone).limit(1);
    if (matches && matches.length > 0) {
      if (data.client_profile_id && matches[0].id === data.client_profile_id) return;
      setPhoneDupe(matches[0]); setPhoneDupeDismissed(false);
    } else { setPhoneDupe(null); }
  }

  async function checkEmailDuplicate() {
    const email = data.client_email?.trim();
    if (!email || !email.includes("@") || !accountId) { setEmailDupe(null); return; }
    let q = supabase.from("client_profiles").select("id, first_name, last_name, email, phone").eq("account_id", accountId).eq("email", email);
    if (data.client_profile_id) q = q.neq("id", data.client_profile_id);
    const { data: matches } = await q.limit(1);
    if (matches && matches.length > 0) setEmailDupe(matches[0]); else setEmailDupe(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Quién es el cliente?</h3>
        <p className="text-sm text-muted-foreground">Ingresa los datos de contacto</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email..."
          className="w-full border border-input bg-background rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        {searching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {results.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {results.map(c => (
            <button key={c.id} onClick={() => selectClient(c)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                {(c.first_name?.[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.first_name} {c.last_name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.phone || c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {data.is_existing_client && (
        <div className="flex items-center gap-2">
          <Badge className="bg-accent/10 text-accent border-accent/20">♻️ Cliente existente</Badge>
          <button onClick={clearClient} className="text-xs text-muted-foreground hover:text-foreground">Cambiar</button>
        </div>
      )}

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre *</label>
          <input type="text" value={data.client_first_name} onChange={e => update({ client_first_name: e.target.value })}
            placeholder="Juan" className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {data.client_first_name.length > 0 && data.client_first_name.length < 2 && <p className="text-[10px] text-destructive mt-1">Mínimo 2 caracteres</p>}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellido *</label>
          <input type="text" value={data.client_last_name} onChange={e => update({ client_last_name: e.target.value })}
            placeholder="Pérez" className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {/* Primary phone */}
      <PhoneRow
        label="Teléfono *"
        phoneLabel={data.client_phone_label}
        onPhoneLabelChange={v => update({ client_phone_label: v })}
        selectedCountry={selectedCountry}
        selectedCode={selectedCode}
        selectedFlag={selectedFlag}
        localDigits={localDigits}
        isInternationalMode={isInternationalMode}
        rawInput={rawInput}
        phoneValid={phoneValid}
        onCountrySelect={handleCountrySelect}
        onPhoneChange={handlePhoneChange}
        onPhoneBlur={handlePhoneBlur}
      />

      {/* Duplicate warning */}
      {phoneDupe && !phoneDupeDismissed && (
        <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-xl px-4 py-3">
          <p className="text-sm text-yellow-300 font-semibold">⚠️ Este teléfono ya está registrado</p>
          <p className="text-xs text-yellow-300/80 mt-0.5">{phoneDupe.first_name} {phoneDupe.last_name}{phoneDupe.email ? ` · ${phoneDupe.email}` : ""}</p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => selectClient(phoneDupe)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors">Usar cliente existente</button>
            <button type="button" onClick={() => setPhoneDupeDismissed(true)} className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Ignorar y continuar</button>
          </div>
        </div>
      )}

      {/* Secondary phone */}
      {showSecondPhone ? (
        <PhoneRow
          label="Teléfono secundario"
          phoneLabel={data.client_mobile_phone_label}
          onPhoneLabelChange={v => update({ client_mobile_phone_label: v })}
          selectedCountry={country2}
          selectedCode={code2}
          selectedFlag={flag2}
          localDigits={digits2}
          isInternationalMode={intlMode2}
          rawInput={raw2}
          phoneValid={valid2}
          onCountrySelect={handleCountry2}
          onPhoneChange={handlePhone2Change}
          onPhoneBlur={handlePhone2Blur}
          onRemove={() => {
            setShowSecondPhone(false); setDigits2(""); setRaw2("");
            setCountry2("US"); setCode2("+1"); setFlag2("🇺🇸");
            update({ client_mobile_phone: "", client_mobile_phone_label: "mobile" });
          }}
        />
      ) : (
        <button type="button" onClick={() => setShowSecondPhone(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
          <Plus className="w-3.5 h-3.5" /> Agregar otro teléfono
        </button>
      )}

      {/* Email */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Email (opcional)</label>
        <input type="email" value={data.client_email} onChange={e => update({ client_email: e.target.value })} onBlur={checkEmailDuplicate}
          placeholder="cliente@email.com" className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        {emailDupe && (
          <p className="text-xs text-blue-400 mt-1.5">ℹ️ Este email ya está en uso por {emailDupe.first_name} {emailDupe.last_name}
            <span className="text-blue-400/60"> — puede continuar, familias comparten email</span></p>
        )}
      </div>

      {/* Language */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Idioma preferido</label>
        <div className="flex gap-3">
          {[{ key: "es", label: "🇪🇸 Español" }, { key: "en", label: "🇺🇸 English" }].map(lang => (
            <button key={lang.key} onClick={() => update({ client_language: lang.key })}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${data.client_language === lang.key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Relationship */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Quién es esta persona en el caso?</label>
        <p className="text-[10px] text-muted-foreground mb-2">Selecciona su rol</p>
        <div className="grid grid-cols-2 gap-2">
          {RELATIONSHIPS.map(r => {
            const selected = data.client_relationship === r.key;
            return (
              <button key={r.key} onClick={() => update({ client_relationship: r.key, client_relationship_detail: "" })}
                className={`flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-left transition-all duration-200 relative ${selected ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-border hover:border-foreground/20 bg-card"}`}>
                {selected && (
                  <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-2 h-2 text-accent-foreground" />
                  </div>
                )}
                <span className="text-sm font-semibold">
                  <span className="mr-1.5">{r.emoji}</span>
                  <span className={selected ? "text-accent" : "text-foreground"}>{r.label}</span>
                </span>
                {r.desc && <span className="text-[10px] text-muted-foreground leading-tight">{r.desc}</span>}
              </button>
            );
          })}
        </div>
        {data.client_relationship === "otro" && (
          <div className="mt-2">
            <input type="text" value={data.client_relationship_detail} onChange={e => update({ client_relationship_detail: e.target.value })}
              placeholder="¿Cuál es su rol en el caso?" className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        )}
      </div>
    </div>
  );
}
