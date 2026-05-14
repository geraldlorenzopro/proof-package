// I-130 specific state shape + API. Built on top of generic useCasePack.

import { useCallback } from "react";
import { useCasePack, toggleInList } from "../../shared/useCasePack";
import type { PackLang, PackProRole } from "../../shared/types";

export type { PackLang, PackProRole };

export interface I130PackState {
  lang: PackLang;
  proRole: PackProRole;
  i864: {
    sponsorIncome: number | null;
    householdSize: number;
    sponsorHasFiledTaxes3y: boolean | null;
    sponsorIsUSC: boolean | null;
    completed: string[];
  };
  bonaFide: {
    financial: Record<string, boolean>;
    residence: Record<string, boolean>;
    children: Record<string, boolean>;
    statements: Record<string, boolean>;
    timeline: Record<string, boolean>;
  };
  packet: {
    completed: string[];
    paymentMethod: "g1450" | "g1650" | null;
  };
  interview: {
    completed: string[];
    interpreterName: string;
    interpreterRelation: string;
    g1256Signed: boolean;
  };
  evidence: {
    completed: string[];
    requested: string[];
  };
}

const I130_DEFAULTS: Omit<I130PackState, "lang" | "proRole"> = {
  i864: {
    sponsorIncome: null,
    householdSize: 2,
    sponsorHasFiledTaxes3y: null,
    sponsorIsUSC: null,
    completed: [],
  },
  bonaFide: {
    financial: {},
    residence: {},
    children: {},
    statements: {},
    timeline: {},
  },
  packet: { completed: [], paymentMethod: null },
  interview: { completed: [], interpreterName: "", interpreterRelation: "", g1256Signed: false },
  evidence: { completed: [], requested: [] },
};

export function useI130Pack(caseId: string) {
  const { state, setState, setLang, setProRole, patchSection } = useCasePack<I130PackState>(
    "i130",
    caseId,
    I130_DEFAULTS,
  );

  // Keep the legacy `update(key, patch)` API for the 7 docs.
  const update = useCallback(
    <K extends keyof I130PackState>(key: K, sectionPatch: Partial<I130PackState[K]>) => {
      patchSection(key, sectionPatch);
    },
    [patchSection],
  );

  const toggleItem = useCallback(
    (section: "i864" | "packet" | "interview" | "evidence", itemId: string) => {
      setState((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          completed: toggleInList(prev[section].completed, itemId),
        },
      }));
    },
    [setState],
  );

  const toggleBonaFide = useCallback(
    (category: keyof I130PackState["bonaFide"], itemId: string) => {
      setState((prev) => ({
        ...prev,
        bonaFide: {
          ...prev.bonaFide,
          [category]: {
            ...prev.bonaFide[category],
            [itemId]: !prev.bonaFide[category][itemId],
          },
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

  return {
    state,
    update,
    setLang,
    setProRole,
    toggleItem,
    toggleBonaFide,
    toggleRequested,
  };
}
