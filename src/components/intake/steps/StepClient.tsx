import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, ChevronDown, Check, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { COUNTRY_CODES, FREQUENT_COUNT } from "@/lib/countryCodes";
import { detectInternational, validateForCountry, parseExisting, getFlag, formatNational } from "@/lib/phoneDetect";
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

function stripNonDigits(val: string) { return val.replace(/\D/g, ""); }

const RELATIONSHIPS = [
  { key: "solicitante", emoji: "👤", label: "Es el solicitante", desc: "La persona que necesita el beneficio migratorio" },
  { key: "familiar", emoji: "👨‍👩‍👧", label: "Es familiar del solicitante", desc: "Cónyuge, hijo, padre u otro familiar incluido" },
  { key: "patrocinador", emoji: "🤝", label: "Es el patrocinador", desc: "Quien firma la petición o el Affidavit of Support" },
  { key: "otro", emoji: "📋", label: "Otro rol", desc: "" },
];

export default function StepClient({ data, update, accountId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Phone state — dropdown country is source of truth
  const parsed = parseExisting(data.client_phone);
  const [selectedCountry, setSelectedCountry] = useState(parsed.country);
  const [selectedCode, setSelectedCode] = useState(parsed.code);
  const [selectedFlag, setSelectedFlag] = useState(parsed.flag);
  const [localDigits, setLocalDigits] = useState(parsed.local);
  const [isInternationalMode, setIsInternationalMode] = useState(false); // true when user types "+"
  const [rawInput, setRawInput] = useState(""); // only used during "+" typing
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);

  const [phoneDupe, setPhoneDupe] = useState<DuplicateMatch | null>(null);
  const [phoneDupeDismissed, setPhoneDupeDismissed] = useState(false);
  const [emailDupe, setEmailDupe] = useState<DuplicateMatch | null>(null);

  // Sync E.164 to parent whenever localDigits or country changes
  useEffect(() => {
    if (!localDigits) { update({ client_phone: "" }); return; }
    const result = validateForCountry(localDigits, selectedCountry, selectedCode);
    update({ client_phone: result.fullPhone });
  }, [localDigits, selectedCountry, selectedCode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    update({ client_profile_id: null, is_existing_client: false, client_first_name: "", client_last_name: "", client_phone: "", client_email: "" });
    setLocalDigits(""); setRawInput(""); setSelectedFlag("🇺🇸"); setSelectedCode("+1"); setSelectedCountry("US");
    setIsInternationalMode(false); setPhoneValid(null); setPhoneDupe(null); setPhoneDupeDismissed(false); setEmailDupe(null);
  }

  function handleCountrySelect(iso: string, code: string, flag: string) {
    setSelectedCountry(iso);
    setSelectedCode(code);
    setSelectedFlag(flag);
    setIsInternationalMode(false);
    setRawInput("");
    setShowDropdown(false);
    setCountrySearch("");
    // Re-validate current digits with new country
    if (localDigits) {
      const result = validateForCountry(localDigits, iso, code);
      setPhoneValid(result.isValid);
      setLocalDigits(result.localNumber || localDigits);
      update({ client_phone: result.fullPhone });
    }
  }

  function handlePhoneChange(val: string) {
    // If user starts typing "+", switch to international mode
    if (val.startsWith("+")) {
      setIsInternationalMode(true);
      // Keep only digits and the leading +
      const cleaned = "+" + val.slice(1).replace(/\D/g, "");
      if (cleaned.length > 16) return; // E.164 max
      setRawInput(cleaned);
      setLocalDigits(""); // will be set on blur
      setPhoneValid(null);
      return;
    }

    // Local mode — dropdown country is source of truth
    setIsInternationalMode(false);
    setRawInput("");
    const digits = val.replace(/\D/g, "");
    if (digits.length > 15) return;
    setLocalDigits(digits);
    setPhoneValid(null);
  }

  function handlePhoneBlur() {
    if (isInternationalMode && rawInput.startsWith("+") && rawInput.length >= 4) {
      // Auto-detect country from "+" prefix
      const result = detectInternational(rawInput);
      if (result) {
        setSelectedFlag(result.flag);
        setSelectedCode(result.countryCode);
        setSelectedCountry(result.country);
        setLocalDigits(result.localNumber);
        setPhoneValid(result.isValid);
        update({ client_phone: result.fullPhone });
        setIsInternationalMode(false);
        setRawInput("");
        checkPhoneDuplicate(result.fullPhone);
        return;
      }
      // Failed to parse — keep raw but mark invalid
      setPhoneValid(false);
      checkPhoneDuplicate(rawInput);
      return;
    }

    // Local mode — validate with selected country (NO guessing)
    if (localDigits.length >= 7) {
      const result = validateForCountry(localDigits, selectedCountry, selectedCode);
      setPhoneValid(result.isValid);
      setLocalDigits(result.localNumber || localDigits);
      update({ client_phone: result.fullPhone });
      checkPhoneDuplicate(result.fullPhone);
    } else if (localDigits.length > 0) {
      setPhoneValid(false);
      checkPhoneDuplicate(data.client_phone);
    }
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

  // Display value for phone input
  const phoneDisplayValue = isInternationalMode
    ? rawInput
    : formatNational(localDigits, selectedCountry);

  const phoneInvalid = localDigits.length > 0 && localDigits.length < 7 && !isInternationalMode;

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
              <div className="w-8 h-8 rounded-full bg-jarvis/10 flex items-center justify-center text-jarvis text-xs font-bold">
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
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">♻️ Cliente existente</Badge>
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

      {/* Phone */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Teléfono *</label>
        <div className="flex gap-0">
          {/* Country dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button type="button" onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 border border-input border-r-0 bg-background rounded-l-xl px-3 py-2.5 text-sm hover:bg-secondary/50 transition-colors min-w-[90px]">
              <span>{selectedFlag} {selectedCode}</span>
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
                        <button type="button" onClick={() => handleCountrySelect(c.iso, c.code, c.flag)}
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
          {/* Phone input */}
          <div className="relative flex-1">
            <input type="tel" value={phoneDisplayValue}
              onChange={e => handlePhoneChange(e.target.value)} onBlur={handlePhoneBlur}
              placeholder={isInternationalMode ? "+57 312 456 7890" : "(305) 555-0000"}
              className="w-full border border-input bg-background rounded-r-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-8" />
            {phoneValid === true && localDigits.length >= 7 && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
            {phoneValid === false && (localDigits.length >= 7 || (isInternationalMode && rawInput.length >= 4)) && <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Escribe + para detectar país automáticamente · Sin + usa el selector de país</p>
        {phoneInvalid && <p className="text-[10px] text-destructive mt-1">Mínimo 7 dígitos</p>}
        {phoneValid === false && localDigits.length >= 7 && <p className="text-[10px] text-yellow-400 mt-1">⚠️ Número no válido para {selectedCountry}</p>}

        {phoneDupe && !phoneDupeDismissed && (
          <div className="mt-2 border border-yellow-500/30 bg-yellow-500/10 rounded-xl px-4 py-3">
            <p className="text-sm text-yellow-300 font-semibold">⚠️ Este teléfono ya está registrado</p>
            <p className="text-xs text-yellow-300/80 mt-0.5">{phoneDupe.first_name} {phoneDupe.last_name}{phoneDupe.email ? ` · ${phoneDupe.email}` : ""}</p>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => selectClient(phoneDupe)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors">Usar cliente existente</button>
              <button type="button" onClick={() => setPhoneDupeDismissed(true)} className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Ignorar y continuar</button>
            </div>
          </div>
        )}
      </div>

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
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${data.client_language === lang.key ? "border-jarvis bg-jarvis/10 text-jarvis" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
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
