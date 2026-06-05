/**
 * useCloseOnScroll — Hook helper para popovers con createPortal + position:fixed
 * que NO actualizan su posición durante scroll.
 *
 * Round 9.30 Mr. Lorenzo screenshot: el dropdown de "Tipo de proceso"
 * (CaseTypeInlineEdit) calcula su posición UNA vez al abrir vía
 * getBoundingClientRect. Cuando el usuario scrollea la página o la
 * tabla virtualizada, el trigger baja pero el popover queda flotando
 * en pixels viejos → disconectado del anchor.
 *
 * Misma situación en CaseStageInlineEdit, CaseOwnerInlineEdit,
 * ResponsibleInlineEdit, CaseTypeFilterDropdown.
 *
 * Solución: cerrar el popover en cualquier scroll. Patrón estándar
 * de Notion / Linear / Airtable. Más simple que actualizar posición
 * en tiempo real, evita race conditions con virtualizer.
 *
 * Uso:
 *   useCloseOnScroll(open, () => setOpen(false));
 *
 * Nota: `capture: true` en el listener captura scroll en CUALQUIER
 * ancestor (incluyendo el virtualizer parent), no solo window.
 */
import { useEffect } from "react";

export function useCloseOnScroll(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    function handleScroll(e: Event) {
      // No cerrar si el scroll es DENTRO del popover (su lista interna)
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-popover-internal-scroll]")) return;
      onClose();
    }
    // capture: true para detectar scroll en cualquier ancestor + virtualizer
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [open, onClose]);
}
