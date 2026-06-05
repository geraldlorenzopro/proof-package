import { getCaseTypeByKey } from "./caseTypes";

/**
 * Labels LEGACY — solo para case_types antiguos en DB que no migraron
 * a las keys nuevas del catálogo. Antes de buscar acá, se resuelve
 * contra CASE_TYPES (104 entries). Auditoría 2026-06-05.
 */
export const CASE_TYPE_LABELS: Record<string, string> = {
  'naturalization': 'Naturalización',
  'family-petition': 'Petición Familiar',
  'adjustment-of-status': 'Ajuste de Estatus',
  'I-130': 'I-130 · Petición Familiar',
  'I-130/I-485 AOS': 'I-130/I-485 · Ajuste de Estatus',
  'I-485': 'I-485 · Ajuste de Estatus',
  'I-765': 'I-765 · Permiso de Trabajo',
  'I-131': 'I-131 · Advance Parole',
  'I-864': 'I-864 · Declaración de Sostenimiento',
  'I-751': 'I-751 · Remover Condición',
  'I-360': 'I-360 · VAWA',
  'I-539': 'I-539 · Extensión de Estatus',
  'I-90': 'I-90 · Renovación de Green Card',
  'N-400': 'N-400 · Naturalización',
  'removal-defense': 'Defensa de Remoción',
  'asylum': 'Asilo',
  'daca-tps': 'DACA / TPS',
  'ead-renewal': 'Renovación de EAD',
  'work-visa': 'Visa de Trabajo',
  'waiver': 'Waiver',
  'consular': 'Proceso Consular',
  'vawa': 'VAWA',
  'u-visa': 'U-Visa',
  'general': 'General',
  'consultation': 'Consulta inicial requerida',
};

export function getCaseTypeLabel(caseType: string): string {
  if (!caseType) return 'General';
  // 1. Catálogo nuevo (CASE_TYPES, 104 entries) — fuente de verdad
  const meta = getCaseTypeByKey(caseType);
  if (meta) return meta.shortLabel;
  // 2. Direct match en mapa legacy
  if (CASE_TYPE_LABELS[caseType]) return CASE_TYPE_LABELS[caseType];
  // 3. Normalize: lowercase + replace spaces with hyphens
  const normalized = caseType.toLowerCase().replace(/\s+/g, '-');
  if (CASE_TYPE_LABELS[normalized]) return CASE_TYPE_LABELS[normalized];
  // 4. Fallback: devolver el raw — visible para que se note el gap
  return caseType;
}

export function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
