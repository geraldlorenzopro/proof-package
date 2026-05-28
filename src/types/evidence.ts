export type EvidenceType = 'photo' | 'chat' | 'other';

export type DatePrecision = 'exact' | 'month' | 'year';

export interface EvidenceItem {
  id: string;
  file: File;
  previewUrl: string;
  type: EvidenceType;
  exhibit_number: string;
  // Form fields
  event_date: string; // YYYY-MM-DD (day defaults to 01 for month/year precision)
  date_is_approximate: boolean;
  date_precision?: DatePrecision; // defaults to 'exact' for backwards compat
  caption: string;
  location?: string;
  participants: string;
  platform?: string; // for chats
  demonstrates?: string; // for chats
  notes?: string;
  // Status
  formComplete: boolean;
  // When restoring a session from sessionStorage we can't bring blobs back —
  // the user has to re-upload. Metadata is preserved and re-attached by filename.
  needsReupload?: boolean;
}

export interface CaseInfo {
  petitioner_name: string;
  beneficiary_name: string;
  compiled_date: string;
}

export type Lang = 'es' | 'en';
