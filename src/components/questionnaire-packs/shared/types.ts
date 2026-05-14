// Shared types across ALL question packs (I-130, I-485, I-765, future N-400, DS-260, I-751)

export type PackLang = "es" | "en";
export type PackProRole = "attorney" | "accredited_rep" | "form_preparer" | "self_petitioner";
export type PackType = "i130" | "i485" | "i765" | "n400" | "ds260" | "i751";

export interface PackBaseState {
  lang: PackLang;
  proRole: PackProRole;
}

export interface DocStatus {
  blocker: "blocker";
  in_progress: "in_progress";
  ready: "ready";
  completed: "completed";
  pending: "pending";
}

export type DocStatusValue = keyof DocStatus;

export interface DocChecklistItem {
  id: string;
  label: string;
  status: "done" | "pending" | "danger" | "blank";
}

export interface DocCardData {
  id: string;
  title: string;
  subtitle: string;
  status: DocStatusValue;
  heroStat: string;
  heroStatLabel?: string;
  percent?: number;
  items: DocChecklistItem[];
  primaryAction: { label: string; href: string };
}

export interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  source?: string;
}

export interface NextActionItem {
  id: string;
  label: string;
  when: string;
  whenColor: "rose" | "amber" | "emerald" | "muted";
  done?: boolean;
}

export type FilingStep = "intake" | "evidence" | "forms" | "review" | "filed";

export interface PackCaseSummary {
  caseId: string;
  paraNumber: string;
  clientName: string;
  caseType: string;
  petitionerLabel: string;
  startedAt: string;
  tags: Array<{ label: string; tone: "neutral" | "warning" | "danger" | "info" }>;
  filing: {
    target: string;
    daysRemaining: number;
    currentStep: FilingStep;
  };
}
