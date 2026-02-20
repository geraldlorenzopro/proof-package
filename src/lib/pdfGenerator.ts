import jsPDF from 'jspdf';
import { EvidenceItem, CaseInfo } from '@/types/evidence';
import { buildCaption, formatDateDisplay } from './evidenceUtils';

const NAVY = [22, 42, 90] as const;
const GOLD = [196, 155, 48] as const;
const GRAY = [100, 110, 130] as const;
const LIGHT = [245, 247, 252] as const;

function addPageFooter(doc: jsPDF, exhibitNum: string, compiledDate: string, pageNum: number) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(20, pageH - 18, pageW - 20, pageH - 18);

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Exhibit ${exhibitNum}`, 20, pageH - 10);
  doc.text(`Compiled: ${compiledDate}`, pageW / 2, pageH - 10, { align: 'center' });
  doc.text(`Page ${pageNum}`, pageW - 20, pageH - 10, { align: 'right' });
}

export async function generateEvidencePDF(
  items: EvidenceItem[],
  caseInfo: CaseInfo
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let pageNum = 1;

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  // Background
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, H, 'F');

  // Gold top bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 6, 'F');

  // Logo / Title area
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('USCIS', W / 2, 22, { align: 'center' });

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Relationship Evidence Package', W / 2, 55, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 235);
  doc.text('Supporting Documentation for Immigration Case', W / 2, 65, { align: 'center' });

  // Separator line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(35, 75, W - 35, 75);

  // Info block
  const infoY = 90;
  const lineH = 9;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Petitioner:', 45, infoY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 230, 255);
  doc.text(caseInfo.petitioner_name || '—', 85, infoY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Beneficiary:', 45, infoY + lineH);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 230, 255);
  doc.text(caseInfo.beneficiary_name || '—', 85, infoY + lineH);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Case Type:', 45, infoY + lineH * 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 230, 255);
  doc.text(caseInfo.case_type || '—', 85, infoY + lineH * 2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Compiled:', 45, infoY + lineH * 3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 230, 255);
  doc.text(caseInfo.compiled_date, 85, infoY + lineH * 3);

  // Total exhibits
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(35, infoY + lineH * 3.8, W - 35, infoY + lineH * 3.8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 220);
  doc.text(`Total Exhibits: ${items.length}`, W / 2, infoY + lineH * 5, { align: 'center' });

  // Gold bottom bar
  doc.setFillColor(...GOLD);
  doc.rect(0, H - 6, W, 6, 'F');

  // ── TABLE OF CONTENTS PAGE ──────────────────────────────────────────────────
  doc.addPage();
  pageNum++;

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Table of Contents', 20, 18);
  doc.setFillColor(...GOLD);
  doc.rect(0, 28, W, 2, 'F');

  let tocY = 42;
  const sections = [
    { label: 'Section A – Photographs', type: 'photo', items: items.filter(i => i.type === 'photo') },
    { label: 'Section B – Messages & Chats', type: 'chat', items: items.filter(i => i.type === 'chat') },
    { label: 'Section C – Other Supporting Visuals', type: 'other', items: items.filter(i => i.type === 'other') },
  ];

  sections.forEach(sec => {
    if (sec.items.length === 0) return;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(sec.label, 20, tocY);
    tocY += 7;

    sec.items.forEach(item => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const desc = item.caption.length > 50 ? item.caption.substring(0, 50) + '…' : item.caption;
      doc.text(`  ${item.exhibit_number}    ${desc}`, 20, tocY);
      doc.text(formatDateDisplay(item.event_date, item.date_is_approximate), W - 20, tocY, { align: 'right' });
      tocY += 6;
    });
    tocY += 4;
  });

  addPageFooter(doc, 'INDEX', caseInfo.compiled_date, pageNum);

  // ── EVIDENCE SECTIONS ────────────────────────────────────────────────────────
  for (const sec of sections) {
    if (sec.items.length === 0) continue;

    // Section divider page
    doc.addPage();
    pageNum++;

    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 0, W, 4, 'F');
    doc.rect(0, H - 4, W, 4, 'F');

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(sec.label.split('–')[0].trim(), W / 2, H / 2 - 10, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 215, 245);
    const subLabel = sec.label.split('–')[1]?.trim() || '';
    doc.text(subLabel, W / 2, H / 2 + 5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(160, 175, 210);
    doc.text(`${sec.items.length} exhibit${sec.items.length !== 1 ? 's' : ''}`, W / 2, H / 2 + 18, { align: 'center' });

    // Each exhibit
    for (const item of sec.items) {
      doc.addPage();
      pageNum++;

      // Header bar
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 28, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD);
      doc.text(`Exhibit ${item.exhibit_number}`, 20, 12);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      const shortCaption = item.caption.length > 60 ? item.caption.substring(0, 60) + '…' : item.caption;
      doc.text(shortCaption, 20, 22);

      doc.setFillColor(...GOLD);
      doc.rect(0, 28, W, 1.5, 'F');

      // Image
      let imgY = 36;
      const maxImgH = 120;
      if (item.file.type.startsWith('image/')) {
        try {
          const imgData = await fileToBase64(item.file);
          const imgProps = doc.getImageProperties(imgData);
          const imgW = W - 40;
          const ratio = imgProps.height / imgProps.width;
          const imgH = Math.min(imgW * ratio, maxImgH);
          const fmt = (imgProps.fileType || '').toUpperCase() || 'JPEG';
          doc.addImage(imgData, fmt as 'JPEG' | 'PNG' | 'WEBP', 20, imgY, imgW, imgH);
          imgY += imgH + 6;
        } catch {
          doc.setFillColor(...LIGHT);
          doc.rect(20, imgY, W - 40, 50, 'F');
          doc.setFontSize(9);
          doc.setTextColor(...GRAY);
          doc.text('[La imagen no pudo renderizarse]', W / 2, imgY + 25, { align: 'center' });
          imgY += 56;
        }
      } else {
        // PDF or other non-image file — show placeholder
        doc.setFillColor(...LIGHT);
        doc.rect(20, imgY, W - 40, 30, 'F');
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        doc.text(`[Archivo adjunto: ${item.file.name}]`, W / 2, imgY + 17, { align: 'center' });
        imgY += 36;
      }

      // Caption / metadata block — dynamic height based on text
      const fullCaption = buildCaption(item);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(40, 55, 90);
      const captionLines = doc.splitTextToSize(fullCaption, W - 52);
      const captionH = captionLines.length * 5 + 6;
      const metaH = Math.max(30, captionH + 8);

      doc.setFillColor(...LIGHT);
      doc.roundedRect(20, imgY, W - 40, metaH, 2, 2, 'F');
      doc.text(captionLines, 26, imgY + 8);

      // Metadata row
      const metaRowY = imgY + metaH + 6;
      const metaItems = [
        { label: 'Date', value: formatDateDisplay(item.event_date, item.date_is_approximate) },
        { label: 'Participants', value: item.participants || '—' },
        { label: 'Source', value: item.source_location || '—' },
      ];
      if (item.platform) metaItems.push({ label: 'Platform', value: item.platform });

      let mx = 20;
      const colW = (W - 40) / metaItems.length;
      metaItems.forEach(m => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(196, 155, 48);
        doc.text(m.label.toUpperCase(), mx, metaRowY);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...NAVY);
        const valLines = doc.splitTextToSize(m.value, colW - 4);
        doc.text(valLines, mx, metaRowY + 5);
        mx += colW;
      });

      if (item.notes) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...GRAY);
        doc.text(`Note: ${item.notes}`, 20, metaRowY + 18);
      }

      addPageFooter(doc, item.exhibit_number, caseInfo.compiled_date, pageNum);
    }
  }

  // Save
  const filename = `USCIS_Evidence_${(caseInfo.petitioner_name || 'Case').replace(/\s+/g, '_')}_${caseInfo.compiled_date.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
