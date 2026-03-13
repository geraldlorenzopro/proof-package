/**
 * Consular Interview Simulator — Question Bank
 * Based on common B1/B2 consular interview questions
 * and DS-160 guidance from AILA manual
 */

export interface ConsularQuestion {
  id: string;
  category: 'purpose' | 'ties' | 'finances' | 'history' | 'personal';
  questionEn: string;
  questionEs: string;
  tipEs: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const CONSULAR_QUESTIONS: ConsularQuestion[] = [
  // ── PURPOSE ──
  {
    id: 'cq_purpose',
    category: 'purpose',
    questionEn: 'What is the purpose of your trip to the United States?',
    questionEs: '¿Cuál es el propósito de su viaje a Estados Unidos?',
    tipEs: 'Sea claro y específico. Diga exactamente qué va a hacer: "Voy a visitar Disneyland con mi familia por 10 días" es mejor que "Voy de turismo".',
    difficulty: 'easy',
  },
  {
    id: 'cq_how_long',
    category: 'purpose',
    questionEn: 'How long do you plan to stay in the United States?',
    questionEs: '¿Cuánto tiempo planea quedarse en Estados Unidos?',
    tipEs: 'Dé una respuesta concreta: "Dos semanas, del 15 al 29 de julio." Nunca diga "no sé" o "lo que me den."',
    difficulty: 'easy',
  },
  {
    id: 'cq_where_stay',
    category: 'purpose',
    questionEn: 'Where will you stay in the United States?',
    questionEs: '¿Dónde se va a quedar en Estados Unidos?',
    tipEs: 'Tenga la dirección exacta. Si es hotel, sepa el nombre. Si es con familia, sepa la dirección completa.',
    difficulty: 'easy',
  },
  {
    id: 'cq_who_travel',
    category: 'purpose',
    questionEn: 'Who are you traveling with?',
    questionEs: '¿Con quién va a viajar?',
    tipEs: 'Mencione nombres y relación: "Con mi esposa María y mis dos hijos."',
    difficulty: 'easy',
  },
  {
    id: 'cq_itinerary',
    category: 'purpose',
    questionEn: 'What is your travel itinerary?',
    questionEs: '¿Cuál es su itinerario de viaje?',
    tipEs: 'Tenga un plan detallado: ciudades que visitará, actividades, fechas de ida y vuelta.',
    difficulty: 'medium',
  },

  // ── TIES ──
  {
    id: 'cq_job',
    category: 'ties',
    questionEn: 'What do you do for a living?',
    questionEs: '¿A qué se dedica?',
    tipEs: 'Explique su trabajo con orgullo y detalle: "Soy contador en una empresa de construcción desde hace 5 años."',
    difficulty: 'easy',
  },
  {
    id: 'cq_employer',
    category: 'ties',
    questionEn: 'Who is your employer? How long have you worked there?',
    questionEs: '¿Quién es su empleador? ¿Cuánto tiempo lleva trabajando ahí?',
    tipEs: 'Diga el nombre de la empresa, su puesto y cuánto tiempo lleva. Entre más tiempo, mejor.',
    difficulty: 'easy',
  },
  {
    id: 'cq_return',
    category: 'ties',
    questionEn: 'What ties do you have to your home country that will ensure your return?',
    questionEs: '¿Qué lo va a hacer regresar a su país?',
    tipEs: 'Esta es LA pregunta clave. Mencione: trabajo, hijos en escuela, casa propia, negocio, padres que cuidar.',
    difficulty: 'hard',
  },
  {
    id: 'cq_property',
    category: 'ties',
    questionEn: 'Do you own property or a house in your home country?',
    questionEs: '¿Tiene propiedades o casa en su país?',
    tipEs: 'Si tiene, dígalo con seguridad. Si no, enfóquese en otros lazos como familia o trabajo.',
    difficulty: 'medium',
  },
  {
    id: 'cq_family_home',
    category: 'ties',
    questionEn: 'Tell me about your family in your home country.',
    questionEs: 'Hábleme de su familia en su país.',
    tipEs: 'Mencione hijos, esposo/a, padres. Los hijos menores en la escuela son un lazo muy fuerte.',
    difficulty: 'medium',
  },

  // ── FINANCES ──
  {
    id: 'cq_who_pays',
    category: 'finances',
    questionEn: 'Who is paying for your trip?',
    questionEs: '¿Quién paga su viaje?',
    tipEs: '"Yo lo pago" es la mejor respuesta. Si alguien más paga, explique la relación y por qué.',
    difficulty: 'medium',
  },
  {
    id: 'cq_salary',
    category: 'finances',
    questionEn: 'How much do you earn per month?',
    questionEs: '¿Cuánto gana al mes?',
    tipEs: 'Dé una cifra real. No exagere. El cónsul puede verificar.',
    difficulty: 'medium',
  },
  {
    id: 'cq_savings',
    category: 'finances',
    questionEn: 'How much money do you have saved for this trip?',
    questionEs: '¿Cuánto dinero tiene ahorrado para este viaje?',
    tipEs: 'Tenga clara la cifra. Si lleva estados de cuenta, mejor.',
    difficulty: 'medium',
  },
  {
    id: 'cq_trip_cost',
    category: 'finances',
    questionEn: 'How much will this trip cost?',
    questionEs: '¿Cuánto le va a costar este viaje?',
    tipEs: 'Sepa el costo aproximado: boletos, hotel, comida, actividades. Demuestre que lo tiene planeado.',
    difficulty: 'medium',
  },

  // ── HISTORY ──
  {
    id: 'cq_prev_travel',
    category: 'history',
    questionEn: 'Have you ever been to the United States before?',
    questionEs: '¿Ha estado en Estados Unidos antes?',
    tipEs: 'Si sí, diga cuándo, por cuánto tiempo, y que regresó a tiempo. Si no, sea honesto.',
    difficulty: 'easy',
  },
  {
    id: 'cq_denied',
    category: 'history',
    questionEn: 'Have you ever been denied a visa?',
    questionEs: '¿Le han negado la visa antes?',
    tipEs: 'Sea honesto. Si le negaron, explique qué cambió desde entonces (mejor trabajo, más arraigo).',
    difficulty: 'hard',
  },
  {
    id: 'cq_other_countries',
    category: 'history',
    questionEn: 'What other countries have you traveled to?',
    questionEs: '¿A qué otros países ha viajado?',
    tipEs: 'Viajes a otros países demuestran que usted viaja y regresa. Menciónelos todos.',
    difficulty: 'easy',
  },
  {
    id: 'cq_family_usa',
    category: 'history',
    questionEn: 'Do you have any relatives in the United States?',
    questionEs: '¿Tiene familiares en Estados Unidos?',
    tipEs: 'Sea honesto. Si tiene, diga su estatus. No niegue familiares — el cónsul puede saberlo.',
    difficulty: 'hard',
  },

  // ── PERSONAL ──
  {
    id: 'cq_marital',
    category: 'personal',
    questionEn: 'Are you married? Tell me about your spouse.',
    questionEs: '¿Está casado/a? Hábleme de su esposo/a.',
    tipEs: 'Mencione nombre, a qué se dedica, y que se queda en el país cuidando a los hijos.',
    difficulty: 'easy',
  },
  {
    id: 'cq_children',
    category: 'personal',
    questionEn: 'Do you have children? How old are they?',
    questionEs: '¿Tiene hijos? ¿Qué edad tienen?',
    tipEs: 'Los hijos menores en la escuela son un lazo muy fuerte. Diga sus nombres y edades.',
    difficulty: 'easy',
  },
  {
    id: 'cq_education',
    category: 'personal',
    questionEn: 'What is your education level?',
    questionEs: '¿Qué estudios tiene?',
    tipEs: 'Mencione su título o nivel de estudios. Si está estudiando actualmente, aún mejor.',
    difficulty: 'easy',
  },
];

export const CATEGORY_LABELS: Record<string, { es: string; en: string; icon: string }> = {
  purpose: { es: 'Propósito del Viaje', en: 'Trip Purpose', icon: 'Plane' },
  ties: { es: 'Lazos con su País', en: 'Home Ties', icon: 'Home' },
  finances: { es: 'Finanzas', en: 'Finances', icon: 'DollarSign' },
  history: { es: 'Historial', en: 'Travel History', icon: 'Clock' },
  personal: { es: 'Personal', en: 'Personal', icon: 'User' },
};
