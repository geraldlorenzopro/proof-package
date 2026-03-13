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
  hasRegisteredBusiness?: boolean;
  monthlyIncome: 'none' | 'low' | 'medium' | 'high' | 'very_high';
  isStudying: boolean;
  educationLevel: 'none' | 'high_school' | 'university_current' | 'university_recent' | 'university' | 'postgrad';
  incomeStability: 'stable' | 'irregular' | 'none';

  // Step 3 — Arraigo
  ownsProperty: boolean;
  propertyType?: 'house' | 'land' | 'commercial' | 'multiple';
  hasBankAccounts: boolean;
  hasInvestments: boolean;
  familyInHomeCountry: 'strong' | 'moderate' | 'weak';
  communityTies: 'strong' | 'moderate' | 'weak';
  hasDependents: boolean;

  // Step 4 — Viajes
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
    arraigo_economico += a.propertyType === 'multiple' ? 12 : a.propertyType === 'commercial' ? 10 : 8;
  }
  if (a.hasBankAccounts) arraigo_economico += 5;
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
  estabilidad = Math.min(estabilidad, 20);

  // ── VIAJES (20 pts) ──
  if (a.previousVisaApproved) viajes += 8;
  if (a.previousUSTravel) viajes += 4;
  const travelMap = { none: 0, regional: 2, international: 4, extensive: 6 };
  viajes += travelMap[a.travelHistory] || 0;
  if (a.complianceRecord === 'perfect') viajes += 4;
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
  { id: 'q_age', step: 1, textEs: '¿Cuál es la edad del solicitante?', textEn: 'What is the applicant\'s age?', fieldKey: 'age', type: 'select', options: [
    { value: '15', labelEs: 'Menor de 16', labelEn: 'Under 16' },
    { value: '17', labelEs: '16 – 17', labelEn: '16 – 17' },
    { value: '20', labelEs: '18 – 21', labelEn: '18 – 21' },
    { value: '25', labelEs: '22 – 28', labelEn: '22 – 28' },
    { value: '32', labelEs: '29 – 35', labelEn: '29 – 35' },
    { value: '42', labelEs: '36 – 49', labelEn: '36 – 49' },
    { value: '55', labelEs: '50 – 60', labelEn: '50 – 60' },
    { value: '65', labelEs: '61+', labelEn: '61+' },
  ]},
  { id: 'q_gender', step: 1, textEs: '¿Sexo del solicitante?', textEn: 'Applicant\'s gender?', fieldKey: 'gender', type: 'select', options: [
    { value: 'male', labelEs: 'Masculino', labelEn: 'Male' },
    { value: 'female', labelEs: 'Femenino', labelEn: 'Female' },
  ]},
  { id: 'q_marital', step: 1, textEs: '¿Estado civil?', textEn: 'Marital status?', fieldKey: 'maritalStatus', type: 'select', options: [
    { value: 'single', labelEs: 'Soltero/a', labelEn: 'Single' },
    { value: 'married', labelEs: 'Casado/a', labelEn: 'Married' },
    { value: 'divorced', labelEs: 'Divorciado/a', labelEn: 'Divorced' },
    { value: 'widowed', labelEs: 'Viudo/a', labelEn: 'Widowed' },
    { value: 'cohabiting', labelEs: 'Unión libre', labelEn: 'Cohabiting' },
  ]},
  { id: 'q_children', step: 1, textEs: '¿Tiene hijos?', textEn: 'Do you have children?', fieldKey: 'hasChildren', type: 'boolean' },
  { id: 'q_children_ages', step: 1, textEs: '¿Edades de los hijos?', textEn: 'Children\'s ages?', fieldKey: 'childrenAges', type: 'select',
    condition: (a) => a.hasChildren === true,
    options: [
      { value: 'minor', labelEs: 'Menores de edad', labelEn: 'Minors' },
      { value: 'adult', labelEs: 'Mayores de edad', labelEn: 'Adults' },
      { value: 'both', labelEs: 'Ambos', labelEn: 'Both' },
    ]},
  { id: 'q_living', step: 1, textEs: '¿Con quién vive?', textEn: 'Who do you live with?', fieldKey: 'livingSituation', type: 'select', options: [
    { value: 'alone', labelEs: 'Solo/a', labelEn: 'Alone' },
    { value: 'with_parents', labelEs: 'Con padres', labelEn: 'With parents' },
    { value: 'with_partner', labelEs: 'Con pareja', labelEn: 'With partner' },
    { value: 'with_family', labelEs: 'Con familia', labelEn: 'With family' },
  ]},
  { id: 'q_companion', step: 1, textEs: '¿Con quién viajará?', textEn: 'Who will you travel with?', fieldKey: 'travelCompanion', type: 'select', options: [
    { value: 'alone', labelEs: 'Solo/a', labelEn: 'Alone' },
    { value: 'both_parents', labelEs: 'Ambos padres', labelEn: 'Both parents' },
    { value: 'one_parent', labelEs: 'Un padre/madre', labelEn: 'One parent' },
    { value: 'relatives', labelEs: 'Familiares', labelEn: 'Relatives' },
    { value: 'partner', labelEs: 'Pareja', labelEn: 'Partner' },
    { value: 'family', labelEs: 'Familia completa', labelEn: 'Whole family' },
  ]},
  { id: 'q_purpose', step: 1, textEs: '¿Motivo principal del viaje?', textEn: 'Main purpose of travel?', fieldKey: 'travelPurpose', type: 'select',
    consularQuestion: 'What is the purpose of your trip to the United States?',
    options: [
      { value: 'tourism', labelEs: 'Turismo', labelEn: 'Tourism' },
      { value: 'education', labelEs: 'Educación', labelEn: 'Education' },
      { value: 'business', labelEs: 'Negocios', labelEn: 'Business' },
      { value: 'medical', labelEs: 'Médico', labelEn: 'Medical' },
      { value: 'visit_partner', labelEs: 'Visitar pareja', labelEn: 'Visit partner' },
      { value: 'visit_family', labelEs: 'Visitar familia', labelEn: 'Visit family' },
      { value: 'event', labelEs: 'Evento', labelEn: 'Event' },
      { value: 'other', labelEs: 'Otro', labelEn: 'Other' },
    ]},

  // ── STEP 2: ESTABILIDAD ──
  { id: 'q_employment', step: 2, textEs: '¿Situación laboral actual?', textEn: 'Current employment status?', fieldKey: 'employmentStatus', type: 'select',
    consularQuestion: 'What do you do for a living?',
    options: [
      { value: 'employed', labelEs: 'Empleado/a', labelEn: 'Employed' },
      { value: 'self_employed', labelEs: 'Independiente', labelEn: 'Self-employed' },
      { value: 'unemployed', labelEs: 'Desempleado/a', labelEn: 'Unemployed' },
      { value: 'student', labelEs: 'Estudiante', labelEn: 'Student' },
      { value: 'retired', labelEs: 'Jubilado/a', labelEn: 'Retired' },
      { value: 'part_time', labelEs: 'Medio tiempo', labelEn: 'Part-time' },
    ]},
  { id: 'q_emp_type', step: 2, textEs: '¿Tipo de empleo?', textEn: 'Type of employment?', fieldKey: 'employmentType', type: 'select',
    condition: (a) => ['employed', 'self_employed', 'part_time'].includes(a.employmentStatus || ''),
    options: [
      { value: 'private', labelEs: 'Privado', labelEn: 'Private' },
      { value: 'public', labelEs: 'Público', labelEn: 'Public' },
      { value: 'freelance', labelEs: 'Freelance', labelEn: 'Freelance' },
      { value: 'family_business', labelEs: 'Negocio familiar', labelEn: 'Family business' },
      { value: 'informal', labelEs: 'Informal', labelEn: 'Informal' },
    ]},
  { id: 'q_registered_biz', step: 2, textEs: '¿Tiene negocio registrado?', textEn: 'Do you have a registered business?', fieldKey: 'hasRegisteredBusiness', type: 'boolean',
    condition: (a) => a.employmentStatus === 'self_employed' },
  { id: 'q_income', step: 2, textEs: '¿Nivel de ingresos mensuales?', textEn: 'Monthly income level?', fieldKey: 'monthlyIncome', type: 'select',
    consularQuestion: 'How much do you earn per month?',
    options: [
      { value: 'none', labelEs: 'Sin ingresos', labelEn: 'No income' },
      { value: 'low', labelEs: 'Bajo (< $500)', labelEn: 'Low (< $500)' },
      { value: 'medium', labelEs: 'Medio ($500-$1500)', labelEn: 'Medium ($500-$1500)' },
      { value: 'high', labelEs: 'Alto ($1500-$5000)', labelEn: 'High ($1500-$5000)' },
      { value: 'very_high', labelEs: 'Muy alto (> $5000)', labelEn: 'Very high (> $5000)' },
    ]},
  { id: 'q_studying', step: 2, textEs: '¿Estudia actualmente?', textEn: 'Currently studying?', fieldKey: 'isStudying', type: 'boolean' },
  { id: 'q_education', step: 2, textEs: '¿Nivel educativo?', textEn: 'Education level?', fieldKey: 'educationLevel', type: 'select', options: [
    { value: 'none', labelEs: 'Sin educación formal', labelEn: 'No formal education' },
    { value: 'high_school', labelEs: 'Secundaria/Bachillerato', labelEn: 'High school' },
    { value: 'university_current', labelEs: 'Universidad (cursando)', labelEn: 'University (current)' },
    { value: 'university_recent', labelEs: 'Universidad (recién graduado)', labelEn: 'University (recent grad)' },
    { value: 'university', labelEs: 'Universidad (graduado)', labelEn: 'University (graduate)' },
    { value: 'postgrad', labelEs: 'Posgrado', labelEn: 'Postgraduate' },
  ]},
  { id: 'q_income_stability', step: 2, textEs: '¿Estabilidad de ingresos?', textEn: 'Income stability?', fieldKey: 'incomeStability', type: 'select', options: [
    { value: 'stable', labelEs: 'Estable', labelEn: 'Stable' },
    { value: 'irregular', labelEs: 'Irregular', labelEn: 'Irregular' },
    { value: 'none', labelEs: 'Sin ingresos', labelEn: 'No income' },
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
  { id: 'q_bank', step: 3, textEs: '¿Tiene cuentas bancarias?', textEn: 'Do you have bank accounts?', fieldKey: 'hasBankAccounts', type: 'boolean' },
  { id: 'q_invest', step: 3, textEs: '¿Tiene inversiones?', textEn: 'Do you have investments?', fieldKey: 'hasInvestments', type: 'boolean' },
  { id: 'q_family_ties', step: 3, textEs: '¿Vínculos familiares en su país?', textEn: 'Family ties in home country?', fieldKey: 'familyInHomeCountry', type: 'select',
    consularQuestion: 'What family do you have in your home country?',
    options: [
      { value: 'strong', labelEs: 'Fuertes', labelEn: 'Strong' },
      { value: 'moderate', labelEs: 'Moderados', labelEn: 'Moderate' },
      { value: 'weak', labelEs: 'Débiles', labelEn: 'Weak' },
    ]},
  { id: 'q_community', step: 3, textEs: '¿Vínculos comunitarios?', textEn: 'Community ties?', fieldKey: 'communityTies', type: 'select', options: [
    { value: 'strong', labelEs: 'Fuertes (iglesia, organizaciones, etc.)', labelEn: 'Strong' },
    { value: 'moderate', labelEs: 'Moderados', labelEn: 'Moderate' },
    { value: 'weak', labelEs: 'Débiles', labelEn: 'Weak' },
  ]},
  { id: 'q_dependents', step: 3, textEs: '¿Tiene dependientes a su cargo?', textEn: 'Do you have dependents?', fieldKey: 'hasDependents', type: 'boolean' },

  // ── STEP 4: VIAJES ──
  { id: 'q_prev_visa', step: 4, textEs: '¿Ha tenido visa aprobada antes?', textEn: 'Have you had a visa approved before?', fieldKey: 'previousVisaApproved', type: 'boolean',
    consularQuestion: 'Have you ever been to the United States before?' },
  { id: 'q_prev_us', step: 4, textEs: '¿Ha viajado a EE.UU. antes?', textEn: 'Have you traveled to the US before?', fieldKey: 'previousUSTravel', type: 'boolean' },
  { id: 'q_travel_hist', step: 4, textEs: '¿Historial de viajes internacionales?', textEn: 'International travel history?', fieldKey: 'travelHistory', type: 'select', options: [
    { value: 'none', labelEs: 'Ninguno', labelEn: 'None' },
    { value: 'regional', labelEs: 'Regional (países vecinos)', labelEn: 'Regional' },
    { value: 'international', labelEs: 'Internacional', labelEn: 'International' },
    { value: 'extensive', labelEs: 'Extenso (múltiples países)', labelEn: 'Extensive' },
  ]},
  { id: 'q_compliance', step: 4, textEs: '¿Historial de cumplimiento migratorio?', textEn: 'Immigration compliance record?', fieldKey: 'complianceRecord', type: 'select', options: [
    { value: 'perfect', labelEs: 'Perfecto', labelEn: 'Perfect' },
    { value: 'minor_issues', labelEs: 'Problemas menores', labelEn: 'Minor issues' },
    { value: 'overstay', labelEs: 'Sobrestadía', labelEn: 'Overstay' },
    { value: 'unknown', labelEs: 'No aplica / Primer viaje', labelEn: 'N/A / First trip' },
  ]},
  { id: 'q_duration', step: 4, textEs: '¿Duración planeada del viaje?', textEn: 'Planned trip duration?', fieldKey: 'tripDuration', type: 'select',
    consularQuestion: 'How long do you plan to stay in the United States?',
    options: [
      { value: 'short', labelEs: '1-2 semanas', labelEn: '1-2 weeks' },
      { value: 'medium', labelEs: '2-4 semanas', labelEn: '2-4 weeks' },
      { value: 'long', labelEs: 'Más de 1 mes', labelEn: 'More than 1 month' },
    ]},
  { id: 'q_financed', step: 4, textEs: '¿Quién financia el viaje?', textEn: 'Who is financing the trip?', fieldKey: 'tripFinancedBy', type: 'select',
    consularQuestion: 'Who is paying for your trip?',
    options: [
      { value: 'self', labelEs: 'Yo mismo', labelEn: 'Self' },
      { value: 'family_local', labelEs: 'Familia (en mi país)', labelEn: 'Family (local)' },
      { value: 'family_usa', labelEs: 'Familiar en EE.UU.', labelEn: 'Family in USA' },
      { value: 'employer', labelEs: 'Empleador', labelEn: 'Employer' },
      { value: 'other', labelEs: 'Otro', labelEn: 'Other' },
    ]},

  // ── STEP 5: HISTORIAL ──
  { id: 'q_denials', step: 5, textEs: '¿Cuántas veces le han negado la visa?', textEn: 'How many times have you been denied a visa?', fieldKey: 'previousDenials', type: 'number',
    consularQuestion: 'Have you ever been refused a visa to the United States?' },
  { id: 'q_recent_denial', step: 5, textEs: '¿Cuándo fue la negación más reciente?', textEn: 'When was the most recent denial?', fieldKey: 'mostRecentDenial', type: 'select',
    condition: (a) => (a.previousDenials || 0) > 0,
    options: [
      { value: 'less_1yr', labelEs: 'Menos de 1 año', labelEn: 'Less than 1 year' },
      { value: '1_3yr', labelEs: '1-3 años', labelEn: '1-3 years' },
      { value: 'over_3yr', labelEs: 'Más de 3 años', labelEn: 'Over 3 years' },
    ]},
  { id: 'q_gaps', step: 5, textEs: '¿Tiene huecos laborales largos?', textEn: 'Do you have long employment gaps?', fieldKey: 'employmentGaps', type: 'boolean' },
  { id: 'q_inconsistencies', step: 5, textEs: '¿Hay inconsistencias en su perfil?', textEn: 'Are there inconsistencies in your profile?', fieldKey: 'inconsistencies', type: 'boolean' },
  { id: 'q_criminal', step: 5, textEs: '¿Tiene antecedentes penales?', textEn: 'Do you have a criminal record?', fieldKey: 'criminalRecord', type: 'boolean' },
];

export const STEP_LABELS = [
  { step: 1, labelEs: 'Personal', labelEn: 'Personal', icon: 'User' },
  { step: 2, labelEs: 'Estabilidad', labelEn: 'Stability', icon: 'Briefcase' },
  { step: 3, labelEs: 'Arraigo', labelEn: 'Ties', icon: 'Home' },
  { step: 4, labelEs: 'Viajes', labelEn: 'Travel', icon: 'Plane' },
  { step: 5, labelEs: 'Historial', labelEn: 'History', icon: 'ShieldAlert' },
];
