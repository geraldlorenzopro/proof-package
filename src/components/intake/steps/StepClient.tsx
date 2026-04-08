import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COUNTRY_CODES, FREQUENT_COUNT } from "@/lib/countryCodes";
import { detectInternational, validateForCountry, detectLocal10, parseExisting, getFlag } from "@/lib/phoneDetect";
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

function stripNonDigits(val: string) {
  return val.replace(/\D/g, "");
}

/** Allow + as first char, then only digits */
function stripPhoneInput(val: string) {
  if (val.startsWith("+")) return "+" + val.slice(1).replace(/\D/g, "");
  return val.replace(/\D/g, "");
}

function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default function StepClient({ data, update, accountId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const parsed = parseExisting(data.client_phone);
  const [detectedFlag, setDetectedFlag] = useState(parsed.flag);
  const [detectedCode, setDetectedCode] = useState(parsed.code);
  const [detectedCountry, setDetectedCountry] = useState(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.local);
  const [rawInput, setRawInput] = useState(""); // tracks if user typed "+"
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);

  // Duplicate detection state
  const [phoneDupe, setPhoneDupe] = useState<DuplicateMatch | null>(null);
  const [phoneDupeDismissed, setPhoneDupeDismissed] = useState(false);
  const [emailDupe, setEmailDupe] = useState<DuplicateMatch | null>(null);

  // Sync full phone to parent
  useEffect(() => {
    const digits = stripNonDigits(localNumber);
    if (digits.length === 0) {
      update({ client_phone: "" });
      return;
    }
    const prefix = showManual && manualCode ? `+${stripNonDigits(manualCode)}` : detectedCode;
    update({ client_phone: `${prefix}${digits}` });
  }, [localNumber, detectedCode, showManual, manualCode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // When existing client selected, parse phone
  useEffect(() => {
    const p = parseExisting(data.client_phone);
    const currentDigits = stripNonDigits(localNumber);
    if (p.local !== currentDigits) {
      setDetectedFlag(p.flag);
      setDetectedCode(p.code);
      setDetectedCountry(p.country);
      setLocalNumber(p.local);
      setShowManual(false);
    }
  }, [data.is_existing_client]);

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
      client_profile_id: client.id,
      is_existing_client: true,
      client_first_name: client.first_name || "",
      client_last_name: client.last_name || "",
      client_phone: client.phone || "",
      client_email: client.email || "",
    });
    setQuery("");
    setResults([]);
    setPhoneDupe(null);
    setPhoneDupeDismissed(false);
    setEmailDupe(null);
  }

  function clearClient() {
    update({
      client_profile_id: null,
      is_existing_client: false,
      client_first_name: "",
      client_last_name: "",
      client_phone: "",
      client_email: "",
    });
    setLocalNumber("");
    setRawInput("");
    setDetectedFlag("🇺🇸");
    setDetectedCode("+1");
    setDetectedCountry("US");
    setShowManual(false);
    setPhoneValid(null);
    setPhoneDupe(null);
    setPhoneDupeDismissed(false);
    setEmailDupe(null);
  }

  function handleLocalChange(val: string) {
    const cleaned = stripPhoneInput(val);
    if (cleaned.replace(/\D/g, "").length > 15) return;

    setRawInput(cleaned);

    if (cleaned.length === 0 || cleaned === "+") {
      setLocalNumber("");
      setPhoneValid(null);
      if (cleaned.length === 0) {
        setDetectedFlag("🇺🇸");
        setDetectedCode("+1");
        setDetectedCountry("US");
      }
      return;
    }

    // Store only digits for display
    const digits = cleaned.replace(/\D/g, "");
    setLocalNumber(digits);
  }

  // Normalize and check duplicates on blur
  function handlePhoneBlur() {
    const digits = stripNonDigits(localNumber);
    if (digits.length < 7 || showManual) {
      checkPhoneDuplicate();
      return;
    }

    // If user typed "+" → international auto-detect
    if (rawInput.startsWith("+")) {
      const result = detectInternational("+" + digits);
      if (result) {
        setDetectedFlag(result.flag);
        setDetectedCode(result.countryCode);
        setDetectedCountry(result.country);
        setLocalNumber(result.localNumber);
        setPhoneValid(result.isValid);
        update({ client_phone: result.fullPhone });
        setRawInput(""); // clear the "+" mode after detection
        checkPhoneDuplicate();
        return;
      }
    }

    // No "+" → use the country from the dropdown
    // Special case: 10-digit with DR area codes
    if (digits.length === 10) {
      const local10 = detectLocal10(digits);
      setDetectedFlag(local10.flag);
      setDetectedCode(local10.code);
      setDetectedCountry(local10.country);
    }

    const result = validateForCountry(digits, detectedCountry, detectedCode);
    setPhoneValid(result.isValid);
    setLocalNumber(result.localNumber || digits);
    update({ client_phone: result.fullPhone });
    checkPhoneDuplicate();
  }

  // Phone duplicate check on blur
  async function checkPhoneDuplicate() {
    const fullPhone = data.client_phone;
    if (!fullPhone || fullPhone.length < 8 || !accountId || data.is_existing_client) {
      setPhoneDupe(null);
      return;
    }
    const { data: matches } = await supabase
      .from("client_profiles")
      .select("id, first_name, last_name, email, phone")
      .eq("account_id", accountId)
      .eq("phone", fullPhone)
      .limit(1);
    if (matches && matches.length > 0) {
      // Don't show if it's the already-selected client
      if (data.client_profile_id && matches[0].id === data.client_profile_id) return;
      setPhoneDupe(matches[0]);
      setPhoneDupeDismissed(false);
    } else {
      setPhoneDupe(null);
    }
  }

  // Email duplicate check on blur
  async function checkEmailDuplicate() {
    const email = data.client_email?.trim();
    if (!email || !email.includes("@") || !accountId) {
      setEmailDupe(null);
      return;
    }
    let query = supabase
      .from("client_profiles")
      .select("id, first_name, last_name, email, phone")
      .eq("account_id", accountId)
      .eq("email", email);

    if (data.client_profile_id) {
      query = query.neq("id", data.client_profile_id);
    }

    const { data: matches } = await query.limit(1);
    if (matches && matches.length > 0) {
      setEmailDupe(matches[0]);
    } else {
      setEmailDupe(null);
    }
  }

  const digits = stripNonDigits(localNumber);
  const phoneInvalid = digits.length > 0 && digits.length < 7;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Quién es el cliente?</h3>
        <p className="text-sm text-muted-foreground">Busca un cliente existente o ingresa los datos</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar cliente existente..."
          className="w-full border border-input bg-background rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {results.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => selectClient(c)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-jarvis/10 flex items-center justify-center text-jarvis text-xs font-bold">
                {(c.first_name?.[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{c.phone || c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Existing client badge */}
      {data.is_existing_client && (
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            ♻️ Cliente existente
          </Badge>
          <button onClick={clearClient} className="text-xs text-muted-foreground hover:text-foreground">
            Cambiar
          </button>
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre *</label>
          <input
            type="text"
            value={data.client_first_name}
            onChange={e => update({ client_first_name: e.target.value })}
            placeholder="Juan"
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {data.client_first_name.length > 0 && data.client_first_name.length < 2 && (
            <p className="text-[10px] text-rose-400 mt-1">Mínimo 2 caracteres</p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellido *</label>
          <input
            type="text"
            value={data.client_last_name}
            onChange={e => update({ client_last_name: e.target.value })}
            placeholder="Pérez"
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Phone with country code */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Teléfono *</label>
        <div className="flex gap-0">
          {/* Country selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 border border-input border-r-0 bg-background rounded-l-xl px-3 py-2.5 text-sm hover:bg-secondary/50 transition-colors min-w-[90px]"
            >
              {showManual ? (
                <span className="text-muted-foreground">🌐 +{stripNonDigits(manualCode) || "?"}</span>
              ) : (
                <span>{detectedFlag} {detectedCode}</span>
              )}
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 w-72 max-h-72 border border-border bg-background rounded-xl shadow-lg flex flex-col">
                {/* Search input */}
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    placeholder="Buscar país..."
                    className="w-full border border-input bg-background rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {(() => {
                    const q = countrySearch.toLowerCase().trim();
                    const filtered = q
                      ? COUNTRY_CODES.map((c, idx) => ({ c, idx })).filter(
                          ({ c }) =>
                            c.name.toLowerCase().includes(q) ||
                            c.code.includes(q) ||
                            c.iso.toLowerCase().includes(q)
                        )
                      : COUNTRY_CODES.map((c, idx) => ({ c, idx }));

                    // Show separator between frequent and rest when not searching
                    return filtered.map(({ c, idx }, i) => (
                      <div key={`${c.iso}-${idx}`}>
                        {!q && idx === FREQUENT_COUNT && (
                          <div className="border-t border-border my-1 mx-2" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDetectedFlag(c.flag);
                            setDetectedCode(c.code);
                            setDetectedCountry(c.iso);
                            setShowManual(false);
                            setShowDropdown(false);
                            setCountrySearch("");
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary/50 transition-colors text-left ${
                            !showManual && detectedCountry === c.iso ? "bg-secondary/30" : ""
                          }`}
                        >
                          <span>{c.flag}</span>
                          <span className="font-medium">{c.code}</span>
                          <span className="text-muted-foreground text-xs truncate">{c.name}</span>
                        </button>
                      </div>
                    ));
                  })()}
                </div>
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManual(true);
                      setShowDropdown(false);
                      setCountrySearch("");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors text-left text-muted-foreground"
                  >
                    🌐 Otro...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manual code input */}
          {showManual && (
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              placeholder="Código"
              className="w-16 border border-input border-r-0 bg-background px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {/* Number input */}
          <div className="relative flex-1">
            <input
              type="tel"
              value={rawInput.startsWith("+") ? rawInput : formatPhoneDisplay(localNumber)}
              onChange={e => handleLocalChange(e.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="+57 o (809) 676-5653"
              className="w-full border border-input bg-background rounded-r-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-8"
            />
            {phoneValid === true && digits.length >= 7 && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            )}
            {phoneValid === false && digits.length >= 7 && (
              <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Escribe + para detectar país automáticamente (ej: +57, +34)
        </p>
        {phoneInvalid && (
          <p className="text-[10px] text-destructive mt-1">Mínimo 7 dígitos</p>
        )}
        {phoneValid === false && digits.length >= 7 && (
          <p className="text-[10px] text-yellow-400 mt-1">⚠️ Número incompleto</p>
        )}

        {/* Phone duplicate warning */}
        {phoneDupe && !phoneDupeDismissed && (
          <div className="mt-2 border border-yellow-500/30 bg-yellow-500/10 rounded-xl px-4 py-3">
            <p className="text-sm text-yellow-300 font-semibold">
              ⚠️ Este teléfono ya está registrado
            </p>
            <p className="text-xs text-yellow-300/80 mt-0.5">
              {phoneDupe.first_name} {phoneDupe.last_name}
              {phoneDupe.email ? ` · ${phoneDupe.email}` : ""}
            </p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => selectClient(phoneDupe)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors"
              >
                Usar cliente existente
              </button>
              <button
                type="button"
                onClick={() => setPhoneDupeDismissed(true)}
                className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                Ignorar y continuar
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Email (opcional)</label>
        <input
          type="email"
          value={data.client_email}
          onChange={e => update({ client_email: e.target.value })}
          onBlur={checkEmailDuplicate}
          placeholder="cliente@email.com"
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Email duplicate info (non-blocking) */}
        {emailDupe && (
          <p className="text-xs text-blue-400 mt-1.5">
            ℹ️ Este email ya está en uso por {emailDupe.first_name} {emailDupe.last_name}
            <span className="text-blue-400/60"> — puede continuar, familias comparten email</span>
          </p>
        )}
      </div>

      {/* Language */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Idioma preferido</label>
        <div className="flex gap-3">
          {[
            { key: "es", label: "🇪🇸 Español" },
            { key: "en", label: "🇺🇸 English" },
          ].map(lang => (
            <button
              key={lang.key}
              onClick={() => update({ client_language: lang.key })}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                data.client_language === lang.key
                  ? "border-jarvis bg-jarvis/10 text-jarvis"
                  : "border-border text-muted-foreground hover:border-foreground/20"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client type */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Tipo de cliente</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "principal", label: "👤 Cliente principal" },
            { key: "familiar", label: "👨‍👩‍👧 Familiar/Derivado" },
            { key: "peticionario", label: "🧑‍💼 Peticionario" },
            { key: "referido", label: "⚖️ Referido por abogado" },
          ].map(ct => {
            const selected = data.client_type === ct.key;
            return (
              <button
                key={ct.key}
                onClick={() => update({ client_type: ct.key })}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                  selected
                    ? "border-jarvis bg-jarvis/10 font-semibold text-jarvis"
                    : "border-border text-muted-foreground hover:border-foreground/20"
                }`}
              >
                {ct.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
