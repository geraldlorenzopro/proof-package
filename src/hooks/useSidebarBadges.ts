/**
 * useSidebarBadges — Real counts for sidebar item badges (non-demo mode).
 *
 * - consultations: pre_intakes / consultations pending review
 * - cases: client_cases with deadline within next 7 days
 * - leads: leads created in last 24h
 * - forms: case_tasks pending related to forms
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode, DEMO_SIDEBAR_BADGES } from "./useDemoData";

export interface SidebarBadges {
  consultations: number;
  cases: number;
  leads: number;
  forms: number;
}

const EMPTY: SidebarBadges = { consultations: 0, cases: 0, leads: 0, forms: 0 };

export function useSidebarBadges(accountId: string | null): SidebarBadges {
  const demoMode = useDemoMode();
  const [badges, setBadges] = useState<SidebarBadges>(EMPTY);

  useEffect(() => {
    if (demoMode) {
      setBadges({
        consultations: DEMO_SIDEBAR_BADGES.consultations_today,
        cases: DEMO_SIDEBAR_BADGES.cases,
        leads: DEMO_SIDEBAR_BADGES.leads,
        forms: DEMO_SIDEBAR_BADGES.forms,
      });
      return;
    }
    if (!accountId) {
      setBadges(EMPTY);
      return;
    }
    let cancelled = false;

    void (async () => {
      const now = new Date();
      const in7d = new Date(Date.now() + 7 * 86400000).toISOString();
      const last24h = new Date(Date.now() - 24 * 3600000).toISOString();

      // Note: `leads` and `pre_intakes` tables do not exist; mapped to
      // `consultations` (status pending) and `client_profiles` (last 24h).
      // `case_deadlines` column is `deadline_date`, not `due_date`.
      // Bug fix: el CHECK constraint de consultations.status solo permite
      // 'active','completed','abandoned'. Antes filtrábamos por valores
      // que NO existen en el ENUM ('pending','scheduled','in_review') → 0
      // garantizado. Ahora usamos 'active' (consulta iniciada pero sin
      // ended_at) que es la semántica real de "pendiente".
      const [consultRes, casesRes, leadsRes, formsRes] = await Promise.all([
        supabase
          .from("consultations" as any)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("status", "active"),

        supabase
          .from("case_deadlines" as any)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("deadline_date", now.toISOString())
          .lte("deadline_date", in7d),

        supabase
          .from("client_profiles" as any)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("created_at", last24h),

        supabase
          .from("case_tasks" as any)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("status", "pending")
          .ilike("title", "%form%"),
      ]);

      if (cancelled) return;

      setBadges({
        consultations: consultRes.error ? 0 : (consultRes.count ?? 0),
        cases: casesRes.error ? 0 : (casesRes.count ?? 0),
        leads: leadsRes.error ? 0 : (leadsRes.count ?? 0),
        forms: formsRes.error ? 0 : (formsRes.count ?? 0),
      });
    })();

    return () => { cancelled = true; };
  }, [accountId, demoMode]);

  return badges;
}
