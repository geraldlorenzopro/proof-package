export type EvidenceType = 'photo' | 'chat' | 'other';

export interface EvidenceItem {
  id: string;
  file: File;
  previewUrl: string;
  type: EvidenceType;
  exhibit_number: string;
  // Form fields
  event_date: string; // YYYY-MM-DD, MM-YYYY, or approximate range
  date_is_approximate: boolean;
  caption: string;
  location?: string;
  participants: string;
  platform?: string; // for chats
  demonstrates?: string; // for chats
  source_location: string;
  notes?: string;
  // Status
  formComplete: boolean;
}

export interface CaseInfo {
  petitioner_name: string;
  beneficiary_name: string;
  compiled_date: string;
}

export type Lang = 'es' | 'en';
