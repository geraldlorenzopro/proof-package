import { useCallback } from "react";
import { useCasePack, toggleInList } from "../shared/useCasePack";
import type { PackLang, PackProRole } from "../shared/types";

export type { PackLang, PackProRole };

export type FilingType = "initial" | "renewal" | "replacement";
export type CategoryCode =
  | "c08"  // Asylum applicant (pending)
  | "c09"  // Adjustment applicant (pending I-485)
  | "c10"  // Withholding of removal
  | "c14"  // Deferred action
  | "c33"  // DACA
  | "a03"  // Refugee
  | "a05"  // Asylee
  | "a10"  // Withholding granted
  | "a17"  // E-2 spouse
  | "a18"  // L-2 spouse
  | "f01"  // F-1 student (post-completion OPT)
  | "c25"  // J-2 spouse
  | "c31"  // VAWA self-petitioner
  | null;

export interface I765PackState {
  lang: PackLang;
  proRole: PackProRole;
  eligibility: {
    filingType: FilingType | null;
    categoryCode: CategoryCode;
    completed: string[];
  };
  documents: {
    completed: string[];
    requested: string[];
  };
  photo: {
    completed: string[];
  };
  feeWaiver: {
    requestingWaiver: boolean | null;
    meansTestedBenefits: boolean | null;
    householdBelow150Poverty: boolean | null;
    financialHardship: boolean | null;
    paymentMethod: "g1450" | "g1650" | "i912_waiver" | "no_fee_c09" | null;
  };
  comboCard: {
    requestI131: boolean | null;
    travelNeeded: boolean | null;
    emergencyTravel: boolean | null;
  };
  packet: {
    completed: string[];
  };
  status: {
    receiptNumber: string;
    filedDate: string;
    biometricsDate: string;
    eadCardNumber: string;
    eadValidUntil: string;
  };
}

const I765_DEFAULTS: Omit<I765PackState, "lang" | "proRole"> = {
  eligibility: { filingType: null, categoryCode: null, completed: [] },
  documents: { completed: [], requested: [] },
  photo: { completed: [] },
  feeWaiver: {
    requestingWaiver: null,
    meansTestedBenefits: null,
    householdBelow150Poverty: null,
    financialHardship: null,
    paymentMethod: null,
  },
  comboCard: { requestI131: null, travelNeeded: null, emergencyTravel: null },
  packet: { completed: [] },
  status: {
    receiptNumber: "",
    filedDate: "",
    biometricsDate: "",
    eadCardNumber: "",
    eadValidUntil: "",
  },
};

export function useI765Pack(caseId: string) {
  const { state, setState, setLang, setProRole, patchSection } = useCasePack<I765PackState>(
    "i765",
    caseId,
    I765_DEFAULTS,
  );

  const update = useCallback(
    <K extends keyof I765PackState>(key: K, sectionPatch: Partial<I765PackState[K]>) => {
      patchSection(key, sectionPatch);
    },
    [patchSection],
  );

  const toggleItem = useCallback(
    (
      section: "eligibility" | "documents" | "photo" | "packet",
      itemId: string,
    ) => {
      setState((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          completed: toggleInList((prev[section] as any).completed ?? [], itemId),
        },
      }));
    },
    [setState],
  );

  const toggleRequested = useCallback(
    (itemId: string) => {
      setState((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          requested: toggleInList(prev.documents.requested, itemId),
        },
      }));
    },
    [setState],
  );

  return {
    state,
    update,
    setLang,
    setProRole,
    toggleItem,
    toggleRequested,
  };
}
