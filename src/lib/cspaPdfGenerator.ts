import jsPDF from 'jspdf';

const NAVY = [22, 42, 90] as const;
const GOLD = [196, 155, 48] as const;
const GRAY = [100, 110, 130] as const;
const LIGHT = [245, 247, 252] as const;

export interface CSPAReportData {
  // Client / lead
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  // Calculation inputs
  dob: string;
  priorityDate: string;
  approvalDate: string;
  visaAvailableDate: string;
  category: string;
  chargeability: string;
  // Results
  cspaAgeYears: number;
  qualifies: boolean;
  pendingTimeDays: number;
  biologicalAgeDays: number;
  bulletinInfo?: string;
  approvalControlled?: boolean;
  // Hypothetical
  isHypothetical?: boolean;
  // Firm branding
  firmName?: string;
  logoUrl?: string;
  // Projection scenarios
  projection?: {
    base?: { date: string; months: number; agedOut: boolean };
    optimistic?: { date: string; months: number; agedOut: boolean };
    pessimistic?: { date: string; months: number; agedOut: boolean };
  };
  lang: 'es' | 'en';
}

function formatDatePDF(dateStr: string, lang: 'es' | 'en'): string {
  if (!dateStr) return '—';
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

export async function generateCSPAReport(data: CSPAReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const isEs = data.lang === 'es';
  const today = new Date().toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── COVER PAGE ──────────────────────────────────────────────────
  let headerY = 20;

  // Firm logo
  if (data.logoUrl) {
    const logoData = await loadLogoAsDataUrl(data.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 20, headerY, 30, 30);
        headerY += 5;
      } catch { /* skip logo on error */ }
    }
  }

  // Firm name
  if (data.firmName) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(data.firmName, data.logoUrl ? 55 : 20, headerY + 10);
    headerY = headerY + 18;
  }

  // Gold separator
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(20, headerY + 18, W - 20, headerY + 18);

  // Title
  const titleY = headerY + 35;
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('CSPA', W / 2, titleY, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(...GRAY);
  doc.text(isEs ? 'Análisis de Edad CSPA' : 'CSPA Age Analysis', W / 2, titleY + 10, { align: 'center' });

  // Hypothetical banner on cover
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
    const hypText = isEs
      ? '🔮 SIMULACIÓN HIPOTÉTICA — La visa aún no está disponible'
      : '🔮 HYPOTHETICAL SIMULATION — Visa is not yet available';
    doc.text(hypText, W / 2, bannerY + 9, { align: 'center' });
  }

  // Client info box
  const boxY = titleY + (data.isHypothetical ? 40 : 25);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(30, boxY, W - 60, 40, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Preparado para:' : 'Prepared for:', 40, boxY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(data.clientName, 90, boxY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Fecha:' : 'Date:', 40, boxY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(today, 90, boxY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Categoría:' : 'Category:', 40, boxY + 32);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`${data.category} / ${data.chargeability}`, 90, boxY + 32);

  // ── PAGE 2: RESULTS ──────────────────────────────────────────────
  doc.addPage();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Resultado del Análisis' : 'Analysis Result', 20, 25);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(20, 30, W - 20, 30);

  // Hypothetical note on results page
  let startY = 40;
  if (data.isHypothetical) {
    doc.setFillColor(255, 248, 220);
    doc.roundedRect(20, startY - 4, W - 40, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    const hypNote = isEs
      ? '🔮 Simulación: Este resultado muestra qué pasaría si la visa estuviera disponible hoy. No es un resultado definitivo.'
      : '🔮 Simulation: This result shows what would happen if the visa were available today. Not a definitive result.';
    doc.text(hypNote, 25, startY + 5);
    startY += 20;
  }

  // CSPA Age result banner
  if (data.qualifies) {
    doc.setFillColor(230, 245, 230);
  } else {
    doc.setFillColor(255, 235, 235);
  }
  doc.roundedRect(20, startY, W - 40, 35, 3, 3, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Edad CSPA:' : 'CSPA Age:', 30, startY + 14);
  doc.setFontSize(24);
  doc.text(`${data.cspaAgeYears.toFixed(2)}`, 80, startY + 15);
  doc.setFontSize(10);
  doc.text(isEs ? 'años' : 'years', 110, startY + 15);

  doc.setFontSize(11);
  if (data.qualifies) {
    doc.setTextColor(34, 139, 34);
    doc.text(isEs ? '✓ CALIFICA — Edad menor de 21' : '✓ QUALIFIES — Age under 21', 30, startY + 27);
  } else {
    doc.setTextColor(180, 30, 30);
    doc.text(isEs ? '✗ NO CALIFICA — Edad supera 21' : '✗ DOES NOT QUALIFY — Age exceeds 21', 30, startY + 27);
  }

  // Dates table
  let tableY = startY + 50;
  const visaLabel = data.isHypothetical
    ? (isEs ? 'Fecha Simulada (hoy)' : 'Simulated Date (today)')
    : (isEs ? 'Visa Disponible' : 'Visa Available');
  const dates = [
    [isEs ? 'Fecha de Nacimiento' : 'Date of Birth', formatDatePDF(data.dob, data.lang)],
    [isEs ? 'Fecha de Prioridad' : 'Priority Date', formatDatePDF(data.priorityDate, data.lang)],
    [isEs ? 'Fecha de Aprobación' : 'Approval Date', formatDatePDF(data.approvalDate, data.lang)],
    [visaLabel, data.visaAvailableDate ? formatDatePDF(data.visaAvailableDate, data.lang) : (isEs ? 'Hoy (simulación)' : 'Today (simulation)')],
  ];

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Fechas del Caso' : 'Case Dates', 20, tableY);
  tableY += 8;

  dates.forEach(([label, value]) => {
    doc.setFillColor(...LIGHT);
    doc.rect(20, tableY - 4, W - 40, 10, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(label, 25, tableY + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(value, W - 25, tableY + 2, { align: 'right' });
    tableY += 12;
  });

  // Calculation breakdown — HUMAN READABLE
  tableY += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? '¿Cómo se calculó?' : 'How was it calculated?', 20, tableY);
  tableY += 10;

  const pendingHuman = daysToHuman(data.pendingTimeDays, data.lang);
  const bioHuman = daysToHuman(data.biologicalAgeDays, data.lang);

  const steps = [
    {
      label: isEs ? 'Paso 1: Tiempo que USCIS se tardó en aprobar' : 'Step 1: How long USCIS took to approve',
      detail: isEs
        ? `Desde que se presentó hasta que se aprobó pasaron ${pendingHuman}. Este tiempo se resta de la edad como beneficio de la ley CSPA.`
        : `From filing to approval took ${pendingHuman}. This time is subtracted from the age as a CSPA law benefit.`,
      value: pendingHuman,
    },
    {
      label: isEs ? 'Paso 2: Edad real cuando la visa estuvo lista' : 'Step 2: Actual age when visa was ready',
      detail: isEs
        ? `El beneficiario tenía ${bioHuman} (${daysToYearsStr(data.biologicalAgeDays)} años exactos) cuando la visa estuvo disponible.`
        : `The beneficiary was ${bioHuman} (${daysToYearsStr(data.biologicalAgeDays)} exact years) when the visa became available.`,
      value: `${daysToYearsStr(data.biologicalAgeDays)} ${isEs ? 'años' : 'years'}`,
    },
    {
      label: isEs ? 'Paso 3: Edad CSPA (resultado final)' : 'Step 3: CSPA Age (final result)',
      detail: isEs
        ? `Edad real (${bioHuman}) menos crédito USCIS (${pendingHuman}) = ${data.cspaAgeYears.toFixed(2)} años`
        : `Actual age (${bioHuman}) minus USCIS credit (${pendingHuman}) = ${data.cspaAgeYears.toFixed(2)} years`,
      value: `${data.cspaAgeYears.toFixed(2)} ${isEs ? 'años' : 'years'}`,
    },
  ];

  steps.forEach((step) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(step.label, 25, tableY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(step.detail, W - 55);
    doc.text(lines, 25, tableY + 5);
    tableY += 7 + lines.length * 4;
  });

  // Bulletin info
  if (data.bulletinInfo) {
    tableY += 3;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(20, tableY - 4, W - 40, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text(`📌 ${data.bulletinInfo}`, 25, tableY + 3);
    if (data.approvalControlled) {
      doc.text(isEs ? '⚖️ Se usó la fecha de aprobación (posterior al boletín)' : '⚖️ Approval date used (later than bulletin)', 25, tableY + 8);
    }
    tableY += 18;
  }

  // ── PROJECTIONS (if available) — PAGE 3 ─────────────────────────
  const hasProjection = data.projection && (data.projection.base || data.projection.optimistic || data.projection.pessimistic);
  if (hasProjection) {
    doc.addPage();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(isEs ? '🔮 Proyección: ¿Cuándo podría estar lista la visa?' : '🔮 Projection: When could the visa be ready?', 20, 25);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(20, 30, W - 20, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const projIntro = isEs
      ? 'Basado en cómo se ha movido la fila históricamente, estos son los escenarios estimados:'
      : 'Based on how the line has historically moved, these are the estimated scenarios:';
    doc.text(projIntro, 20, 38);

    let projY = 48;

    const scenarios = [
      { label: isEs ? '🟢 Si la fila se mueve rápido (Optimista)' : '🟢 If the line moves fast (Optimistic)', data: data.projection!.optimistic, color: [230, 245, 230] as const },
      { label: isEs ? '🟡 Al paso normal (Base)' : '🟡 At normal pace (Base)', data: data.projection!.base, color: [255, 248, 220] as const },
      { label: isEs ? '🔴 Si la fila se mueve lento (Pesimista)' : '🔴 If the line moves slowly (Pessimistic)', data: data.projection!.pessimistic, color: [255, 235, 235] as const },
    ];

    scenarios.forEach((s) => {
      if (!s.data) return;
      doc.setFillColor(s.color[0], s.color[1], s.color[2]);
      doc.roundedRect(20, projY - 4, W - 40, 22, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(s.label, 25, projY + 3);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);

      const dateFormatted = formatDatePDF(s.data.date, data.lang);
      const waitHuman = daysToHuman(s.data.months * 30, data.lang);
      const statusTxt = s.data.agedOut
        ? (isEs ? '⚠ Riesgo de age-out' : '⚠ Age-out risk')
        : (isEs ? '✓ Se ve bien' : '✓ Looking good');

      doc.text(`${isEs ? 'Fecha estimada' : 'Estimated date'}: ${dateFormatted}  ·  ${isEs ? 'Espera' : 'Wait'}: ~${waitHuman}  ·  ${statusTxt}`, 25, projY + 12);
      projY += 28;
    });

    // Projection disclaimer
    projY += 5;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(20, projY - 4, W - 40, 18, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    const discText = isEs
      ? 'Estas proyecciones son estimaciones basadas en datos históricos del Boletín de Visas. La velocidad real de la fila puede variar significativamente. No constituyen una garantía ni asesoría legal.'
      : 'These projections are estimates based on historical Visa Bulletin data. Actual line speed may vary significantly. They do not constitute a guarantee or legal advice.';
    const discLines = doc.splitTextToSize(discText, W - 50);
    doc.text(discLines, 25, projY + 3);
  }

  // ── FOOTER on every page ───────────────────────────────────────
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
