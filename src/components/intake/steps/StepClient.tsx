import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const COUNTRY_CODES = [
  { flag: "🇺🇸", code: "+1", name: "Estados Unidos" },
  { flag: "🇩🇴", code: "+1", name: "República Dominicana", alt: "DO" },
  { flag: "🇲🇽", code: "+52", name: "México" },
  { flag: "🇬🇹", code: "+502", name: "Guatemala" },
  { flag: "🇭🇳", code: "+504", name: "Honduras" },
  { flag: "🇸🇻", code: "+503", name: "El Salvador" },
  { flag: "🇳🇮", code: "+505", name: "Nicaragua" },
  { flag: "🇨🇷", code: "+506", name: "Costa Rica" },
  { flag: "🇵🇦", code: "+507", name: "Panamá" },
  { flag: "🇨🇴", code: "+57", name: "Colombia" },
  { flag: "🇻🇪", code: "+58", name: "Venezuela" },
  { flag: "🇵🇪", code: "+51", name: "Perú" },
  { flag: "🇪🇨", code: "+593", name: "Ecuador" },
  { flag: "🇨🇺", code: "+53", name: "Cuba" },
  { flag: "🇭🇹", code: "+509", name: "Haití" },
  { flag: "🇵🇷", code: "+1", name: "Puerto Rico", alt: "PR" },
];

function stripNonDigits(val: string) {
  return val.replace(/\D/g, "");
}

function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface NormalizedPhone {
  countryCode: string;
  flag: string;
  localNumber: string;
  fullPhone: string;
  countryIdx: number;
}

function normalizePhone(input: string): NormalizedPhone {
  const digits = input.replace(/\D/g, "");
  if (!digits) return { countryCode: "+1", flag: "🇺🇸", localNumber: "", fullPhone: "", countryIdx: 0 };

  // Rep. Dom. — 809/829/849
  if (/^1?(809|829|849)/.test(digits)) {
    const local = digits.replace(/^1/, "");
    return { countryCode: "+1", flag: "🇩🇴", localNumber: local, fullPhone: "+1" + local, countryIdx: 1 };
  }
  // México
  if (/^52/.test(digits)) {
    const local = digits.slice(2);
    return { countryCode: "+52", flag: "🇲🇽", localNumber: local, fullPhone: "+52" + local, countryIdx: 2 };
  }
  // Guatemala
  if (/^502/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+502", flag: "🇬🇹", localNumber: local, fullPhone: "+502" + local, countryIdx: 3 };
  }
  // Honduras
  if (/^504/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+504", flag: "🇭🇳", localNumber: local, fullPhone: "+504" + local, countryIdx: 4 };
  }
  // El Salvador
  if (/^503/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+503", flag: "🇸🇻", localNumber: local, fullPhone: "+503" + local, countryIdx: 5 };
  }
  // Nicaragua
  if (/^505/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+505", flag: "🇳🇮", localNumber: local, fullPhone: "+505" + local, countryIdx: 6 };
  }
  // Costa Rica
  if (/^506/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+506", flag: "🇨🇷", localNumber: local, fullPhone: "+506" + local, countryIdx: 7 };
  }
  // Panamá
  if (/^507/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+507", flag: "🇵🇦", localNumber: local, fullPhone: "+507" + local, countryIdx: 8 };
  }
  // Colombia
  if (/^57/.test(digits)) {
    const local = digits.slice(2);
    return { countryCode: "+57", flag: "🇨🇴", localNumber: local, fullPhone: "+57" + local, countryIdx: 9 };
  }
  // Venezuela
  if (/^58/.test(digits)) {
    const local = digits.slice(2);
    return { countryCode: "+58", flag: "🇻🇪", localNumber: local, fullPhone: "+58" + local, countryIdx: 10 };
  }
  // Perú
  if (/^51/.test(digits) && !/^(510|511|512|513|514|515|516|517|518|519)/.test(digits.slice(0,3) + "0")) {
    // Only match if starts with 51 and next digit isn't ambiguous with US area codes
    if (digits.length <= 11) {
      const local = digits.slice(2);
      return { countryCode: "+51", flag: "🇵🇪", localNumber: local, fullPhone: "+51" + local, countryIdx: 11 };
    }
  }
  // Ecuador
  if (/^593/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+593", flag: "🇪🇨", localNumber: local, fullPhone: "+593" + local, countryIdx: 12 };
  }
  // Cuba
  if (/^53/.test(digits) && digits.length <= 10) {
    const local = digits.slice(2);
    return { countryCode: "+53", flag: "🇨🇺", localNumber: local, fullPhone: "+53" + local, countryIdx: 13 };
  }
  // Haití
  if (/^509/.test(digits)) {
    const local = digits.slice(3);
    return { countryCode: "+509", flag: "🇭🇹", localNumber: local, fullPhone: "+509" + local, countryIdx: 14 };
  }
  // Puerto Rico — 787/939
  if (/^1?(787|939)/.test(digits)) {
    const local = digits.replace(/^1/, "");
    return { countryCode: "+1", flag: "🇵🇷", localNumber: local, fullPhone: "+1" + local, countryIdx: 15 };
  }
  // USA default
  const local = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  return { countryCode: "+1", flag: "🇺🇸", localNumber: local, fullPhone: "+1" + local, countryIdx: 0 };
}

function parseExistingPhone(phone: string) {
  if (!phone) return { countryIdx: 0, local: "" };
  const result = normalizePhone(phone);
  return { countryIdx: result.countryIdx, local: result.localNumber };
}

export default function StepClient({ data, update, accountId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);

  const parsed = parseExistingPhone(data.client_phone);
  const [countryIdx, setCountryIdx] = useState(parsed.countryIdx);
  const [localNumber, setLocalNumber] = useState(parsed.local);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const prefix = showManual && manualCode ? `+${stripNonDigits(manualCode)}` : COUNTRY_CODES[countryIdx].code;
    update({ client_phone: `${prefix}${digits}` });
  }, [localNumber, countryIdx, showManual, manualCode]);

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
    const p = parseExistingPhone(data.client_phone);
    const currentDigits = stripNonDigits(localNumber);
    if (p.local !== currentDigits) {
      setCountryIdx(p.countryIdx);
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
    setCountryIdx(0);
    setShowManual(false);
    setPhoneDupe(null);
    setPhoneDupeDismissed(false);
    setEmailDupe(null);
  }

  function handleLocalChange(val: string) {
    const digits = stripNonDigits(val);
    if (digits.length <= 15) {
      setLocalNumber(digits);
    }
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

  const selectedCountry = COUNTRY_CODES[countryIdx];
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
                <span>{selectedCountry.flag} {selectedCountry.code}</span>
              )}
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-64 overflow-y-auto border border-border bg-background rounded-xl shadow-lg">
                {COUNTRY_CODES.map((c, idx) => (
                  <button
                    key={`${c.code}-${c.alt || c.name}`}
                    type="button"
                    onClick={() => {
                      setCountryIdx(idx);
                      setShowManual(false);
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 transition-colors text-left ${
                      !showManual && countryIdx === idx ? "bg-secondary/30" : ""
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span className="font-medium">{c.code}</span>
                    <span className="text-muted-foreground text-xs truncate">{c.name}</span>
                  </button>
                ))}
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManual(true);
                      setShowDropdown(false);
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
          <input
            type="tel"
            value={formatPhoneDisplay(localNumber)}
            onChange={e => handleLocalChange(e.target.value)}
            onBlur={checkPhoneDuplicate}
            placeholder="(809) 676-5653"
            className="flex-1 border border-input bg-background rounded-r-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {phoneInvalid && (
          <p className="text-[10px] text-rose-400 mt-1">Mínimo 7 dígitos</p>
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
    </div>
  );
}
