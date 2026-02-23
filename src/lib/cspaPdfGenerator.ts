import jsPDF from 'jspdf';

const NAVY = [22, 42, 90] as const;
const GOLD = [196, 155, 48] as const;
const GRAY = [100, 110, 130] as const;
const LIGHT = [245, 247, 252] as const;
const WHITE = [255, 255, 255] as const;

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

function formatDatePDF(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${months[monthIdx]} ${parseInt(parts[2])}, ${parts[0]}`;
  }
  return dateStr;
}

function daysToYears(days: number): string {
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
  const H = doc.internal.pageSize.getHeight();
  const isEs = data.lang === 'es';
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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

  // Client info box
  const boxY = titleY + 25;
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
  doc.text(isEs ? 'Resultado del Cálculo' : 'Calculation Result', 20, 25);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(20, 30, W - 20, 30);

  // CSPA Age result banner
  const bannerY = 40;
  if (data.qualifies) {
    doc.setFillColor(230, 245, 230);
  } else {
    doc.setFillColor(255, 235, 235);
  }
  doc.roundedRect(20, bannerY, W - 40, 35, 3, 3, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Edad CSPA:' : 'CSPA Age:', 30, bannerY + 14);
  doc.setFontSize(24);
  doc.text(`${data.cspaAgeYears.toFixed(2)}`, 80, bannerY + 15);
  doc.setFontSize(10);
  doc.text(isEs ? 'años' : 'years', 110, bannerY + 15);

  doc.setFontSize(11);
  if (data.qualifies) {
    doc.setTextColor(34, 139, 34);
    doc.text(isEs ? '✓ CALIFICA — Edad menor de 21' : '✓ QUALIFIES — Age under 21', 30, bannerY + 27);
  } else {
    doc.setTextColor(180, 30, 30);
    doc.text(isEs ? '✗ NO CALIFICA — Edad supera 21' : '✗ DOES NOT QUALIFY — Age exceeds 21', 30, bannerY + 27);
  }

  // Dates table
  let tableY = bannerY + 50;
  const dates = [
    [isEs ? 'Fecha de Nacimiento' : 'Date of Birth', formatDatePDF(data.dob)],
    [isEs ? 'Fecha de Prioridad' : 'Priority Date', formatDatePDF(data.priorityDate)],
    [isEs ? 'Fecha de Aprobación' : 'Approval Date', formatDatePDF(data.approvalDate)],
    [isEs ? 'Visa Disponible' : 'Visa Available', formatDatePDF(data.visaAvailableDate)],
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

  // Calculation breakdown
  tableY += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(isEs ? 'Desglose del Cálculo' : 'Calculation Breakdown', 20, tableY);
  tableY += 10;

  const steps = [
    {
      label: isEs ? 'Paso 1: Tiempo pendiente en USCIS' : 'Step 1: Pending time at USCIS',
      formula: isEs ? 'Aprobación − Prioridad' : 'Approval − Priority',
      value: `${data.pendingTimeDays} ${isEs ? 'días' : 'days'} (${daysToYears(data.pendingTimeDays)} ${isEs ? 'años' : 'years'})`,
    },
    {
      label: isEs ? 'Paso 2: Edad biológica al visa disponible' : 'Step 2: Biological age at visa available',
      formula: isEs ? 'Visa Disponible − Nacimiento' : 'Visa Available − Birth',
      value: `${data.biologicalAgeDays} ${isEs ? 'días' : 'days'} (${daysToYears(data.biologicalAgeDays)} ${isEs ? 'años' : 'years'})`,
    },
    {
      label: isEs ? 'Paso 3: Edad CSPA final' : 'Step 3: Final CSPA age',
      formula: isEs ? 'Edad Biológica − Tiempo USCIS' : 'Biological Age − USCIS Time',
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
    doc.text(`${step.formula} = ${step.value}`, 25, tableY + 5);
    tableY += 14;
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

  // ── PROJECTIONS (if available) ─────────────────────────────────
  if (data.projection && (data.projection.base || data.projection.optimistic || data.projection.pessimistic)) {
    tableY += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(isEs ? 'Proyección de Escenarios' : 'Scenario Projections', 20, tableY);
    tableY += 10;

    const scenarios = [
      { label: isEs ? 'Optimista' : 'Optimistic', data: data.projection.optimistic },
      { label: isEs ? 'Base' : 'Base', data: data.projection.base },
      { label: isEs ? 'Pesimista' : 'Pessimistic', data: data.projection.pessimistic },
    ];

    scenarios.forEach((s) => {
      if (!s.data) return;
      doc.setFillColor(...LIGHT);
      doc.roundedRect(20, tableY - 4, W - 40, 12, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(s.label, 25, tableY + 2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const statusTxt = s.data.agedOut
        ? (isEs ? '⚠ Age Out' : '⚠ Age Out')
        : (isEs ? '✓ Califica' : '✓ Qualifies');
      doc.text(`${formatDatePDF(s.data.date)} (~${s.data.months} ${isEs ? 'meses' : 'months'}) — ${statusTxt}`, 60, tableY + 2);
      tableY += 14;
    });
  }

  // ── FOOTER on every page ───────────────────────────────────────
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();

    // Gold line
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(20, pageH - 20, pageW - 20, pageH - 20);

    // Firm name left
    if (data.firmName) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(data.firmName, 20, pageH - 14);
    }

    // NER credit center
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('Powered by NER Immigration AI', pageW / 2, pageH - 14, { align: 'center' });

    // Page number right
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`${i} / ${totalPages}`, pageW - 20, pageH - 14, { align: 'right' });

    // Disclaimer
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text(
      isEs
        ? 'Este documento no constituye asesoría legal. Los resultados son orientativos y deben ser verificados por un profesional.'
        : 'This document does not constitute legal advice. Results are for guidance only and must be verified by a professional.',
      pageW / 2, pageH - 8, { align: 'center' }
    );
  }

  // Save
  const filename = `CSPA_Report_${data.clientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
