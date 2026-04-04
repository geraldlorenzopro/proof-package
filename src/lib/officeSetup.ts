import { supabase } from "@/integrations/supabase/client";

const STANDARD_CASE_TYPES = [
  { case_type: 'adjustment-of-status', display_name: 'Adjustment of Status', main_form: 'I-485', icon: '🟢', sort_order: 1 },
  { case_type: 'naturalization', display_name: 'Ciudadanía / Naturalización', main_form: 'N-400', icon: '🇺🇸', sort_order: 2 },
  { case_type: 'vawa-u-visa', display_name: 'VAWA / U-Visa / T-Visa', main_form: 'I-360', icon: '🛡️', sort_order: 3 },
  { case_type: 'removal-defense', display_name: 'Removal Defense', main_form: '42B/42A', icon: '⚖️', sort_order: 4 },
  { case_type: 'asylum', display_name: 'Asylum', main_form: 'I-589', icon: '🤝', sort_order: 5 },
  { case_type: 'work-visa', display_name: 'Visas de Trabajo', main_form: 'I-129', icon: '💼', sort_order: 6 },
  { case_type: 'daca-tps', display_name: 'DACA / TPS', main_form: 'I-821D', icon: '🔄', sort_order: 7 },
  { case_type: 'consular-b1b2', display_name: 'Consular / B1-B2', main_form: 'DS-160', icon: '✈️', sort_order: 8 },
  { case_type: 'ead-renewal', display_name: 'Renovación EAD', main_form: 'I-765', icon: '📋', sort_order: 9 },
  { case_type: 'green-card-renewal', display_name: 'Renovación Green Card', main_form: 'I-90', icon: '💳', sort_order: 10 },
  { case_type: 'removal-of-conditions', display_name: 'Remoción de Condiciones', main_form: 'I-751', icon: '🔓', sort_order: 11 },
  { case_type: 'extension-of-status', display_name: 'Extensión de Estatus', main_form: 'I-539', icon: '⏳', sort_order: 12 },
  { case_type: 'family-petition', display_name: 'Petición Familiar', main_form: 'I-130', icon: '👨‍👩‍👧', sort_order: 13 },
  { case_type: 'affidavit-support', display_name: 'Affidavit of Support', main_form: 'I-864', icon: '📝', sort_order: 14 },
  { case_type: 'travel-document', display_name: 'Travel Document', main_form: 'I-131', icon: '🛂', sort_order: 15 },
  { case_type: 'waiver', display_name: 'Waiver', main_form: 'I-601/I-601A', icon: '🔑', sort_order: 16 },
];

const AI_CASE_TYPES = new Set([
  'adjustment-of-status', 'naturalization', 'vawa-u-visa', 'removal-defense',
  'asylum', 'work-visa', 'daca-tps', 'consular-b1b2', 'ead-renewal',
]);

const DEFAULT_CONSULTATIONS = [
  { name: 'Consulta Inicial', duration_minutes: 30, price: 150, sort_order: 1 },
  { name: 'Consulta de Seguimiento', duration_minutes: 20, price: 75, sort_order: 2 },
  { name: 'Evaluación de Elegibilidad', duration_minutes: 45, price: 200, sort_order: 3 },
];

export { STANDARD_CASE_TYPES, AI_CASE_TYPES, DEFAULT_CONSULTATIONS };

export async function initializeOfficeConfig(accountId: string) {
  // 1. Upsert office_config
  const { error: ocErr } = await supabase
    .from('office_config')
    .upsert({ account_id: accountId }, { onConflict: 'account_id' });
  if (ocErr) console.error('office_config upsert error', ocErr);

  // 2. Insert standard case types
  for (const ct of STANDARD_CASE_TYPES) {
    await supabase.from('active_case_types').upsert(
      { account_id: accountId, ...ct, is_active: true, is_custom: false },
      { onConflict: 'account_id,case_type' }
    );
  }

  // 3. Insert default consultations (only if none exist)
  const { data: existing } = await supabase
    .from('consultation_types')
    .select('id')
    .eq('account_id', accountId)
    .limit(1);

  if (!existing || existing.length === 0) {
    for (const c of DEFAULT_CONSULTATIONS) {
      await supabase.from('consultation_types').insert({ account_id: accountId, ...c });
    }
  }
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','GU','VI','AS','MP',
];

export const TIMEZONES = [
  { value: 'America/New_York', label: 'EST/EDT — New York' },
  { value: 'America/Chicago', label: 'CST/CDT — Chicago' },
  { value: 'America/Denver', label: 'MST/MDT — Denver' },
  { value: 'America/Los_Angeles', label: 'PST/PDT — Los Angeles' },
  { value: 'America/Santo_Domingo', label: 'AST — Santo Domingo' },
  { value: 'America/Bogota', label: 'COT — Bogotá' },
  { value: 'America/Mexico_City', label: 'CST/CDT — Ciudad de México' },
  { value: 'America/Lima', label: 'PET — Lima' },
  { value: 'America/Argentina/Buenos_Aires', label: 'ART — Buenos Aires' },
];
