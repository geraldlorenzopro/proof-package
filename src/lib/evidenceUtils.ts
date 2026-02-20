import { EvidenceType } from '@/types/evidence';

export function classifyFile(file: File): EvidenceType {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // Images are likely photos unless named chat/screenshot/msg
  if (type.startsWith('image/')) {
    const chatKeywords = ['chat', 'whatsapp', 'instagram', 'facebook', 'imessage', 'sms', 'msg', 'message', 'screenshot', 'captura', 'screen'];
    if (chatKeywords.some(kw => name.includes(kw))) {
      return 'chat';
    }
    return 'photo';
  }

  // PDFs, docs → other
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
  if (!date) return 'Fecha no especificada';
  const suffix = isApprox ? ' (aprox.)' : '';
  return date + suffix;
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
  source_location: string;
}): string {
  const dateStr = formatDateDisplay(item.event_date, item.date_is_approximate);

  if (item.type === 'photo') {
    const loc = item.location ? ` Location: ${item.location}.` : '';
    return `Photo of ${item.participants} during ${item.caption}. Date: ${dateStr}.${loc} Source: ${item.source_location}.`;
  }

  if (item.type === 'chat') {
    const purpose = item.demonstrates || 'ongoing communication';
    return `${item.platform || 'Chat'} message screenshot between ${item.participants}. Date/range: ${dateStr}. Purpose: demonstrates ${purpose}. Source: ${item.source_location}.`;
  }

  return `${item.caption}. Date: ${dateStr}. Participants: ${item.participants}. Source: ${item.source_location}.`;
}
