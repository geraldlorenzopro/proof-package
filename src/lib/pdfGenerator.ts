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

  console.log('[translate] Sending texts for translation:', Object.keys(texts).length, 'fields');

  try {
    const { data, error } = await supabase.functions.invoke('translate-evidence', { body: { texts } });
    
    console.log('[translate] Response:', { data, error });

    if (error) {
      console.error('[translate] Edge function error:', error);
      return items;
    }

    if (data?.error) {
      console.warn('[translate] Translation service error:', data.error);
    }

    const translated: Record<string, string> = data?.translated || {};
    const translatedCount = Object.keys(translated).length;
    console.log('[translate] Received translations:', translatedCount, '/', Object.keys(texts).length);

    if (translatedCount === 0) {
      console.warn('[translate] No translations returned — using originals');
      return items;
    }

    return items.map(item => ({
      ...item,
      caption: translated[`${item.id}__caption`] || item.caption,
      participants: translated[`${item.id}__participants`] || item.participants,
      location: item.location ? (translated[`${item.id}__location`] || item.location) : item.location,
      notes: item.notes ? (translated[`${item.id}__notes`] || item.notes) : item.notes,
    }));
  } catch (err) {
    console.error('[translate] Exception during translation:', err);
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

  // Re-assign exhibit numbers with dynamic section letters (only non-empty sections get letters)
  const DYN_LETTERS = ['A', 'B', 'C', 'D', 'E'];
  let dynIdx = 0;
  for (const group of [photos, chats, others]) {
    if (group.length === 0) continue;
    const letter = DYN_LETTERS[dynIdx++];
    group.forEach((item, i) => {
      item.exhibit_number = `${letter}-${String(i + 1).padStart(2, '0')}`;
    });
  }

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
  // Build sections dynamically — letters assigned sequentially to non-empty sections
  const SECTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const sectionDefs = [
    { title: 'Photographs', items: photos, isPhotos: true },
    { title: 'Messages & Chats', items: chats, isPhotos: false },
    { title: 'Other Supporting Documents', items: others, isPhotos: false },
  ].filter(s => s.items.length > 0);

  const sections = sectionDefs.map((s, i) => ({
    label: `Section ${SECTION_LETTERS[i]} – ${s.title}`,
    letter: SECTION_LETTERS[i],
    items: s.items,
    isPhotos: s.isPhotos,
  }));

  let sy = summaryY;
  for (const sec of sections) {
    doc.text(`${sec.label}: ${sec.items.length} item${sec.items.length !== 1 ? 's' : ''}`, W / 2, sy, { align: 'center' });
    sy += 7;
  }

  // ── TABLE OF CONTENTS ────────────────────────────────────────────────────────
  doc.addPage();
  pageNum++;

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Table of Contents', W / 2, 22, { align: 'center' });
  drawGoldRule(doc, 27);

  let tocY = 42;

  sections.forEach(sec => {
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

    // Photos: 4 per page in 2x2 grid. Chats/docs: 2 per page stacked.
    if (sec.isPhotos) {
      for (let i = 0; i < sec.items.length; i += 4) {
        const pageItems = sec.items.slice(i, i + 4);
        itemIdx += pageItems.length;
        onProgress?.(`Rendering ${itemIdx}/${totalItems}…`);
        doc.addPage();
        pageNum++;
        await renderPhotoGrid(doc, pageItems, caseInfo.compiled_date, pageNum, W, H);
      }
    } else {
      for (let i = 0; i < sec.items.length; i += 2) {
        const pageItems = sec.items.slice(i, i + 2);
        itemIdx += pageItems.length;
        onProgress?.(`Rendering ${itemIdx}/${totalItems}…`);
        doc.addPage();
        pageNum++;
        await renderStackedItems(doc, pageItems, caseInfo.compiled_date, pageNum, W, H);
      }
    }
  }

  onProgress?.('Saving PDF…');
  const filename = `USCIS_Evidence_${(caseInfo.petitioner_name || 'Case').replace(/\s+/g, '_')}_${caseInfo.compiled_date.replace(/[\s,/]/g, '-')}.pdf`;
  doc.save(filename);
  onProgress?.('');
}

// ── Render 4 photos in 2x2 grid ─────────────────────────────────────────────

async function renderPhotoGrid(
  doc: jsPDF,
  items: EvidenceItem[],
  compiledDate: string,
  pageNum: number,
  W: number,
  H: number,
) {
  const MARGIN = 15;
  const GAP = 6;
  const CONTENT_W = W - MARGIN * 2;
  const COL_W = (CONTENT_W - GAP) / 2;
  const FOOTER_ZONE = 22;
  const USABLE_H = H - 20 - FOOTER_ZONE; // top header + footer
  const ROW_H = (USABLE_H - GAP) / 2;
  const IMG_MAX_H = ROW_H - 22; // leave room for caption below image

  // Header
  drawGoldRule(doc, 14, MARGIN);
  let startY = 18;

  const positions = [
    { x: MARGIN, y: startY },
    { x: MARGIN + COL_W + GAP, y: startY },
    { x: MARGIN, y: startY + ROW_H + GAP },
    { x: MARGIN + COL_W + GAP, y: startY + ROW_H + GAP },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const pos = positions[i];
    let y = pos.y;

    // Exhibit label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(`Exhibit ${item.exhibit_number}`, pos.x, y + 3);
    y += 6;

    // Image
    if (isImageItem(item)) {
      try {
        const { dataUrl, width: natW, height: natH } = await imageToJpegDataUrl(item.file, item.previewUrl);
        const ratio = natH / natW;
        let imgW = COL_W;
        let imgH = imgW * ratio;
        if (imgH > IMG_MAX_H) {
          imgH = IMG_MAX_H;
          imgW = imgH / ratio;
        }
        const imgX = pos.x + (COL_W - imgW) / 2;

        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.2);
        doc.rect(imgX - 0.3, y - 0.3, imgW + 0.6, imgH + 0.6);
        doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
        y += imgH + 2;
      } catch {
        doc.setFillColor(...LIGHT);
        doc.rect(pos.x, y, COL_W, 25, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text('[Image error]', pos.x + COL_W / 2, y + 13, { align: 'center' });
        y += 27;
      }
    }

    // Compact caption (2 lines max)
    const caption = buildCaption(item);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(40, 55, 90);
    const lines = doc.splitTextToSize(caption, COL_W - 2);
    doc.text(lines.slice(0, 2), pos.x + 1, y + 3);
    y += Math.min(lines.length, 2) * 3.5 + 2;

    // Participants (compact)
    if (item.participants && item.participants.trim()) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(`Participants: ${item.participants}`, pos.x + 1, y + 2);
    }
  }

  addPageFooter(doc, compiledDate, pageNum);
}

// ── Render 2 items stacked (for chats/documents) ────────────────────────────

async function renderStackedItems(
  doc: jsPDF,
  items: EvidenceItem[],
  compiledDate: string,
  pageNum: number,
  W: number,
  H: number,
) {
  const MARGIN = 18;
  const CONTENT_W = W - MARGIN * 2;
  const FOOTER_ZONE = 22;
  const USABLE_H = H - 18 - FOOTER_ZONE;
  const SLOT_H = USABLE_H / 2;
  const IMG_MAX_H = SLOT_H - 30;

  drawGoldRule(doc, 14, MARGIN);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const slotTop = 18 + idx * SLOT_H;
    let y = slotTop;

    // Separator between items
    if (idx > 0) {
      doc.setDrawColor(210, 215, 225);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y - 2, W - MARGIN, y - 2);
    }

    // Exhibit label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(`Exhibit ${item.exhibit_number}`, MARGIN, y + 3);
    y += 7;

    // Image
    if (isImageItem(item)) {
      try {
        const { dataUrl, width: natW, height: natH } = await imageToJpegDataUrl(item.file, item.previewUrl);
        const ratio = natH / natW;
        let imgW = CONTENT_W;
        let imgH = imgW * ratio;
        if (imgH > IMG_MAX_H) {
          imgH = IMG_MAX_H;
          imgW = imgH / ratio;
        }
        const imgX = MARGIN + (CONTENT_W - imgW) / 2;

        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.2);
        doc.rect(imgX - 0.3, y - 0.3, imgW + 0.6, imgH + 0.6);
        doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
        y += imgH + 3;
      } catch {
        doc.setFillColor(...LIGHT);
        doc.rect(MARGIN, y, CONTENT_W, 25, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text('[Image error]', W / 2, y + 13, { align: 'center' });
        y += 28;
      }
    } else {
      doc.setFillColor(...LIGHT);
      doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(`[File: ${item.file.name}]`, W / 2, y + 12, { align: 'center' });
      y += 24;
    }

    // Caption (3 lines max)
    const caption = buildCaption(item);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(40, 55, 90);
    const lines = doc.splitTextToSize(caption, CONTENT_W - 4);
    doc.text(lines.slice(0, 3), MARGIN + 2, y + 3);
    y += Math.min(lines.length, 3) * 4 + 3;

    // Participants
    if (item.participants && item.participants.trim()) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD);
      doc.text('PARTICIPANTS', MARGIN, y);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NAVY);
      doc.text(item.participants, MARGIN, y + 4);
    }
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
