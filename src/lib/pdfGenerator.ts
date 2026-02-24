import jsPDF from 'jspdf';
import { EvidenceItem, CaseInfo } from '@/types/evidence';
import { buildCaption, generateExhibitNumber } from './evidenceUtils';
import { supabase } from '@/integrations/supabase/client';

// ── AI Translation via Lovable AI (Gemini) ──────────────────────────────────
async function translateItems(items: EvidenceItem[]): Promise<EvidenceItem[]> {
  const texts: Record<string, string> = {};
  for (const item of items) {
    if (item.caption) texts[`${item.id}__caption`] = item.caption;
    if (item.participants) texts[`${item.id}__participants`] = item.participants;
    if (item.location) texts[`${item.id}__location`] = item.location;
    if (item.notes) texts[`${item.id}__notes`] = item.notes;
  }

  if (Object.keys(texts).length === 0) return items;

  try {
    const { data, error } = await supabase.functions.invoke('translate-evidence', { body: { texts } });
    const translated: Record<string, string> = (data && !error) ? (data.translated || {}) : {};
    return items.map(item => ({
      ...item,
      caption: translated[`${item.id}__caption`] || item.caption,
      participants: translated[`${item.id}__participants`] || item.participants,
      location: item.location ? (translated[`${item.id}__location`] || item.location) : item.location,
      notes: item.notes ? (translated[`${item.id}__notes`] || item.notes) : item.notes,
    }));
  } catch {
    return items; // fallback to originals on error
  }
}

// ── Color palette ───────────────────────────────────────────────────────────
const NAVY = [22, 42, 90] as const;
const GOLD = [196, 155, 48] as const;
const GRAY = [100, 110, 130] as const;
const LIGHT = [245, 247, 252] as const;
const WHITE = [255, 255, 255] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function isImageItem(item: EvidenceItem): boolean {
  const ext = item.file.name?.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return true;
  if (item.file.type?.startsWith('image/')) return true;
  if (item.previewUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(item.previewUrl)) return true;
  return false;
}

function formatDateForPDF(date: string, isApprox: boolean): string {
  if (!date) return 'Date not specified';
  const parts = date.split('-');
  if (parts.length === 3) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const year = parts[0];
    if (monthIdx >= 0 && monthIdx < 12) {
      const formatted = `${months[monthIdx]} ${day}, ${year}`;
      return isApprox ? `${formatted} (approx.)` : formatted;
    }
  }
  return isApprox ? `${date} (approx.)` : date;
}

function addPageFooter(doc: jsPDF, compiledDate: string, pageNum: number) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(20, pageH - 18, pageW - 20, pageH - 18);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Compiled: ${compiledDate}`, pageW / 2, pageH - 10, { align: 'center' });
  doc.text(`Page ${pageNum}`, pageW - 20, pageH - 10, { align: 'right' });
}

function drawGoldRule(doc: jsPDF, y: number, margin: number = 20) {
  const W = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(margin, y, W - margin, y);
}

// ── Main Export ──────────────────────────────────────────────────────────────

export async function generateEvidencePDF(
  items: EvidenceItem[],
  caseInfo: CaseInfo,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.('Translating to English…');
  const translatedItems = await translateItems(items);
  onProgress?.('Building PDF…');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let pageNum = 1;

  const photos = translatedItems.filter(i => i.type === 'photo');
  const chats = translatedItems.filter(i => i.type === 'chat');
  const others = translatedItems.filter(i => i.type === 'other');

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  // Title
  drawGoldRule(doc, 40, 35);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Relationship Evidence Package', W / 2, 58, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Supporting Documentation for Immigration Case', W / 2, 67, { align: 'center' });

  drawGoldRule(doc, 75, 35);

  // Case info block
  const infoY = 92;
  const lineH = 10;
  const labelX = 55;
  const valueX = 100;

  const infoRows = [
    { label: 'Petitioner:', value: caseInfo.petitioner_name || '—' },
    { label: 'Beneficiary:', value: caseInfo.beneficiary_name || '—' },
    { label: 'Compiled:', value: caseInfo.compiled_date },
  ];

  infoRows.forEach((row, i) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(row.label, labelX, infoY + i * lineH);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(row.value, valueX, infoY + i * lineH);
  });

  drawGoldRule(doc, infoY + lineH * 3.2, 35);

  // Section summary
  const summaryY = infoY + lineH * 4.5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  let sy = summaryY;
  if (photos.length > 0) { doc.text(`Section A – Photographs: ${photos.length} item${photos.length !== 1 ? 's' : ''}`, W / 2, sy, { align: 'center' }); sy += 7; }
  if (chats.length > 0) { doc.text(`Section B – Messages & Chats: ${chats.length} item${chats.length !== 1 ? 's' : ''}`, W / 2, sy, { align: 'center' }); sy += 7; }
  if (others.length > 0) { doc.text(`Section C – Other Documents: ${others.length} item${others.length !== 1 ? 's' : ''}`, W / 2, sy, { align: 'center' }); }

  // ── TABLE OF CONTENTS ────────────────────────────────────────────────────────
  doc.addPage();
  pageNum++;

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Table of Contents', W / 2, 22, { align: 'center' });
  drawGoldRule(doc, 27);

  let tocY = 42;
  const sections = [
    { label: 'Section A – Photographs', items: photos },
    { label: 'Section B – Messages & Chats', items: chats },
    { label: 'Section C – Other Supporting Documents', items: others },
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
      const desc = item.caption.length > 55 ? item.caption.substring(0, 55) + '…' : item.caption;
      doc.text(`  ${item.exhibit_number}  ${desc}`, 20, tocY);
      if (item.event_date) {
        doc.text(formatDateForPDF(item.event_date, item.date_is_approximate), W - 20, tocY, { align: 'right' });
      }
      tocY += 6;
    });
    tocY += 5;
  });

  addPageFooter(doc, caseInfo.compiled_date, pageNum);

  // ── EVIDENCE SECTIONS ─────────────────────────────────────────────────────────
  let itemIdx = 0;
  const totalItems = translatedItems.length;

  for (const sec of sections) {
    if (sec.items.length === 0) continue;

    // Section divider page
    doc.addPage();
    pageNum++;

    drawGoldRule(doc, H / 2 - 25, 35);

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(sec.label.split('–')[0].trim(), W / 2, H / 2 - 10, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(sec.label.split('–')[1]?.trim() || '', W / 2, H / 2 + 5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text(`${sec.items.length} item${sec.items.length !== 1 ? 's' : ''}`, W / 2, H / 2 + 18, { align: 'center' });

    drawGoldRule(doc, H / 2 + 25, 35);

    // One item per page — consistent for all types
    for (const item of sec.items) {
      itemIdx++;
      onProgress?.(`Rendering ${itemIdx}/${totalItems}…`);
      doc.addPage();
      pageNum++;
      await renderEvidencePage(doc, item, caseInfo.compiled_date, pageNum, W, H);
    }
  }

  onProgress?.('Saving PDF…');
  const filename = `USCIS_Evidence_${(caseInfo.petitioner_name || 'Case').replace(/\s+/g, '_')}_${caseInfo.compiled_date.replace(/[\s,/]/g, '-')}.pdf`;
  doc.save(filename);
  onProgress?.('');
}

// ── Render a single evidence item — full page, consistent sizing ────────────

async function renderEvidencePage(
  doc: jsPDF,
  item: EvidenceItem,
  compiledDate: string,
  pageNum: number,
  W: number,
  H: number,
) {
  const MARGIN = 20;
  const CONTENT_W = W - MARGIN * 2;
  const FOOTER_ZONE = 26; // space reserved for footer

  // ── Page header: Exhibit number + thin gold rule ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text(`Exhibit ${item.exhibit_number}`, MARGIN, 16);

  drawGoldRule(doc, 19, MARGIN);

  let y = 26;

  // ── Image ──
  // Calculate max available height for image: leave room for caption + metadata + footer
  const META_ZONE = 50; // space for caption + metadata below image
  const MAX_IMG_H = H - y - META_ZONE - FOOTER_ZONE;

  if (isImageItem(item)) {
    try {
      const { dataUrl, width: natW, height: natH } = await imageToJpegDataUrl(item.file, item.previewUrl);
      const ratio = natH / natW;

      let imgW: number;
      let imgH: number;

      // Fill content width, then cap height
      imgW = CONTENT_W;
      imgH = imgW * ratio;

      if (imgH > MAX_IMG_H) {
        imgH = MAX_IMG_H;
        imgW = imgH / ratio;
      }

      // Center horizontally
      const imgX = MARGIN + (CONTENT_W - imgW) / 2;

      // Add thin border around image
      doc.setDrawColor(200, 205, 215);
      doc.setLineWidth(0.3);
      doc.rect(imgX - 0.5, y - 0.5, imgW + 1, imgH + 1);

      doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
      y += imgH + 6;
    } catch {
      doc.setFillColor(...LIGHT);
      doc.rect(MARGIN, y, CONTENT_W, 40, 'F');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text('[Image could not be rendered]', W / 2, y + 20, { align: 'center' });
      y += 46;
    }
  } else {
    // Non-image file placeholder
    doc.setFillColor(...LIGHT);
    doc.rect(MARGIN, y, CONTENT_W, 30, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`[Attached file: ${item.file.name}]`, W / 2, y + 17, { align: 'center' });
    y += 36;
  }

  // ── Caption ──
  const fullCaption = buildCaption(item);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(40, 55, 90);
  const captionLines = doc.splitTextToSize(fullCaption, CONTENT_W - 4);
  const maxCaptionLines = 4;
  const displayLines = captionLines.slice(0, maxCaptionLines);

  // Caption background
  const captionH = displayLines.length * 4.5 + 6;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(MARGIN, y, CONTENT_W, captionH, 1.5, 1.5, 'F');
  doc.text(displayLines, MARGIN + 4, y + 5);
  y += captionH + 5;

  // ── Metadata row ──
  const metaItems: { label: string; value: string }[] = [];
  if (item.exhibit_number) {
    metaItems.push({ label: 'EXHIBIT', value: item.exhibit_number });
  }
  if (item.event_date) {
    metaItems.push({ label: 'DATE', value: formatDateForPDF(item.event_date, item.date_is_approximate) });
  }
  if (item.participants && item.participants.trim()) {
    metaItems.push({ label: 'PARTICIPANTS', value: item.participants });
  }
  if (item.location && item.location.trim()) {
    metaItems.push({ label: 'LOCATION', value: item.location });
  }

  if (metaItems.length > 0) {
    const colW = CONTENT_W / metaItems.length;
    let mx = MARGIN;
    metaItems.forEach(m => {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD);
      doc.text(m.label, mx, y);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NAVY);
      const valLines = doc.splitTextToSize(m.value, colW - 4);
      doc.text(valLines[0] || '', mx, y + 4.5);
      mx += colW;
    });
    y += 14;
  }

  // ── Notes ──
  if (item.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text(`Note: ${item.notes}`, MARGIN, y);
  }

  addPageFooter(doc, compiledDate, pageNum);
}

// ── Convert any image to JPEG data URL via canvas ───────────────────────────

function imageToJpegDataUrl(
  file: File,
  previewUrl?: string,
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const src = previewUrl || (file.size > 0 ? URL.createObjectURL(file) : '');
    if (!src) { reject(new Error('No image source available')); return; }
    const created = !previewUrl && file.size > 0;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxPx = 2048;
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { if (created) URL.revokeObjectURL(src); reject(new Error('Canvas not available')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      if (created) URL.revokeObjectURL(src);
      resolve({ dataUrl, width: canvas.width, height: canvas.height });
    };
    img.onerror = () => { if (created) URL.revokeObjectURL(src); reject(new Error('Image load failed')); };
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
