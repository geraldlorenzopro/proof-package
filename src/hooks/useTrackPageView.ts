/**
 * useTrackPageView — dispara `page.view` cuando un componente de página monta.
 *
 * Uso:
 *   function HubPage() {
 *     useTrackPageView("hub.dashboard");
 *     return <div>...</div>;
 *   }
 *
 * Por qué un nombre lógico ("hub.dashboard") en vez del pathname literal:
 *   - Pathnames con :param explotan el cardinality (1 evento por caso)
 *   - El nombre lógico permite agregar en dashboards sin regex
 *   - El pathname real ya se infiere de `window.location.pathname`
 *     y se loguea en properties para drill-down
 *
 * Convención de nombres lógicos:
 *   - hub.{section}        ej. hub.dashboard, hub.cases, hub.consultations
 *   - case_engine.{tab}    ej. case_engine.overview, case_engine.tasks
 *   - tools.{tool}         ej. tools.uscis_analyzer, tools.cspa
 *   - admin.{section}      ej. admin.dashboard, admin.firms
 *   - public.{page}        ej. public.case_track, public.intake
 *   - auth.{flow}          ej. auth.login, auth.signup, auth.reset
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";

export function useTrackPageView(
  viewName: string,
  extraProps?: Record<string, unknown>
): void {
  const location = useLocation();

  useEffect(() => {
    if (!viewName) return;
    void trackEvent("page.view", {
      properties: {
        view: viewName,
        pathname: location.pathname,
        search: location.search || undefined,
        ...extraProps,
      },
    });
    // H4 fix (audit ronda 2): re-dispara también cuando cambia el query string.
    // Esto captura tabs URL-synced del Case Engine (?tab=tareas vs ?tab=overview),
    // filtros guardados en URL, paginación, etc. Antes el comentario decía que
    // esto funcionaba pero solo monitoreábamos pathname → tabs invisibles en
    // funnels analytics.
  }, [viewName, location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps
}
