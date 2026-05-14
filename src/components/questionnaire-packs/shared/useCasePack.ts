import { useCallback, useEffect, useState } from "react";
import type { PackLang, PackProRole, PackType } from "./types";

// Hook genérico de persistencia para cualquier pack.
// Cada pack (i130, i485, i765, etc.) extiende este shape con sus secciones específicas.
//
// Persistence bridge:
//   localStorage hoy → Supabase mañana (tabla case_pack_state) sin tocar callers.
//   Solo se reemplaza el bloque load/save por queries con account_id+case_id+pack_type.

export interface CasePackStateBase {
  lang: PackLang;
  proRole: PackProRole;
}

const BASE_DEFAULTS: CasePackStateBase = {
  lang: "es",
  proRole: "attorney",
};

function storageKey(packType: PackType, caseId: string) {
  return `ner.${packType}-pack.${caseId}`;
}

export function useCasePack<T extends CasePackStateBase>(
  packType: PackType,
  caseId: string,
  defaults: Omit<T, keyof CasePackStateBase>,
) {
  const initialState: T = { ...BASE_DEFAULTS, ...defaults } as T;

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey(packType, caseId));
      if (!raw) return initialState;
      const parsed = JSON.parse(raw);
      return { ...initialState, ...parsed };
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(packType, caseId), JSON.stringify(state));
    } catch {
      /* localStorage llena o desactivada — fail silently */
    }
  }, [packType, caseId, state]);

  const setLang = useCallback((lang: PackLang) => {
    setState((prev) => ({ ...prev, lang }));
  }, []);

  const setProRole = useCallback((proRole: PackProRole) => {
    setState((prev) => ({ ...prev, proRole }));
  }, []);

  const patch = useCallback((updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const patchSection = useCallback(
    <K extends keyof T>(section: K, sectionPatch: Partial<T[K]>) => {
      setState((prev) => ({
        ...prev,
        [section]: { ...(prev[section] as object), ...sectionPatch },
      }));
    },
    [],
  );

  return {
    state,
    setState,
    setLang,
    setProRole,
    patch,
    patchSection,
  };
}

// Helper: toggle an item in a string[] list within a section.
export function toggleInList(list: string[], itemId: string): string[] {
  return list.includes(itemId) ? list.filter((x) => x !== itemId) : [...list, itemId];
}
