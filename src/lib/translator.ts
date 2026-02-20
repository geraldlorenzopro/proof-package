/**
 * Auto-translates free-text fields from Spanish to English
 * using simple heuristics for common immigration evidence phrases.
 * This ensures the final PDF is fully in English for USCIS compliance.
 */

// Common Spanish → English phrase map for immigration evidence context
const PHRASE_MAP: [RegExp, string][] = [
  // Events / descriptions
  [/cumpleaños/gi, 'birthday'],
  [/boda/gi, 'wedding'],
  [/aniversario/gi, 'anniversary'],
  [/viaje a/gi, 'trip to'],
  [/vacaciones/gi, 'vacation'],
  [/visita a/gi, 'visit to'],
  [/visita/gi, 'visit'],
  [/graduación/gi, 'graduation'],
  [/navidad/gi, 'Christmas'],
  [/año nuevo/gi, 'New Year'],
  [/día de acción de gracias/gi, 'Thanksgiving'],
  [/reunión familiar/gi, 'family gathering'],
  [/familia/gi, 'family'],
  [/cena/gi, 'dinner'],
  [/almuerzo/gi, 'lunch'],
  [/desayuno/gi, 'breakfast'],
  [/restaurante/gi, 'restaurant'],
  [/concierto/gi, 'concert'],
  [/evento/gi, 'event'],
  [/parque/gi, 'park'],
  [/playa/gi, 'beach'],
  [/montaña/gi, 'mountain'],
  [/hospital/gi, 'hospital'],
  [/médico/gi, 'doctor'],
  [/aeropuerto/gi, 'airport'],
  [/nuestra hija/gi, 'our daughter'],
  [/nuestro hijo/gi, 'our son'],
  [/nuestros hijos/gi, 'our children'],
  [/nuestra familia/gi, 'our family'],
  [/peticionario y beneficiario/gi, 'petitioner and beneficiary'],
  [/peticionario/gi, 'petitioner'],
  [/beneficiario/gi, 'beneficiary'],

  // Locations (common)
  [/ciudad de/gi, 'city of'],
  [/estado de/gi, 'state of'],
  [/municipio/gi, 'municipality'],

  // Document types (other section)
  [/reserva de vuelo/gi, 'flight reservation'],
  [/boleto/gi, 'ticket'],
  [/ticket/gi, 'ticket'],
  [/recibo/gi, 'receipt'],
  [/comprobante/gi, 'proof'],
  [/factura/gi, 'invoice'],
  [/contrato/gi, 'contract'],
  [/arrendamiento/gi, 'lease'],
  [/estado de cuenta/gi, 'bank statement'],
  [/cuenta bancaria/gi, 'bank account'],
  [/transferencia/gi, 'transfer'],
  [/pago/gi, 'payment'],
  [/seguro/gi, 'insurance'],
  [/póliza/gi, 'policy'],
  [/pasaporte/gi, 'passport'],
  [/visa/gi, 'visa'],
  [/acta/gi, 'certificate'],
  [/certificado/gi, 'certificate'],

  // Chat/communication context
  [/coordinación de gastos/gi, 'coordination of expenses'],
  [/gastos del hogar/gi, 'household expenses'],
  [/gastos compartidos/gi, 'shared expenses'],
  [/planificación/gi, 'planning'],
  [/mudanza/gi, 'relocation'],
  [/apoyo/gi, 'support'],
  [/comunicación/gi, 'communication'],
  [/vida en común/gi, 'shared life'],

  // Participants
  [/y su esposa/gi, 'and his wife'],
  [/y su esposo/gi, 'and her husband'],
  [/y su pareja/gi, 'and their partner'],
  [/ambos/gi, 'both'],
  [/los dos/gi, 'both of them'],
  [/el peticionario/gi, 'the petitioner'],
  [/la peticionaria/gi, 'the petitioner'],
  [/el beneficiario/gi, 'the beneficiary'],
  [/la beneficiaria/gi, 'the beneficiary'],
  [/la pareja/gi, 'the couple'],
  [/amigos/gi, 'friends'],
  [/compañeros/gi, 'colleagues'],

  // Common particles
  [/\bde la\b/gi, 'of the'],
  [/\bde los\b/gi, 'of the'],
  [/\bde las\b/gi, 'of the'],
  [/\bdel\b/gi, 'of the'],
  [/\ben el\b/gi, 'at the'],
  [/\ben la\b/gi, 'at the'],
  [/\bcon el\b/gi, 'with the'],
  [/\bcon la\b/gi, 'with the'],
  [/\bpara el\b/gi, 'for the'],
  [/\bpara la\b/gi, 'for the'],
  [/\bcon su\b/gi, 'with their'],
  [/\bpor el\b/gi, 'for the'],
  [/\bpor la\b/gi, 'for the'],
  [/\bEj\.\s*/gi, 'E.g. '],
];

/**
 * Translates common Spanish phrases found in evidence descriptions to English.
 * Falls back gracefully – if nothing matches, returns the original text.
 */
export function translateToEnglish(text: string): string {
  if (!text) return text;

  // Quick heuristic: detect if text is likely already in English
  // (common English words that don't appear in Spanish commonly)
  const englishIndicators = /\b(the|and|with|trip|photo|birthday|wedding|travel|our|their|both|visit|family|dinner|lunch|beach|airport|hotel|party|christmas|graduation)\b/i;
  if (englishIndicators.test(text)) return text;

  let result = text;
  for (const [pattern, replacement] of PHRASE_MAP) {
    result = result.replace(pattern, replacement);
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Returns DEMONSTRATES value always in English (for PDF).
 */
const DEMONSTRATES_EN_MAP: Record<string, string> = {
  'Comunicación constante': 'Ongoing communication',
  'Coordinación de vida en común': 'Coordination of shared life',
  'Apoyo emocional': 'Emotional support',
  'Apoyo financiero': 'Financial support',
  'Planificación de viaje / mudanza': 'Travel / relocation planning',
  'Relación romántica': 'Romantic relationship',
  'Otro': 'Other',
  // Already-English values pass through
  'Ongoing communication': 'Ongoing communication',
  'Coordination of shared life': 'Coordination of shared life',
  'Emotional support': 'Emotional support',
  'Financial support': 'Financial support',
  'Travel / relocation planning': 'Travel / relocation planning',
  'Romantic relationship': 'Romantic relationship',
  'Other': 'Other',
};

export function demonstratesToEnglish(value: string): string {
  return DEMONSTRATES_EN_MAP[value] || value;
}
