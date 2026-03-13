/**
 * Avatar-Specific Strategy & Document Checklist Engine
 * All recommendations are POSITIVE — what to present, never what to hide.
 * Based on 9 FAM 402.2-2
 */
import type { VisaEvalAnswers, EvalResult, ScoreBreakdown } from "./visaAvatarEngine";

// ── Strategy per Avatar Group ──────────────────────────
export interface AvatarStrategy {
  title: string;
  actions: string[];
  keyMessage: string; // The core narrative for the consular interview
}

export interface DocumentItem {
  name: string;
  description: string;
  priority: 'required' | 'recommended' | 'bonus';
  category: 'economic' | 'family' | 'travel' | 'employment' | 'identity' | 'purpose';
}

export interface WhatIfScenario {
  id: string;
  label: string;
  description: string;
  currentValue: boolean | string;
  improvedValue: boolean | string;
  scoreImpact: number; // estimated points gained
  category: keyof ScoreBreakdown;
  fieldKey: keyof VisaEvalAnswers;
}

// ── Avatar Strategies (always positive) ──────────────────
function getGroupStrategy(avatarCode: string, answers: VisaEvalAnswers): AvatarStrategy {
  const group = avatarCode.charAt(0);

  const strategies: Record<string, () => AvatarStrategy> = {
    A: () => ({
      title: 'Menor de Edad — Perfil Familiar',
      keyMessage: 'Demostrar que el menor tiene un hogar estable y motivo claro de retorno con su familia.',
      actions: [
        'Presentar actas de nacimiento y documentos escolares del menor',
        'Incluir carta de la escuela confirmando inscripción activa y fechas del ciclo escolar',
        'Si viaja con un solo padre, presentar autorización notariada del otro padre',
        'Demostrar que la familia tiene estabilidad económica para el viaje',
        answers.travelPurpose === 'education'
          ? 'Presentar carta de aceptación del programa educativo o campamento'
          : 'Incluir itinerario detallado del viaje familiar',
      ],
    }),

    B: () => ({
      title: 'Estudiante — Perfil Académico',
      keyMessage: 'Mostrar compromiso académico activo y plan de vida ligado al país de origen.',
      actions: [
        'Presentar constancia de inscripción actual y récord de calificaciones',
        'Incluir carta de la universidad describiendo el programa y fecha de graduación',
        'Demostrar cómo el viaje complementa su formación profesional',
        answers.employmentStatus === 'part_time'
          ? 'Presentar carta del empleador confirmando posición y fecha de regreso'
          : 'Mostrar plan de carrera post-graduación en su país',
        'Incluir estados de cuenta que demuestren capacidad de financiar el viaje',
      ],
    }),

    C: () => {
      const isPublicSector = answers.employmentType === 'public';
      return {
        title: 'Profesional — Perfil Laboral',
        keyMessage: 'Demostrar estabilidad profesional, trayectoria laboral y compromisos que requieren retorno.',
        actions: [
          isPublicSector
            ? 'Presentar credencial de empleo público y carta oficial con cargo y antigüedad'
            : 'Presentar carta del empleador con cargo, salario, antigüedad y permiso de viaje',
          'Incluir últimas 3 nóminas o recibos de pago',
          'Demostrar trayectoria profesional con constancias o reconocimientos',
          answers.educationLevel === 'university_recent'
            ? 'Incluir diploma/título universitario reciente'
            : 'Presentar certificaciones profesionales o capacitaciones recientes',
          'Incluir estados de cuenta bancarios de los últimos 3 meses',
        ],
      };
    },

    D: () => ({
      title: 'Padre/Madre Soltero(a) — Perfil de Arraigo Familiar',
      keyMessage: 'Destacar el rol de cuidador principal y la responsabilidad familiar que garantiza el retorno.',
      actions: [
        'Presentar actas de nacimiento de los hijos',
        'Incluir constancias escolares de los hijos (inscripción, calificaciones)',
        answers.employmentStatus === 'employed' || answers.employmentStatus === 'self_employed'
          ? 'Presentar carta del empleador con cargo, salario y permiso de vacaciones'
          : 'Demostrar fuentes de ingreso y capacidad económica',
        'Incluir documentación que demuestre custodia legal de los hijos',
        'Presentar itinerario de viaje que muestre fechas claras de regreso antes del ciclo escolar',
      ],
    }),

    E: () => ({
      title: 'Pareja/Familia — Perfil de Unidad Familiar',
      keyMessage: 'Demostrar la solidez del núcleo familiar y los compromisos conjuntos que requieren retorno.',
      actions: [
        'Presentar acta de matrimonio',
        answers.hasChildren
          ? 'Incluir actas de nacimiento y constancias escolares de los hijos'
          : 'Presentar documentación de bienes compartidos del matrimonio',
        'Incluir cartas de empleo de ambos cónyuges',
        'Demostrar propiedad conjunta o contrato de arrendamiento',
        'Presentar itinerario de viaje familiar con fechas definidas',
      ],
    }),

    F: () => ({
      title: 'Emprendedor — Perfil Empresarial',
      keyMessage: 'Demostrar que el negocio es real, operativo y requiere la presencia del solicitante.',
      actions: [
        answers.hasRegisteredBusiness
          ? 'Presentar registro mercantil, patente o licencia de operación vigente'
          : 'Reunir documentación que formalice la actividad comercial',
        'Incluir declaraciones de impuestos de los últimos 2 años',
        'Presentar estados financieros o contabilidad del negocio',
        'Demostrar nómina o contratos con empleados/proveedores',
        answers.travelPurpose === 'business'
          ? 'Incluir carta de invitación comercial o agenda de reuniones en EE.UU.'
          : 'Mostrar por qué el viaje no afecta la operación del negocio',
      ],
    }),

    G: () => ({
      title: 'Adulto Mayor — Perfil de Retiro',
      keyMessage: 'Demostrar estabilidad económica en retiro, lazos familiares fuertes y motivo temporal de viaje.',
      actions: [
        'Presentar comprobante de pensión o jubilación',
        answers.ownsProperty
          ? 'Incluir escrituras de propiedad a su nombre'
          : 'Demostrar estabilidad habitacional (contrato de arrendamiento, carta familiar)',
        'Presentar estados de cuenta bancarios con historial de depósitos regulares',
        'Incluir documentación de familiares que permanecen en el país (hijos, nietos)',
        'Presentar seguro médico de viaje vigente',
      ],
    }),

    H: () => {
      const isMultipleDenials = answers.previousDenials >= 2;
      return {
        title: 'Perfil de Alto Riesgo — Estrategia de Fortalecimiento',
        keyMessage: 'Abordar directamente las áreas de preocupación con documentación sólida y cambios verificables.',
        actions: [
          isMultipleDenials
            ? 'Documentar cambios significativos en su situación desde la última negación'
            : 'Fortalecer el arraigo económico con documentación verificable',
          'Presentar evidencia de empleo estable y trayectoria laboral',
          'Demostrar lazos familiares fuertes con documentación actualizada',
          answers.travelPurpose === 'visit_partner'
            ? 'Considerar formalizar la relación y presentar plan de visita con fechas específicas'
            : 'Preparar narrativa clara y coherente del motivo de viaje',
          'Consultar con un abogado de inmigración antes de volver a aplicar',
        ],
      };
    },
  };

  return (strategies[group] || strategies.C)();
}

// ── Document Checklist ──────────────────────────────────
function getDocumentChecklist(avatarCode: string, answers: VisaEvalAnswers): DocumentItem[] {
  const docs: DocumentItem[] = [];
  const group = avatarCode.charAt(0);

  // Universal documents
  docs.push(
    { name: 'Pasaporte vigente', description: 'Con al menos 6 meses de validez', priority: 'required', category: 'identity' },
    { name: 'Foto reciente', description: 'Formato 5x5 cm, fondo blanco, reciente', priority: 'required', category: 'identity' },
    { name: 'Confirmación DS-160', description: 'Página de confirmación del formulario DS-160', priority: 'required', category: 'identity' },
    { name: 'Comprobante de pago', description: 'Recibo de pago de la tarifa de visa MRV', priority: 'required', category: 'identity' },
  );

  // Employment docs
  if (['employed', 'self_employed', 'part_time'].includes(answers.employmentStatus)) {
    docs.push({
      name: 'Carta de empleo',
      description: 'Con cargo, salario, antigüedad y permiso de ausencia',
      priority: 'required',
      category: 'employment',
    });
    docs.push({
      name: 'Recibos de nómina',
      description: 'Últimos 3 meses',
      priority: 'required',
      category: 'employment',
    });
  }

  if (answers.employmentStatus === 'self_employed') {
    docs.push(
      { name: 'Registro mercantil', description: 'Licencia o patente de operación', priority: 'required', category: 'employment' },
      { name: 'Declaraciones de impuestos', description: 'Últimos 2 años fiscales', priority: 'required', category: 'employment' },
      { name: 'Estados financieros', description: 'Balance y estado de resultados reciente', priority: 'recommended', category: 'employment' },
    );
  }

  if (answers.employmentStatus === 'retired') {
    docs.push({
      name: 'Comprobante de pensión',
      description: 'Carta o estado de cuenta de la pensión',
      priority: 'required',
      category: 'employment',
    });
  }

  if (answers.employmentStatus === 'student' || answers.isStudying) {
    docs.push(
      { name: 'Constancia de inscripción', description: 'Carta de la institución educativa', priority: 'required', category: 'employment' },
      { name: 'Récord académico', description: 'Calificaciones del período actual', priority: 'recommended', category: 'employment' },
    );
  }

  // Economic ties
  docs.push({
    name: 'Estados de cuenta bancarios',
    description: 'Últimos 3-6 meses mostrando movimientos',
    priority: 'required',
    category: 'economic',
  });

  if (answers.ownsProperty) {
    docs.push({
      name: 'Escrituras de propiedad',
      description: 'Título de propiedad registrado',
      priority: 'required',
      category: 'economic',
    });
  }

  if (answers.ownsVehicle) {
    docs.push({
      name: 'Título de vehículo',
      description: 'Tarjeta de circulación o título a su nombre',
      priority: 'recommended',
      category: 'economic',
    });
  }

  if (answers.hasInvestments) {
    docs.push({
      name: 'Certificados de inversión',
      description: 'CDTs, acciones, fondos de inversión',
      priority: 'recommended',
      category: 'economic',
    });
  }

  // Family ties
  if (answers.hasChildren) {
    docs.push(
      { name: 'Actas de nacimiento de hijos', description: 'Copias certificadas', priority: 'required', category: 'family' },
      { name: 'Constancias escolares de hijos', description: 'Inscripción y calificaciones', priority: 'recommended', category: 'family' },
    );
  }

  if (answers.maritalStatus === 'married') {
    docs.push({
      name: 'Acta de matrimonio',
      description: 'Copia certificada reciente',
      priority: 'required',
      category: 'family',
    });
  }

  if (answers.hasDependents) {
    docs.push({
      name: 'Documentación de dependientes',
      description: 'Prueba de personas a su cargo económico',
      priority: 'recommended',
      category: 'family',
    });
  }

  // Travel-specific
  if (answers.travelPurpose === 'business') {
    docs.push(
      { name: 'Carta de invitación comercial', description: 'De la empresa o socio en EE.UU.', priority: 'required', category: 'purpose' },
      { name: 'Agenda de reuniones', description: 'Itinerario de actividades comerciales', priority: 'recommended', category: 'purpose' },
    );
  }

  if (answers.travelPurpose === 'medical') {
    docs.push(
      { name: 'Carta del médico en EE.UU.', description: 'Diagnóstico y plan de tratamiento', priority: 'required', category: 'purpose' },
      { name: 'Historial médico', description: 'Referencia del médico local', priority: 'recommended', category: 'purpose' },
    );
  }

  if (answers.travelPurpose === 'education') {
    docs.push({
      name: 'Carta de aceptación',
      description: 'Del programa educativo o curso en EE.UU.',
      priority: 'required',
      category: 'purpose',
    });
  }

  if (answers.travelPurpose === 'event') {
    docs.push({
      name: 'Invitación al evento',
      description: 'Boletos, invitación formal o confirmación',
      priority: 'required',
      category: 'purpose',
    });
  }

  // Travel history
  docs.push({
    name: 'Itinerario de viaje',
    description: 'Reservación de hotel y vuelos (no necesita comprar, solo reservar)',
    priority: 'recommended',
    category: 'travel',
  });

  if (answers.previousVisaApproved) {
    docs.push({
      name: 'Visa anterior',
      description: 'Copia de visa previa aprobada',
      priority: 'recommended',
      category: 'travel',
    });
  }

  if (answers.travelHistory !== 'none') {
    docs.push({
      name: 'Sellos de pasaporte previos',
      description: 'Páginas con sellos de viajes anteriores',
      priority: 'bonus',
      category: 'travel',
    });
  }

  if (answers.previousDenials > 0) {
    docs.push({
      name: 'Documentación de cambios',
      description: 'Evidencia de mejoras en su situación desde la última negación',
      priority: 'required',
      category: 'travel',
    });
  }

  // Group-specific extras
  if (group === 'A') {
    docs.push({
      name: 'Autorización de viaje',
      description: 'Carta notariada del padre/madre que no viaja',
      priority: 'required',
      category: 'family',
    });
  }

  if (group === 'G') {
    docs.push({
      name: 'Seguro médico de viaje',
      description: 'Póliza vigente con cobertura en EE.UU.',
      priority: 'recommended',
      category: 'travel',
    });
  }

  return docs;
}

// ── What-If Scenarios ──────────────────────────────────
function getWhatIfScenarios(answers: VisaEvalAnswers, score: ScoreBreakdown): WhatIfScenario[] {
  const scenarios: WhatIfScenario[] = [];

  // Only suggest improvements for things they DON'T have
  if (!answers.ownsProperty) {
    scenarios.push({
      id: 'property',
      label: 'Adquirir una propiedad',
      description: 'Comprar casa, terreno o local comercial a su nombre',
      currentValue: false,
      improvedValue: true,
      scoreImpact: 6,
      category: 'arraigo_economico',
      fieldKey: 'ownsProperty',
    });
  }

  if (!answers.hasBankAccounts) {
    scenarios.push({
      id: 'bank',
      label: 'Abrir cuenta bancaria',
      description: 'Cuenta de ahorro o corriente con movimientos regulares',
      currentValue: false,
      improvedValue: true,
      scoreImpact: 4,
      category: 'arraigo_economico',
      fieldKey: 'hasBankAccounts',
    });
  }

  if (!answers.hasInvestments) {
    scenarios.push({
      id: 'investments',
      label: 'Hacer inversiones formales',
      description: 'CDTs, fondos de inversión, acciones',
      currentValue: false,
      improvedValue: true,
      scoreImpact: 5,
      category: 'arraigo_economico',
      fieldKey: 'hasInvestments',
    });
  }

  if (!answers.hasRegisteredBusiness && answers.employmentStatus === 'self_employed') {
    scenarios.push({
      id: 'register_biz',
      label: 'Registrar el negocio formalmente',
      description: 'Obtener licencia mercantil y registro fiscal',
      currentValue: false,
      improvedValue: true,
      scoreImpact: 5,
      category: 'arraigo_economico',
      fieldKey: 'hasRegisteredBusiness',
    });
  }

  if (!answers.ownsVehicle) {
    scenarios.push({
      id: 'vehicle',
      label: 'Adquirir vehículo propio',
      description: 'Vehículo registrado a su nombre',
      currentValue: false,
      improvedValue: true,
      scoreImpact: 3,
      category: 'arraigo_economico',
      fieldKey: 'ownsVehicle',
    });
  }

  if (answers.communityTies !== 'strong') {
    scenarios.push({
      id: 'community',
      label: 'Participar activamente en su comunidad',
      description: 'Iglesia, club, asociación o voluntariado',
      currentValue: answers.communityTies,
      improvedValue: 'strong',
      scoreImpact: 3,
      category: 'arraigo_familiar',
      fieldKey: 'communityTies',
    });
  }

  if (answers.travelHistory === 'none' || answers.travelHistory === 'regional') {
    scenarios.push({
      id: 'travel',
      label: 'Viajar a otros países primero',
      description: 'Construir historial de viajes y cumplimiento migratorio',
      currentValue: answers.travelHistory,
      improvedValue: 'international',
      scoreImpact: answers.travelHistory === 'none' ? 4 : 2,
      category: 'viajes',
      fieldKey: 'travelHistory',
    });
  }

  if (answers.incomeStability === 'irregular') {
    scenarios.push({
      id: 'income_stability',
      label: 'Estabilizar ingresos mensuales',
      description: 'Conseguir empleo formal o contratos regulares',
      currentValue: 'irregular',
      improvedValue: 'stable',
      scoreImpact: 3,
      category: 'estabilidad',
      fieldKey: 'incomeStability',
    });
  }

  if (answers.monthlyIncome === 'low' || answers.monthlyIncome === 'none') {
    scenarios.push({
      id: 'income',
      label: 'Mejorar nivel de ingresos',
      description: 'Incrementar ingresos demostrables con documentación',
      currentValue: answers.monthlyIncome,
      improvedValue: 'medium',
      scoreImpact: answers.monthlyIncome === 'none' ? 5 : 3,
      category: 'estabilidad',
      fieldKey: 'monthlyIncome',
    });
  }

  if (answers.tripDuration === 'long') {
    scenarios.push({
      id: 'trip_duration',
      label: 'Planear un viaje más corto',
      description: 'Viaje de 1-2 semanas demuestra intención de retorno más clara',
      currentValue: 'long',
      improvedValue: 'short',
      scoreImpact: 3,
      category: 'viajes',
      fieldKey: 'tripDuration',
    });
  }

  // Sort by impact
  return scenarios.sort((a, b) => b.scoreImpact - a.scoreImpact).slice(0, 6);
}

// ── Main Export ──────────────────────────────────────────
export interface FullEvaluation {
  strategy: AvatarStrategy;
  documents: DocumentItem[];
  whatIfScenarios: WhatIfScenario[];
  potentialImprovement: number; // max possible score gain
}

export function getFullEvaluation(answers: VisaEvalAnswers, result: EvalResult): FullEvaluation {
  const strategy = getGroupStrategy(result.avatar.code, answers);
  const documents = getDocumentChecklist(result.avatar.code, answers);
  const whatIfScenarios = getWhatIfScenarios(answers, result.score);
  const potentialImprovement = whatIfScenarios.reduce((sum, s) => sum + s.scoreImpact, 0);

  return { strategy, documents, whatIfScenarios, potentialImprovement };
}
