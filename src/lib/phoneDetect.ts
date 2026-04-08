import { parsePhoneNumber, CountryCode } from "libphonenumber-js";

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
  countryCode: string;   // e.g. "+34"
  flag: string;          // e.g. "🇪🇸"
  country: string;       // ISO e.g. "ES"
  localNumber: string;   // national digits
  fullPhone: string;     // E.164
  isValid: boolean;
}

const DR_AREA = /^(809|829|849)/;

/**
 * Detect and normalize a phone number from raw digits.
 * Tries to parse with '+' prefix first; for 10-digit numbers
 * prioritizes Dominican Republic area codes, then defaults to US.
 */
export function detectPhone(input: string): PhoneDetectResult {
  const digits = input.replace(/\D/g, "");
  if (!digits) return { countryCode: "+1", flag: "🇺🇸", country: "US", localNumber: "", fullPhone: "", isValid: false };

  // 10 digits — check DR area codes first (primary market), then US
  if (digits.length === 10 && DR_AREA.test(digits)) {
    return { countryCode: "+1", flag: "🇩🇴", country: "DO", localNumber: digits, fullPhone: "+1" + digits, isValid: true };
  }
  if (digits.length === 10) {
    return { countryCode: "+1", flag: "🇺🇸", country: "US", localNumber: digits, fullPhone: "+1" + digits, isValid: true };
  }

  // For anything else, try parsing as international with + prefix
  try {
    const parsed = parsePhoneNumber("+" + digits);
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

  // Fallback — default US
  return { countryCode: "+1", flag: "🇺🇸", country: "US", localNumber: digits, fullPhone: "+1" + digits, isValid: false };
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
  // Fallback
  const digits = phone.replace(/\D/g, "");
  return { country: "US", flag: "🇺🇸", code: "+1", local: digits };
}
