import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";

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
 * Parse an international number that starts with "+".
 * ONLY called when user explicitly types "+".
 */
export function detectInternational(input: string): PhoneDetectResult | null {
  const raw = input.replace(/[^\d+]/g, "");
  if (!raw.startsWith("+") || raw.length < 4) return null;

  try {
    const parsed = parsePhoneNumber(raw);
    if (parsed) {
      return {
        countryCode: "+" + parsed.countryCallingCode,
        flag: getFlag(parsed.country || "US"),
        country: parsed.country || "US",
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
      return {
        countryCode: "+" + parsed.countryCallingCode,
        flag: getFlag(parsed.country || countryIso),
        country: parsed.country || countryIso,
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
 */
export function parseExisting(phone: string): { country: string; flag: string; code: string; local: string } {
  if (!phone) return { country: "US", flag: "🇺🇸", code: "+1", local: "" };
  const clean = phone.startsWith("+") ? phone : "+" + phone.replace(/\D/g, "");
  try {
    const parsed = parsePhoneNumber(clean);
    if (parsed) {
      return {
        country: parsed.country || "US",
        flag: getFlag(parsed.country || "US"),
        code: "+" + parsed.countryCallingCode,
        local: parsed.nationalNumber as string,
      };
    }
  } catch { /* fall through */ }
  const digits = phone.replace(/\D/g, "");
  return { country: "US", flag: "🇺🇸", code: "+1", local: digits };
}
