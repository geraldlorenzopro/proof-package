import jsPDF from 'jspdf';

const NAVY = [22, 42, 90] as const;
const GOLD = [196, 155, 48] as const;
const GRAY = [100, 110, 130] as const;
const LIGHT = [245, 247, 252] as const;
const GREEN: readonly [number, number, number] = [34, 139, 34];
const RED: readonly [number, number, number] = [180, 30, 30];

export interface CSPAReportData {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  dob: string;
  priorityDate: string;
  approvalDate: string;
  visaAvailableDate: string;
  category: string;
  chargeability: string;
  cspaAgeYears: number;
  qualifies: boolean;
  pendingTimeDays: number;
  biologicalAgeDays: number;
  bulletinInfo?: string;
  approvalControlled?: boolean;
  isHypothetical?: boolean;
  firmName?: string;
  logoUrl?: string;
  projection?: {
    base?: { date: string; months: number; agedOut: boolean; cspaAge?: number };
    optimistic?: { date: string; months: number; agedOut: boolean };
    pessimistic?: { date: string; months: number; agedOut: boolean };
    marginMonths?: number;
    effectiveAgeOut?: string;
    rateDaysPerMonth?: number;
    rates?: { rate_12m: number | null; rate_24m: number | null; rate_36m: number | null };
    pendingTimeDays?: number;
    status?: string;
  };
  lang: 'es' | 'en';
}

function formatDatePDF(dateStr: string, lang: 'es' | 'en'): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysToHuman(days: number, lang: 'es' | 'en'): string {
  const y = Math.floor(days / 365);
  const m = Math.round((days % 365) / 30);
  if (lang === 'es') {
    if (y === 0) return `${m} meses`;
    return m > 0 ? `${y} años y ${m} meses` : `${y} años`;
  }
  if (y === 0) return `${m} months`;
  return m > 0 ? `${y} years and ${m} months` : `${y} years`;
}

function daysToYearsStr(days: number): string {
  return (days / 365.25).toFixed(2);
}

function monthsToHuman(months: number, lang: 'es' | 'en'): string {
  if (months < 12) return `${months} ${lang === 'es' ? 'meses' : 'months'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (lang === 'es') return m > 0 ? `${y} años y ${m} meses` : `${y} años`;
  return m > 0 ? `${y} years and ${m} months` : `${y} years`;
}

async function loadLogoAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addPageHeader(doc: jsPDF, title: string, W: number) {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(title, 20, 25);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(20, 30, W - 20, 30);
}

export async function generateCSPAReport(data: CSPAReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const isEs = data.lang === 'es';
  const today = new Date().toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1: COVER
  // ══════════════════════════════════════════════════════════════════
  let headerY = 20;

  if (data.logoUrl) {
    const logoData = await loadLogoAsDataUrl(data.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 20, headerY, 30, 30);
        headerY += 5;
      } catch { /* skip */ }
    }
  }

  if (data.firmName) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(data.firmName, data.logoUrl ? 55 : 20, headerY + 10);
    headerY = headerY + 18;
  }

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(20, headerY + 18, W - 20, headerY + 18);

  const titleY = headerY + 35;
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Análisis de Edad CSPA' : 'CSPA Age Analysis', W / 2, titleY, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(...GRAY);
  doc.text(isEs ? 'Reporte Completo de Protección CSPA' : 'Complete CSPA Protection Report', W / 2, titleY + 10, { align: 'center' });

  // Hypothetical banner
  if (data.isHypothetical) {
    const bannerY = titleY + 18;
    doc.setFillColor(255, 248, 220);
    doc.roundedRect(30, bannerY, W - 60, 14, 3, 3, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.roundedRect(30, bannerY, W - 60, 14, 3, 3, 'S');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(isEs ? 'SIMULACIÓN HIPOTÉTICA - La visa aún no está disponible' : 'HYPOTHETICAL SIMULATION - Visa is not yet available', W / 2, bannerY + 9, { align: 'center' });
  }

  // Client info box
  const boxY = titleY + (data.isHypothetical ? 40 : 25);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(30, boxY, W - 60, 50, 3, 3, 'F');

  const infoRows = [
    [isEs ? 'Preparado para:' : 'Prepared for:', data.clientName],
    [isEs ? 'Fecha:' : 'Date:', today],
    [isEs ? 'Categoría:' : 'Category:', `${data.category} / ${data.chargeability}`],
    [isEs ? 'Resultado:' : 'Result:', data.qualifies ? (isEs ? 'CALIFICA (menor de 21)' : 'QUALIFIES (under 21)') : (isEs ? 'NO CALIFICA (mayor de 21)' : 'DOES NOT QUALIFY (over 21)')],
  ];

  let infoY = boxY + 12;
  infoRows.forEach(([label, value]) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(label, 40, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(value, 95, infoY);
    infoY += 10;
  });

  // Quick summary box
  const summaryY = boxY + 60;
  doc.setFillColor(data.qualifies ? 230 : 255, data.qualifies ? 245 : 235, data.qualifies ? 230 : 235);
  doc.roundedRect(30, summaryY, W - 60, 30, 3, 3, 'F');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(data.qualifies ? GREEN : RED));
  doc.text(`${isEs ? 'Edad CSPA' : 'CSPA Age'}: ${data.cspaAgeYears.toFixed(2)} ${isEs ? 'años' : 'years'}`, W / 2, summaryY + 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(data.qualifies ? (isEs ? 'CALIFICA - Edad congelada menor de 21' : 'QUALIFIES - Frozen age under 21') : (isEs ? 'NO CALIFICA - Edad supera 21' : 'DOES NOT QUALIFY - Age exceeds 21'), W / 2, summaryY + 22, { align: 'center' });

  // ══════════════════════════════════════════════════════════════════
  // PAGE 2: CALCULATION BREAKDOWN
  // ══════════════════════════════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, isEs ? 'Cómo se calculó la edad CSPA' : 'How the CSPA age was calculated', W);

  let y = 40;

  // Hypothetical note
  if (data.isHypothetical) {
    doc.setFillColor(255, 248, 220);
    doc.roundedRect(20, y - 4, W - 40, 20, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    const hypLines = doc.splitTextToSize(
      isEs
        ? 'SIMULACIÓN: Este resultado muestra qué pasaría si la visa estuviera disponible hoy. La fecha de prioridad aún no está vigente, por lo que este cálculo es orientativo.'
        : 'SIMULATION: This result shows what would happen if the visa were available today. The priority date is not yet current, so this calculation is for reference only.',
      W - 50
    );
    doc.text(hypLines, 25, y + 3);
    y += 24;
  }

  // Dates table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Fechas del caso' : 'Case dates', 20, y);
  y += 8;

  const visaLabel = data.isHypothetical ? (isEs ? 'Fecha simulada (hoy)' : 'Simulated date (today)') : (isEs ? 'Visa disponible' : 'Visa available');
  const dates = [
    [isEs ? 'Fecha de nacimiento' : 'Date of birth', formatDatePDF(data.dob, data.lang)],
    [isEs ? 'Fecha de prioridad (petición)' : 'Priority date (petition)', formatDatePDF(data.priorityDate, data.lang)],
    [isEs ? 'Fecha de aprobación (USCIS)' : 'Approval date (USCIS)', formatDatePDF(data.approvalDate, data.lang)],
    [visaLabel, data.visaAvailableDate ? formatDatePDF(data.visaAvailableDate, data.lang) : (isEs ? 'Hoy (simulación)' : 'Today (simulation)')],
  ];

  dates.forEach(([label, value], i) => {
    doc.setFillColor(i % 2 === 0 ? 245 : 252, i % 2 === 0 ? 247 : 252, 252);
    doc.rect(20, y - 4, W - 40, 10, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(label, 25, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(value, W - 25, y + 2, { align: 'right' });
    y += 12;
  });

  // Controlling date explanation
  if (data.bulletinInfo) {
    y += 2;
    doc.setFillColor(235, 245, 255);
    doc.roundedRect(20, y - 4, W - 40, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NAVY);
    const controlText = data.approvalControlled
      ? (isEs ? 'Se usa la fecha de aprobación porque fue posterior a la disponibilidad de visa.' : 'Approval date is used because it came after visa availability.')
      : (isEs ? 'Se usa la fecha del Boletín de Visas.' : 'Visa Bulletin date is used.');
    doc.text(controlText, 25, y + 3);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(data.bulletinInfo, 25, y + 9);
    y += 20;
  }

  // Step-by-step breakdown
  y += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Desglose paso a paso' : 'Step-by-step breakdown', 20, y);
  y += 10;

  const pendingHuman = daysToHuman(data.pendingTimeDays, data.lang);
  const bioHuman = daysToHuman(data.biologicalAgeDays, data.lang);

  const steps = [
    {
      num: '1',
      title: isEs ? 'Tiempo que USCIS tardó en aprobar' : 'How long USCIS took to approve',
      detail: isEs
        ? `Desde que se presentó la petición hasta que USCIS la aprobó pasaron ${pendingHuman} (${data.pendingTimeDays} días). Este tiempo se le resta a la edad del beneficiario como un "crédito" que otorga la ley CSPA.`
        : `From petition filing to USCIS approval took ${pendingHuman} (${data.pendingTimeDays} days). This time is subtracted from the beneficiary's age as a "credit" granted by the CSPA law.`,
      result: pendingHuman,
      color: GOLD,
    },
    {
      num: '2',
      title: isEs ? 'Edad real cuando la visa estuvo lista' : 'Actual age when the visa was ready',
      detail: isEs
        ? `El beneficiario tenía ${bioHuman} (${daysToYearsStr(data.biologicalAgeDays)} años exactos) cuando la visa estuvo disponible (o cuando se simuló que estuviera disponible).`
        : `The beneficiary was ${bioHuman} (${daysToYearsStr(data.biologicalAgeDays)} exact years) when the visa became available (or when availability was simulated).`,
      result: `${daysToYearsStr(data.biologicalAgeDays)} ${isEs ? 'años' : 'years'}`,
      color: NAVY,
    },
    {
      num: '3',
      title: isEs ? 'Edad CSPA (resultado final)' : 'CSPA Age (final result)',
      detail: isEs
        ? `Edad real (${bioHuman}) menos el crédito de USCIS (${pendingHuman}) = ${data.cspaAgeYears.toFixed(2)} años. ${data.qualifies ? 'Como es menor de 21, el beneficiario CALIFICA bajo CSPA.' : 'Como es 21 o más, el beneficiario NO califica bajo CSPA.'}`
        : `Actual age (${bioHuman}) minus USCIS credit (${pendingHuman}) = ${data.cspaAgeYears.toFixed(2)} years. ${data.qualifies ? 'Since it is under 21, the beneficiary QUALIFIES under CSPA.' : 'Since it is 21 or more, the beneficiary DOES NOT qualify under CSPA.'}`,
      result: `${data.cspaAgeYears.toFixed(2)} ${isEs ? 'años' : 'years'}`,
      color: data.qualifies ? GREEN : RED,
    },
  ];

  steps.forEach((step) => {
    // Step number circle
    doc.setFillColor(step.color[0], step.color[1], step.color[2]);
    doc.circle(28, y + 1, 4, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(step.num, 28, y + 2, { align: 'center' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(step.title, 36, y + 2);

    // Result badge
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(step.color[0], step.color[1], step.color[2]);
    doc.text(step.result, W - 25, y + 2, { align: 'right' });

    // Detail
    y += 7;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(step.detail, W - 55);
    doc.text(lines, 36, y);
    y += lines.length * 4 + 6;
  });

  // ══════════════════════════════════════════════════════════════════
  // PAGE 3: PROJECTIONS (if available)
  // ══════════════════════════════════════════════════════════════════
  const proj = data.projection;
  const hasProjection = proj && (proj.base || proj.optimistic || proj.pessimistic);

  if (hasProjection) {
    doc.addPage();
    addPageHeader(doc, isEs ? 'Proyección: ¿Cuándo podría estar lista la visa?' : 'Projection: When could the visa be ready?', W);

    let py = 38;

    // Intro text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const introLines = doc.splitTextToSize(
      isEs
        ? 'Basado en cómo se ha movido la fila históricamente en el Boletín de Visas, estos son los escenarios estimados para cuándo la visa podría estar disponible:'
        : 'Based on how the line has historically moved in the Visa Bulletin, these are the estimated scenarios for when the visa could be available:',
      W - 40
    );
    doc.text(introLines, 20, py);
    py += introLines.length * 4 + 6;

    // Overall status banner
    if (proj.status) {
      const isRisk = proj.status === 'WILL_AGE_OUT';
      doc.setFillColor(isRisk ? 255 : 230, isRisk ? 235 : 245, isRisk ? 235 : 230);
      doc.roundedRect(20, py - 4, W - 40, 22, 3, 3, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(isRisk ? RED : GREEN));
      doc.text(isRisk ? (isEs ? 'HAY RIESGO' : 'THERE IS RISK') : (isEs ? 'SE VE BIEN' : 'LOOKING GOOD'), 30, py + 5);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const statusDesc = isRisk
        ? (isEs ? 'Al paso actual, el beneficiario podría pasar del límite de edad ANTES de que la visa esté lista.' : 'At current pace, the beneficiary could exceed the age limit BEFORE the visa is ready.')
        : (isEs ? 'Al paso actual, la visa estaría lista ANTES de que el beneficiario pase del límite de edad.' : 'At current pace, the visa should be ready BEFORE the beneficiary reaches the age limit.');
      doc.text(statusDesc, 30, py + 13);
      py += 28;
    }

    // Key metrics
    const metrics: [string, string][] = [];
    if (proj.base) {
      metrics.push([isEs ? 'Fecha estimada (escenario base)' : 'Estimated date (base scenario)', formatDatePDF(proj.base.date, data.lang)]);
      if (proj.base.cspaAge !== undefined) {
        metrics.push([isEs ? 'Edad CSPA proyectada' : 'Projected CSPA age', `${proj.base.cspaAge.toFixed(2)} ${isEs ? 'años' : 'years'}`]);
      }
    }
    if (proj.effectiveAgeOut) {
      metrics.push([isEs ? 'Fecha límite de edad (cumple 21 - crédito)' : 'Age deadline (turns 21 - credit)', formatDatePDF(proj.effectiveAgeOut, data.lang)]);
    }
    if (proj.marginMonths !== undefined) {
      const marginStr = proj.marginMonths > 0 ? `+${proj.marginMonths} ${isEs ? 'meses de margen' : 'months margin'}` : `${proj.marginMonths} ${isEs ? 'meses (sin margen)' : 'months (no margin)'}`;
      metrics.push([isEs ? 'Margen de tiempo' : 'Time margin', marginStr]);
    }
    if (proj.pendingTimeDays) {
      metrics.push([isEs ? 'Crédito CSPA (tiempo pendiente)' : 'CSPA credit (pending time)', daysToHuman(proj.pendingTimeDays, data.lang)]);
    }

    if (metrics.length > 0) {
      metrics.forEach(([label, value], i) => {
        doc.setFillColor(i % 2 === 0 ? 245 : 252, i % 2 === 0 ? 247 : 252, 252);
        doc.rect(20, py - 3, W - 40, 10, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(label, 25, py + 3);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(value, W - 25, py + 3, { align: 'right' });
        py += 12;
      });
      py += 4;
    }

    // Three scenarios
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(isEs ? 'Los tres escenarios' : 'The three scenarios', 20, py);
    py += 8;

    const scenarios = [
      { label: isEs ? 'Si la fila se mueve rápido' : 'If the line moves fast', data: proj.optimistic, bgColor: [230, 245, 230] as const, icon: '>' },
      { label: isEs ? 'Al paso normal' : 'At normal pace', data: proj.base, bgColor: [255, 248, 220] as const, icon: '=' },
      { label: isEs ? 'Si la fila se mueve lento' : 'If the line moves slowly', data: proj.pessimistic, bgColor: [255, 235, 235] as const, icon: '<' },
    ];

    scenarios.forEach((s) => {
      if (!s.data) return;
      doc.setFillColor(s.bgColor[0], s.bgColor[1], s.bgColor[2]);
      doc.roundedRect(20, py - 4, W - 40, 24, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(s.label, 25, py + 3);

      // Status icon
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(s.data.agedOut ? RED : GREEN));
      doc.text(s.data.agedOut ? (isEs ? 'NO califica' : 'Does NOT qualify') : (isEs ? 'Califica' : 'Qualifies'), W - 25, py + 3, { align: 'right' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const dateStr = formatDatePDF(s.data.date, data.lang);
      const waitStr = monthsToHuman(s.data.months, data.lang);
      doc.text(`${isEs ? 'Fecha estimada' : 'Estimated date'}: ${dateStr}  |  ${isEs ? 'Espera' : 'Wait'}: ~${waitStr}`, 25, py + 13);
      py += 30;
    });

    // Rate info
    if (proj.rateDaysPerMonth) {
      py += 2;
      doc.setFillColor(...LIGHT);
      doc.roundedRect(20, py - 4, W - 40, 22, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(`${isEs ? 'Velocidad actual de la fila' : 'Current line speed'}: ${proj.rateDaysPerMonth} ${isEs ? 'días/mes' : 'days/month'}`, 25, py + 3);

      if (proj.rates) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        const rateDetails: string[] = [];
        if (proj.rates.rate_12m !== null) rateDetails.push(`${isEs ? 'Último año' : 'Last year'}: ${proj.rates.rate_12m} d/m`);
        if (proj.rates.rate_24m !== null) rateDetails.push(`${isEs ? 'Últimos 2 años' : 'Last 2 years'}: ${proj.rates.rate_24m} d/m`);
        if (proj.rates.rate_36m !== null) rateDetails.push(`${isEs ? 'Últimos 3 años' : 'Last 3 years'}: ${proj.rates.rate_36m} d/m`);
        doc.text(rateDetails.join('  |  '), 25, py + 11);
      }
      py += 26;
    }

    // Projection disclaimer
    py += 2;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(20, py - 4, W - 40, 20, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    const discText = isEs
      ? 'IMPORTANTE: Estas proyecciones son estimaciones basadas en datos históricos del Boletín de Visas. La velocidad real puede variar significativamente. No constituyen una garantía ni asesoría legal. La fila puede avanzar más rápido o más lento de lo esperado.'
      : 'IMPORTANT: These projections are estimates based on historical Visa Bulletin data. Actual speed may vary significantly. They do not constitute a guarantee or legal advice. The line may move faster or slower than expected.';
    const discLines = doc.splitTextToSize(discText, W - 50);
    doc.text(discLines, 25, py + 2);
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 4: IMPORTANT CONSIDERATIONS
  // ══════════════════════════════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, isEs ? 'Consideraciones importantes' : 'Important considerations', W);

  let cy = 40;

  // Marriage impact (detailed per category)
  const familyCats = ['F1', 'F2A', 'F2B', 'F3', 'F4'];
  if (familyCats.includes(data.category)) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(isEs ? '¿Qué pasa si el beneficiario se casa?' : 'What if the beneficiary gets married?', 20, cy);
    cy += 8;

    // ── Category-specific marriage data ──
    const marriageData: Record<string, { severity: 'severe' | 'moderate' | 'none'; riskTag: [string, string]; who: [string, string]; cspaProtects: [string, string]; effect: [string, string]; example: [string, string] }> = {
      F1: {
        severity: 'moderate',
        riskTag: ['RIESGO MODERADO — El caso pasa de F1 a F3 (fila más lenta).', 'MODERATE RISK — Case moves from F1 to F3 (slower line).'],
        who: ['El beneficiario principal es el hijo/a soltero/a (21+) del ciudadano americano.', 'The principal beneficiary is the unmarried son/daughter (21+) of the U.S. citizen.'],
        cspaProtects: ['La CSPA protege a los hijos derivados (hijos menores del beneficiario principal — nietos del peticionario).', 'CSPA protects the derivative children (minor children of the principal — petitioner\'s grandchildren).'],
        effect: ['Si el beneficiario principal se casa, el caso pasa de F1 a F3. La petición no se destruye, pero la fila F3 es significativamente más lenta. Los hijos derivados mantienen la protección CSPA pero bajo el calendario más lento de F3, lo que puede aumentar el riesgo de que cumplan 21.', 'If the principal gets married, the case moves from F1 to F3. The petition isn\'t destroyed, but the F3 line is significantly slower. Derivative children keep CSPA protection but under the slower F3 timeline, increasing the risk of aging out.'],
        example: ['Ejemplo: Carlos (F1, 28 años) tiene un hijo de 16. Si Carlos se casa, pasa a F3. Su hijo sigue protegido por CSPA, pero ahora bajo la fila F3 que puede tardar considerablemente más. Su hijo podría cumplir 21 antes de que la visa esté disponible.', 'Example: Carlos (F1, age 28) has a 16-year-old son. If Carlos marries, he moves to F3. His son keeps CSPA protection, but now under the F3 line which could take considerably longer. His son could turn 21 before the visa is available.'],
      },
      F2A: {
        severity: 'severe',
        riskTag: ['RIESGO ALTO — Depende de quién sea el beneficiario principal.', 'HIGH RISK — Depends on who the principal beneficiary is.'],
        who: ['El beneficiario principal puede ser: (a) el cónyuge del residente permanente, o (b) un hijo/a menor soltero/a (menor de 21).', 'The principal beneficiary can be: (a) the LPR\'s spouse, or (b) an unmarried minor child (under 21).'],
        cspaProtects: ['Si el principal es el hijo menor: la CSPA lo protege directamente. Si el principal es el cónyuge: la CSPA protege a los hijos derivados del cónyuge.', 'If the principal is the minor child: CSPA directly protects them. If the principal is the spouse: CSPA protects the spouse\'s derivative children.'],
        effect: ['Si el hijo menor (principal) se casa: pierde COMPLETAMENTE el estatus de "hijo". No existe categoría para hijo casado de residente permanente. Pérdida total e irreversible. Si el principal es el cónyuge: el cónyuge ya está casado (esa es la base), pero sus hijos derivados necesitan protección CSPA.', 'If the minor child (principal) marries: they COMPLETELY lose "child" status. No category exists for a married child of an LPR. Total, irreversible loss. If the principal is the spouse: they\'re already married (that\'s the basis), but their derivative children need CSPA protection.'],
        example: ['Ejemplo: María (cónyuge F2A) tiene dos hijos de 15 y 18. La CSPA protege a ambos hijos como derivados. Si el hijo de 18 (edad CSPA) cumple 21 antes de que la visa esté disponible, queda fuera del caso. Es crucial monitorear su edad.', 'Example: Maria (F2A spouse) has children ages 15 and 18. CSPA protects both as derivatives. If the 18-year-old (CSPA age) turns 21 before the visa is available, they fall out of the case. Monitoring their age is crucial.'],
      },
      F2B: {
        severity: 'severe',
        riskTag: ['RIESGO ALTO — Casarse destruye la petición por completo.', 'HIGH RISK — Getting married destroys the petition entirely.'],
        who: ['El beneficiario principal es el hijo/a soltero/a (21+) del residente permanente.', 'The principal beneficiary is the unmarried adult son/daughter (21+) of the LPR.'],
        cspaProtects: ['La CSPA protege a los hijos derivados (hijos menores del beneficiario principal — nietos del peticionario residente).', 'CSPA protects the derivative children (minor children of the principal — LPR petitioner\'s grandchildren).'],
        effect: ['Si el beneficiario principal se casa, pierde la categoría F2B por completo. No existe categoría para hijo casado de residente permanente. La petición se destruye y los derivados también pierden su protección. La única forma de recuperar sería que el peticionario se naturalice y presente una nueva petición bajo F3.', 'If the principal gets married, they completely lose F2B. No category exists for a married child of an LPR. The petition is destroyed and derivatives also lose protection. The only recovery path: petitioner naturalizes and files new petition under F3.'],
        example: ['Ejemplo: Pedro (F2B, 25 años) tiene un hijo de 12. Si Pedro se casa, la petición desaparece. Su hijo pierde toda protección CSPA. Si el padre de Pedro se hace ciudadano, podría presentar una NUEVA petición bajo F3, pero empezaría de cero.', 'Example: Pedro (F2B, age 25) has a 12-year-old son. If Pedro marries, the petition disappears. His son loses all CSPA protection. If Pedro\'s father becomes a citizen, he could file a NEW F3 petition, but it would start from scratch.'],
      },
      F3: {
        severity: 'none',
        riskTag: ['SIN RIESGO — El beneficiario ya está en la categoría de hijo casado.', 'NO RISK — The beneficiary is already in the married child category.'],
        who: ['El beneficiario principal es el hijo/a casado/a de un ciudadano americano.', 'The principal beneficiary is the married son/daughter of a U.S. citizen.'],
        cspaProtects: ['La CSPA protege a los hijos derivados (hijos menores del beneficiario principal — nietos del peticionario).', 'CSPA protects the derivative children (minor children of the principal — petitioner\'s grandchildren).'],
        effect: ['El beneficiario principal ya está casado — ese es el requisito de esta categoría. El matrimonio no cambia nada. Sus hijos derivados mantienen la protección CSPA normalmente.', 'The principal is already married — that\'s the requirement for this category. Marriage doesn\'t change anything. Derivative children keep CSPA protection normally.'],
        example: ['Ejemplo: Ana (F3) tiene un hijo de 14. Como Ana ya está casada, su estado civil no afecta el caso. Su hijo está protegido por CSPA y solo necesita monitorear que su edad CSPA no llegue a 21 antes de la visa.', 'Example: Ana (F3) has a 14-year-old son. Since Ana is already married, her marital status doesn\'t affect the case. Her son is protected by CSPA and just needs to ensure his CSPA age doesn\'t reach 21 before the visa.'],
      },
      F4: {
        severity: 'none',
        riskTag: ['SIN RIESGO — El estado civil no afecta la categoría F4.', 'NO RISK — Marital status doesn\'t affect the F4 category.'],
        who: ['El beneficiario principal es el hermano/a del ciudadano americano.', 'The principal beneficiary is the sibling of the U.S. citizen.'],
        cspaProtects: ['La CSPA protege a los hijos derivados (hijos menores del beneficiario — sobrinos del peticionario).', 'CSPA protects the derivative children (minor children of the beneficiary — petitioner\'s nieces/nephews).'],
        effect: ['El estado civil del beneficiario principal no afecta F4. Ya sea soltero o casado, la categoría es la misma. Los hijos derivados mantienen la protección CSPA normalmente.', 'The principal\'s marital status doesn\'t affect F4. Whether single or married, the category stays the same. Derivative children keep CSPA protection normally.'],
        example: ['Ejemplo: Luis (F4) tiene hijos de 10 y 17. Si Luis se casa o divorcia, su categoría F4 no cambia. Sus hijos están protegidos por CSPA. El único riesgo es que la fila F4 es muy lenta y alguno podría cumplir 21 antes.', 'Example: Luis (F4) has children ages 10 and 17. If Luis marries or divorces, his F4 category doesn\'t change. His children are protected by CSPA. The only risk is the F4 line is very slow and one could turn 21 before then.'],
      },
    };

    const catInfo = marriageData[data.category];
    if (catInfo) {
      const li = isEs ? 0 : 1;

      // Risk severity banner
      const bannerColor = catInfo.severity === 'severe' ? [255, 235, 235] as const : catInfo.severity === 'moderate' ? [255, 248, 220] as const : [230, 245, 230] as const;
      const textColor = catInfo.severity === 'severe' ? RED : catInfo.severity === 'moderate' ? GOLD : GREEN;
      doc.setFillColor(bannerColor[0], bannerColor[1], bannerColor[2]);
      doc.roundedRect(20, cy - 3, W - 40, 12, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(catInfo.riskTag[li], 25, cy + 5);
      cy += 16;

      // Who is who
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(isEs ? 'Quién es quién en esta categoría:' : 'Who is who in this category:', 25, cy);
      cy += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const whoLines = doc.splitTextToSize(catInfo.who[li], W - 55);
      doc.text(whoLines, 25, cy);
      cy += whoLines.length * 4 + 3;

      // Who does CSPA protect
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(isEs ? 'A quién protege la CSPA:' : 'Who does CSPA protect:', 25, cy);
      cy += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const cspaLines = doc.splitTextToSize(catInfo.cspaProtects[li], W - 55);
      doc.text(cspaLines, 25, cy);
      cy += cspaLines.length * 4 + 3;

      // Marriage effect
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(isEs ? 'Qué pasa si se casa:' : 'What happens if they marry:', 25, cy);
      cy += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const effectLines = doc.splitTextToSize(catInfo.effect[li], W - 55);
      doc.text(effectLines, 25, cy);
      cy += effectLines.length * 4 + 4;

      // Narrative example box
      doc.setFillColor(...LIGHT);
      doc.roundedRect(20, cy - 3, W - 40, 28, 2, 2, 'F');
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(22, cy - 3, 22, cy + 25);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(isEs ? 'Ejemplo práctico:' : 'Practical example:', 27, cy + 3);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const exLines = doc.splitTextToSize(catInfo.example[li], W - 60);
      doc.text(exLines, 27, cy + 9);
      cy += 32;
    }
  }

  // Sought to Acquire reminder
  if (data.qualifies || (hasProjection && !proj?.base?.agedOut)) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(isEs ? 'Plazo de 1 año para actuar (Sought to Acquire)' : '1-year deadline to act (Sought to Acquire)', 20, cy);
    cy += 7;

    doc.setFillColor(255, 248, 220);
    doc.roundedRect(20, cy - 3, W - 40, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const staLines = doc.splitTextToSize(
      isEs
        ? 'Si el beneficiario califica bajo CSPA, tiene MÁXIMO 1 AÑO desde que la visa estuvo disponible para demostrar que "buscó adquirir" la residencia. Si no actúa dentro de ese plazo, pierde la protección CSPA aunque califique por edad.'
        : 'If the beneficiary qualifies under CSPA, they have a MAXIMUM of 1 YEAR from when the visa became available to demonstrate they "sought to acquire" residence. Missing this deadline means losing CSPA protection even if they qualify by age.',
      W - 50
    );
    doc.text(staLines, 25, cy + 2);
    cy += staLines.length * 4 + 10;
  }

  // What is CSPA explanation
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? '¿Qué es la ley CSPA?' : 'What is the CSPA law?', 20, cy);
  cy += 7;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const cspaExpl = isEs
    ? 'La Child Status Protection Act (CSPA) es una ley federal que protege a los hijos de inmigrantes que "envejecen" mientras esperan su visa. Normalmente, un "hijo" debe ser soltero y menor de 21 años. La ley CSPA permite restar el tiempo que USCIS tardó en procesar la petición de la edad del beneficiario, efectivamente "congelando" su edad. Si después de restar este crédito la edad es menor de 21, el beneficiario mantiene su clasificación como "hijo" y puede continuar con su proceso migratorio.'
    : 'The Child Status Protection Act (CSPA) is a federal law that protects children of immigrants who "age out" while waiting for their visa. Normally, a "child" must be unmarried and under 21. The CSPA law allows subtracting the time USCIS took to process the petition from the beneficiary\'s age, effectively "freezing" their age. If after subtracting this credit the age is under 21, the beneficiary maintains their classification as a "child" and can continue their immigration process.';
  const cspaLines2 = doc.splitTextToSize(cspaExpl, W - 50);
  doc.text(cspaLines2, 25, cy);

  // ══════════════════════════════════════════════════════════════════
  // FOOTER on every page
  // ══════════════════════════════════════════════════════════════════
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(20, pageH - 20, pageW - 20, pageH - 20);

    if (data.firmName) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(data.firmName, 20, pageH - 14);
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('Powered by NER Immigration AI', pageW / 2, pageH - 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`${i} / ${totalPages}`, pageW - 20, pageH - 14, { align: 'right' });

    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text(
      isEs
        ? 'Este documento no constituye asesoría legal. Los resultados son orientativos y deben ser verificados por un profesional.'
        : 'This document does not constitute legal advice. Results are for guidance only and must be verified by a professional.',
      pageW / 2, pageH - 8, { align: 'center' }
    );
  }

  const filename = `CSPA_Report_${data.clientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
