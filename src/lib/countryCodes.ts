export interface CountryCode {
  flag: string;
  code: string;
  name: string;
  /** Area codes that identify this country within a shared dial code (e.g. +1) */
  areaCodes?: string[];
  /** ISO 3166-1 alpha-2 */
  iso: string;
}

/**
 * Frequently-used countries appear first (Latin America / Caribbean),
 * then the rest of the world alphabetically.
 */
export const COUNTRY_CODES: CountryCode[] = [
  // ── Frecuentes ─────────────────────────────────
  { flag: "🇺🇸", code: "+1", name: "Estados Unidos", iso: "US" },
  { flag: "🇩🇴", code: "+1", name: "República Dominicana", iso: "DO", areaCodes: ["809","829","849"] },
  { flag: "🇲🇽", code: "+52", name: "México", iso: "MX" },
  { flag: "🇬🇹", code: "+502", name: "Guatemala", iso: "GT" },
  { flag: "🇭🇳", code: "+504", name: "Honduras", iso: "HN" },
  { flag: "🇸🇻", code: "+503", name: "El Salvador", iso: "SV" },
  { flag: "🇳🇮", code: "+505", name: "Nicaragua", iso: "NI" },
  { flag: "🇨🇷", code: "+506", name: "Costa Rica", iso: "CR" },
  { flag: "🇵🇦", code: "+507", name: "Panamá", iso: "PA" },
  { flag: "🇨🇴", code: "+57", name: "Colombia", iso: "CO" },
  { flag: "🇻🇪", code: "+58", name: "Venezuela", iso: "VE" },
  { flag: "🇵🇪", code: "+51", name: "Perú", iso: "PE" },
  { flag: "🇪🇨", code: "+593", name: "Ecuador", iso: "EC" },
  { flag: "🇨🇺", code: "+53", name: "Cuba", iso: "CU" },
  { flag: "🇭🇹", code: "+509", name: "Haití", iso: "HT" },
  { flag: "🇵🇷", code: "+1", name: "Puerto Rico", iso: "PR", areaCodes: ["787","939"] },

  // ── Resto del mundo (A-Z) ──────────────────────
  { flag: "🇦🇫", code: "+93", name: "Afganistán", iso: "AF" },
  { flag: "🇦🇱", code: "+355", name: "Albania", iso: "AL" },
  { flag: "🇩🇿", code: "+213", name: "Argelia", iso: "DZ" },
  { flag: "🇦🇩", code: "+376", name: "Andorra", iso: "AD" },
  { flag: "🇦🇴", code: "+244", name: "Angola", iso: "AO" },
  { flag: "🇦🇬", code: "+1", name: "Antigua y Barbuda", iso: "AG", areaCodes: ["268"] },
  { flag: "🇦🇷", code: "+54", name: "Argentina", iso: "AR" },
  { flag: "🇦🇲", code: "+374", name: "Armenia", iso: "AM" },
  { flag: "🇦🇺", code: "+61", name: "Australia", iso: "AU" },
  { flag: "🇦🇹", code: "+43", name: "Austria", iso: "AT" },
  { flag: "🇦🇿", code: "+994", name: "Azerbaiyán", iso: "AZ" },
  { flag: "🇧🇸", code: "+1", name: "Bahamas", iso: "BS", areaCodes: ["242"] },
  { flag: "🇧🇭", code: "+973", name: "Baréin", iso: "BH" },
  { flag: "🇧🇩", code: "+880", name: "Bangladés", iso: "BD" },
  { flag: "🇧🇧", code: "+1", name: "Barbados", iso: "BB", areaCodes: ["246"] },
  { flag: "🇧🇾", code: "+375", name: "Bielorrusia", iso: "BY" },
  { flag: "🇧🇪", code: "+32", name: "Bélgica", iso: "BE" },
  { flag: "🇧🇿", code: "+501", name: "Belice", iso: "BZ" },
  { flag: "🇧🇯", code: "+229", name: "Benín", iso: "BJ" },
  { flag: "🇧🇹", code: "+975", name: "Bután", iso: "BT" },
  { flag: "🇧🇴", code: "+591", name: "Bolivia", iso: "BO" },
  { flag: "🇧🇦", code: "+387", name: "Bosnia y Herzegovina", iso: "BA" },
  { flag: "🇧🇼", code: "+267", name: "Botsuana", iso: "BW" },
  { flag: "🇧🇷", code: "+55", name: "Brasil", iso: "BR" },
  { flag: "🇧🇳", code: "+673", name: "Brunéi", iso: "BN" },
  { flag: "🇧🇬", code: "+359", name: "Bulgaria", iso: "BG" },
  { flag: "🇧🇫", code: "+226", name: "Burkina Faso", iso: "BF" },
  { flag: "🇧🇮", code: "+257", name: "Burundi", iso: "BI" },
  { flag: "🇰🇭", code: "+855", name: "Camboya", iso: "KH" },
  { flag: "🇨🇲", code: "+237", name: "Camerún", iso: "CM" },
  { flag: "🇨🇦", code: "+1", name: "Canadá", iso: "CA" },
  { flag: "🇨🇻", code: "+238", name: "Cabo Verde", iso: "CV" },
  { flag: "🇨🇫", code: "+236", name: "Rep. Centroafricana", iso: "CF" },
  { flag: "🇹🇩", code: "+235", name: "Chad", iso: "TD" },
  { flag: "🇨🇱", code: "+56", name: "Chile", iso: "CL" },
  { flag: "🇨🇳", code: "+86", name: "China", iso: "CN" },
  { flag: "🇨🇾", code: "+357", name: "Chipre", iso: "CY" },
  { flag: "🇰🇲", code: "+269", name: "Comoras", iso: "KM" },
  { flag: "🇨🇬", code: "+242", name: "Congo", iso: "CG" },
  { flag: "🇨🇩", code: "+243", name: "R.D. del Congo", iso: "CD" },
  { flag: "🇭🇷", code: "+385", name: "Croacia", iso: "HR" },
  { flag: "🇩🇰", code: "+45", name: "Dinamarca", iso: "DK" },
  { flag: "🇩🇯", code: "+253", name: "Yibuti", iso: "DJ" },
  { flag: "🇩🇲", code: "+1", name: "Dominica", iso: "DM", areaCodes: ["767"] },
  { flag: "🇪🇬", code: "+20", name: "Egipto", iso: "EG" },
  { flag: "🇬🇶", code: "+240", name: "Guinea Ecuatorial", iso: "GQ" },
  { flag: "🇪🇷", code: "+291", name: "Eritrea", iso: "ER" },
  { flag: "🇪🇪", code: "+372", name: "Estonia", iso: "EE" },
  { flag: "🇸🇿", code: "+268", name: "Esuatini", iso: "SZ" },
  { flag: "🇪🇹", code: "+251", name: "Etiopía", iso: "ET" },
  { flag: "🇪🇸", code: "+34", name: "España", iso: "ES" },
  { flag: "🇫🇯", code: "+679", name: "Fiyi", iso: "FJ" },
  { flag: "🇫🇮", code: "+358", name: "Finlandia", iso: "FI" },
  { flag: "🇫🇷", code: "+33", name: "Francia", iso: "FR" },
  { flag: "🇬🇦", code: "+241", name: "Gabón", iso: "GA" },
  { flag: "🇬🇲", code: "+220", name: "Gambia", iso: "GM" },
  { flag: "🇬🇪", code: "+995", name: "Georgia", iso: "GE" },
  { flag: "🇩🇪", code: "+49", name: "Alemania", iso: "DE" },
  { flag: "🇬🇭", code: "+233", name: "Ghana", iso: "GH" },
  { flag: "🇬🇷", code: "+30", name: "Grecia", iso: "GR" },
  { flag: "🇬🇩", code: "+1", name: "Granada", iso: "GD", areaCodes: ["473"] },
  { flag: "🇬🇳", code: "+224", name: "Guinea", iso: "GN" },
  { flag: "🇬🇼", code: "+245", name: "Guinea-Bisáu", iso: "GW" },
  { flag: "🇬🇾", code: "+592", name: "Guyana", iso: "GY" },
  { flag: "🇭🇰", code: "+852", name: "Hong Kong", iso: "HK" },
  { flag: "🇭🇺", code: "+36", name: "Hungría", iso: "HU" },
  { flag: "🇮🇸", code: "+354", name: "Islandia", iso: "IS" },
  { flag: "🇮🇳", code: "+91", name: "India", iso: "IN" },
  { flag: "🇮🇩", code: "+62", name: "Indonesia", iso: "ID" },
  { flag: "🇮🇷", code: "+98", name: "Irán", iso: "IR" },
  { flag: "🇮🇶", code: "+964", name: "Irak", iso: "IQ" },
  { flag: "🇮🇪", code: "+353", name: "Irlanda", iso: "IE" },
  { flag: "🇮🇱", code: "+972", name: "Israel", iso: "IL" },
  { flag: "🇮🇹", code: "+39", name: "Italia", iso: "IT" },
  { flag: "🇯🇲", code: "+1", name: "Jamaica", iso: "JM", areaCodes: ["876","658"] },
  { flag: "🇯🇵", code: "+81", name: "Japón", iso: "JP" },
  { flag: "🇯🇴", code: "+962", name: "Jordania", iso: "JO" },
  { flag: "🇰🇿", code: "+7", name: "Kazajistán", iso: "KZ", areaCodes: ["70","71","72","73","74","75","76","77"] },
  { flag: "🇰🇪", code: "+254", name: "Kenia", iso: "KE" },
  { flag: "🇰🇮", code: "+686", name: "Kiribati", iso: "KI" },
  { flag: "🇰🇼", code: "+965", name: "Kuwait", iso: "KW" },
  { flag: "🇰🇬", code: "+996", name: "Kirguistán", iso: "KG" },
  { flag: "🇱🇦", code: "+856", name: "Laos", iso: "LA" },
  { flag: "🇱🇻", code: "+371", name: "Letonia", iso: "LV" },
  { flag: "🇱🇧", code: "+961", name: "Líbano", iso: "LB" },
  { flag: "🇱🇸", code: "+266", name: "Lesoto", iso: "LS" },
  { flag: "🇱🇷", code: "+231", name: "Liberia", iso: "LR" },
  { flag: "🇱🇾", code: "+218", name: "Libia", iso: "LY" },
  { flag: "🇱🇮", code: "+423", name: "Liechtenstein", iso: "LI" },
  { flag: "🇱🇹", code: "+370", name: "Lituania", iso: "LT" },
  { flag: "🇱🇺", code: "+352", name: "Luxemburgo", iso: "LU" },
  { flag: "🇲🇴", code: "+853", name: "Macao", iso: "MO" },
  { flag: "🇲🇬", code: "+261", name: "Madagascar", iso: "MG" },
  { flag: "🇲🇼", code: "+265", name: "Malaui", iso: "MW" },
  { flag: "🇲🇾", code: "+60", name: "Malasia", iso: "MY" },
  { flag: "🇲🇻", code: "+960", name: "Maldivas", iso: "MV" },
  { flag: "🇲🇱", code: "+223", name: "Malí", iso: "ML" },
  { flag: "🇲🇹", code: "+356", name: "Malta", iso: "MT" },
  { flag: "🇲🇭", code: "+692", name: "Islas Marshall", iso: "MH" },
  { flag: "🇲🇷", code: "+222", name: "Mauritania", iso: "MR" },
  { flag: "🇲🇺", code: "+230", name: "Mauricio", iso: "MU" },
  { flag: "🇲🇩", code: "+373", name: "Moldavia", iso: "MD" },
  { flag: "🇲🇨", code: "+377", name: "Mónaco", iso: "MC" },
  { flag: "🇲🇳", code: "+976", name: "Mongolia", iso: "MN" },
  { flag: "🇲🇪", code: "+382", name: "Montenegro", iso: "ME" },
  { flag: "🇲🇦", code: "+212", name: "Marruecos", iso: "MA" },
  { flag: "🇲🇿", code: "+258", name: "Mozambique", iso: "MZ" },
  { flag: "🇲🇲", code: "+95", name: "Myanmar", iso: "MM" },
  { flag: "🇳🇦", code: "+264", name: "Namibia", iso: "NA" },
  { flag: "🇳🇷", code: "+674", name: "Nauru", iso: "NR" },
  { flag: "🇳🇵", code: "+977", name: "Nepal", iso: "NP" },
  { flag: "🇳🇱", code: "+31", name: "Países Bajos", iso: "NL" },
  { flag: "🇳🇿", code: "+64", name: "Nueva Zelanda", iso: "NZ" },
  { flag: "🇳🇪", code: "+227", name: "Níger", iso: "NE" },
  { flag: "🇳🇬", code: "+234", name: "Nigeria", iso: "NG" },
  { flag: "🇰🇵", code: "+850", name: "Corea del Norte", iso: "KP" },
  { flag: "🇲🇰", code: "+389", name: "Macedonia del Norte", iso: "MK" },
  { flag: "🇳🇴", code: "+47", name: "Noruega", iso: "NO" },
  { flag: "🇴🇲", code: "+968", name: "Omán", iso: "OM" },
  { flag: "🇵🇰", code: "+92", name: "Pakistán", iso: "PK" },
  { flag: "🇵🇼", code: "+680", name: "Palaos", iso: "PW" },
  { flag: "🇵🇸", code: "+970", name: "Palestina", iso: "PS" },
  { flag: "🇵🇬", code: "+675", name: "Papúa Nueva Guinea", iso: "PG" },
  { flag: "🇵🇾", code: "+595", name: "Paraguay", iso: "PY" },
  { flag: "🇵🇭", code: "+63", name: "Filipinas", iso: "PH" },
  { flag: "🇵🇱", code: "+48", name: "Polonia", iso: "PL" },
  { flag: "🇵🇹", code: "+351", name: "Portugal", iso: "PT" },
  { flag: "🇶🇦", code: "+974", name: "Catar", iso: "QA" },
  { flag: "🇷🇴", code: "+40", name: "Rumanía", iso: "RO" },
  { flag: "🇷🇺", code: "+7", name: "Rusia", iso: "RU" },
  { flag: "🇷🇼", code: "+250", name: "Ruanda", iso: "RW" },
  { flag: "🇰🇳", code: "+1", name: "San Cristóbal y Nieves", iso: "KN", areaCodes: ["869"] },
  { flag: "🇱🇨", code: "+1", name: "Santa Lucía", iso: "LC", areaCodes: ["758"] },
  { flag: "🇻🇨", code: "+1", name: "San Vicente", iso: "VC", areaCodes: ["784"] },
  { flag: "🇼🇸", code: "+685", name: "Samoa", iso: "WS" },
  { flag: "🇸🇲", code: "+378", name: "San Marino", iso: "SM" },
  { flag: "🇸🇹", code: "+239", name: "Santo Tomé y Príncipe", iso: "ST" },
  { flag: "🇸🇦", code: "+966", name: "Arabia Saudita", iso: "SA" },
  { flag: "🇸🇳", code: "+221", name: "Senegal", iso: "SN" },
  { flag: "🇷🇸", code: "+381", name: "Serbia", iso: "RS" },
  { flag: "🇸🇨", code: "+248", name: "Seychelles", iso: "SC" },
  { flag: "🇸🇱", code: "+232", name: "Sierra Leona", iso: "SL" },
  { flag: "🇸🇬", code: "+65", name: "Singapur", iso: "SG" },
  { flag: "🇸🇰", code: "+421", name: "Eslovaquia", iso: "SK" },
  { flag: "🇸🇮", code: "+386", name: "Eslovenia", iso: "SI" },
  { flag: "🇸🇧", code: "+677", name: "Islas Salomón", iso: "SB" },
  { flag: "🇸🇴", code: "+252", name: "Somalia", iso: "SO" },
  { flag: "🇿🇦", code: "+27", name: "Sudáfrica", iso: "ZA" },
  { flag: "🇰🇷", code: "+82", name: "Corea del Sur", iso: "KR" },
  { flag: "🇸🇸", code: "+211", name: "Sudán del Sur", iso: "SS" },
  { flag: "🇱🇰", code: "+94", name: "Sri Lanka", iso: "LK" },
  { flag: "🇸🇩", code: "+249", name: "Sudán", iso: "SD" },
  { flag: "🇸🇷", code: "+597", name: "Surinam", iso: "SR" },
  { flag: "🇸🇪", code: "+46", name: "Suecia", iso: "SE" },
  { flag: "🇨🇭", code: "+41", name: "Suiza", iso: "CH" },
  { flag: "🇸🇾", code: "+963", name: "Siria", iso: "SY" },
  { flag: "🇹🇼", code: "+886", name: "Taiwán", iso: "TW" },
  { flag: "🇹🇯", code: "+992", name: "Tayikistán", iso: "TJ" },
  { flag: "🇹🇿", code: "+255", name: "Tanzania", iso: "TZ" },
  { flag: "🇹🇭", code: "+66", name: "Tailandia", iso: "TH" },
  { flag: "🇹🇱", code: "+670", name: "Timor Oriental", iso: "TL" },
  { flag: "🇹🇬", code: "+228", name: "Togo", iso: "TG" },
  { flag: "🇹🇴", code: "+676", name: "Tonga", iso: "TO" },
  { flag: "🇹🇹", code: "+1", name: "Trinidad y Tobago", iso: "TT", areaCodes: ["868"] },
  { flag: "🇹🇳", code: "+216", name: "Túnez", iso: "TN" },
  { flag: "🇹🇷", code: "+90", name: "Turquía", iso: "TR" },
  { flag: "🇹🇲", code: "+993", name: "Turkmenistán", iso: "TM" },
  { flag: "🇹🇻", code: "+688", name: "Tuvalu", iso: "TV" },
  { flag: "🇺🇬", code: "+256", name: "Uganda", iso: "UG" },
  { flag: "🇺🇦", code: "+380", name: "Ucrania", iso: "UA" },
  { flag: "🇦🇪", code: "+971", name: "Emiratos Árabes", iso: "AE" },
  { flag: "🇬🇧", code: "+44", name: "Reino Unido", iso: "GB" },
  { flag: "🇺🇾", code: "+598", name: "Uruguay", iso: "UY" },
  { flag: "🇺🇿", code: "+998", name: "Uzbekistán", iso: "UZ" },
  { flag: "🇻🇺", code: "+678", name: "Vanuatu", iso: "VU" },
  { flag: "🇻🇳", code: "+84", name: "Vietnam", iso: "VN" },
  { flag: "🇾🇪", code: "+967", name: "Yemen", iso: "YE" },
  { flag: "🇿🇲", code: "+260", name: "Zambia", iso: "ZM" },
  { flag: "🇿🇼", code: "+263", name: "Zimbabue", iso: "ZW" },
];

/** Number of "frequent" countries shown at the top before separator */
export const FREQUENT_COUNT = 16;

/**
 * Build a lookup table for auto-detection.
 * Entries with areaCodes get priority matching on areaCode within +1.
 * Otherwise, match by longest dial-code prefix first.
 */
interface PrefixEntry {
  codeDigits: string;
  areaCode?: string;
  idx: number;
}

const prefixTable: PrefixEntry[] = [];
COUNTRY_CODES.forEach((c, idx) => {
  const codeDigits = c.code.replace("+", "");
  if (c.areaCodes) {
    c.areaCodes.forEach(ac => {
      prefixTable.push({ codeDigits, areaCode: ac, idx });
    });
  } else if (idx > 0) {
    // skip US (idx 0) — it's the fallback
    prefixTable.push({ codeDigits, idx });
  }
});
// Sort: longer total prefix first for greedy matching
prefixTable.sort((a, b) => {
  const lenA = a.codeDigits.length + (a.areaCode?.length || 0);
  const lenB = b.codeDigits.length + (b.areaCode?.length || 0);
  return lenB - lenA;
});

export interface NormalizedPhone {
  countryCode: string;
  flag: string;
  localNumber: string;
  fullPhone: string;
  countryIdx: number;
}

export function normalizePhone(input: string): NormalizedPhone {
  const digits = input.replace(/\D/g, "");
  if (!digits) return { countryCode: "+1", flag: "🇺🇸", localNumber: "", fullPhone: "", countryIdx: 0 };

  for (const entry of prefixTable) {
    if (entry.areaCode) {
      // For +1 countries with area codes: match with or without leading 1
      const withOne = entry.codeDigits + entry.areaCode;
      const withoutOne = entry.areaCode; // +1 countries: user may type just area code
      if (digits.startsWith(withOne)) {
        const local = digits.slice(entry.codeDigits.length);
        return {
          countryCode: COUNTRY_CODES[entry.idx].code,
          flag: COUNTRY_CODES[entry.idx].flag,
          localNumber: local,
          fullPhone: "+" + entry.codeDigits + local,
          countryIdx: entry.idx,
        };
      }
      if (entry.codeDigits === "1" && digits.startsWith(withoutOne)) {
        return {
          countryCode: "+1",
          flag: COUNTRY_CODES[entry.idx].flag,
          localNumber: digits,
          fullPhone: "+1" + digits,
          countryIdx: entry.idx,
        };
      }
    } else {
      if (digits.startsWith(entry.codeDigits)) {
        const local = digits.slice(entry.codeDigits.length);
        return {
          countryCode: COUNTRY_CODES[entry.idx].code,
          flag: COUNTRY_CODES[entry.idx].flag,
          localNumber: local,
          fullPhone: "+" + entry.codeDigits + local,
          countryIdx: entry.idx,
        };
      }
    }
  }

  // Fallback: US
  const local = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  return { countryCode: "+1", flag: "🇺🇸", localNumber: local, fullPhone: "+1" + local, countryIdx: 0 };
}

export function parseExistingPhone(phone: string) {
  if (!phone) return { countryIdx: 0, local: "" };
  const result = normalizePhone(phone);
  return { countryIdx: result.countryIdx, local: result.localNumber };
}
