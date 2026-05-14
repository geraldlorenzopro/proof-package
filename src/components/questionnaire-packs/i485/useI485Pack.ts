import { useCallback } from "react";
import { useCasePack, toggleInList } from "../shared/useCasePack";
import type { PackLang, PackProRole } from "../shared/types";

export type { PackLang, PackProRole };

export type FilingStrategy = "concurrent" | "standalone" | "tps_to_485" | "asylum_to_485" | null;

export interface I485PackState {
  lang: PackLang;
  proRole: PackProRole;
  // ═══ Doc 01 Cuestionario + eligibility ═══
  eligibility: {
    strategy: FilingStrategy;
    underlyingPetition: "i130" | "i140" | "asylum" | "vawa" | "u_visa" | "t_visa" | "other" | null;
    underlyingApproved: boolean | null;
    inspectedEntered: boolean | null;
    visaCurrent: boolean | null;
    in245i: boolean | null;
    completed: string[];
  };
  // ═══ Doc 02 Guía Entrevista ═══
  guia: {
    completed: string[];
  };
  // ═══ Doc 03 Evidence Checklist ═══
  evidence: {
    completed: string[];
    requested: string[];
  };
  // ═══ Doc 04 Packet Preparation ═══
  packet: {
    completed: string[];
    paymentMethod: "g1450" | "g1650" | "i912_waiver" | null;
    concurrentForms: string[]; // ["i130", "i765", "i131", "i864"]
  };
  // ═══ Doc 05 Inadmissibility Screener — INA 212(a) ═══
  inadmissibility: {
    health: {
      hasCommunicableDisease: boolean | null;
      missingVaccinations: boolean | null;
      drugAbuse: boolean | null;
      physicalMentalDisorder: boolean | null;
    };
    criminal: {
      anyArrests: boolean | null;
      crimeMoralTurpitude: boolean | null;
      drugConvictions: boolean | null;
      multipleConvictions: boolean | null;
      prostitution: boolean | null;
      humanTrafficking: boolean | null;
    };
    immigration: {
      unlawfulPresenceGt180: boolean | null;
      unlawfulPresenceGt1y: boolean | null;
      previousRemoval: boolean | null;
      fraudMisrepresentation: boolean | null;
      falseClaimUSC: boolean | null;
      stowaway: boolean | null;
      smuggler: boolean | null;
      illegalReentry: boolean | null;
    };
    economic: {
      publicChargeLikely: boolean | null;
    };
    notes: string;
  };
  // ═══ Doc 06 I-693 Medical Exam Tracker ═══
  medical: {
    civilSurgeonSelected: boolean;
    civilSurgeonName: string;
    examScheduledDate: string;
    examCompletedDate: string;
    vaccinationsComplete: boolean | null;
    sealedEnvelopeReceived: boolean | null;
    submissionStrategy: "with_485" | "at_interview" | "rfe_response" | null;
    completed: string[];
  };
  // ═══ Doc 07 Interview Prep ═══
  interview: {
    completed: string[];
    interpreterName: string;
    interpreterRelation: string;
    g1256Signed: boolean;
    fieldOffice: string;
  };
}

const I485_DEFAULTS: Omit<I485PackState, "lang" | "proRole"> = {
  eligibility: {
    strategy: null,
    underlyingPetition: null,
    underlyingApproved: null,
    inspectedEntered: null,
    visaCurrent: null,
    in245i: null,
    completed: [],
  },
  guia: { completed: [] },
  evidence: { completed: [], requested: [] },
  packet: { completed: [], paymentMethod: null, concurrentForms: [] },
  inadmissibility: {
    health: {
      hasCommunicableDisease: null,
      missingVaccinations: null,
      drugAbuse: null,
      physicalMentalDisorder: null,
    },
    criminal: {
      anyArrests: null,
      crimeMoralTurpitude: null,
      drugConvictions: null,
      multipleConvictions: null,
      prostitution: null,
      humanTrafficking: null,
    },
    immigration: {
      unlawfulPresenceGt180: null,
      unlawfulPresenceGt1y: null,
      previousRemoval: null,
      fraudMisrepresentation: null,
      falseClaimUSC: null,
      stowaway: null,
      smuggler: null,
      illegalReentry: null,
    },
    economic: { publicChargeLikely: null },
    notes: "",
  },
  medical: {
    civilSurgeonSelected: false,
    civilSurgeonName: "",
    examScheduledDate: "",
    examCompletedDate: "",
    vaccinationsComplete: null,
    sealedEnvelopeReceived: null,
    submissionStrategy: null,
    completed: [],
  },
  interview: {
    completed: [],
    interpreterName: "",
    interpreterRelation: "",
    g1256Signed: false,
    fieldOffice: "",
  },
};

export function useI485Pack(caseId: string) {
  const { state, setState, setLang, setProRole, patchSection } = useCasePack<I485PackState>(
    "i485",
    caseId,
    I485_DEFAULTS,
  );

  const update = useCallback(
    <K extends keyof I485PackState>(key: K, sectionPatch: Partial<I485PackState[K]>) => {
      patchSection(key, sectionPatch);
    },
    [patchSection],
  );

  const toggleItem = useCallback(
    (
      section: "eligibility" | "guia" | "evidence" | "packet" | "medical" | "interview",
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

  const toggleConcurrent = useCallback(
    (formId: string) => {
      setState((prev) => ({
        ...prev,
        packet: {
          ...prev.packet,
          concurrentForms: toggleInList(prev.packet.concurrentForms, formId),
        },
      }));
    },
    [setState],
  );

  const toggleRequested = useCallback(
    (itemId: string) => {
      setState((prev) => ({
        ...prev,
        evidence: {
          ...prev.evidence,
          requested: toggleInList(prev.evidence.requested, itemId),
        },
      }));
    },
    [setState],
  );

  const setInadmissibility = useCallback(
    (
      cat: keyof I485PackState["inadmissibility"],
      field: string,
      value: boolean | null | string,
    ) => {
      setState((prev) => ({
        ...prev,
        inadmissibility: {
          ...prev.inadmissibility,
          [cat]:
            typeof prev.inadmissibility[cat] === "object" && prev.inadmissibility[cat] !== null
              ? { ...(prev.inadmissibility[cat] as object), [field]: value }
              : value,
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
    toggleConcurrent,
    toggleRequested,
    setInadmissibility,
  };
}
