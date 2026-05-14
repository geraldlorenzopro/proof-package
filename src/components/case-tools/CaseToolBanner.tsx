import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link as LinkIcon } from "lucide-react";
import { useCaseContext, getBackToCasePath } from "./useCaseContext";

/**
 * Banner que aparece SOLO si el tool fue invocado desde un case engine
 * (URL trae ?case_id=X). Si no, no renderiza nada y el tool funciona
 * standalone como siempre.
 *
 * Diseño: minimal, sticky top, una sola línea. No invade el tool.
 */
export default function CaseToolBanner({ toolLabel }: { toolLabel: string }) {
  const navigate = useNavigate();
  const ctx = useCaseContext();
  const backPath = getBackToCasePath(ctx);

  if (!ctx.caseId || !backPath) return null;

  return (
    <div className="sticky top-0 z-40 bg-jarvis/10 border-b border-jarvis/30 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-2 min-w-0">
          <LinkIcon className="w-3.5 h-3.5 text-jarvis shrink-0" />
          <span className="text-jarvis/90 font-medium truncate">
            {toolLabel} · vinculado al caso{" "}
            <code className="font-mono text-jarvis bg-jarvis/10 px-1.5 py-0.5 rounded text-[11px]">
              {ctx.caseId}
            </code>
          </span>
        </div>
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold text-jarvis hover:bg-jarvis/15 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3 h-3" />
          Volver al caso
        </button>
      </div>
    </div>
  );
}
