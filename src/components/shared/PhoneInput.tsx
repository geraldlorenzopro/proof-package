import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, AlertTriangle, X } from "lucide-react";
import { COUNTRY_CODES, FREQUENT_COUNT } from "@/lib/countryCodes";
import { formatNational, PHONE_LABELS } from "@/lib/phoneDetect";

export interface PhoneInputProps {
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

export default function PhoneInput({
  label, phoneLabel, onPhoneLabelChange,
  selectedCountry, selectedCode, selectedFlag,
  localDigits, isInternationalMode, rawInput,
  phoneValid, onCountrySelect, onPhoneChange, onPhoneBlur,
  onRemove,
}: PhoneInputProps) {
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
      {/* Unified container with focus-within */}
      <div className="flex rounded-xl border border-input bg-background transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring">
        {/* Country dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button type="button" onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 px-2.5 py-2.5 hover:bg-secondary/50 transition-colors rounded-l-xl">
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

        {/* Divider */}
        <div className="w-px bg-input self-stretch my-1.5" />

        {/* Country code prefix */}
        {!isInternationalMode && (
          <div className="flex items-center px-2 py-2.5">
            <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">{selectedCode}</span>
          </div>
        )}

        {/* Phone input */}
        <div className="relative flex-1">
          <input type="tel" value={displayValue}
            onChange={e => onPhoneChange(e.target.value)} onBlur={onPhoneBlur}
            placeholder={isInternationalMode ? "+57 312 456 7890" : "Número de teléfono"}
            className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none pr-8" />
          {phoneValid === true && localDigits.length >= 7 && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
          {phoneValid === false && (localDigits.length >= 7 || (isInternationalMode && rawInput.length >= 4)) && <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />}
        </div>

        {/* Divider */}
        <div className="w-px bg-input self-stretch my-1.5" />

        {/* Phone type selector */}
        <div className="relative" ref={labelRef}>
          <button type="button" onClick={() => setShowLabelPicker(!showLabelPicker)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm hover:bg-secondary/50 transition-colors min-w-[100px] rounded-r-xl">
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
      <p className="text-[10px] text-muted-foreground mt-1">Usa la bandera para cambiar país o escribe + para internacional</p>
      {phoneInvalid && <p className="text-[10px] text-destructive mt-1">Mínimo 7 dígitos</p>}
      {phoneValid === false && localDigits.length >= 7 && <p className="text-[10px] text-yellow-400 mt-1">⚠️ Número no válido para {selectedCountry}</p>}
    </div>
  );
}
