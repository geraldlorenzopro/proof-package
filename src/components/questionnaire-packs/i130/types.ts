export type DocStatus = "blocker" | "in_progress" | "ready" | "completed" | "pending";

export type FilingStep = "intake" | "evidence" | "forms" | "review" | "filed";

export interface DocChecklistItem {
  id: string;
  label: string;
  status: "done" | "pending" | "danger" | "blank";
}

export interface DocCardData {
  id: string;
  title: string;
  subtitle: string;
  status: DocStatus;
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
