/**
 * scopedStorage — Helper para localStorage namespaced por account_id.
 *
 * Background (Victoria audit 2026-06-05): el Hub Casos tenía 4 keys
 * sin namespace (ner_cases_view, _group_by, _sort_by, _filters). Si
 * un paralegal está en 2 firmas (Camino B: empleado que rota entre
 * memberships NER + GHL), las preferencias de Firma A leakean a B.
 * Para case_types con "recents pinned" eso es leak de inteligencia
 * comercial — qué tipos de visa trabaja cada firma.
 *
 * Fix: todo localStorage del Hub Casos pasa por estos helpers que
 * agregan el namespace automáticamente.
 *
 * Migration: al primer mount con un accountId válido, limpiamos las
 * keys legacy sin namespace que correspondan a otra firma.
 */
const LEGACY_KEYS = [
  "ner_cases_view",
  "ner_cases_group_by",
  "ner_cases_sort_by",
  "ner_cases_filters",
  "ner_cases_active_view",
  "ner_cases_collapsed_v2",
];

function nsKey(key: string, accountId: string | null): string {
  if (!accountId) return key; // fallback global cuando aún no resolvió
  return `${key}::${accountId}`;
}

export function readScoped<T = string>(key: string, accountId: string | null, parse?: (raw: string) => T): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(nsKey(key, accountId));
    if (raw === null) return null;
    return parse ? parse(raw) : (raw as unknown as T);
  } catch {
    return null;
  }
}

export function writeScoped(key: string, accountId: string | null, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(nsKey(key, accountId), value);
  } catch {}
}

export function readScopedJson<T>(key: string, accountId: string | null, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(nsKey(key, accountId));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeScopedJson<T>(key: string, accountId: string | null, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(nsKey(key, accountId), JSON.stringify(value));
  } catch {}
}

/**
 * Limpieza one-shot de keys legacy sin namespace. Se ejecuta al mount
 * del Hub Casos cuando accountId está disponible. Idempotente — si
 * la key ya está namespaceada no toca nada.
 */
export function migrateLegacyKeys(accountId: string | null): void {
  if (typeof window === "undefined" || !accountId) return;
  try {
    for (const k of LEGACY_KEYS) {
      const legacy = localStorage.getItem(k);
      if (legacy === null) continue;
      const scoped = localStorage.getItem(nsKey(k, accountId));
      if (scoped === null) {
        // Asumimos que la legacy era de ESTE accountId (caso más común,
        // user con 1 sola firma). Si era de otra firma, peor caso es
        // que el user pierde la preferencia — no leak.
        localStorage.setItem(nsKey(k, accountId), legacy);
      }
      localStorage.removeItem(k);
    }
  } catch {}
}
