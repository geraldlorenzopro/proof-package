/**
 * QuickAskCamila — Quick prompts contextuales en Hub Inicio (Ola 5.b).
 *
 * Implementa el "AI Chat contextual" del plano: en lugar de obligar al
 * paralegal a abrir Camila y escribir la pregunta, se le ofrecen 4-5
 * preguntas comunes como buttons. Click → dispatch event `camila:open`
 * con la pregunta pre-cargada → CamilaFloatingPanel se abre con la
 * respuesta empezando a streamear.
 *
 * Reusa el infrastructure existente de CamilaFloatingPanel (event listener
 * `camila:open` en línea 304 del archivo). NO duplica código.
 *
 * Tracking:
 *   - `hub.quick_ask_clicked` con la pregunta y el slot index
 */

import { Sparkles, ArrowUpRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface QuickPrompt {
  slug: string;
  label: string;
  question: string;
}

// Curated prompts — contextual para el día a día del paralegal.
// Cada uno está optimizado para que Camila responda con data del account_id
// activo (la edge fn camila-chat conoce el contexto).
const QUICK_PROMPTS: QuickPrompt[] = [
  {
    slug: "casos_atrasados",
    label: "¿Casos atrasados?",
    question: "¿Qué casos están atrasados o sin actividad reciente? Listame los 5 más críticos.",
  },
  {
    slug: "tareas_dia",
    label: "Tareas del día",
    question: "¿Qué tareas tengo pendientes para hoy? Priorizalas por urgencia.",
  },
  {
    slug: "proximas_entrevistas",
    label: "Próximas entrevistas",
    question: "¿Qué entrevistas USCIS/NVC/embajada tengo programadas en los próximos 7 días?",
  },
  {
    slug: "rfes_pendientes",
    label: "RFEs pendientes",
    question: "¿Hay algún RFE pendiente de respuesta? Mostrame deadlines y casos afectados.",
  },
];

interface Props {
  /** Demo mode: prompts se ven pero el dispatch puede no responder. */
  isDemo?: boolean;
}

export default function QuickAskCamila({ isDemo = false }: Props) {
  function handleAsk(prompt: QuickPrompt) {
    void trackEvent("hub.quick_ask_clicked", {
      properties: {
        prompt_slug: prompt.slug,
        prompt_index: QUICK_PROMPTS.findIndex((p) => p.slug === prompt.slug),
      },
    });

    if (isDemo) {
      // En demo no disparamos el chat porque puede no tener accountId real
      return;
    }

    // Dispatch event que CamilaFloatingPanel escucha (línea 304 del archivo).
    // El panel abre + envía el mensaje automáticamente.
    window.dispatchEvent(
      new CustomEvent("camila:open", {
        detail: { message: prompt.question },
      })
    );
  }

  return (
    <section className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">Pregúntale a Camila</h3>
          <p className="text-[10px] text-muted-foreground">
            Atajo a preguntas comunes — click y Camila responde
          </p>
        </div>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt.slug}
            onClick={() => handleAsk(prompt)}
            className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/30 bg-background/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            title={prompt.question}
          >
            <span className="text-xs font-medium truncate">{prompt.label}</span>
            <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
