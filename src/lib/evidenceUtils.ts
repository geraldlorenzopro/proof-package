import { EvidenceType } from '@/types/evidence';

export function classifyFile(file: File): EvidenceType {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith('image/')) {
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
  const dateStr = formatDateDisplay(item.event_date, item.date_is_approximate);
  const participants = item.participants || '—';

  if (item.type === 'photo') {
    const loc = item.location ? ` Location: ${item.location}.` : '';
    return `Photo of ${participants} during ${item.caption}. Date: ${dateStr}.${loc}`;
  }

  if (item.type === 'chat') {
    const purpose = toEnglish(item.demonstrates || '') || 'ongoing communication';
    return `${item.platform || 'Chat'} message screenshot between ${participants}. Date/range: ${dateStr}. Demonstrates: ${purpose}.`;
  }

  return `${item.caption}. Date: ${dateStr}. Participants: ${participants}.`;
}
