/**
 * SubStageInput — Input de sub_stage con autocomplete contextual al lane.
 *
 * Fase 4 catálogo (2026-06-03). Usa <datalist> nativo HTML5 + statuses
 * sugeridos por lane de subStageHints.ts. Compatible con cualquier lane.
 *
 * Flujo:
 *   1. Paralegal hace focus en input
 *   2. Browser muestra dropdown con hints específicos del lane actual
 *   3. Paralegal puede elegir uno o escribir libre (sin penalidad)
 *   4. onChange dispara con el valor final
 *
 * No requiere portal ni librería — datalist es nativo, accesible, mobile-safe.
 */
import { getSubStageHints, getSubStageDatalistId } from "@/lib/subStageHints";
import type { PipelineStageKey } from "@/hooks/useCasePipeline";

interface Props {
  /** Lane actual del caso (uscis/nvc/embajada/etc.) — define los hints. */
  lane: PipelineStageKey | null | undefined;
  /** Valor actual del sub_stage. */
  value: string;
  /** Callback cuando cambia el valor. */
  onChange: (next: string) => void;
  /** Placeholder cuando vacío. */
  placeholder?: string;
  /** Disabled (ej. read-only por permisos). */
  disabled?: boolean;
  /** Clases extra para el input. */
  className?: string;
  /** Max length del input. Default 80. */
  maxLength?: number;
}

export default function SubStageInput({
  lane,
  value,
  onChange,
  placeholder = "Ej. Biométricos programados",
  disabled = false,
  className = "",
  maxLength = 80,
}: Props) {
  const hints = getSubStageHints(lane);
  const datalistId = getSubStageDatalistId(lane);

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={hints.length > 0 ? datalistId : undefined}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={`w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-[12px] text-white placeholder:text-slate-500 focus:border-cyan-accent focus:outline-none disabled:opacity-50 ${className}`}
      />
      {hints.length > 0 && (
        <datalist id={datalistId}>
          {hints.map((hint) => (
            <option key={hint} value={hint} />
          ))}
        </datalist>
      )}
    </>
  );
}
