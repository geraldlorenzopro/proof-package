export type Lang = 'es' | 'en';

export const T = {
  // App UI
  appName: { es: 'USCIS Evidence Assistant', en: 'USCIS Evidence Assistant' },
  tagline: { es: 'Paquete Profesional de Evidencias para USCIS', en: 'Professional Evidence Package for USCIS' },
  taglineDesc: {
    es: 'Organiza fotos, capturas de chat y documentos en un PDF listo para tu caso de inmigración.',
    en: 'Organize photos, chat screenshots and documents into a PDF ready for your immigration case.',
  },

  // Steps
  step1: { es: 'Información del caso', en: 'Case Information' },
  step2: { es: 'Subir archivos', en: 'Upload Files' },
  step3: { es: 'Completar datos', en: 'Complete Details' },
  step4: { es: 'Generar PDF', en: 'Generate PDF' },

  // Buttons
  continue: { es: 'Continuar →', en: 'Continue →' },
  addMoreFiles: { es: '+ Agregar más archivos', en: '+ Add more files' },
  completeData: { es: 'Completar datos de', en: 'Complete details for' },
  file: { es: 'archivo', en: 'file' },
  files: { es: 'archivos', en: 'files' },
  reviewAndGenerate: { es: 'Ver resumen y generar PDF →', en: 'Review and generate PDF →' },
  downloadPDF: { es: 'Descargar PDF Profesional', en: 'Download Professional PDF' },
  generating: { es: 'Generando PDF…', en: 'Generating PDF…' },
  remove: { es: 'Eliminar', en: 'Remove' },
  confirmFiles: { es: 'Confirmar', en: 'Confirm' },
  uploadHere: { es: 'Arrastra tus archivos aquí', en: 'Drag your files here' },
  uploadSub: {
    es: 'o haz clic para seleccionar fotos, capturas de chat, comprobantes',
    en: 'or click to select photos, chat screenshots, receipts',
  },
  uploadFormats: { es: 'Soporta: JPG, PNG, WEBP, PDF', en: 'Supports: JPG, PNG, WEBP, PDF' },
  confirmClassify: { es: 'Confirma la clasificación de cada archivo:', en: 'Confirm the classification of each file:' },
  orFromDrive: { es: 'o importa desde Google Drive', en: 'or import from Google Drive' },

  // Case info form
  caseInfoTitle: { es: 'Información del Caso', en: 'Case Information' },
  caseInfoDesc: { es: 'Estos datos aparecerán en la portada del PDF.', en: 'This information will appear on the PDF cover page.' },
  petitionerName: { es: 'Nombre del Peticionario', en: "Petitioner's Name" },
  beneficiaryName: { es: 'Nombre del Beneficiario', en: "Beneficiary's Name" },
  compiledDate: { es: 'Fecha de Compilación', en: 'Compilation Date' },

  // Evidence form
  date: { es: 'Fecha', en: 'Date' },
  datePlaceholder: { es: 'YYYY-MM-DD, MM-YYYY, o rango', en: 'YYYY-MM-DD, MM-YYYY, or range' },
  dateApprox: { es: '¿Fecha aproximada?', en: 'Approximate date?' },
  dateApproxLabel: { es: 'Marcar como "aprox."', en: 'Mark as approximate' },
  eventDescription: { es: 'Descripción del evento', en: 'Event Description' },
  eventDescPlaceholder: { es: 'Ej. Cumpleaños de nuestra hija, viaje a Miami', en: 'E.g. Daughter\'s birthday, trip to Miami' },
  peopleInPhoto: { es: 'Personas en la foto', en: 'People in the photo' },
  peoplePlaceholder: { es: 'Ej. Peticionario y beneficiario', en: 'E.g. Petitioner and beneficiary' },
  location: { es: 'Lugar (opcional)', en: 'Location (optional)' },
  locationPlaceholder: { es: 'Ej. New York, NY', en: 'E.g. New York, NY' },
  platform: { es: 'Plataforma', en: 'Platform' },
  participants: { es: 'Participantes', en: 'Participants' },
  participantsPlaceholder: { es: 'Ej. Juan García y María López', en: 'E.g. Juan García and María López' },
  demonstrates: { es: '¿Qué demuestra?', en: 'What does it demonstrate?' },
  additionalDesc: { es: 'Descripción adicional', en: 'Additional description' },
  description: { es: 'Descripción', en: 'Description' },
  descriptionPlaceholder: { es: 'Ej. Reserva de vuelo, ticket de concierto', en: 'E.g. Flight reservation, concert ticket' },
  related: { es: 'Participantes / relacionados', en: 'Participants / related' },
  sourceFile: { es: 'Fuente del archivo', en: 'File Source' },
  selectSource: { es: 'Seleccionar fuente…', en: 'Select source…' },
  selectPlatform: { es: 'Seleccionar…', en: 'Select…' },
  selectDemonstrates: { es: 'Seleccionar…', en: 'Select…' },
  additionalNote: { es: 'Nota adicional (opcional)', en: 'Additional note (optional)' },
  notePlaceholder: { es: 'Cualquier contexto adicional relevante', en: 'Any additional relevant context' },

  // Type labels
  typePhoto: { es: '📷 Fotos (bodas, familia, viajes)', en: '📷 Photos (weddings, family, trips)' },
  typeChat: { es: '💬 Capturas de conversaciones', en: '💬 Conversation screenshots' },
  typeOther: { es: '📄 Capturas de boletos, recibos, etc.', en: '📄 Tickets, receipts, etc.' },

  // Step 2
  uploadTitle: { es: 'Sube tus evidencias', en: 'Upload your evidence' },
  uploadDesc: {
    es: 'Puedes subir fotos, capturas de WhatsApp/Instagram, tickets, comprobantes, etc.',
    en: 'You can upload photos, WhatsApp/Instagram screenshots, tickets, receipts, etc.',
  },

  // Step 3
  completeDataTitle: { es: 'Completa los datos', en: 'Complete the details' },
  progress: { es: 'Progreso', en: 'Progress' },

  // Step 4
  finalSummary: { es: 'Resumen Final', en: 'Final Summary' },
  finalSummaryDesc: { es: 'Revisa tu paquete de evidencias antes de generar el PDF.', en: 'Review your evidence package before generating the PDF.' },
  caseInfoRecap: { es: 'Información del Caso', en: 'Case Information' },
  petitioner: { es: 'Peticionario:', en: 'Petitioner:' },
  beneficiary: { es: 'Beneficiario:', en: 'Beneficiary:' },
  compiled: { es: 'Compilado:', en: 'Compiled:' },
  pdfWillInclude: { es: 'El PDF incluirá:', en: 'The PDF will include:' },
  pdfCoverPage: { es: 'Portada con información del caso', en: 'Cover page with case information' },
  pdfTOC: { es: 'Tabla de contenidos', en: 'Table of contents' },
  pdfFooter: { es: 'Pie de página con fecha', en: 'Footer with date' },
  noStorage: {
    es: 'El PDF se descargará directamente a tu dispositivo. No se almacena ningún dato en servidores.',
    en: 'The PDF will download directly to your device. No data is stored on servers.',
  },

  // PDF content (always in English for USCIS)
  pdfTitle: 'Relationship Evidence Package',
  pdfSubtitle: 'Supporting Documentation for Immigration Case',
  pdfPetitioner: 'Petitioner:',
  pdfBeneficiary: 'Beneficiary:',
  pdfCompiled: 'Compiled:',
  pdfTotalPhotos: 'Total Photos:',
  pdfTotalChats: 'Total Messages:',
  pdfTotalOther: 'Total Other Documents:',
  pdfSectionA: 'Section A – Photographs',
  pdfSectionALabel: 'Photographs',
  pdfSectionB: 'Section B – Messages & Chats',
  pdfSectionBLabel: 'Messages & Chats',
  pdfSectionC: 'Section C – Other Supporting Documents',
  pdfSectionCLabel: 'Other Supporting Documents',
  pdfTableOfContents: 'Table of Contents',
  pdfPage: 'Page',
  pdfCompilePage: 'Compiled:',

  // Demonstrates options (stored in English for PDF)
  demonstratesOpts: {
    es: [
      'Comunicación constante',
      'Coordinación de vida en común',
      'Apoyo emocional',
      'Apoyo financiero',
      'Planificación de viaje / mudanza',
      'Relación romántica',
      'Otro',
    ],
    en: [
      'Ongoing communication',
      'Coordination of shared life',
      'Emotional support',
      'Financial support',
      'Travel / relocation planning',
      'Romantic relationship',
      'Other',
    ],
  },

  // Splash & Disclaimer
  splashPlatform: { es: 'NER Immigration AI', en: 'NER Immigration AI' },
  splashSubtitle: { es: 'Soluciones de Inmigración Inteligente', en: 'Intelligent Immigration Solutions' },
  splashTap: { es: 'Toca para comenzar', en: 'Tap to start' },
  disclaimerTitle: { es: 'Aviso Legal Importante', en: 'Important Legal Notice' },
  disclaimerExclusive: { es: 'Esta herramienta es de uso exclusivo para profesionales de inmigración.', en: 'This tool is for exclusive use by immigration professionals.' },
  disclaimerDesc: {
    es: 'NER Photo Evidence Organizer es un módulo de apoyo técnico integrado en la plataforma NER Immigration AI. El PDF generado organiza evidencia fotográfica y no constituye asesoría legal.',
    en: 'NER Photo Evidence Organizer is a technical support module integrated into the NER Immigration AI platform. The generated PDF organizes photographic evidence and does not constitute legal advice.',
  },
  disclaimerAccept: { es: 'Al continuar acepta los términos de uso.', en: 'By continuing you accept the terms of use.' },
  disclaimerContinue: { es: 'Deseo Continuar', en: 'I Wish to Continue' },

  // Trust badges
  badge1: { es: 'Formato USCIS-friendly', en: 'USCIS-friendly format' },
  badge2: { es: 'Organización cronológica', en: 'Chronological organization' },
  badge3: { es: 'PDF con portada e índice', en: 'PDF with cover and index' },

  // Language toggle
  switchToEnglish: { es: 'Switch to English', en: '' },
  switchToSpanish: { es: '', en: 'Cambiar a Español' },
} as const;

export function t(key: keyof typeof T, lang: Lang): string {
  const entry = T[key];
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && lang in entry) {
    return (entry as Record<string, string>)[lang] || '';
  }
  return '';
}
