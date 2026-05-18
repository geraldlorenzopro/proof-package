/**
 * useWeekendEvents — Hub Inicio v7 Fase D
 *
 * "N cosas pasaron mientras no estuviste" — agrega leads nuevos, USCIS
 * updates, RFEs recibidos y docs subidos desde la última sesión (viernes
 * 5pm si es lunes mañana, sino 24h atrás).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WeekendEvent {
  type: "leads_new" | "uscis_updates" | "rfe_received" | "docs_uploaded" | "messages_unread" | "money_collected";
  count: number;
  display: string;
  detail: string;
  href: string;
  color: "cyan" | "blue" | "rose" | "purple" | "orange" | "emerald";
}

interface State {
  events: WeekendEvent[];
  totalCount: number;
  sinceLabel: string;
  loading: boolean;
}

function getLastSessionStart(): { date: Date; label: string } {
  const now = new Date();
  const day = now.getDay();
  if (day === 1 && now.getHours() < 18) {
    const friday = new Date(now);
    friday.setDate(now.getDate() - 3);
    friday.setHours(17, 0, 0, 0);
    return { date: friday, label: "desde viernes 5pm" };
  }
  return { date: new Date(now.getTime() - 24 * 3600_000), label: "últimas 24h" };
}

export function useWeekendEvents(accountId: string | null): State {
  const [state, setState] = useState<State>({
    events: [], totalCount: 0, sinceLabel: "", loading: true,
  });

  useEffect(() => {
    if (!accountId) {
      setState({ events: [], totalCount: 0, sinceLabel: "", loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const { date: since, label } = getLastSessionStart();
      const sinceIso = since.toISOString();

      const [leadsRes, uscisRes, rfeRes, docsRes] = await Promise.all([
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("created_at", sinceIso),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("updated_at", sinceIso)
          .not("status", "in", "(completed,archived,cancelled)"),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("rfe_deadline", "is", null)
          .gte("updated_at", sinceIso),
        supabase.from("case_documents" as any).select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("created_at", sinceIso),
      ]);

      if (cancelled) return;

      const events: WeekendEvent[] = [
        {
          type: "leads_new",
          count: leadsRes.count ?? 0,
          display: `${leadsRes.count ?? 0}`,
          detail: "leads nuevos\nde FB Ads",
          href: "/hub/leads",
          color: "cyan",
        },
        {
          type: "uscis_updates",
          count: uscisRes.count ?? 0,
          display: `${uscisRes.count ?? 0}`,
          detail: "USCIS updates\ncase status",
          href: "/hub/cases",
          color: "blue",
        },
        {
          type: "rfe_received",
          count: rfeRes.count ?? 0,
          display: `${rfeRes.count ?? 0}`,
          detail: (rfeRes.count ?? 0) === 1 ? "RFE recibido" : "RFEs recibidos",
          href: "/hub/cases?filter=at-risk",
          color: "rose",
        },
        {
          type: "docs_uploaded",
          count: docsRes.count ?? 0,
          display: `${docsRes.count ?? 0}`,
          detail: "docs subidos\npor clientes",
          href: "/hub/clients",
          color: "purple",
        },
        {
          type: "messages_unread",
          count: 0,
          display: "—",
          detail: "mensajes\nsin responder",
          href: "/hub/chat",
          color: "orange",
        },
        {
          type: "money_collected",
          count: 0,
          display: "$0",
          detail: "cobrado\n0 invoices",
          href: "/hub/reports",
          color: "emerald",
        },
      ];

      const totalCount = events.reduce((sum, e) => sum + e.count, 0);

      setState({ events, totalCount, sinceLabel: label, loading: false });
    })();

    return () => { cancelled = true; };
  }, [accountId]);

  return state;
}
