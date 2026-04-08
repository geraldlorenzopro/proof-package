import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";
import { COUNTRY_CODES } from "./countryCodes";

const FLAG_MAP: Record<string, string> = {
  US:"🇺🇸",DO:"🇩🇴",MX:"🇲🇽",GT:"🇬🇹",HN:"🇭🇳",SV:"🇸🇻",NI:"🇳🇮",CR:"🇨🇷",
  PA:"🇵🇦",CO:"🇨🇴",VE:"🇻🇪",PE:"🇵🇪",EC:"🇪🇨",CU:"🇨🇺",HT:"🇭🇹",PR:"🇵🇷",
  ES:"🇪🇸",BR:"🇧🇷",AR:"🇦🇷",CL:"🇨🇱",BO:"🇧🇴",PY:"🇵🇾",UY:"🇺🇾",GB:"🇬🇧",
  FR:"🇫🇷",DE:"🇩🇪",IT:"🇮🇹",PT:"🇵🇹",CA:"🇨🇦",JP:"🇯🇵",CN:"🇨🇳",KR:"🇰🇷",
  IN:"🇮🇳",AU:"🇦🇺",RU:"🇷🇺",ZA:"🇿🇦",NG:"🇳🇬",EG:"🇪🇬",AE:"🇦🇪",SA:"🇸🇦",
  IL:"🇮🇱",TR:"🇹🇷",PH:"🇵🇭",TH:"🇹🇭",VN:"🇻🇳",ID:"🇮🇩",MY:"🇲🇾",SG:"🇸🇬",
  NZ:"🇳🇿",SE:"🇸🇪",NO:"🇳🇴",DK:"🇩🇰",FI:"🇫🇮",NL:"🇳🇱",BE:"🇧🇪",CH:"🇨🇭",
  AT:"🇦🇹",PL:"🇵🇱",CZ:"🇨🇿",RO:"🇷🇴",UA:"🇺🇦",GR:"🇬🇷",IE:"🇮🇪",HU:"🇭🇺",
  KZ:"🇰🇿",PK:"🇵🇰",BD:"🇧🇩",LK:"🇱🇰",KE:"🇰🇪",GH:"🇬🇭",TZ:"🇹🇿",UG:"🇺🇬",
  JM:"🇯🇲",TT:"🇹🇹",BB:"🇧🇧",GY:"🇬🇾",SR:"🇸🇷",BZ:"🇧🇿",
};

export function getFlag(iso: string): string {
  return FLAG_MAP[iso] || "🌐";
}

export interface PhoneDetectResult {
  countryCode: string;
  flag: string;
  country: string;
  localNumber: string;
  fullPhone: string;
  isValid: boolean;
}

/**
 * NANP disambiguation: For +1 numbers, check the area code (first 3 digits
 * of the national number) against known Caribbean/territory area codes.
 * If no match → default to US.
 */
function resolveNanpCountry(nationalNumber: string): string {
  const areaCode = nationalNumber.slice(0, 3);
  const nanpCountries = COUNTRY_CODES.filter(c => c.code === "+1" && c.areaCodes?.length);
  for (const cc of nanpCountries) {
    if (cc.areaCodes!.includes(areaCode)) return cc.iso;
  }
  return "US"; // Default for +1 numbers without a matching area code
}

/**
 * Parse an international number that starts with "+".
 * ONLY called when user explicitly types "+".
 */
export function detectInternational(input: string): PhoneDetectResult | null {
  const raw = input.replace(/[^\d+]/g, "");
  if (!raw.startsWith("+") || raw.length < 4) return null;

  try {
    const parsed = parsePhoneNumber(raw);
    if (parsed) {
      const baseCountry = (parsed.country || "US") as string;
      // NANP fix: libphonenumber may return "US" for all +1 numbers
      // We use area code disambiguation to get the correct country
      const country = parsed.countryCallingCode === "1"
        ? resolveNanpCountry(parsed.nationalNumber as string)
        : baseCountry;
      return {
        countryCode: "+" + parsed.countryCallingCode,
        flag: getFlag(country),
        country,
        localNumber: parsed.nationalNumber as string,
        fullPhone: parsed.format("E.164"),
        isValid: parsed.isValid(),
      };
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * Validate a local number for the country selected in the dropdown.
 * The dropdown country is the SOURCE OF TRUTH when no "+" is present.
 * Returns E.164 formatted phone.
 */
export function validateForCountry(
  localDigits: string,
  countryIso: string,
  dialCode: string
): PhoneDetectResult {
  const digits = localDigits.replace(/\D/g, "");
  const flag = getFlag(countryIso);

  if (!digits) {
    return { countryCode: dialCode, flag, country: countryIso, localNumber: "", fullPhone: "", isValid: false };
  }

  try {
    const parsed = parsePhoneNumber(digits, countryIso as CountryCode);
    if (parsed) {
      // IMPORTANT: Keep the user-selected country as truth — do NOT override
      return {
        countryCode: "+" + parsed.countryCallingCode,
        flag,
        country: countryIso,
        localNumber: parsed.nationalNumber as string,
        fullPhone: parsed.format("E.164"),
        isValid: parsed.isValid(),
      };
    }
  } catch { /* fall through */ }

  // Fallback — concat without truncation
  return {
    countryCode: dialCode,
    flag,
    country: countryIso,
    localNumber: digits,
    fullPhone: dialCode + digits,
    isValid: false,
  };
}

/**
 * Format a national number for display using libphonenumber-js.
 * Falls back to raw digits if parsing fails.
 */
export function formatNational(digits: string, countryIso: string): string {
  if (!digits) return "";
  try {
    const parsed = parsePhoneNumber(digits, countryIso as CountryCode);
    if (parsed) {
      return parsed.formatNational();
    }
  } catch { /* fall through */ }
  return digits;
}

/**
 * Parse an existing E.164 phone string into country + local.
 * Uses NANP area code disambiguation for +1 numbers.
 */
export function parseExisting(phone: string): { country: string; flag: string; code: string; local: string } {
  if (!phone) return { country: "US", flag: "🇺🇸", code: "+1", local: "" };
  const clean = phone.startsWith("+") ? phone : "+" + phone.replace(/\D/g, "");
  try {
    const parsed = parsePhoneNumber(clean);
    if (parsed) {
      const baseCountry2 = (parsed.country || "US") as string;
      // NANP disambiguation
      const country = parsed.countryCallingCode === "1"
        ? resolveNanpCountry(parsed.nationalNumber as string)
        : baseCountry2;
      return {
        country,
        flag: getFlag(country),
        code: "+" + parsed.countryCallingCode,
        local: parsed.nationalNumber as string,
      };
    }
  } catch { /* fall through */ }
  const digits = phone.replace(/\D/g, "");
  return { country: "US", flag: "🇺🇸", code: "+1", local: digits };
}

/** Phone label/type options */
export const PHONE_LABELS = [
  { key: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { key: "mobile", label: "Móvil", emoji: "📱" },
  { key: "home", label: "Casa", emoji: "🏠" },
  { key: "work", label: "Trabajo", emoji: "💼" },
  { key: "landline", label: "Tel. fijo", emoji: "☎️" },
] as const;

export type PhoneLabel = typeof PHONE_LABELS[number]["key"];

/**
 * Try to detect a country from raw digits (no "+" prefix).
 * Strategy:
 * 1. For 10-digit numbers, try +1{digits} (NANP) and check if the area code
 *    maps to a non-US Caribbean/territory country.
 * 2. For any length, try +{digits} and see if libphonenumber finds a valid match.
 * Only returns if the detected country differs from the currently selected one.
 */
export function detectFromDigits(
  digits: string,
  currentCountry: string
): PhoneDetectResult | null {
  if (!digits || digits.length < 8) return null;

  // Strategy 1: 10-digit NANP — try +1{digits} for Caribbean area codes
  if (digits.length === 10) {
    const areaCode = digits.slice(0, 3);
    const nanpCountries = COUNTRY_CODES.filter(c => c.code === "+1" && c.areaCodes?.length);
    for (const cc of nanpCountries) {
      if (cc.areaCodes!.includes(areaCode)) {
        // This area code belongs to a non-US NANP country
        const attempt = detectInternational("+1" + digits);
        if (attempt && attempt.isValid) {
          // Override country to the correct one
          attempt.country = cc.iso;
          attempt.flag = getFlag(cc.iso);
          if (attempt.country !== currentCountry) return attempt;
        }
        break;
      }
    }
  }

  // Strategy 2: Try +{digits} directly for non-NANP international
  if (digits.length >= 10) {
    const attempt = detectInternational("+" + digits);
    if (attempt && attempt.isValid && attempt.country !== currentCountry) {
      return attempt;
    }
  }

  return null;
}
