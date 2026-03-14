/**
 * Visa B1/B2 Avatar Classification & Scoring Engine
 * Based on 9 FAM 402.2-2 consular manual logic
 * 34 avatars across 8 groups
 */

// ── Types ──────────────────────────────────────────────
export interface VisaEvalAnswers {
  // Step 1 — Personal
  age: number;
  gender: 'male' | 'female' | 'other';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'cohabiting';
  hasChildren: boolean;
  childrenAges?: string; // 'minor' | 'adult' | 'both'
  livingSituation: 'alone' | 'with_parents' | 'with_partner' | 'with_family';
  travelCompanion: 'alone' | 'both_parents' | 'one_parent' | 'relatives' | 'partner' | 'family';
  travelPurpose: 'tourism' | 'education' | 'business' | 'medical' | 'visit_partner' | 'visit_family' | 'event';

  // Step 2 — Estabilidad
  employmentStatus: 'employed' | 'self_employed' | 'unemployed' | 'student' | 'retired' | 'part_time';
  employmentType?: 'private' | 'public' | 'freelance' | 'family_business' | 'informal';
  jobTenure?: 'less_1yr' | '1_3yr' | '3_5yr' | 'over_5yr';
  hasRegisteredBusiness?: boolean;
  monthlyIncome: 'none' | 'low' | 'medium' | 'high' | 'very_high';
  isStudying: boolean;
  educationLevel: 'none' | 'high_school' | 'university_current' | 'university_recent' | 'university' | 'postgrad';
  incomeStability: 'stable' | 'irregular' | 'none';
  partnerOccupation?: 'employed' | 'self_employed' | 'student' | 'homemaker' | 'unemployed' | 'retired';

  // Step 3 — Arraigo
  ownsProperty: boolean;
  propertyType?: 'house' | 'land' | 'commercial' | 'multiple';
  ownsVehicle: boolean;
  hasBankAccounts: boolean;
  hasInvestments: boolean;
  familyInHomeCountry: 'strong' | 'moderate' | 'weak';
  communityTies: 'strong' | 'moderate' | 'weak';
  hasDependents: boolean;

  // Step 4 — Viajes
  familyInUSA: boolean;
  familyPetitionPending?: boolean;
  familyHasVisa: boolean;
  familyVisaUsage?: 'short_trips' | 'long_trips' | 'mixed' | 'never_used';
  previousVisaApproved: boolean;
  previousUSTravel: boolean;
  travelHistory: 'none' | 'regional' | 'international' | 'extensive';
  complianceRecord: 'perfect' | 'minor_issues' | 'overstay' | 'unknown';
  tripDuration: 'short' | 'medium' | 'long';
  tripFinancedBy: 'self' | 'family_local' | 'family_usa' | 'employer' | 'other';

  // Step 5 — Historial
  previousDenials: number;
  mostRecentDenial?: 'less_1yr' | '1_3yr' | 'over_3yr' | 'none';
  employmentGaps: boolean;
  inconsistencies: boolean;
  criminalRecord: boolean;
}

export interface AvatarResult {
  code: string;
  group: string;
  label: string;
  description: string;
  riskFactors: string[];
  strengths: string[];
}

export interface ScoreBreakdown {
  arraigo_economico: number;     // max 25
  arraigo_familiar: number;      // max 25
  estabilidad: number;           // max 20
  viajes: number;                // max 20
  historial: number;             // max 10
  penalties: number;             // negative
  total: number;                 // 0-100
  coherenceFlags: string[];
}

export interface EvalResult {
  avatar: AvatarResult;
  score: ScoreBreakdown;
  riskLevel: 'high' | 'medium' | 'low';
  recommendation: string;
}

// ── Avatar Definitions ──────────────────────────────────
const AVATARS: Record<string, Omit<AvatarResult, 'riskFactors' | 'strengths'>> = {
  A1: { code: 'A1', group: 'A', label: 'Menor viajando con ambos padres', description: 'Menor de edad acompañado por ambos padres' },
  A2: { code: 'A2', group: 'A', label: 'Menor viajando con un solo padre', description: 'Menor acompañado por uno de los padres' },
  A3: { code: 'A3', group: 'A', label: 'Menor viajando con familiares', description: 'Menor acompañado por abuelos o tíos' },
  A4: { code: 'A4', group: 'A', label: 'Menor viviendo con un solo padre', description: 'Menor que vive en hogar monoparental' },
  A5: { code: 'A5', group: 'A', label: 'Adolescente viajando solo (educativo)', description: 'Adolescente 16-17 viajando solo por motivo educativo' },
  B1: { code: 'B1', group: 'B', label: 'Estudiante que vive con padres', description: 'Estudiante 18-28 viviendo con padres' },
  B2: { code: 'B2', group: 'B', label: 'Estudiante independiente', description: 'Estudiante 18-28 viviendo solo' },
  B3: { code: 'B3', group: 'B', label: 'Estudiante que trabaja medio tiempo', description: 'Estudiante 18-28 con empleo parcial' },
  B4: { code: 'B4', group: 'B', label: 'Estudiante financiado por familiar en USA', description: 'Estudiante cuyo viaje es financiado por familiar en EE.UU.' },
  B5: { code: 'B5', group: 'B', label: 'Joven sin estudios activos', description: 'Joven 18-28 sin estudios ni empleo estable' },
  C1: { code: 'C1', group: 'C', label: 'Profesional independiente', description: 'Adulto joven 22-35 empleado y viviendo solo' },
  C2: { code: 'C2', group: 'C', label: 'Adulto joven viviendo con padres', description: 'Adulto joven 22-35 empleado viviendo con padres' },
  C3: { code: 'C3', group: 'C', label: 'Adulto dependiente sin estudios', description: 'Adulto 22-35 sin empleo ni estudios, vive con padres' },
  C4: { code: 'C4', group: 'C', label: 'Empleado público joven', description: 'Adulto joven 22-35 con empleo en sector público' },
  C5: { code: 'C5', group: 'C', label: 'Profesional recién graduado', description: 'Adulto joven 22-35 recién graduado con empleo inicial' },
  D1: { code: 'D1', group: 'D', label: 'Madre soltera trabajadora', description: 'Mujer soltera con hijos y empleo' },
  D2: { code: 'D2', group: 'D', label: 'Padre soltero trabajador', description: 'Hombre soltero con hijos y empleo' },
  D3: { code: 'D3', group: 'D', label: 'Madre soltera sin empleo', description: 'Mujer soltera con hijos sin empleo' },
  D4: { code: 'D4', group: 'D', label: 'Padre soltero con ingresos inestables', description: 'Hombre soltero con hijos e ingresos irregulares' },
  E1: { code: 'E1', group: 'E', label: 'Pareja casada sin hijos', description: 'Matrimonio sin hijos' },
  E2: { code: 'E2', group: 'E', label: 'Pareja casada con hijos menores', description: 'Matrimonio con hijos menores de edad' },
  E3: { code: 'E3', group: 'E', label: 'Pareja casada con hijos adultos', description: 'Matrimonio con hijos mayores de edad' },
  E4: { code: 'E4', group: 'E', label: 'Pareja en unión libre', description: 'Pareja en convivencia no casados' },
  F1: { code: 'F1', group: 'F', label: 'Empresario con negocio registrado', description: 'Empresario con empresa formal registrada' },
  F2: { code: 'F2', group: 'F', label: 'Comerciante informal', description: 'Negocio propio sin registro formal' },
  F3: { code: 'F3', group: 'F', label: 'Socio de negocio familiar', description: 'Participación en empresa familiar' },
  F4: { code: 'F4', group: 'F', label: 'Freelancer / independiente', description: 'Trabajo por cuenta propia sin empresa formal' },
  G1: { code: 'G1', group: 'G', label: 'Jubilado con pensión', description: 'Mayor de 60 con pensión estable' },
  G2: { code: 'G2', group: 'G', label: 'Jubilado con propiedades', description: 'Mayor de 60 con bienes inmuebles' },
  G3: { code: 'G3', group: 'G', label: 'Adulto mayor dependiente de hijos', description: 'Mayor de 60 financiado por hijos' },
  H1: { code: 'H1', group: 'H', label: 'Noviazgo online', description: 'Viaje para visitar pareja conocida online' },
  H2: { code: 'H2', group: 'H', label: 'Dependiente económico de familiar en USA', description: 'Viaje financiado por familiar en EE.UU.' },
  H3: { code: 'H3', group: 'H', label: 'Historial de múltiples negaciones', description: 'Visa negada 2 o más veces' },
  H4: { code: 'H4', group: 'H', label: 'Perfil laboral inconsistente', description: 'Huecos laborales e ingresos poco claros' },
};

// ── Avatar Classification ──────────────────────────────
export function classifyAvatar(a: VisaEvalAnswers): AvatarResult {
  const riskFactors: string[] = [];
  const strengths: string[] = [];

  // HIGH RISK flags first (can override)
  if (a.previousDenials >= 2) {
    riskFactors.push('Múltiples negaciones previas');
    return { ...AVATARS.H3, riskFactors, strengths };
  }
  if (a.travelPurpose === 'visit_partner') {
    riskFactors.push('Motivo de viaje: visitar pareja');
    return { ...AVATARS.H1, riskFactors, strengths };
  }
  if (a.tripFinancedBy === 'family_usa' && a.employmentStatus === 'unemployed') {
    riskFactors.push('Dependiente económico de familiar en USA');
    return { ...AVATARS.H2, riskFactors, strengths };
  }
  if (a.employmentGaps && a.incomeStability === 'irregular') {
    riskFactors.push('Perfil laboral inconsistente');
    return { ...AVATARS.H4, riskFactors, strengths };
  }

  // GROUP A — Menores
  if (a.age < 18) {
    if (a.age >= 16 && a.travelCompanion === 'alone' && a.travelPurpose === 'education') {
      return { ...AVATARS.A5, riskFactors, strengths: ['Programa educativo'] };
    }
    if (a.travelCompanion === 'both_parents') return { ...AVATARS.A1, riskFactors, strengths: ['Viaja con ambos padres'] };
    if (a.travelCompanion === 'one_parent') {
      if (a.livingSituation === 'with_family') return { ...AVATARS.A4, riskFactors: ['Hogar monoparental'], strengths };
      return { ...AVATARS.A2, riskFactors, strengths };
    }
    if (a.travelCompanion === 'relatives') return { ...AVATARS.A3, riskFactors: ['No viaja con padres'], strengths };
    return { ...AVATARS.A4, riskFactors, strengths };
  }

  // GROUP G — Adultos mayores
  if (a.age > 60) {
    if (a.employmentStatus === 'retired' && a.monthlyIncome !== 'none') {
      if (a.ownsProperty) return { ...AVATARS.G2, riskFactors, strengths: ['Pensión', 'Propiedades'] };
      return { ...AVATARS.G1, riskFactors, strengths: ['Pensión estable'] };
    }
    if (a.tripFinancedBy === 'family_local' || a.tripFinancedBy === 'family_usa') {
      return { ...AVATARS.G3, riskFactors: ['Dependiente de hijos'], strengths };
    }
    return { ...AVATARS.G1, riskFactors, strengths };
  }

  // GROUP D — Padres solteros
  if (a.hasChildren && (a.maritalStatus === 'single' || a.maritalStatus === 'divorced')) {
    if (a.gender === 'female') {
      if (a.employmentStatus === 'employed' || a.employmentStatus === 'self_employed') {
        return { ...AVATARS.D1, riskFactors, strengths: ['Empleo activo', 'Hijos como arraigo'] };
      }
      return { ...AVATARS.D3, riskFactors: ['Sin empleo'], strengths: ['Hijos como arraigo'] };
    }
    if (a.gender === 'male') {
      if (a.incomeStability === 'irregular') return { ...AVATARS.D4, riskFactors: ['Ingresos inestables'], strengths };
      return { ...AVATARS.D2, riskFactors, strengths: ['Empleo activo', 'Hijos como arraigo'] };
    }
  }

  // GROUP E — Parejas
  if (a.maritalStatus === 'married') {
    if (!a.hasChildren) return { ...AVATARS.E1, riskFactors, strengths: ['Matrimonio'] };
    if (a.childrenAges === 'minor' || a.childrenAges === 'both') return { ...AVATARS.E2, riskFactors, strengths: ['Familia con menores'] };
    return { ...AVATARS.E3, riskFactors, strengths: ['Matrimonio', 'Hijos adultos'] };
  }
  if (a.maritalStatus === 'cohabiting') return { ...AVATARS.E4, riskFactors: ['No casados formalmente'], strengths: ['Convivencia'] };

  // GROUP F — Emprendedores
  if (a.employmentStatus === 'self_employed') {
    if (a.hasRegisteredBusiness) return { ...AVATARS.F1, riskFactors, strengths: ['Negocio registrado'] };
    if (a.employmentType === 'family_business') return { ...AVATARS.F3, riskFactors, strengths: ['Negocio familiar'] };
    if (a.employmentType === 'freelance') return { ...AVATARS.F4, riskFactors: ['Sin empresa formal'], strengths: ['Independiente'] };
    return { ...AVATARS.F2, riskFactors: ['Negocio informal'], strengths };
  }

  // GROUP B — Estudiantes (18-28)
  if (a.age >= 18 && a.age <= 28 && a.isStudying) {
    if (a.tripFinancedBy === 'family_usa') return { ...AVATARS.B4, riskFactors: ['Financiado por familiar en USA'], strengths: ['Estudios activos'] };
    if (a.employmentStatus === 'part_time' || a.employmentStatus === 'employed') return { ...AVATARS.B3, riskFactors, strengths: ['Estudia y trabaja'] };
    if (a.livingSituation === 'with_parents') return { ...AVATARS.B1, riskFactors, strengths: ['Estudios activos', 'Vive con padres'] };
    return { ...AVATARS.B2, riskFactors, strengths: ['Estudios activos', 'Independiente'] };
  }
  if (a.age >= 18 && a.age <= 28 && !a.isStudying && a.employmentStatus === 'unemployed') {
    return { ...AVATARS.B5, riskFactors: ['Sin estudios ni empleo'], strengths };
  }

  // GROUP C — Adultos jóvenes (22-35)
  if (a.age >= 22 && a.age <= 35) {
    if (a.employmentType === 'public') return { ...AVATARS.C4, riskFactors, strengths: ['Empleo público'] };
    if (a.educationLevel === 'university_recent') return { ...AVATARS.C5, riskFactors, strengths: ['Recién graduado'] };
    if (!a.isStudying && a.employmentStatus === 'unemployed' && a.livingSituation === 'with_parents') {
      return { ...AVATARS.C3, riskFactors: ['Sin empleo ni estudios', 'Dependiente'], strengths };
    }
    if (a.livingSituation === 'with_parents') return { ...AVATARS.C2, riskFactors, strengths: ['Empleo activo'] };
    return { ...AVATARS.C1, riskFactors, strengths: ['Profesional independiente'] };
  }

  // Default fallback
  if (a.employmentStatus === 'employed') return { ...AVATARS.C1, riskFactors, strengths: ['Empleo activo'] };
  return { ...AVATARS.C3, riskFactors: ['Perfil sin categoría clara'], strengths };
}

// ── Scoring Engine (100 points) ──────────────────────────
export function calculateScore(a: VisaEvalAnswers): ScoreBreakdown {
  let arraigo_economico = 0; // max 25
  let arraigo_familiar = 0;  // max 25
  let estabilidad = 0;       // max 20
  let viajes = 0;            // max 20
  let historial = 10;        // max 10 (starts full, penalties subtract)
  let penalties = 0;
  const coherenceFlags: string[] = [];

  // ── ARRAIGO ECONÓMICO (25 pts) ──
  if (a.ownsProperty) {
    arraigo_economico += a.propertyType === 'multiple' ? 10 : a.propertyType === 'commercial' ? 8 : 6;
  }
  if (a.ownsVehicle) arraigo_economico += 3;
  if (a.hasBankAccounts) arraigo_economico += 4;
  if (a.hasInvestments) arraigo_economico += 5;
  if (a.hasRegisteredBusiness) arraigo_economico += 5;
  arraigo_economico = Math.min(arraigo_economico, 25);

  // ── ARRAIGO FAMILIAR (25 pts) ──
  if (a.hasChildren) arraigo_familiar += a.childrenAges === 'minor' ? 12 : 8;
  if (a.maritalStatus === 'married') arraigo_familiar += 8;
  else if (a.maritalStatus === 'cohabiting') arraigo_familiar += 4;
  if (a.familyInHomeCountry === 'strong') arraigo_familiar += 5;
  else if (a.familyInHomeCountry === 'moderate') arraigo_familiar += 3;
  if (a.communityTies === 'strong') arraigo_familiar += 3;
  arraigo_familiar = Math.min(arraigo_familiar, 25);

  // ── ESTABILIDAD (20 pts) ──
  const incomeMap = { none: 0, low: 2, medium: 5, high: 8, very_high: 10 };
  estabilidad += incomeMap[a.monthlyIncome] || 0;
  if (a.employmentStatus === 'employed') estabilidad += 6;
  else if (a.employmentStatus === 'self_employed') estabilidad += 5;
  else if (a.employmentStatus === 'retired') estabilidad += 5;
  else if (a.employmentStatus === 'part_time') estabilidad += 3;
  else if (a.employmentStatus === 'student') estabilidad += 2;
  if (a.incomeStability === 'stable') estabilidad += 4;
  else if (a.incomeStability === 'irregular') estabilidad += 1;
  // Job tenure bonus
  if (a.jobTenure === 'over_5yr') estabilidad += 3;
  else if (a.jobTenure === '3_5yr') estabilidad += 2;
  else if (a.jobTenure === '1_3yr') estabilidad += 1;
  // Partner occupation bonus (married/cohabiting)
  if (a.partnerOccupation === 'employed' || a.partnerOccupation === 'self_employed') estabilidad += 2;
  estabilidad = Math.min(estabilidad, 20);

  // ── VIAJES (20 pts) ──
  if (a.previousVisaApproved) viajes += 6;
  if (a.previousUSTravel) viajes += 3;
  // Family visa history bonus
  if (a.familyHasVisa) {
    viajes += 3;
    if (a.familyVisaUsage === 'short_trips') viajes += 2; // Good usage pattern
    else if (a.familyVisaUsage === 'mixed') viajes += 1;
    else if (a.familyVisaUsage === 'long_trips') viajes -= 1; // Suspicious pattern
  }
  const travelMap = { none: 0, regional: 2, international: 4, extensive: 6 };
  viajes += travelMap[a.travelHistory] || 0;
  if (a.complianceRecord === 'perfect') viajes += 3;
  else if (a.complianceRecord === 'minor_issues') viajes += 1;
  viajes = Math.min(viajes, 20);

  // ── HISTORIAL (10 pts, with penalties) ──
  if (a.previousDenials >= 2) { penalties -= 20; historial = 0; }
  else if (a.previousDenials === 1) {
    if (a.mostRecentDenial === 'less_1yr') { penalties -= 15; historial = 0; }
    else if (a.mostRecentDenial === '1_3yr') { penalties -= 8; historial = 2; }
    else { penalties -= 3; historial = 5; }
  }
  if (a.criminalRecord) { penalties -= 15; historial = 0; }
  if (a.inconsistencies) { penalties -= 5; historial = Math.max(historial - 3, 0); }
  if (a.complianceRecord === 'overstay') { penalties -= 10; historial = 0; }

  // ── COHERENCE CHECKS ──
  if (a.tripDuration === 'long' && (a.monthlyIncome === 'low' || a.monthlyIncome === 'none')) {
    coherenceFlags.push('Viaje largo con ingresos bajos — riesgo de intención de trabajo');
    penalties -= 5;
  }
  if (a.age < 18 && a.travelCompanion === 'alone' && a.travelPurpose !== 'education') {
    coherenceFlags.push('Menor viajando solo sin motivo educativo');
    penalties -= 5;
  }
  if (a.tripFinancedBy === 'family_usa' && a.employmentStatus === 'unemployed') {
    coherenceFlags.push('Sin empleo y financiado por familiar en USA — riesgo de intención migratoria');
    penalties -= 5;
  }
  if (a.travelPurpose === 'visit_partner' && !a.previousUSTravel) {
    coherenceFlags.push('Primera visita a EE.UU. para visitar pareja — perfil de alto riesgo');
    penalties -= 5;
  }
  // Green card petition pending — strong negative factor (9 FAM 402.2-2)
  if (a.familyPetitionPending === true) {
    coherenceFlags.push('Petición de residencia pendiente — falta de intención de retorno');
    penalties -= 12;
  }

  const total = Math.max(0, Math.min(100, arraigo_economico + arraigo_familiar + estabilidad + viajes + historial + penalties));

  return { arraigo_economico, arraigo_familiar, estabilidad, viajes, historial, penalties, total, coherenceFlags };
}

export function getRiskLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'low';   // Perfil Alto (probabilidad razonable)
  if (score >= 45) return 'medium'; // Perfil Medio (requiere estrategia)
  return 'high';                    // Perfil Bajo (riesgo alto)
}

export function getRecommendation(riskLevel: string): string {
  switch (riskLevel) {
    case 'low': return 'Probabilidad razonable de aprobación. Se recomienda preparar documentación y proceder con la solicitud.';
    case 'medium': return 'Se requiere estrategia. Se recomienda fortalecer el arraigo y consultar con un profesional antes de aplicar.';
    case 'high': return 'Riesgo alto de negación. Se recomienda consulta legal urgente antes de proceder.';
    default: return '';
  }
}

export function evaluateProfile(answers: VisaEvalAnswers): EvalResult {
  const avatar = classifyAvatar(answers);
  const score = calculateScore(answers);
  const riskLevel = getRiskLevel(score.total);
  const recommendation = getRecommendation(riskLevel);
  return { avatar, score, riskLevel, recommendation };
}

// ── Interview Questions ──────────────────────────────────
export interface InterviewQuestion {
  id: string;
  step: number;
  textEs: string;
  textEn: string;
  fieldKey: keyof VisaEvalAnswers;
  type: 'select' | 'number' | 'boolean';
  options?: { value: string; labelEs: string; labelEn: string }[];
  condition?: (a: Partial<VisaEvalAnswers>) => boolean;
  consularQuestion?: string; // Audio practice question
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ── STEP 1: PERSONAL ──
  { id: 'q_age', step: 1, textEs: '¿Qué edad tiene la persona que va a pedir la visa?', textEn: 'How old is the visa applicant?', fieldKey: 'age', type: 'select', options: [
    { value: '15', labelEs: 'Menor de 16 años', labelEn: 'Under 16' },
    { value: '17', labelEs: '16 a 17 años', labelEn: '16 – 17' },
    { value: '20', labelEs: '18 a 21 años', labelEn: '18 – 21' },
    { value: '25', labelEs: '22 a 28 años', labelEn: '22 – 28' },
    { value: '32', labelEs: '29 a 35 años', labelEn: '29 – 35' },
    { value: '42', labelEs: '36 a 49 años', labelEn: '36 – 49' },
    { value: '55', labelEs: '50 a 60 años', labelEn: '50 – 60' },
    { value: '65', labelEs: '61 años o más', labelEn: '61+' },
  ]},
  { id: 'q_gender', step: 1, textEs: '¿Es hombre o mujer?', textEn: 'Male or female?', fieldKey: 'gender', type: 'select', options: [
    { value: 'male', labelEs: 'Hombre', labelEn: 'Male' },
    { value: 'female', labelEs: 'Mujer', labelEn: 'Female' },
  ]},
  { id: 'q_marital', step: 1, textEs: '¿Está casado/a, soltero/a, o en otra situación?', textEn: 'Are you married, single, or other?', fieldKey: 'maritalStatus', type: 'select', options: [
    { value: 'single', labelEs: 'Soltero/a', labelEn: 'Single' },
    { value: 'married', labelEs: 'Casado/a', labelEn: 'Married' },
    { value: 'divorced', labelEs: 'Divorciado/a', labelEn: 'Divorced' },
    { value: 'widowed', labelEs: 'Viudo/a', labelEn: 'Widowed' },
    { value: 'cohabiting', labelEs: 'Vive con su pareja sin casarse', labelEn: 'Living together' },
  ]},
  { id: 'q_children', step: 1, textEs: '¿Tiene hijos?', textEn: 'Do you have children?', fieldKey: 'hasChildren', type: 'boolean' },
  { id: 'q_children_ages', step: 1, textEs: '¿Sus hijos son menores o mayores de edad?', textEn: 'Are your children minors or adults?', fieldKey: 'childrenAges', type: 'select',
    condition: (a) => a.hasChildren === true,
    options: [
      { value: 'minor', labelEs: 'Son menores de edad', labelEn: 'Minors' },
      { value: 'adult', labelEs: 'Son mayores de edad', labelEn: 'Adults' },
      { value: 'both', labelEs: 'Tengo de los dos', labelEn: 'Both' },
    ]},
  { id: 'q_living', step: 1, textEs: '¿Con quién vive en su casa?', textEn: 'Who do you live with?', fieldKey: 'livingSituation', type: 'select', options: [
    { value: 'alone', labelEs: 'Vivo solo/a', labelEn: 'Alone' },
    { value: 'with_parents', labelEs: 'Con mis padres', labelEn: 'With parents' },
    { value: 'with_partner', labelEs: 'Con mi pareja', labelEn: 'With partner' },
    { value: 'with_family', labelEs: 'Con otros familiares', labelEn: 'With family' },
  ]},
  { id: 'q_companion', step: 1, textEs: '¿Con quién va a viajar?', textEn: 'Who will you travel with?', fieldKey: 'travelCompanion', type: 'select', options: [
    { value: 'alone', labelEs: 'Voy solo/a', labelEn: 'Alone' },
    { value: 'both_parents', labelEs: 'Con papá y mamá', labelEn: 'Both parents' },
    { value: 'one_parent', labelEs: 'Con uno de mis padres', labelEn: 'One parent' },
    { value: 'relatives', labelEs: 'Con otros familiares', labelEn: 'Relatives' },
    { value: 'partner', labelEs: 'Con mi pareja', labelEn: 'Partner' },
    { value: 'family', labelEs: 'Con toda mi familia', labelEn: 'Whole family' },
  ]},
  { id: 'q_purpose', step: 1, textEs: '¿Para qué quiere ir a Estados Unidos?', textEn: 'Why do you want to go to the United States?', fieldKey: 'travelPurpose', type: 'select',
    consularQuestion: 'What is the purpose of your trip to the United States?',
    options: [
      { value: 'tourism', labelEs: 'Pasear / Turismo', labelEn: 'Tourism' },
      { value: 'education', labelEs: 'Estudiar o tomar un curso', labelEn: 'Education' },
      { value: 'business', labelEs: 'Negocios o trabajo', labelEn: 'Business' },
      { value: 'medical', labelEs: 'Ir al doctor o tratamiento médico', labelEn: 'Medical' },
      { value: 'visit_partner', labelEs: 'Visitar a mi novio/a o pareja', labelEn: 'Visit partner' },
      { value: 'visit_family', labelEs: 'Visitar familia', labelEn: 'Visit family' },
      { value: 'event', labelEs: 'Ir a un evento (boda, graduación, etc.)', labelEn: 'Event' },
      { value: 'other', labelEs: 'Otro motivo', labelEn: 'Other' },
    ]},

  // ── STEP 2: ESTABILIDAD ──
  { id: 'q_employment', step: 2, textEs: '¿Qué hace para ganarse la vida?', textEn: 'What do you do for a living?', fieldKey: 'employmentStatus', type: 'select',
    consularQuestion: 'What do you do for a living?',
    options: [
      { value: 'employed', labelEs: 'Trabajo para una empresa o alguien', labelEn: 'Employed' },
      { value: 'self_employed', labelEs: 'Tengo mi propio negocio', labelEn: 'Self-employed' },
      { value: 'unemployed', labelEs: 'No estoy trabajando ahora', labelEn: 'Unemployed' },
      { value: 'student', labelEs: 'Solo estudio', labelEn: 'Student' },
      { value: 'retired', labelEs: 'Estoy jubilado/a', labelEn: 'Retired' },
      { value: 'part_time', labelEs: 'Trabajo medio tiempo', labelEn: 'Part-time' },
    ]},
  { id: 'q_emp_type', step: 2, textEs: '¿En qué tipo de lugar trabaja?', textEn: 'What type of workplace?', fieldKey: 'employmentType', type: 'select',
    condition: (a) => ['employed', 'part_time'].includes(a.employmentStatus || ''),
    options: [
      { value: 'private', labelEs: 'Empresa privada', labelEn: 'Private company' },
      { value: 'public', labelEs: 'Gobierno o sector público', labelEn: 'Government' },
      { value: 'family_business', labelEs: 'Negocio de la familia', labelEn: 'Family business' },
      { value: 'informal', labelEs: 'Trabajo informal (sin contrato)', labelEn: 'Informal' },
    ]},
  { id: 'q_registered_biz', step: 2, textEs: '¿Su negocio está registrado legalmente?', textEn: 'Is your business legally registered?', fieldKey: 'hasRegisteredBusiness', type: 'boolean',
    condition: (a) => a.employmentStatus === 'self_employed' },
  { id: 'q_job_tenure', step: 2, textEs: '¿Hace cuánto tiempo trabaja ahí o tiene su negocio?', textEn: 'How long have you been working there or running your business?', fieldKey: 'jobTenure', type: 'select',
    consularQuestion: 'How long have you been working there?',
    condition: (a) => ['employed', 'self_employed', 'part_time'].includes(a.employmentStatus || ''),
    options: [
      { value: 'less_1yr', labelEs: 'Menos de 1 año', labelEn: 'Less than 1 year' },
      { value: '1_3yr', labelEs: '1 a 3 años', labelEn: '1 – 3 years' },
      { value: '3_5yr', labelEs: '3 a 5 años', labelEn: '3 – 5 years' },
      { value: 'over_5yr', labelEs: 'Más de 5 años', labelEn: 'Over 5 years' },
    ]},
  { id: 'q_income', step: 2, textEs: '¿Cuánto dinero gana al mes?', textEn: 'How much money do you earn per month?', fieldKey: 'monthlyIncome', type: 'select',
    consularQuestion: 'How much do you earn per month?',
    options: [
      { value: 'none', labelEs: 'No gano dinero', labelEn: 'No income' },
      { value: 'low', labelEs: 'Menos de $500 al mes', labelEn: 'Less than $500/month' },
      { value: 'medium', labelEs: 'Entre $500 y $1,500 al mes', labelEn: '$500 – $1,500/month' },
      { value: 'high', labelEs: 'Entre $1,500 y $5,000 al mes', labelEn: '$1,500 – $5,000/month' },
      { value: 'very_high', labelEs: 'Más de $5,000 al mes', labelEn: 'More than $5,000/month' },
    ]},
  { id: 'q_studying', step: 2, textEs: '¿Está estudiando en este momento?', textEn: 'Are you currently studying?', fieldKey: 'isStudying', type: 'boolean' },
  { id: 'q_education', step: 2, textEs: '¿Hasta qué grado estudió?', textEn: 'What is your education level?', fieldKey: 'educationLevel', type: 'select', options: [
    { value: 'none', labelEs: 'No fui a la escuela', labelEn: 'No formal education' },
    { value: 'high_school', labelEs: 'Terminé la secundaria o bachillerato', labelEn: 'High school' },
    { value: 'university_current', labelEs: 'Estoy en la universidad ahora', labelEn: 'University (current)' },
    { value: 'university_recent', labelEs: 'Me gradué hace poco de la universidad', labelEn: 'University (recent grad)' },
    { value: 'university', labelEs: 'Ya me gradué de la universidad', labelEn: 'University (graduate)' },
    { value: 'postgrad', labelEs: 'Tengo maestría o doctorado', labelEn: 'Postgraduate' },
  ]},
  { id: 'q_income_stability', step: 2, textEs: '¿Cómo le llega el dinero cada mes?', textEn: 'How does your income arrive each month?', fieldKey: 'incomeStability', type: 'select',
    condition: (a) => !['unemployed', 'student'].includes(a.employmentStatus || '') && a.monthlyIncome !== 'none',
    options: [
    { value: 'stable', labelEs: 'Me pagan siempre la misma cantidad y a tiempo', labelEn: 'Always the same amount, on time' },
    { value: 'irregular', labelEs: 'A veces gano más, a veces menos', labelEn: 'Sometimes more, sometimes less' },
  ]},
  { id: 'q_partner_occupation', step: 2, textEs: '¿A qué se dedica su pareja?', textEn: 'What does your partner do?', fieldKey: 'partnerOccupation', type: 'select',
    consularQuestion: 'What does your spouse do for a living?',
    condition: (a) => ['married', 'cohabiting'].includes(a.maritalStatus || ''),
    options: [
      { value: 'employed', labelEs: 'Trabaja para alguien', labelEn: 'Employed' },
      { value: 'self_employed', labelEs: 'Tiene su propio negocio', labelEn: 'Self-employed' },
      { value: 'student', labelEs: 'Estudia', labelEn: 'Student' },
      { value: 'homemaker', labelEs: 'Se dedica al hogar', labelEn: 'Homemaker' },
      { value: 'unemployed', labelEs: 'No está trabajando', labelEn: 'Not working' },
      { value: 'retired', labelEs: 'Está jubilado/a', labelEn: 'Retired' },
    ]},

  // ── STEP 3: ARRAIGO ──
  { id: 'q_property', step: 3, textEs: '¿Posee propiedades?', textEn: 'Do you own property?', fieldKey: 'ownsProperty', type: 'boolean',
    consularQuestion: 'Do you own any property in your home country?' },
  { id: 'q_property_type', step: 3, textEs: '¿Qué tipo de propiedad?', textEn: 'What type of property?', fieldKey: 'propertyType', type: 'select',
    condition: (a) => a.ownsProperty === true,
    options: [
      { value: 'house', labelEs: 'Casa/Apartamento', labelEn: 'House/Apartment' },
      { value: 'land', labelEs: 'Terreno', labelEn: 'Land' },
      { value: 'commercial', labelEs: 'Local comercial', labelEn: 'Commercial property' },
      { value: 'multiple', labelEs: 'Múltiples propiedades', labelEn: 'Multiple properties' },
    ]},
  { id: 'q_vehicle', step: 3, textEs: '¿Tiene vehículo propio?', textEn: 'Do you own a vehicle?', fieldKey: 'ownsVehicle', type: 'boolean' },
  { id: 'q_bank', step: 3, textEs: '¿Tiene cuentas bancarias?', textEn: 'Do you have bank accounts?', fieldKey: 'hasBankAccounts', type: 'boolean' },
  { id: 'q_invest', step: 3, textEs: '¿Tiene inversiones?', textEn: 'Do you have investments?', fieldKey: 'hasInvestments', type: 'boolean' },
  { id: 'q_family_ties', step: 3, textEs: '¿Qué tanta familia tiene en su país?', textEn: 'How much family do you have in your home country?', fieldKey: 'familyInHomeCountry', type: 'select',
    consularQuestion: 'What family do you have in your home country?',
    options: [
      { value: 'strong', labelEs: 'Mucha familia cercana (padres, hermanos, hijos)', labelEn: 'Lots of close family' },
      { value: 'moderate', labelEs: 'Algo de familia (tíos, primos)', labelEn: 'Some family' },
      { value: 'weak', labelEs: 'Casi no tengo familia aquí', labelEn: 'Very little family here' },
    ]},
  { id: 'q_community', step: 3, textEs: '¿Participa en algo en su comunidad?', textEn: 'Do you participate in community activities?', fieldKey: 'communityTies', type: 'select', options: [
    { value: 'strong', labelEs: 'Sí, voy a la iglesia, club, o soy parte de un grupo', labelEn: 'Yes, church, club, or group' },
    { value: 'moderate', labelEs: 'A veces participo en actividades', labelEn: 'Sometimes' },
    { value: 'weak', labelEs: 'No participo en nada', labelEn: 'No participation' },
  ]},
  { id: 'q_dependents', step: 3, textEs: '¿Hay personas que dependen de usted económicamente?', textEn: 'Are there people who depend on you financially?', fieldKey: 'hasDependents', type: 'boolean' },

  // ── STEP 4: VIAJES ──
  { id: 'q_family_usa', step: 4, textEs: '¿Tiene familiares viviendo en Estados Unidos?', textEn: 'Do you have family living in the United States?', fieldKey: 'familyInUSA', type: 'boolean' },
  { id: 'q_family_petition', step: 4, textEs: '¿Algún familiar en EE.UU. lo ha pedido para residencia (green card)?', textEn: 'Has a family member in the US petitioned for your green card?', fieldKey: 'familyPetitionPending', type: 'boolean',
    condition: (a) => a.familyInUSA === true },
  { id: 'q_family_visa', step: 4, textEs: '¿Alguien en su casa tiene visa americana?', textEn: 'Does anyone in your household have a US visa?', fieldKey: 'familyHasVisa', type: 'boolean' },
  { id: 'q_family_visa_usage', step: 4, textEs: '¿Cómo han usado la visa en su familia?', textEn: 'How has your family used the visa?', fieldKey: 'familyVisaUsage', type: 'select',
    condition: (a) => a.familyHasVisa === true,
    options: [
      { value: 'short_trips', labelEs: 'Han ido por poco tiempo y regresan rápido', labelEn: 'Short trips, return quickly' },
      { value: 'long_trips', labelEs: 'Se han quedado por mucho tiempo', labelEn: 'Stayed for long periods' },
      { value: 'mixed', labelEs: 'A veces corto, a veces largo', labelEn: 'Sometimes short, sometimes long' },
      { value: 'never_used', labelEs: 'Tienen visa pero nunca la han usado', labelEn: 'Have visa but never used it' },
    ]},
  { id: 'q_prev_visa', step: 4, textEs: '¿A usted le han aprobado una visa antes?', textEn: 'Have you had a visa approved before?', fieldKey: 'previousVisaApproved', type: 'boolean' },
  { id: 'q_prev_us', step: 4, textEs: '¿Usted ha ido a Estados Unidos antes?', textEn: 'Have you traveled to the US before?', fieldKey: 'previousUSTravel', type: 'boolean' },
  { id: 'q_travel_hist', step: 4, textEs: '¿Ha viajado a otros países?', textEn: 'Have you traveled to other countries?', fieldKey: 'travelHistory', type: 'select', options: [
    { value: 'none', labelEs: 'Nunca he salido de mi país', labelEn: 'Never left my country' },
    { value: 'regional', labelEs: 'He ido a países cercanos', labelEn: 'Nearby countries' },
    { value: 'international', labelEs: 'He viajado a otros continentes', labelEn: 'Other continents' },
    { value: 'extensive', labelEs: 'He viajado a muchos países', labelEn: 'Many countries' },
  ]},
  { id: 'q_compliance', step: 4, textEs: '¿Ha tenido problemas de migración antes?', textEn: 'Have you had immigration issues before?', fieldKey: 'complianceRecord', type: 'select', options: [
    { value: 'perfect', labelEs: 'No, siempre he cumplido las reglas', labelEn: 'No, always followed the rules' },
    { value: 'minor_issues', labelEs: 'Tuve un problema pequeño', labelEn: 'Had a small issue' },
    { value: 'overstay', labelEs: 'Me quedé más tiempo del permitido', labelEn: 'Stayed longer than allowed' },
    { value: 'unknown', labelEs: 'Es mi primera vez viajando', labelEn: 'First time traveling' },
  ]},
  { id: 'q_duration', step: 4, textEs: '¿Cuánto tiempo piensa quedarse en EE.UU.?', textEn: 'How long do you plan to stay in the US?', fieldKey: 'tripDuration', type: 'select',
    consularQuestion: 'How long do you plan to stay in the United States?',
    options: [
      { value: 'short', labelEs: '1 a 2 semanas', labelEn: '1-2 weeks' },
      { value: 'medium', labelEs: '2 semanas a 1 mes', labelEn: '2 weeks to 1 month' },
      { value: 'long', labelEs: 'Más de 1 mes', labelEn: 'More than 1 month' },
    ]},
  { id: 'q_financed', step: 4, textEs: '¿Quién va a pagar el viaje?', textEn: 'Who is paying for the trip?', fieldKey: 'tripFinancedBy', type: 'select',
    consularQuestion: 'Who is paying for your trip?',
    options: [
      { value: 'self', labelEs: 'Yo lo pago con mi dinero', labelEn: 'I pay with my money' },
      { value: 'family_local', labelEs: 'Mi familia de aquí me ayuda', labelEn: 'My family here helps' },
      { value: 'family_usa', labelEs: 'Un familiar en Estados Unidos paga', labelEn: 'A family member in the US pays' },
      { value: 'employer', labelEs: 'Mi trabajo lo paga', labelEn: 'My employer pays' },
      { value: 'other', labelEs: 'Otra persona', labelEn: 'Someone else' },
    ]},

  // ── STEP 5: HISTORIAL ──
  { id: 'q_denials', step: 5, textEs: '¿Cuántas veces le han dicho que NO a la visa?', textEn: 'How many times have you been denied a visa?', fieldKey: 'previousDenials', type: 'select',
    consularQuestion: 'Have you ever been refused a visa to the United States?',
    options: [
      { value: '0', labelEs: 'Nunca me la han negado', labelEn: 'Never denied' },
      { value: '1', labelEs: 'Me la negaron 1 vez', labelEn: 'Denied 1 time' },
      { value: '2', labelEs: 'Me la negaron 2 veces', labelEn: 'Denied 2 times' },
      { value: '3', labelEs: 'Me la han negado 3 veces o más', labelEn: 'Denied 3+ times' },
    ]},
  { id: 'q_recent_denial', step: 5, textEs: '¿Hace cuánto le negaron la visa?', textEn: 'How long ago was the denial?', fieldKey: 'mostRecentDenial', type: 'select',
    condition: (a) => (a.previousDenials || 0) > 0,
    options: [
      { value: 'less_1yr', labelEs: 'Hace menos de 1 año', labelEn: 'Less than 1 year ago' },
      { value: '1_3yr', labelEs: 'Hace 1 a 3 años', labelEn: '1-3 years ago' },
      { value: 'over_3yr', labelEs: 'Hace más de 3 años', labelEn: 'Over 3 years ago' },
    ]},
  { id: 'q_gaps', step: 5, textEs: '¿Ha estado mucho tiempo sin trabajar?', textEn: 'Have you been unemployed for a long time?', fieldKey: 'employmentGaps', type: 'boolean',
    condition: (a) => !['unemployed', 'student', 'retired'].includes(a.employmentStatus || '') },
  { id: 'q_inconsistencies', step: 5, textEs: '¿Hay algo en su historia que no cuadra o es difícil de explicar?', textEn: 'Is there anything in your history that is hard to explain?', fieldKey: 'inconsistencies', type: 'boolean' },
  { id: 'q_criminal', step: 5, textEs: '¿Ha tenido problemas con la policía o la justicia?', textEn: 'Have you had issues with the police or justice system?', fieldKey: 'criminalRecord', type: 'boolean' },
];

export const STEP_LABELS = [
  { step: 1, labelEs: 'Personal', labelEn: 'Personal', icon: 'User' },
  { step: 2, labelEs: 'Estabilidad', labelEn: 'Stability', icon: 'Briefcase' },
  { step: 3, labelEs: 'Arraigo', labelEn: 'Ties', icon: 'Home' },
  { step: 4, labelEs: 'Viajes', labelEn: 'Travel', icon: 'Plane' },
  { step: 5, labelEs: 'Historial', labelEn: 'History', icon: 'ShieldAlert' },
];
