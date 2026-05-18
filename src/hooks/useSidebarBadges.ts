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

export interface SidebarBadges {
  consultations: number;
  cases: number;
  leads: number;
  forms: number;
}

const EMPTY: SidebarBadges = { consultations: 0, cases: 0, leads: 0, forms: 0 };

export function useSidebarBadges(accountId: string | null): SidebarBadges {
  const [badges, setBadges] = useState<SidebarBadges>(EMPTY);

  useEffect(() => {
    if (!accountId) {
      setBadges(EMPTY);
      return;
    }
    let cancelled = false;

    void (async () => {
      const now = new Date();
      const in7d = new Date(Date.now() + 7 * 86400000).toISOString();
      const last24h = new Date(Date.now() - 24 * 3600000).toISOString();

      const [consultRes, casesRes, leadsRes, formsRes] = await Promise.all([
        supabase
          .from("pre_intakes" as any)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .in("status", ["pending", "submitted", "in_review"]),

        supabase
          .from("case_deadlines" as any)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("due_date", now.toISOString())
          .lte("due_date", in7d),

        supabase
          .from("leads" as any)
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
        consultations: consultRes.count ?? 0,
        cases: casesRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        forms: formsRes.count ?? 0,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId]);

  return badges;
}
