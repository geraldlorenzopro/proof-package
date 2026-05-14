import { useCallback, useEffect, useState } from "react";

export type PackLang = "es" | "en";
export type PackProRole = "attorney" | "accredited_rep" | "form_preparer" | "self_petitioner";

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

const DEFAULT_STATE: I130PackState = {
  lang: "es",
  proRole: "attorney",
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

function storageKey(caseId: string) {
  return `ner.i130-pack.${caseId}`;
}

// NOTE: persistence bridge — localStorage hoy, Supabase mañana.
// La forma del hook está congelada: cuando schema case_pack_state se
// apruebe (ver supabase/migrations/PENDING_*.sql), reemplazar el bloque
// load/save por queries con filtro account_id+case_id. Resto del repo
// no se entera del cambio.
export function useI130Pack(caseId: string) {
  const [state, setState] = useState<I130PackState>(() => {
    try {
      const raw = localStorage.getItem(storageKey(caseId));
      if (!raw) return DEFAULT_STATE;
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(caseId), JSON.stringify(state));
    } catch {
      // localStorage llena o desactivada — fail silently, state vive en memoria
    }
  }, [caseId, state]);

  const update = useCallback(<K extends keyof I130PackState>(key: K, patch: Partial<I130PackState[K]>) => {
    setState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as object), ...patch },
    }));
  }, []);

  const setLang = useCallback((lang: PackLang) => {
    setState((prev) => ({ ...prev, lang }));
  }, []);

  const setProRole = useCallback((proRole: PackProRole) => {
    setState((prev) => ({ ...prev, proRole }));
  }, []);

  const toggleItem = useCallback(
    (section: "i864" | "packet" | "interview" | "evidence", itemId: string) => {
      setState((prev) => {
        const list = prev[section].completed;
        const next = list.includes(itemId) ? list.filter((x) => x !== itemId) : [...list, itemId];
        return { ...prev, [section]: { ...prev[section], completed: next } };
      });
    },
    [],
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
    [],
  );

  const toggleRequested = useCallback((itemId: string) => {
    setState((prev) => {
      const list = prev.evidence.requested;
      const next = list.includes(itemId) ? list.filter((x) => x !== itemId) : [...list, itemId];
      return { ...prev, evidence: { ...prev.evidence, requested: next } };
    });
  }, []);

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
