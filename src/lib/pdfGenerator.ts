import jsPDF from 'jspdf';
import { EvidenceItem, CaseInfo } from '@/types/evidence';
import { buildCaption, formatDateDisplay } from './evidenceUtils';
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


const NAVY = [22, 42, 90] as const;
const GOLD = [196, 155, 48] as const;
const GRAY = [100, 110, 130] as const;
const LIGHT = [245, 247, 252] as const;
const WHITE = [255, 255, 255] as const;

// ── Detect if an item is an image by file name or type ──────────────────────
function isImageItem(item: EvidenceItem): boolean {
  const ext = item.file.name?.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return true;
  if (item.file.type?.startsWith('image/')) return true;
  // Check previewUrl for known image patterns
  if (item.previewUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(item.previewUrl)) return true;
  return false;
}

// ── Human-readable date formatting for PDF ──────────────────────────────────
function formatDateForPDF(date: string, isApprox: boolean): string {
  if (!date) return 'Date not specified';
  
  // Try to parse YYYY-MM-DD format
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
  
  // Fallback
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


export async function generateEvidencePDF(
  items: EvidenceItem[],
  caseInfo: CaseInfo,
  onProgress?: (status: string) => void,
): Promise<void> {
  // ── Translate all free-text fields via AI ──────────────────────────────────
  onProgress?.('Translating to English…');
  const translatedItems = await translateItems(items);
  onProgress?.('Building PDF…');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let pageNum = 1;


  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, H, 'F');

  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 6, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('USCIS', W / 2, 22, { align: 'center' });

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Relationship Evidence Package', W / 2, 55, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 235);
  doc.text('Supporting Documentation for Immigration Case', W / 2, 65, { align: 'center' });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(35, 75, W - 35, 75);

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
  doc.text('Compiled:', 45, infoY + lineH * 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 230, 255);
  doc.text(caseInfo.compiled_date, 85, infoY + lineH * 2);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(35, infoY + lineH * 2.8, W - 35, infoY + lineH * 2.8);

  // Section counts on cover
  const photoCount = translatedItems.filter(i => i.type === 'photo').length;
  const chatCount = translatedItems.filter(i => i.type === 'chat').length;
  const otherCount = translatedItems.filter(i => i.type === 'other').length;
  const countY = infoY + lineH * 4.5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 220);
  if (photoCount > 0) doc.text(`Section A – Photographs: ${photoCount} item${photoCount !== 1 ? 's' : ''}`, W / 2, countY, { align: 'center' });
  if (chatCount > 0) doc.text(`Section B – Messages & Chats: ${chatCount} item${chatCount !== 1 ? 's' : ''}`, W / 2, countY + 8, { align: 'center' });
  if (otherCount > 0) doc.text(`Section C – Other Documents: ${otherCount} item${otherCount !== 1 ? 's' : ''}`, W / 2, countY + (chatCount > 0 ? 16 : 8), { align: 'center' });

  doc.setFillColor(...GOLD);
  doc.rect(0, H - 6, W, 6, 'F');

  // ── TABLE OF CONTENTS PAGE ──────────────────────────────────────────────────
  doc.addPage();
  pageNum++;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('Table of Contents', 20, 18);
  doc.setFillColor(...GOLD);
  doc.rect(0, 28, W, 2, 'F');

  let tocY = 42;
  const sections = [
    { label: 'Section A – Photographs', type: 'photo', items: translatedItems.filter(i => i.type === 'photo') },
    { label: 'Section B – Messages & Chats', type: 'chat', items: translatedItems.filter(i => i.type === 'chat') },
    { label: 'Section C – Other Supporting Documents', type: 'other', items: translatedItems.filter(i => i.type === 'other') },
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
      doc.text(`  ${desc}`, 20, tocY);
      doc.text(formatDateForPDF(item.event_date, item.date_is_approximate), W - 20, tocY, { align: 'right' });
      tocY += 6;
    });
    tocY += 5;
  });

  addPageFooter(doc, caseInfo.compiled_date, pageNum);

  // ── EVIDENCE SECTIONS ────────────────────────────────────────────────────────
  let itemIdx = 0;
  const totalItems = translatedItems.length;

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
    doc.text(`${sec.items.length} item${sec.items.length !== 1 ? 's' : ''}`, W / 2, H / 2 + 18, { align: 'center' });

    // ── MULTI-ITEM PAGES: 2 images per page for photos/chats, 1 per page for other ──
    if (sec.type === 'other') {
      for (const item of sec.items) {
        itemIdx++;
        onProgress?.(`Rendering ${itemIdx}/${totalItems}…`);
        doc.addPage();
        pageNum++;
        await renderSingleItemPage(doc, item, caseInfo.compiled_date, pageNum, W, H);
      }
    } else {
      const ITEMS_PER_PAGE = 2;
      for (let i = 0; i < sec.items.length; i += ITEMS_PER_PAGE) {
        const pageItems = sec.items.slice(i, i + ITEMS_PER_PAGE);
        itemIdx += pageItems.length;
        onProgress?.(`Rendering ${itemIdx}/${totalItems}…`);
        doc.addPage();
        pageNum++;
        await renderMultiItemPage(doc, pageItems, caseInfo.compiled_date, pageNum, W, H);
      }
    }
  }

  onProgress?.('Saving PDF…');
  const filename = `USCIS_Evidence_${(caseInfo.petitioner_name || 'Case').replace(/\s+/g, '_')}_${caseInfo.compiled_date.replace(/[\s,/]/g, '-')}.pdf`;
  doc.save(filename);
  onProgress?.('');
}

async function renderMultiItemPage(
  doc: jsPDF,
  items: EvidenceItem[],
  compiledDate: string,
  pageNum: number,
  W: number,
  H: number
) {
  const MARGIN = 18;
  const CONTENT_W = W - MARGIN * 2;
  const USABLE_H = H - 36 - 24; // header + footer
  const slotH = USABLE_H / 2;
  const IMG_MAX_H = slotH * 0.52;

  // Light page header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 14, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 14, W, 1.5, 'F');

  let slotY = 20;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const fullCaption = buildCaption(item);

    // Separator between items
    if (idx > 0) {
      doc.setDrawColor(220, 225, 235);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, slotY - 3, W - MARGIN, slotY - 3);
    }

    // Image — detect by extension/previewUrl, not file.type
    let imgY = slotY;
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
        doc.addImage(dataUrl, 'JPEG', imgX, imgY, imgW, imgH);
        imgY += imgH + 3;
      } catch {
        doc.setFillColor(...LIGHT);
        doc.rect(MARGIN, imgY, CONTENT_W, 30, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text('[Image could not be rendered]', W / 2, imgY + 15, { align: 'center' });
        imgY += 34;
      }
    } else {
      doc.setFillColor(...LIGHT);
      doc.rect(MARGIN, imgY, CONTENT_W, 20, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(`[Attached file: ${item.file.name}]`, W / 2, imgY + 12, { align: 'center' });
      imgY += 24;
    }

    // Caption italic
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(40, 55, 90);
    const captionLines = doc.splitTextToSize(fullCaption, CONTENT_W);
    doc.text(captionLines.slice(0, 3), MARGIN, imgY + 4); // max 3 lines
    imgY += Math.min(captionLines.length, 3) * 4.5 + 6;

    // Meta row: only show fields with actual values
    const metaItems: { label: string; value: string }[] = [
      { label: 'DATE', value: formatDateForPDF(item.event_date, item.date_is_approximate) },
    ];
    if (item.participants && item.participants.trim()) {
      metaItems.push({ label: 'PARTICIPANTS', value: item.participants });
    }

    const colW = CONTENT_W / metaItems.length;
    let mx = MARGIN;
    metaItems.forEach(m => {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD);
      doc.text(m.label, mx, imgY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...NAVY);
      doc.text(doc.splitTextToSize(m.value, colW - 3)[0], mx, imgY + 4);
      mx += colW;
    });

    slotY = imgY + 14;
  }

  addPageFooter(doc, compiledDate, pageNum);
}

async function renderSingleItemPage(
  doc: jsPDF,
  item: EvidenceItem,
  compiledDate: string,
  pageNum: number,
  W: number,
  H: number
) {
  const MARGIN = 20;
  const CONTENT_W = W - MARGIN * 2;

  // Header bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 28, 'F');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  const shortCaption = item.caption.length > 60 ? item.caption.substring(0, 60) + '…' : item.caption;
  doc.text(shortCaption, MARGIN, 18);

  doc.setFillColor(...GOLD);
  doc.rect(0, 28, W, 1.5, 'F');

  let imgY = 36;
  const maxImgH = 130;

  if (isImageItem(item)) {
    try {
      const { dataUrl, width: natW, height: natH } = await imageToJpegDataUrl(item.file, item.previewUrl);
      const ratio = natH / natW;
      let imgW = CONTENT_W;
      let imgH = imgW * ratio;
      if (imgH > maxImgH) {
        imgH = maxImgH;
        imgW = imgH / ratio;
      }
      const imgX = MARGIN + (CONTENT_W - imgW) / 2;
      doc.addImage(dataUrl, 'JPEG', imgX, imgY, imgW, imgH);
      imgY += imgH + 6;
    } catch {
      doc.setFillColor(...LIGHT);
      doc.rect(MARGIN, imgY, CONTENT_W, 50, 'F');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text('[Image could not be rendered]', W / 2, imgY + 25, { align: 'center' });
      imgY += 56;
    }
  } else {
    doc.setFillColor(...LIGHT);
    doc.rect(MARGIN, imgY, CONTENT_W, 30, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`[Attached file: ${item.file.name}]`, W / 2, imgY + 17, { align: 'center' });
    imgY += 36;
  }

  // Caption block
  const fullCaption = buildCaption(item);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(40, 55, 90);
  const captionLines = doc.splitTextToSize(fullCaption, CONTENT_W - 12);
  const captionH = captionLines.length * 5 + 8;

  doc.setFillColor(...LIGHT);
  doc.roundedRect(MARGIN, imgY, CONTENT_W, captionH, 2, 2, 'F');
  doc.text(captionLines, MARGIN + 6, imgY + 8);
  imgY += captionH + 6;

  // Metadata row — only show fields with actual values
  const metaItems: { label: string; value: string }[] = [
    { label: 'DATE', value: formatDateForPDF(item.event_date, item.date_is_approximate) },
  ];
  if (item.participants && item.participants.trim()) {
    metaItems.push({ label: 'PARTICIPANTS', value: item.participants });
  }

  const colW = CONTENT_W / metaItems.length;
  let mx = MARGIN;
  metaItems.forEach(m => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(m.label, mx, imgY);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NAVY);
    const valLines = doc.splitTextToSize(m.value, colW - 4);
    doc.text(valLines, mx, imgY + 5);
    mx += colW;
  });

  if (item.notes) {
    const noteY = imgY + 18;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text(`Note: ${item.notes}`, MARGIN, noteY);
  }

  addPageFooter(doc, compiledDate, pageNum);
}

// Converts any image to a JPEG data URL via canvas.
// Accepts a previewUrl (already a blob URL or public URL) or falls back to creating one from the File.
function imageToJpegDataUrl(
  file: File,
  previewUrl?: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // Prefer previewUrl (works for remote URLs from Supabase storage)
    const src = previewUrl || (file.size > 0 ? URL.createObjectURL(file) : '');
    if (!src) { reject(new Error('No image source available')); return; }
    const created = !previewUrl && file.size > 0;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Cap canvas size to avoid memory issues on mobile (max 2048px wide)
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
