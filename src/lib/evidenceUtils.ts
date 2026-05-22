import { EvidenceType } from '@/types/evidence';

const ACCEPTED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];
const REJECTED_EXTS = ['tiff', 'tif', 'raw', 'bmp', 'gif', 'svg', 'ico', 'cr2', 'nef', 'arw'];

export function getFileExtension(file: File): string {
  const m = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export function isHeicFile(file: File): boolean {
  const ext = getFileExtension(file);
  const type = file.type.toLowerCase();
  return ext === 'heic' || ext === 'heif' || type === 'image/heic' || type === 'image/heif';
}

export function validateFileFormat(
  file: File,
): { ok: true } | { ok: false; reason: 'rejected' | 'unknown'; ext: string } {
  const ext = getFileExtension(file);
  const type = file.type.toLowerCase();
  if (REJECTED_EXTS.includes(ext)) return { ok: false, reason: 'rejected', ext };
  if (ACCEPTED_EXTS.includes(ext)) return { ok: true };
  if (type.startsWith('image/') || type === 'application/pdf') return { ok: true };
  return { ok: false, reason: 'unknown', ext: ext || type || 'unknown' };
}

export function classifyFile(file: File): EvidenceType {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith('image/') || isHeicFile(file)) {
    const chatKeywords = ['chat', 'whatsapp', 'instagram', 'facebook', 'imessage', 'sms', 'msg', 'message', 'screenshot', 'captura', 'screen'];
    if (chatKeywords.some(kw => name.includes(kw))) {
      return 'chat';
    }
    return 'photo';
  }

  if (type.includes('pdf') || type.includes('document') || type.includes('sheet')) {
    return 'other';
  }

  return 'other';
}

export function generateExhibitNumber(type: EvidenceType, index: number): string {
  const prefix = type === 'photo' ? 'A' : type === 'chat' ? 'B' : 'C';
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

export function formatDateDisplay(date: string, isApprox: boolean): string {
  if (!date) return 'Date not specified';
  const suffix = isApprox ? ' (approx.)' : '';
  return date + suffix;
}

// Maps Spanish UI selections to English for USCIS PDF
const DEMONSTRATES_EN_MAP: Record<string, string> = {
  'Comunicación constante': 'Ongoing communication',
  'Coordinación de vida en común': 'Coordination of shared life',
  'Apoyo emocional': 'Emotional support',
  'Apoyo financiero': 'Financial support',
  'Planificación de viaje / mudanza': 'Travel / relocation planning',
  'Relación romántica': 'Romantic relationship',
  'Otro': 'Other',
};

export function toEnglish(value: string): string {
  return DEMONSTRATES_EN_MAP[value] || value;
}

// Human-readable date for captions (same logic as PDF)
function formatDateHuman(date: string, isApprox: boolean): string {
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

// Strip leading "between"/"entre" from participants to avoid "between Between..."
function cleanParticipants(raw: string): string {
  return raw.replace(/^(between|entre)\s+/i, '').trim();
}

export function buildCaption(item: {
  type: EvidenceType;
  participants: string;
  caption: string;
  event_date: string;
  date_is_approximate: boolean;
  location?: string;
  platform?: string;
  demonstrates?: string;
}): string {
  const dateStr = formatDateHuman(item.event_date, item.date_is_approximate);
  const participants = item.participants ? cleanParticipants(item.participants) : '—';

  const dateInfo = item.event_date ? ` Date: ${dateStr}.` : '';

  if (item.type === 'photo') {
    const loc = item.location ? ` Location: ${item.location}.` : '';
    return `Photo of ${participants} during ${item.caption}.${dateInfo}${loc}`;
  }

  if (item.type === 'chat') {
    const purpose = toEnglish(item.demonstrates || '') || 'ongoing communication';
    const extra = item.caption?.trim() ? ` Additional context: ${item.caption.trim()}.` : '';
    return `${item.platform || 'Chat'} message screenshot between ${participants}.${dateInfo} Demonstrates: ${purpose}.${extra}`;
  }

  const participantsLine = item.participants?.trim() ? ` Participants: ${participants}.` : '';
  return `${item.caption}.${dateInfo}${participantsLine}`;
}
