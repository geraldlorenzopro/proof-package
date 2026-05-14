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
    // Notas de evidencia alternativa por categoría (si no tienen lease pero viven con suegra, etc.)
    altEvidence: Record<string, string>;
    // Marcar categoría como "N/A justificado" (sin penalizar score)
    notApplicable: Record<string, boolean>;
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
    // Items custom de la firma agregados al checklist (no parte de la plantilla NER)
    customItems: Array<{ id: string; label: string; section: string; hint?: string }>;
    // Items NER marcados como "no aplica al caso" (no penaliza, pero queda registro)
    skipped: string[];
    // Selección actual para batch send (no persiste como tal, pero útil tenerlo en state)
    selectedForSend: string[];
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
    altEvidence: {},
    notApplicable: {},
  },
  packet: { completed: [], paymentMethod: null },
  interview: { completed: [], interpreterName: "", interpreterRelation: "", g1256Signed: false },
  evidence: { completed: [], requested: [], customItems: [], skipped: [], selectedForSend: [] },
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

  const setAltEvidence = useCallback(
    (categoryId: string, text: string) => {
      setState((prev) => ({
        ...prev,
        bonaFide: {
          ...prev.bonaFide,
          altEvidence: { ...prev.bonaFide.altEvidence, [categoryId]: text },
        },
      }));
    },
    [setState],
  );

  const toggleNotApplicable = useCallback(
    (categoryId: string) => {
      setState((prev) => ({
        ...prev,
        bonaFide: {
          ...prev.bonaFide,
          notApplicable: {
            ...prev.bonaFide.notApplicable,
            [categoryId]: !prev.bonaFide.notApplicable[categoryId],
          },
        },
      }));
    },
    [setState],
  );

  // ── Evidence: custom items + skipped + selection for batch send ──
  const addCustomItem = useCallback(
    (section: string, label: string, hint?: string) => {
      if (!label.trim()) return;
      setState((prev) => ({
        ...prev,
        evidence: {
          ...prev.evidence,
          customItems: [
            ...(prev.evidence.customItems ?? []),
            {
              id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              label: label.trim(),
              section,
              hint: hint?.trim() || undefined,
            },
          ],
        },
      }));
    },
    [setState],
  );

  const removeCustomItem = useCallback(
    (itemId: string) => {
      setState((prev) => ({
        ...prev,
        evidence: {
          ...prev.evidence,
          customItems: (prev.evidence.customItems ?? []).filter((it) => it.id !== itemId),
          completed: prev.evidence.completed.filter((id) => id !== itemId),
          requested: prev.evidence.requested.filter((id) => id !== itemId),
          selectedForSend: (prev.evidence.selectedForSend ?? []).filter((id) => id !== itemId),
        },
      }));
    },
    [setState],
  );

  const toggleSkipped = useCallback(
    (itemId: string) => {
      setState((prev) => ({
        ...prev,
        evidence: {
          ...prev.evidence,
          skipped: toggleInList(prev.evidence.skipped ?? [], itemId),
        },
      }));
    },
    [setState],
  );

  const toggleSelectedForSend = useCallback(
    (itemId: string) => {
      setState((prev) => ({
        ...prev,
        evidence: {
          ...prev.evidence,
          selectedForSend: toggleInList(prev.evidence.selectedForSend ?? [], itemId),
        },
      }));
    },
    [setState],
  );

  const selectAllForSend = useCallback(
    (itemIds: string[]) => {
      setState((prev) => ({
        ...prev,
        evidence: { ...prev.evidence, selectedForSend: itemIds },
      }));
    },
    [setState],
  );

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      evidence: { ...prev.evidence, selectedForSend: [] },
    }));
  }, [setState]);

  const sendBatchRequest = useCallback(() => {
    setState((prev) => {
      const toMark = prev.evidence.selectedForSend ?? [];
      const newRequested = Array.from(new Set([...prev.evidence.requested, ...toMark]));
      return {
        ...prev,
        evidence: { ...prev.evidence, requested: newRequested, selectedForSend: [] },
      };
    });
  }, [setState]);

  return {
    state,
    update,
    setLang,
    setProRole,
    toggleItem,
    toggleBonaFide,
    toggleRequested,
    setAltEvidence,
    toggleNotApplicable,
    addCustomItem,
    removeCustomItem,
    toggleSkipped,
    toggleSelectedForSend,
    selectAllForSend,
    clearSelection,
    sendBatchRequest,
  };
}
