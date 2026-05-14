import { AlertCircle, ArrowRight } from "lucide-react";

interface Props {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

export default function ActionBanner({ title, body, actionLabel, onAction }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg">
      <div className="w-8 h-8 rounded-md bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
        <AlertCircle className="w-4 h-4 text-rose-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-rose-200 leading-tight">{title}</div>
        <div className="text-[11px] text-rose-200/70 leading-tight mt-0.5">{body}</div>
      </div>
      <button
        onClick={onAction}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-semibold rounded-md transition-colors"
      >
        {actionLabel}
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
