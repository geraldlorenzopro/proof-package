/**
 * OperativeFeed — pantalla principal "morning briefing" de NER.
 *
 * Muestra a la paralegal las 5 cosas más urgentes del día,
 * priorizadas por algoritmo server-side (feed-builder edge function).
 *
 * Diseño guiado por Vanessa (paralegal hispana 45 años):
 * - 5 items max (ni 3 que parece poco, ni 15 que abruma)
 * - Mobile-first (3 visibles sin scroll en iPad)
 * - Botones grandes (clickeables con una mano)
 * - Sin animaciones que entorpezcan en 4G
 * - Empty state nunca vacío (muestra próximos 14 días)
 */

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle, Calendar, CheckSquare, Clock,
  FileText, FolderOpen, Sparkles, RefreshCw, ChevronRight,
} from "lucide-react";
import { useFeed } from "@/hooks/useFeed";
import type { FeedItem, FeedItemKind, FeedItemSeverity } from "@/types/feed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  accountId?: string | null;
  /** Nombre de la paralegal para el saludo */
  staffName?: string;
}

const KIND_ICON: Record<FeedItemKind, typeof AlertTriangle> = {
  deadline_overdue: AlertTriangle,
  deadline_upcoming: Clock,
  task_pending: CheckSquare,
  doc_uploaded: FileText,
  intake_completed: FolderOpen,
  case_stale: Calendar,
};

const SEVERITY_STYLES: Record<FeedItemSeverity, {
  border: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  scoreColor: string;
}> = {
  critical: {
    border: "border-red-500/40",
    bg: "bg-gradient-to-br from-red-500/10 to-red-500/[0.02]",
    iconBg: "bg-red-500/15 border-red-500/30",
    iconColor: "text-red-400",
    scoreColor: "text-red-400",
  },
  high: {
    border: "border-amber-500/40",
    bg: "bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02]",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconColor: "text-amber-400",
    scoreColor: "text-amber-400",
  },
  medium: {
    border: "border-sky-500/30",
    bg: "bg-gradient-to-br from-sky-500/[0.06] to-sky-500/[0.01]",
    iconBg: "bg-sky-500/10 border-sky-500/25",
    iconColor: "text-sky-400",
    scoreColor: "text-sky-400",
  },
  low: {
    border: "border-border",
    bg: "bg-card/50",
    iconBg: "bg-muted/50 border-border",
    iconColor: "text-muted-foreground",
    scoreColor: "text-muted-foreground",
  },
};

export default function OperativeFeed({ accountId = null, staffName }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch, isRefetching } = useFeed(accountId);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = (staffName ?? "").split(" ")[0] || "";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header con saludo */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            {data?.totalPotential
              ? ` · ${data.totalPotential} cosas en tu radar`
              : ""}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refrescar feed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && <FeedSkeleton />}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">
            No pudimos cargar tu feed
          </p>
          <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState data={data} />
      )}

      {/* Items */}
      {!isLoading && !error && data && data.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.items.map((item, idx) => (
            <FeedItemCard
              key={item.id}
              item={item}
              index={idx}
              onClick={() => navigate(item.actionHref)}
            />
          ))}

          {data.totalPotential > data.items.length && (
            <div className="text-center mt-2">
              <button
                onClick={() => navigate("/hub/cases")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                + {data.totalPotential - data.items.length} más en
                <span className="underline ml-1">todos los casos</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card de un item del feed ─────────────────────────────────────────────────

interface CardProps {
  item: FeedItem;
  index: number;
  onClick: () => void;
}

function FeedItemCard({ item, index, onClick }: CardProps) {
  const Icon = KIND_ICON[item.kind] ?? AlertTriangle;
  const styles = SEVERITY_STYLES[item.severity];

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      onClick={onClick}
      className={`group text-left w-full rounded-2xl border ${styles.border} ${styles.bg} p-4 sm:p-5 transition-all hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-jarvis/40`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Icon */}
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${styles.iconBg} border flex items-center justify-center shrink-0`}
        >
          <Icon className={`w-5 h-5 ${styles.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-foreground leading-tight truncate">
            {item.title}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {item.subtitle}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${styles.scoreColor}`}
            >
              {item.actionLabel}
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Empty state inteligente ─────────────────────────────────────────────────

function EmptyState({ data }: { data: { emptyState?: { message: string; nextDeadlines?: { date: string; title: string }[] } } }) {
  const next = data.emptyState?.nextDeadlines ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Todo al día</h3>
          <p className="text-xs text-muted-foreground">
            {data.emptyState?.message ?? "Sin urgencias por ahora."}
          </p>
        </div>
      </div>

      {next.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2 font-semibold">
            Próximos deadlines (14 días)
          </p>
          <ul className="space-y-1.5">
            {next.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs text-muted-foreground">
                  {format(new Date(d.date), "d MMM", { locale: es })}
                </span>
                <span className="text-foreground truncate">{d.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton mientras carga ─────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card/30 p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-1/3 rounded mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
