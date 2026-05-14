import { useCallback, useEffect, useState } from "react";
import type { PackType } from "./types";

// Per-user card order preference. Persists in localStorage keyed by pack type.
// Cuando aprobemos migration case_pack_state, esto se mueve a user_preferences
// (tabla nueva) o a una columna `card_order_prefs JSONB` en account_users.

function storageKey(packType: PackType) {
  return `ner.card-order.${packType}`;
}

export function useCardOrder(packType: PackType, defaultOrder: string[]) {
  const [order, setOrderState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(packType));
      if (!raw) return defaultOrder;
      const parsed = JSON.parse(raw) as string[];
      // Backfill nuevos cards o limpia ids que ya no existen
      const known = new Set(defaultOrder);
      const filtered = parsed.filter((id) => known.has(id));
      const missing = defaultOrder.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    } catch {
      return defaultOrder;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(packType), JSON.stringify(order));
    } catch {
      /* fail silently */
    }
  }, [packType, order]);

  const setOrder = useCallback((next: string[]) => setOrderState(next), []);

  const resetToDefault = useCallback(() => {
    setOrderState(defaultOrder);
    try {
      localStorage.removeItem(storageKey(packType));
    } catch {
      /* fail silently */
    }
  }, [packType, defaultOrder]);

  return { order, setOrder, resetToDefault };
}
